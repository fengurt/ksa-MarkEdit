use anyhow::{Context, Result, anyhow, bail};
use base64::{Engine, engine::general_purpose::STANDARD};
use clap::{Parser, Subcommand, ValueEnum};
use hmac::{Hmac, Mac};
use reqwest::header::{AUTHORIZATION, HeaderMap, HeaderValue, USER_AGENT};
use serde::{Deserialize, Serialize};
use sha1::{Digest as Sha1Digest, Sha1};
use sha2::Sha256;
use std::{
    collections::BTreeMap,
    fs::{self, OpenOptions},
    io::Write,
    path::{Component, Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use uuid::Uuid;
use vault_protocol::{
    CapabilityGrantV1, ObjectKindV1, PermissionV1, SignedManifestV1, VaultMasterKey, VaultObjectV1,
    canonical_cbor, decode_cbor, decrypt_object, decrypt_path, digest_cbor, hpke_seal,
    recovery_phrase, verify_manifest,
};

#[derive(Parser)]
#[command(
    about = "Independent backup and disaster-recovery utility for kmd",
    version
)]
struct Args {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Initialize a brand-new empty Vault and its recovery package.
    /// Never use this command to create a package for an existing Vault.
    InitNewVault {
        #[arg(long)]
        vault_id: Uuid,
        #[arg(long)]
        output: PathBuf,
    },
    /// Validate a package without contacting a backup provider.
    VerifyKit {
        #[arg(long)]
        kit: PathBuf,
    },
    /// Create an expiring, whole-Vault, read-only Agent capability.
    CreateAgentGrant {
        #[arg(long)]
        kit: PathBuf,
        /// SEC1-encoded P-256 HPKE public key in hexadecimal.
        #[arg(long)]
        agent_public_key: String,
        #[arg(long, default_value_t = 24)]
        expires_hours: u64,
        #[arg(long)]
        output: PathBuf,
    },
    /// Restore source Markdown and, when present, attachments.
    Restore {
        #[arg(long)]
        kit: PathBuf,
        #[arg(long)]
        output: PathBuf,
        #[arg(long, value_enum, default_value_t = Source::Cos)]
        source: Source,
        /// Directory containing manifest/latest.cbor and objects/<version>.cbor.
        #[arg(long)]
        source_directory: Option<PathBuf>,
        /// owner/repository override for a GitHub backup.
        #[arg(long)]
        github_repository: Option<String>,
        /// Environment variable holding a GitHub installation token.
        #[arg(long, default_value = "GITHUB_TOKEN")]
        github_token_env: String,
        #[arg(long)]
        overwrite: bool,
    },
}

#[derive(Clone, Copy, ValueEnum)]
enum Source {
    Cos,
    Github,
    Directory,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RecoveryKit {
    protocol_version: u16,
    vault_id: Uuid,
    #[serde(default = "default_api_base")]
    api_base: String,
    recovery_phrase: String,
    recovery_token: String,
    #[serde(default)]
    github_repository: Option<String>,
    #[serde(default)]
    created_at: Option<String>,
    #[serde(default)]
    checksum: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RecoveryPackageV2 {
    protocol_version: u16,
    vault_id: Uuid,
    recovery_phrase: String,
    recovery_token: String,
    created_at: String,
    checksum: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentGrantPackageV1 {
    protocol_version: u16,
    vault_id: Uuid,
    grant_id: Uuid,
    revocation_id: Uuid,
    expires_unix_ms: i64,
    access_token: String,
    encrypted_grant: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RecoveryCatalog {
    protocol_version: u16,
    vault_id: Uuid,
    manifest: CatalogManifest,
    objects: Vec<CatalogObject>,
    cos: CosGrant,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CatalogManifest {
    sequence: u64,
    digest: String,
    signed_cbor: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CatalogObject {
    object_id: Uuid,
    kind: String,
    cipher_size: u64,
    digest: String,
    object_key: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CosGrant {
    bucket: String,
    region: String,
    prefix: String,
    expiration: Option<String>,
    credentials: CosCredentials,
}

#[derive(Deserialize)]
#[serde(rename_all = "PascalCase")]
struct CosCredentials {
    token: String,
    tmp_secret_id: String,
    tmp_secret_key: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RestoreReport {
    vault_id: Uuid,
    manifest_sequence: u64,
    restored_files: usize,
    restored_attachments: usize,
    missing_objects: Vec<Uuid>,
}

type BackupPayload = (Vec<u8>, BTreeMap<Uuid, Vec<u8>>, u64);

#[tokio::main]
async fn main() -> Result<()> {
    match Args::parse().command {
        Command::InitNewVault { vault_id, output } => init_new_vault(vault_id, output),
        Command::VerifyKit { kit } => {
            let kit = read_kit(&kit)?;
            VaultMasterKey::from_recovery_phrase(&kit.recovery_phrase)
                .context("invalid recovery phrase")?;
            STANDARD
                .decode(&kit.recovery_token)
                .context("invalid recovery token")?;
            println!(
                "{}",
                serde_json::to_string_pretty(&serde_json::json!({
                    "valid": true,
                    "protocolVersion": kit.protocol_version,
                    "vaultId": kit.vault_id
                }))?
            );
            Ok(())
        }
        Command::CreateAgentGrant {
            kit,
            agent_public_key,
            expires_hours,
            output,
        } => create_agent_grant(read_kit(&kit)?, &agent_public_key, expires_hours, output),
        Command::Restore {
            kit,
            output,
            source,
            source_directory,
            github_repository,
            github_token_env,
            overwrite,
        } => {
            let kit = read_kit(&kit)?;
            prepare_output(&output, overwrite)?;
            let client = reqwest::Client::builder()
                .https_only(matches!(source, Source::Cos | Source::Github))
                .timeout(std::time::Duration::from_secs(60))
                .build()?;
            let (signed_manifest, objects, sequence) = match source {
                Source::Cos => fetch_cos(&client, &kit).await?,
                Source::Github => {
                    let repository = github_repository
                        .or_else(|| kit.github_repository.clone())
                        .ok_or_else(|| anyhow!("GitHub repository is missing"))?;
                    let token = std::env::var(&github_token_env)
                        .with_context(|| format!("{github_token_env} is not set"))?;
                    fetch_github(&client, &repository, &token).await?
                }
                Source::Directory => {
                    let directory = source_directory
                        .ok_or_else(|| anyhow!("--source-directory is required"))?;
                    fetch_directory(&directory)?
                }
            };
            let report = restore(
                &kit,
                &output,
                &signed_manifest,
                &objects,
                sequence,
                overwrite,
            )?;
            println!("{}", serde_json::to_string_pretty(&report)?);
            if !report.missing_objects.is_empty() {
                bail!(
                    "{} encrypted objects were unavailable; source Markdown that was present was restored",
                    report.missing_objects.len()
                );
            }
            Ok(())
        }
    }
}

fn create_agent_grant(
    kit: RecoveryKit,
    agent_public_key: &str,
    expires_hours: u64,
    output: PathBuf,
) -> Result<()> {
    if output.exists() {
        bail!("refusing to overwrite existing Agent grant package");
    }
    if !(1..=24 * 30).contains(&expires_hours) {
        bail!("Agent grant duration must be between 1 hour and 30 days");
    }
    let public_key = hex::decode(agent_public_key).context("decode Agent public key")?;
    if public_key.len() != 65 {
        bail!("Agent HPKE public key must be an uncompressed P-256 point");
    }
    let master_key = VaultMasterKey::from_recovery_phrase(&kit.recovery_phrase)?;
    let grant_id = Uuid::new_v4();
    let revocation_id = Uuid::new_v4();
    let expires_unix_ms = (SystemTime::now().duration_since(UNIX_EPOCH)?.as_millis()
        + u128::from(expires_hours) * 60 * 60 * 1_000)
        .try_into()
        .context("Agent grant expiration exceeds the protocol range")?;
    let wrapped_capability_key = hpke_seal(
        &public_key,
        master_key.expose_for_wrapping(),
        grant_id.as_bytes(),
    )?;
    let grant = CapabilityGrantV1 {
        protocol_version: 1,
        grant_id,
        agent_hpke_public_key: public_key,
        permission: PermissionV1::ReadOnly,
        allowed_path_prefixes: vec![],
        allowed_tag_identities: vec![],
        expires_unix_ms,
        revocation_id,
        wrapped_capability_key,
    };
    let mut access_token = [0_u8; 32];
    getrandom::fill(&mut access_token).map_err(|_| anyhow!("secure randomness unavailable"))?;
    let package = AgentGrantPackageV1 {
        protocol_version: 1,
        vault_id: kit.vault_id,
        grant_id,
        revocation_id,
        expires_unix_ms,
        access_token: STANDARD.encode(access_token),
        encrypted_grant: STANDARD.encode(canonical_cbor(&grant)?),
    };
    write_private_json(&output, &package)?;
    println!(
        "Read-only Agent grant created at {}. Treat its access token as a secret.",
        output.display()
    );
    Ok(())
}

fn init_new_vault(vault_id: Uuid, output: PathBuf) -> Result<()> {
    if output.exists() {
        bail!("refusing to overwrite existing recovery package");
    }
    let key = VaultMasterKey::generate()?;
    let mut token = [0_u8; 32];
    getrandom::fill(&mut token).map_err(|_| anyhow!("secure randomness unavailable"))?;
    let recovery_phrase = recovery_phrase(&key)?;
    let recovery_token = STANDARD.encode(token);
    let created_at = chrono::Utc::now().to_rfc3339();
    let checksum =
        recovery_package_checksum(vault_id, &recovery_phrase, &recovery_token, &created_at)?;
    let kit = RecoveryPackageV2 {
        protocol_version: 2,
        vault_id,
        recovery_phrase,
        recovery_token,
        created_at,
        checksum,
    };
    write_private_json(&output, &kit)?;
    println!(
        "New empty Vault recovery package created at {}. It is not a package for any existing Vault.",
        output.display()
    );
    Ok(())
}

fn write_private_json(path: &Path, value: &impl Serialize) -> Result<()> {
    let bytes = serde_json::to_vec_pretty(value)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(path)?;
    file.write_all(&bytes)?;
    file.sync_all()?;
    Ok(())
}

fn read_kit(path: &Path) -> Result<RecoveryKit> {
    let kit: RecoveryKit =
        serde_json::from_slice(&fs::read(path).context("read recovery package")?)
            .context("parse recovery package")?;
    if !matches!(kit.protocol_version, 1 | 2) {
        bail!("unsupported recovery package version");
    }
    if kit.protocol_version == 2 {
        let created_at = kit
            .created_at
            .as_deref()
            .ok_or_else(|| anyhow!("recovery package creation time is missing"))?;
        let expected = recovery_package_checksum(
            kit.vault_id,
            &kit.recovery_phrase,
            &kit.recovery_token,
            created_at,
        )?;
        if kit.checksum.as_deref() != Some(expected.as_str()) {
            bail!("recovery package checksum mismatch");
        }
    }
    Ok(kit)
}

fn recovery_package_checksum(
    vault_id: Uuid,
    recovery_phrase: &str,
    recovery_token: &str,
    created_at: &str,
) -> Result<String> {
    let value = BTreeMap::from([
        ("createdAt", serde_json::json!(created_at)),
        ("protocolVersion", serde_json::json!(2)),
        ("recoveryPhrase", serde_json::json!(recovery_phrase)),
        ("recoveryToken", serde_json::json!(recovery_token)),
        ("vaultId", serde_json::json!(vault_id)),
    ]);
    Ok(hex::encode(Sha256::digest(serde_json::to_vec(&value)?)))
}

fn default_api_base() -> String {
    "https://api.notes.apuch.cn".to_owned()
}

fn prepare_output(path: &Path, overwrite: bool) -> Result<()> {
    if path.exists() {
        if !path.is_dir() {
            bail!("restore output must be a directory");
        }
        if !overwrite && fs::read_dir(path)?.next().is_some() {
            bail!("restore output is not empty; pass --overwrite to merge safely");
        }
    } else {
        fs::create_dir_all(path)?;
    }
    Ok(())
}

async fn fetch_cos(client: &reqwest::Client, kit: &RecoveryKit) -> Result<BackupPayload> {
    let response = client
        .post(format!(
            "{}/api/v1/recovery/{}/catalog",
            kit.api_base, kit.vault_id
        ))
        .json(&serde_json::json!({"recoveryToken": kit.recovery_token}))
        .send()
        .await
        .context("request COS recovery catalog")?
        .error_for_status()
        .context("COS recovery authorization failed")?;
    let catalog: RecoveryCatalog = response.json().await.context("parse recovery catalog")?;
    if catalog.protocol_version != 1 || catalog.vault_id != kit.vault_id {
        bail!("recovery catalog does not match the package");
    }
    let signed_manifest = STANDARD
        .decode(&catalog.manifest.signed_cbor)
        .context("decode signed manifest")?;
    if hex::encode(Sha256::digest(&signed_manifest)) != catalog.manifest.digest {
        bail!("recovery catalog manifest digest mismatch");
    }
    let _ = (&catalog.cos.prefix, &catalog.cos.expiration);
    let mut objects = BTreeMap::new();
    for object in catalog.objects {
        let bytes = cos_get(client, &catalog.cos, &object.object_key)
            .await
            .with_context(|| format!("download COS object {}", object.object_id))?;
        if bytes.len() as u64 != object.cipher_size
            || hex::encode(Sha256::digest(&bytes)) != object.digest
        {
            bail!(
                "COS object {} failed size or digest validation",
                object.object_id
            );
        }
        let _ = object.kind;
        objects.insert(object.object_id, bytes);
    }
    Ok((signed_manifest, objects, catalog.manifest.sequence))
}

async fn cos_get(client: &reqwest::Client, grant: &CosGrant, object_key: &str) -> Result<Vec<u8>> {
    if object_key.starts_with('/') || object_key.split('/').any(|value| value == "..") {
        bail!("invalid COS object key");
    }
    let host = format!("{}.cos.{}.myqcloud.com", grant.bucket, grant.region);
    let encoded_key = object_key
        .split('/')
        .map(percent_encode)
        .collect::<Vec<_>>()
        .join("/");
    let path = format!("/{encoded_key}");
    let authorization = cos_authorization(
        "get",
        &host,
        &path,
        &grant.credentials.token,
        &grant.credentials.tmp_secret_id,
        &grant.credentials.tmp_secret_key,
    )?;
    let response = client
        .get(format!("https://{host}{path}"))
        .header("Host", &host)
        .header("x-cos-security-token", &grant.credentials.token)
        .header(AUTHORIZATION, authorization)
        .send()
        .await?
        .error_for_status()?;
    Ok(response.bytes().await?.to_vec())
}

fn cos_authorization(
    method: &str,
    host: &str,
    path: &str,
    token: &str,
    secret_id: &str,
    secret_key: &str,
) -> Result<String> {
    let now = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();
    let key_time = format!("{now};{}", now + 600);
    let header_list = "host;x-cos-security-token";
    let canonical_headers = format!(
        "host={}&x-cos-security-token={}",
        percent_encode(&host.to_ascii_lowercase()),
        percent_encode(token)
    );
    let http_string = format!(
        "{}\n{}\n\n{}\n",
        method.to_ascii_lowercase(),
        path,
        canonical_headers
    );
    let string_to_sign = format!(
        "sha1\n{key_time}\n{}\n",
        hex::encode(Sha1::digest(http_string.as_bytes()))
    );
    let sign_key = hmac_sha1(secret_key.as_bytes(), key_time.as_bytes())?;
    let signature = hex::encode(hmac_sha1(&sign_key, string_to_sign.as_bytes())?);
    Ok(format!(
        "q-sign-algorithm=sha1&q-ak={}&q-sign-time={}&q-key-time={}&q-header-list={}&q-url-param-list=&q-signature={}",
        percent_encode(secret_id),
        key_time,
        key_time,
        header_list,
        signature
    ))
}

async fn fetch_github(
    client: &reqwest::Client,
    repository: &str,
    token: &str,
) -> Result<BackupPayload> {
    validate_repository(repository)?;
    let manifest = github_content(client, repository, "manifest/latest.cbor", token).await?;
    let signed: SignedManifestV1 = decode_cbor(&manifest).context("decode GitHub manifest")?;
    verify_manifest(&signed).context("verify GitHub manifest")?;
    let mut objects = BTreeMap::new();
    for entry in &signed.manifest.entries {
        let path = format!("objects/{}.cbor", entry.current_version_id);
        match github_content(client, repository, &path, token).await {
            Ok(bytes) => {
                objects.insert(entry.current_version_id, bytes);
            }
            Err(error) => {
                eprintln!("warning: {path}: {error}");
            }
        }
    }
    Ok((manifest, objects, signed.manifest.sequence))
}

async fn github_content(
    client: &reqwest::Client,
    repository: &str,
    path: &str,
    token: &str,
) -> Result<Vec<u8>> {
    #[derive(Deserialize)]
    struct Content {
        content: String,
        encoding: String,
    }
    let mut headers = HeaderMap::new();
    headers.insert(
        USER_AGENT,
        HeaderValue::from_static("ksamint-vault-recovery"),
    );
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {token}"))?,
    );
    headers.insert(
        "X-GitHub-Api-Version",
        HeaderValue::from_static("2022-11-28"),
    );
    let content: Content = client
        .get(format!(
            "https://api.github.com/repos/{repository}/contents/{path}?ref=ksamint-backup"
        ))
        .headers(headers)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    if content.encoding != "base64" {
        bail!("unsupported GitHub content encoding");
    }
    STANDARD
        .decode(content.content.replace('\n', ""))
        .context("decode GitHub content")
}

fn fetch_directory(directory: &Path) -> Result<BackupPayload> {
    let manifest =
        fs::read(directory.join("manifest/latest.cbor")).context("read local signed manifest")?;
    let signed: SignedManifestV1 = decode_cbor(&manifest)?;
    verify_manifest(&signed)?;
    let mut objects = BTreeMap::new();
    for entry in &signed.manifest.entries {
        let path = directory
            .join("objects")
            .join(format!("{}.cbor", entry.current_version_id));
        if path.exists() {
            objects.insert(entry.current_version_id, fs::read(path)?);
        }
    }
    Ok((manifest, objects, signed.manifest.sequence))
}

fn restore(
    kit: &RecoveryKit,
    output: &Path,
    signed_manifest: &[u8],
    objects: &BTreeMap<Uuid, Vec<u8>>,
    sequence: u64,
    overwrite: bool,
) -> Result<RestoreReport> {
    let signed: SignedManifestV1 =
        decode_cbor(signed_manifest).context("decode signed manifest")?;
    verify_manifest(&signed).context("verify device manifest signature")?;
    if signed.manifest.vault_id != kit.vault_id || signed.manifest.sequence != sequence {
        bail!("manifest belongs to a different vault or sequence");
    }
    let key = VaultMasterKey::from_recovery_phrase(&kit.recovery_phrase)?;
    let mut report = RestoreReport {
        vault_id: kit.vault_id,
        manifest_sequence: sequence,
        restored_files: 0,
        restored_attachments: 0,
        missing_objects: Vec::new(),
    };
    for entry in &signed.manifest.entries {
        let Some(bytes) = objects.get(&entry.current_version_id) else {
            report.missing_objects.push(entry.current_version_id);
            continue;
        };
        let object: VaultObjectV1 = decode_cbor(bytes).context("decode encrypted object")?;
        if object.file_id != entry.file_id
            || object.version_id != entry.current_version_id
            || digest_cbor(&object)? != entry.object_digest
        {
            bail!("object identity or digest mismatch");
        }
        let relative = decrypt_path(&key, entry.file_id, &entry.encrypted_path)?;
        let target = safe_restore_path(output, &relative)?;
        if target.exists() && !overwrite {
            bail!("restore target already exists: {}", target.display());
        }
        let plaintext = decrypt_object(&key, &object, entry.byte_size as usize)?;
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)?;
        }
        atomic_write(&target, &plaintext)?;
        match object.kind {
            ObjectKindV1::Markdown => report.restored_files += 1,
            ObjectKindV1::Attachment => report.restored_attachments += 1,
            ObjectKindV1::VectorShard | ObjectKindV1::Manifest => {}
        }
    }
    Ok(report)
}

fn safe_restore_path(root: &Path, relative: &str) -> Result<PathBuf> {
    let path = Path::new(relative);
    if path.is_absolute()
        || path.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
    {
        bail!("manifest contains an unsafe path");
    }
    Ok(root.join(path))
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<()> {
    let temporary = path.with_extension(format!(
        "{}.restore-{}",
        path.extension()
            .and_then(|value| value.to_str())
            .unwrap_or("tmp"),
        Uuid::new_v4()
    ));
    {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)?;
        file.write_all(bytes)?;
        file.sync_all()?;
    }
    fs::rename(temporary, path)?;
    Ok(())
}

fn validate_repository(value: &str) -> Result<()> {
    let parts: Vec<_> = value.split('/').collect();
    if parts.len() != 2
        || parts
            .iter()
            .any(|part| part.is_empty() || !part.chars().all(github_name_character))
    {
        bail!("GitHub repository must be owner/name");
    }
    Ok(())
}

fn github_name_character(value: char) -> bool {
    value.is_ascii_alphanumeric() || matches!(value, '-' | '_' | '.')
}

fn percent_encode(value: &str) -> String {
    value
        .as_bytes()
        .iter()
        .map(|byte| {
            if byte.is_ascii_alphanumeric() || matches!(*byte, b'-' | b'.' | b'_' | b'~') {
                (*byte as char).to_string()
            } else {
                format!("%{byte:02X}")
            }
        })
        .collect()
}

fn hmac_sha1(key: &[u8], value: &[u8]) -> Result<Vec<u8>> {
    let mut mac = Hmac::<Sha1>::new_from_slice(key).map_err(|error| anyhow!(error))?;
    mac.update(value);
    Ok(mac.finalize().into_bytes().to_vec())
}

#[cfg(test)]
mod tests {
    use super::*;
    use p256::ecdsa::SigningKey;
    use vault_protocol::{
        ManifestEntryV1, VaultManifestV1, canonical_cbor, encrypt_object_with_nonce, encrypt_path,
        sign_manifest,
    };

    #[test]
    fn rejects_unsafe_restore_paths() {
        let root = Path::new("/tmp/restore");
        assert!(safe_restore_path(root, "../secret").is_err());
        assert!(safe_restore_path(root, "/etc/passwd").is_err());
        assert_eq!(
            safe_restore_path(root, "notes/ok.md").expect("safe"),
            root.join("notes/ok.md")
        );
    }

    #[test]
    fn local_restore_round_trip() {
        let vault_id = Uuid::from_u128(10);
        let file_id = Uuid::from_u128(11);
        let version_id = Uuid::from_u128(12);
        let key = VaultMasterKey::from_bytes([8; 32]);
        let object = encrypt_object_with_nonce(
            &key,
            file_id,
            version_id,
            None,
            ObjectKindV1::Markdown,
            "text/markdown",
            b"# hello",
            [4; 12],
        )
        .expect("encrypt");
        let entry = ManifestEntryV1 {
            file_id,
            current_version_id: version_id,
            encrypted_path: encrypt_path(&key, file_id, "notes/demo.md").expect("path"),
            object_digest: digest_cbor(&object).expect("digest"),
            byte_size: 7,
            modified_unix_ms: 1,
        };
        let manifest = VaultManifestV1 {
            protocol_version: 1,
            vault_id,
            sequence: 1,
            previous_manifest_digest: None,
            entries: vec![entry],
            tombstones: vec![],
            key_version: 1,
            extensions: BTreeMap::new(),
        };
        let signing_key = SigningKey::from_slice(&[6; 32]).expect("key");
        let signed =
            canonical_cbor(&sign_manifest(manifest, &signing_key).expect("sign")).expect("cbor");
        let kit = RecoveryKit {
            protocol_version: 1,
            vault_id,
            api_base: String::new(),
            recovery_phrase: recovery_phrase(&key).expect("phrase"),
            recovery_token: STANDARD.encode([9; 32]),
            github_repository: None,
            created_at: None,
            checksum: None,
        };
        let temporary = std::env::temp_dir().join(format!("ksamint-{}", Uuid::new_v4()));
        fs::create_dir_all(&temporary).expect("mkdir");
        let objects = BTreeMap::from([(version_id, canonical_cbor(&object).expect("object cbor"))]);
        let report = restore(&kit, &temporary, &signed, &objects, 1, false).expect("restore");
        assert_eq!(report.restored_files, 1);
        assert_eq!(
            fs::read_to_string(temporary.join("notes/demo.md")).expect("read"),
            "# hello"
        );
        fs::remove_dir_all(temporary).expect("cleanup");
    }

    #[test]
    fn agent_grant_wraps_the_recovery_key() {
        let vault_id = Uuid::from_u128(31);
        let key = VaultMasterKey::from_bytes([12; 32]);
        let kit = RecoveryKit {
            protocol_version: 1,
            vault_id,
            api_base: String::new(),
            recovery_phrase: recovery_phrase(&key).expect("phrase"),
            recovery_token: STANDARD.encode([4; 32]),
            github_repository: None,
            created_at: None,
            checksum: None,
        };
        let agent = vault_protocol::generate_hpke_keypair();
        let temporary = std::env::temp_dir().join(format!("ksamint-{}", Uuid::new_v4()));
        fs::create_dir_all(&temporary).expect("mkdir");
        let output = temporary.join("agent-grant.json");
        create_agent_grant(kit, &hex::encode(&agent.public_key), 1, output.clone())
            .expect("create grant");
        let package: AgentGrantPackageV1 =
            serde_json::from_slice(&fs::read(output).expect("read grant")).expect("parse grant");
        let grant: CapabilityGrantV1 =
            decode_cbor(&STANDARD.decode(package.encrypted_grant).expect("base64"))
                .expect("decode capability");
        let opened = vault_protocol::hpke_open(
            &agent.private_key,
            &grant.wrapped_capability_key,
            grant.grant_id.as_bytes(),
        )
        .expect("open capability key");
        assert_eq!(opened, key.expose_for_wrapping());
        fs::remove_dir_all(temporary).expect("cleanup");
    }
}
