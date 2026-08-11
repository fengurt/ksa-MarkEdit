use crate::{
    error::{ApiError, ApiResult},
    session::VaultDeviceSession,
    state::AppState,
    sts,
};
use axum::{
    Json,
    extract::{Path, State},
};
use base64::{Engine, engine::general_purpose::STANDARD};
use hmac::{Hmac, Mac};
use jsonwebtoken::{Algorithm, EncodingKey, Header, encode};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha1::Sha1;
use sha2::{Digest, Sha256};
use std::time::Duration;
use uuid::Uuid;
use vault_protocol::{SignedManifestV1, decode_cbor};

type HmacSha1 = Hmac<Sha1>;
const BACKUP_BRANCH: &str = "ksamint-backup";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryConfiguration {
    installation_id: i64,
    owner: String,
    repository: String,
}

#[derive(Serialize)]
struct AppClaims {
    iat: i64,
    exp: i64,
    iss: String,
}

#[derive(Deserialize)]
struct InstallationToken {
    token: String,
    expires_at: String,
    permissions: Value,
}

#[derive(Deserialize)]
struct GitObject {
    sha: String,
    #[serde(default)]
    tree: Option<GitTreeRef>,
}

#[derive(Deserialize)]
struct GitTreeRef {
    sha: String,
}

pub async fn configure_repository(
    State(state): State<AppState>,
    session: VaultDeviceSession,
    Path(vault_id): Path<Uuid>,
    Json(input): Json<RepositoryConfiguration>,
) -> ApiResult<Json<Value>> {
    if input.installation_id <= 0
        || !valid_github_name(&input.owner)
        || !valid_github_name(&input.repository)
    {
        return Err(ApiError::Invalid(
            "invalid GitHub installation or repository".to_owned(),
        ));
    }
    require_device_vault(&session, vault_id)?;
    let candidate = Repository {
        installation_id: input.installation_id,
        owner: input.owner.clone(),
        name: input.repository.clone(),
    };
    let candidate_token = installation_token(&state, &candidate).await?;
    verify_private_repository(&state, &candidate, &candidate_token.token).await?;
    let result = sqlx::query(
        "UPDATE vaults SET github_installation_id = $3, github_repository_owner = $4, \
         github_repository_name = $5, updated_at = now() WHERE id = $1 AND account_id = $2",
    )
    .bind(vault_id)
    .bind(session.account_id)
    .bind(input.installation_id)
    .bind(&input.owner)
    .bind(&input.repository)
    .execute(&state.pool)
    .await?;
    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound);
    }
    schedule_backup(&state, vault_id, 0, true).await?;
    Ok(Json(json!({
        "configured": true,
        "repository": format!("{}/{}", input.owner, input.repository)
    })))
}

pub async fn trigger_backup(
    State(state): State<AppState>,
    session: VaultDeviceSession,
    Path(vault_id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    require_device_vault(&session, vault_id)?;
    let sequence = sqlx::query_scalar::<_, i64>("SELECT sync_sequence FROM vaults WHERE id = $1")
        .bind(vault_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(ApiError::NotFound)?;
    if sequence == 0 {
        return Err(ApiError::Conflict(
            "there is no manifest to back up".to_owned(),
        ));
    }
    schedule_backup(&state, vault_id, sequence, true).await?;
    Ok(Json(json!({"queued": true, "sequence": sequence})))
}

pub async fn list_backups(
    State(state): State<AppState>,
    session: VaultDeviceSession,
    Path(vault_id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    require_device_vault(&session, vault_id)?;
    let rows = sqlx::query_as::<_, (String, i64, chrono::DateTime<chrono::Utc>)>(
        "SELECT commit_sha, sequence, created_at FROM github_backups \
         WHERE vault_id = $1 ORDER BY created_at DESC LIMIT 500",
    )
    .bind(vault_id)
    .fetch_all(&state.pool)
    .await?;
    let job = sqlx::query_as::<_, (i64, chrono::DateTime<chrono::Utc>, i32, Option<String>)>(
        "SELECT requested_sequence, not_before, attempts, last_error FROM github_backup_jobs \
         WHERE vault_id = $1",
    )
    .bind(vault_id)
    .fetch_optional(&state.pool)
    .await?;
    Ok(Json(json!({
        "backups": rows.into_iter().map(|row| json!({
            "commit": row.0, "sequence": row.1, "createdAt": row.2
        })).collect::<Vec<_>>(),
        "pending": job.map(|row| json!({
            "sequence": row.0, "notBefore": row.1, "attempts": row.2, "lastError": row.3
        }))
    })))
}

pub async fn backup_catalog(
    State(state): State<AppState>,
    session: VaultDeviceSession,
    Path((vault_id, commit)): Path<(Uuid, String)>,
) -> ApiResult<Json<Value>> {
    require_device_vault(&session, vault_id)?;
    validate_sha(&commit)?;
    let catalog = sqlx::query_scalar::<_, Value>(
        "SELECT catalog FROM github_backups WHERE vault_id = $1 AND commit_sha = $2",
    )
    .bind(vault_id)
    .bind(commit)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(ApiError::NotFound)?;
    Ok(Json(catalog))
}

pub async fn backup_object(
    State(state): State<AppState>,
    session: VaultDeviceSession,
    Path((vault_id, commit, object_id)): Path<(Uuid, String, Uuid)>,
) -> ApiResult<Json<Value>> {
    require_device_vault(&session, vault_id)?;
    validate_sha(&commit)?;
    let catalog = sqlx::query_scalar::<_, Value>(
        "SELECT catalog FROM github_backups WHERE vault_id = $1 AND commit_sha = $2",
    )
    .bind(vault_id)
    .bind(&commit)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(ApiError::NotFound)?;
    let allowed = catalog["objects"].as_array().is_some_and(|objects| {
        objects
            .iter()
            .any(|object| object["objectId"] == object_id.to_string())
    });
    if !allowed {
        return Err(ApiError::NotFound);
    }
    let repository = repository(&state, vault_id, session.account_id).await?;
    let token = installation_token(&state, &repository).await?;
    let url = format!(
        "https://api.github.com/repos/{}/{}/contents/objects/{}.cbor?ref={}",
        repository.owner, repository.name, object_id, commit
    );
    let response = github_request(&state, &token.token, reqwest::Method::GET, &url)
        .header("Accept", "application/vnd.github.raw+json")
        .send()
        .await
        .map_err(|error| ApiError::Unavailable(error.to_string()))?;
    if !response.status().is_success() {
        return Err(ApiError::Unavailable(format!(
            "GitHub object restore failed with {}",
            response.status()
        )));
    }
    let bytes = response
        .bytes()
        .await
        .map_err(|error| ApiError::Unavailable(error.to_string()))?;
    Ok(Json(
        json!({"objectId": object_id, "ciphertext": STANDARD.encode(bytes)}),
    ))
}

pub async fn schedule_backup(
    state: &AppState,
    vault_id: Uuid,
    sequence: i64,
    immediate: bool,
) -> ApiResult<()> {
    let sequence = if sequence == 0 {
        sqlx::query_scalar::<_, i64>("SELECT sync_sequence FROM vaults WHERE id = $1")
            .bind(vault_id)
            .fetch_optional(&state.pool)
            .await?
            .unwrap_or(0)
    } else {
        sequence
    };
    if sequence == 0 {
        return Ok(());
    }
    let configured = sqlx::query_scalar::<_, bool>(
        "SELECT github_installation_id IS NOT NULL FROM vaults WHERE id = $1",
    )
    .bind(vault_id)
    .fetch_optional(&state.pool)
    .await?
    .unwrap_or(false);
    if !configured {
        return Ok(());
    }
    let delay = if immediate { "0 seconds" } else { "5 minutes" };
    sqlx::query(
        "INSERT INTO github_backup_jobs (vault_id, requested_sequence, not_before) \
         VALUES ($1, $2, now() + $3::interval) ON CONFLICT (vault_id) DO UPDATE SET \
         requested_sequence = GREATEST(github_backup_jobs.requested_sequence, excluded.requested_sequence), \
         not_before = LEAST(github_backup_jobs.not_before, excluded.not_before), updated_at = now()",
    )
    .bind(vault_id)
    .bind(sequence)
    .bind(delay)
    .execute(&state.pool)
    .await?;
    Ok(())
}

pub async fn backup_worker(state: AppState) {
    loop {
        if let Err(error) = process_due_backups(&state).await {
            tracing::warn!(%error, "GitHub backup worker iteration failed");
        }
        tokio::time::sleep(Duration::from_secs(30)).await;
    }
}

async fn process_due_backups(state: &AppState) -> ApiResult<()> {
    let jobs = sqlx::query_as::<_, (Uuid, i64)>(
        "WITH due AS (SELECT vault_id FROM github_backup_jobs \
         WHERE not_before <= now() AND (leased_until IS NULL OR leased_until < now()) \
         ORDER BY not_before FOR UPDATE SKIP LOCKED LIMIT 4) \
         UPDATE github_backup_jobs AS jobs SET leased_until = now() + interval '10 minutes', \
         updated_at = now() FROM due WHERE jobs.vault_id = due.vault_id \
         RETURNING jobs.vault_id, jobs.requested_sequence",
    )
    .fetch_all(&state.pool)
    .await?;
    for (vault_id, sequence) in jobs {
        match run_backup(state, vault_id, sequence).await {
            Ok(()) => {
                sqlx::query("DELETE FROM github_backup_jobs WHERE vault_id = $1 AND requested_sequence <= $2")
                    .bind(vault_id)
                    .bind(sequence)
                    .execute(&state.pool)
                    .await?;
            }
            Err(error) => {
                tracing::warn!(%vault_id, %error, "GitHub encrypted backup failed");
                sqlx::query(
                    "UPDATE github_backup_jobs SET attempts = attempts + 1, last_error = $2, \
                     not_before = now() + make_interval(secs => LEAST(3600, 30 * (attempts + 1))), \
                     leased_until = NULL, updated_at = now() WHERE vault_id = $1",
                )
                .bind(vault_id)
                .bind(error.to_string())
                .execute(&state.pool)
                .await?;
            }
        }
    }
    Ok(())
}

async fn run_backup(state: &AppState, vault_id: Uuid, requested_sequence: i64) -> ApiResult<()> {
    let account_id = sqlx::query_scalar::<_, Uuid>("SELECT account_id FROM vaults WHERE id = $1")
        .bind(vault_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(ApiError::NotFound)?;
    let repository = repository(state, vault_id, account_id).await?;
    let token = installation_token(state, &repository).await?;
    let manifest = sqlx::query_as::<_, (i64, Vec<u8>, Vec<u8>)>(
        "SELECT sequence, digest, signed_cbor FROM manifests WHERE vault_id = $1 \
         AND sequence <= $2 ORDER BY sequence DESC LIMIT 1",
    )
    .bind(vault_id)
    .bind(requested_sequence.max(1))
    .fetch_optional(&state.pool)
    .await?
    .ok_or(ApiError::NotFound)?;
    let signed: SignedManifestV1 = decode_cbor(&manifest.2)
        .map_err(|error| ApiError::Unavailable(format!("stored manifest is invalid: {error}")))?;
    let object_ids = signed
        .manifest
        .entries
        .iter()
        .map(|entry| entry.current_version_id)
        .collect::<Vec<_>>();
    let objects = sqlx::query_as::<_, (Uuid, String, i64, Vec<u8>)>(
        "SELECT id, kind, cipher_size, digest FROM objects WHERE vault_id = $1 \
         AND id = ANY($2) AND kind = 'markdown' ORDER BY id",
    )
    .bind(vault_id)
    .bind(&object_ids)
    .fetch_all(&state.pool)
    .await?;
    let catalog = json!({
        "protocolVersion": 1,
        "vaultId": vault_id,
        "sequence": manifest.0,
        "manifestDigest": hex::encode(&manifest.1),
        "signedManifest": STANDARD.encode(&manifest.2),
        "objects": objects.iter().map(|row| json!({
            "objectId": row.0, "kind": row.1, "cipherSize": row.2, "digest": hex::encode(&row.3)
        })).collect::<Vec<_>>()
    });
    let previous = sqlx::query_scalar::<_, String>(
        "SELECT commit_sha FROM github_backups WHERE vault_id = $1 ORDER BY created_at DESC LIMIT 1",
    )
    .bind(vault_id)
    .fetch_optional(&state.pool)
    .await?;
    let mut tree = Vec::new();
    for object in &objects {
        let already_backed_up = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM github_backup_objects WHERE vault_id = $1 AND object_id = $2)",
        )
        .bind(vault_id)
        .bind(object.0)
        .fetch_one(&state.pool)
        .await?;
        if already_backed_up {
            continue;
        }
        let ciphertext = download_cos_object(state, vault_id, object.0).await?;
        if ciphertext.len() as i64 != object.2 || Sha256::digest(&ciphertext).as_slice() != object.3
        {
            return Err(ApiError::Unavailable(format!(
                "COS object {} failed integrity validation",
                object.0
            )));
        }
        let sha = create_blob(state, &repository, &token.token, &ciphertext).await?;
        tree.push(json!({"path": format!("objects/{}.cbor", object.0), "mode": "100644", "type": "blob", "sha": sha}));
    }
    let manifest_sha = create_blob(state, &repository, &token.token, &manifest.2).await?;
    tree.push(json!({"path": format!("manifests/{}.cbor", manifest.0), "mode": "100644", "type": "blob", "sha": manifest_sha.clone()}));
    tree.push(json!({"path": "manifest/latest.cbor", "mode": "100644", "type": "blob", "sha": manifest_sha}));
    let catalog_bytes =
        serde_json::to_vec(&catalog).map_err(|error| ApiError::Internal(error.into()))?;
    let catalog_sha = create_blob(state, &repository, &token.token, &catalog_bytes).await?;
    tree.push(json!({"path": "recovery/index-v1.json", "mode": "100644", "type": "blob", "sha": catalog_sha}));
    let base_tree = match &previous {
        Some(commit) => Some(commit_tree(state, &repository, &token.token, commit).await?),
        None => None,
    };
    let tree_sha =
        create_tree(state, &repository, &token.token, base_tree.as_deref(), tree).await?;
    let commit = create_commit(
        state,
        &repository,
        &token.token,
        &tree_sha,
        previous.as_deref(),
        &format!("Encrypted Vault snapshot {}", manifest.0),
    )
    .await?;
    update_ref(
        state,
        &repository,
        &token.token,
        &commit,
        previous.is_some(),
    )
    .await?;
    let mut transaction = state.pool.begin().await?;
    sqlx::query(
        "INSERT INTO github_backups (id, vault_id, sequence, commit_sha, catalog) \
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (vault_id, sequence) DO NOTHING",
    )
    .bind(Uuid::new_v4())
    .bind(vault_id)
    .bind(manifest.0)
    .bind(&commit)
    .bind(&catalog)
    .execute(&mut *transaction)
    .await?;
    for object in objects {
        sqlx::query(
            "INSERT INTO github_backup_objects (vault_id, object_id, first_commit_sha) \
             VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        )
        .bind(vault_id)
        .bind(object.0)
        .bind(&commit)
        .execute(&mut *transaction)
        .await?;
    }
    transaction.commit().await?;
    Ok(())
}

struct Repository {
    installation_id: i64,
    owner: String,
    name: String,
}

async fn verify_private_repository(
    state: &AppState,
    repository: &Repository,
    token: &str,
) -> ApiResult<()> {
    let response = github_request(
        state,
        token,
        reqwest::Method::GET,
        &format!(
            "https://api.github.com/repos/{}/{}",
            repository.owner, repository.name
        ),
    )
    .send()
    .await
    .map_err(|error| ApiError::Unavailable(error.to_string()))?;
    if !response.status().is_success() {
        return Err(ApiError::Forbidden);
    }
    let value = response
        .json::<Value>()
        .await
        .map_err(|error| ApiError::Unavailable(error.to_string()))?;
    if value.get("private").and_then(Value::as_bool) != Some(true) {
        return Err(ApiError::Invalid(
            "GitHub backup requires a private repository".to_owned(),
        ));
    }
    Ok(())
}

async fn repository(state: &AppState, vault_id: Uuid, account_id: Uuid) -> ApiResult<Repository> {
    let value = sqlx::query_as::<_, (i64, String, String)>(
        "SELECT github_installation_id, github_repository_owner, github_repository_name \
         FROM vaults WHERE id = $1 AND account_id = $2 AND github_installation_id IS NOT NULL",
    )
    .bind(vault_id)
    .bind(account_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(ApiError::NotFound)?;
    Ok(Repository {
        installation_id: value.0,
        owner: value.1,
        name: value.2,
    })
}

async fn installation_token(
    state: &AppState,
    repository: &Repository,
) -> ApiResult<InstallationToken> {
    let github = state
        .config
        .github
        .as_ref()
        .ok_or_else(|| ApiError::Unavailable("GitHub backup is disabled".to_owned()))?;
    let now = chrono::Utc::now().timestamp();
    let claims = AppClaims {
        iat: now - 30,
        exp: now + 9 * 60,
        iss: github.app_id.to_string(),
    };
    let key = EncodingKey::from_rsa_pem(github.private_key_pem.as_bytes())
        .map_err(|error| ApiError::Unavailable(error.to_string()))?;
    let jwt = encode(&Header::new(Algorithm::RS256), &claims, &key)
        .map_err(|error| ApiError::Unavailable(error.to_string()))?;
    let response = state
        .http
        .post(format!(
            "https://api.github.com/app/installations/{}/access_tokens",
            repository.installation_id
        ))
        .bearer_auth(jwt)
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "ksamint-notes-backup")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .json(&json!({"repositories": [repository.name], "permissions": {"contents": "write"}}))
        .send()
        .await
        .map_err(|error| ApiError::Unavailable(error.to_string()))?;
    if !response.status().is_success() {
        return Err(ApiError::Unavailable(
            "GitHub App installation is unavailable".to_owned(),
        ));
    }
    let token: InstallationToken = response
        .json()
        .await
        .map_err(|error| ApiError::Unavailable(error.to_string()))?;
    if token.permissions.get("contents").and_then(Value::as_str) != Some("write") {
        return Err(ApiError::Forbidden);
    }
    tracing::debug!(expires_at = %token.expires_at, "issued server-side GitHub installation token");
    Ok(token)
}

async fn create_blob(
    state: &AppState,
    repository: &Repository,
    token: &str,
    bytes: &[u8],
) -> ApiResult<String> {
    let response = github_request(
        state,
        token,
        reqwest::Method::POST,
        &format!(
            "https://api.github.com/repos/{}/{}/git/blobs",
            repository.owner, repository.name
        ),
    )
    .json(&json!({"content": STANDARD.encode(bytes), "encoding": "base64"}))
    .send()
    .await
    .map_err(|error| ApiError::Unavailable(error.to_string()))?;
    github_object(response, "create blob").await
}

async fn commit_tree(
    state: &AppState,
    repository: &Repository,
    token: &str,
    commit: &str,
) -> ApiResult<String> {
    let response = github_request(
        state,
        token,
        reqwest::Method::GET,
        &format!(
            "https://api.github.com/repos/{}/{}/git/commits/{commit}",
            repository.owner, repository.name
        ),
    )
    .send()
    .await
    .map_err(|error| ApiError::Unavailable(error.to_string()))?;
    let value = github_object_full(response, "read commit").await?;
    value
        .tree
        .map(|tree| tree.sha)
        .ok_or_else(|| ApiError::Unavailable("GitHub commit has no tree".to_owned()))
}

async fn create_tree(
    state: &AppState,
    repository: &Repository,
    token: &str,
    base: Option<&str>,
    tree: Vec<Value>,
) -> ApiResult<String> {
    let mut body = json!({"tree": tree});
    if let Some(base) = base {
        body["base_tree"] = json!(base);
    }
    let response = github_request(
        state,
        token,
        reqwest::Method::POST,
        &format!(
            "https://api.github.com/repos/{}/{}/git/trees",
            repository.owner, repository.name
        ),
    )
    .json(&body)
    .send()
    .await
    .map_err(|error| ApiError::Unavailable(error.to_string()))?;
    github_object(response, "create tree").await
}

async fn create_commit(
    state: &AppState,
    repository: &Repository,
    token: &str,
    tree: &str,
    parent: Option<&str>,
    message: &str,
) -> ApiResult<String> {
    let parents = parent.into_iter().collect::<Vec<_>>();
    let response = github_request(
        state,
        token,
        reqwest::Method::POST,
        &format!(
            "https://api.github.com/repos/{}/{}/git/commits",
            repository.owner, repository.name
        ),
    )
    .json(&json!({"message": message, "tree": tree, "parents": parents}))
    .send()
    .await
    .map_err(|error| ApiError::Unavailable(error.to_string()))?;
    github_object(response, "create commit").await
}

async fn update_ref(
    state: &AppState,
    repository: &Repository,
    token: &str,
    commit: &str,
    exists: bool,
) -> ApiResult<()> {
    let (method, url, body) = if exists {
        (
            reqwest::Method::PATCH,
            format!(
                "https://api.github.com/repos/{}/{}/git/refs/heads/{BACKUP_BRANCH}",
                repository.owner, repository.name
            ),
            json!({"sha": commit, "force": false}),
        )
    } else {
        (
            reqwest::Method::POST,
            format!(
                "https://api.github.com/repos/{}/{}/git/refs",
                repository.owner, repository.name
            ),
            json!({"ref": format!("refs/heads/{BACKUP_BRANCH}"), "sha": commit}),
        )
    };
    let response = github_request(state, token, method, &url)
        .json(&body)
        .send()
        .await
        .map_err(|error| ApiError::Unavailable(error.to_string()))?;
    if !response.status().is_success() {
        return Err(ApiError::Unavailable(format!(
            "GitHub update ref failed with {}",
            response.status()
        )));
    }
    Ok(())
}

fn github_request(
    state: &AppState,
    token: &str,
    method: reqwest::Method,
    url: &str,
) -> reqwest::RequestBuilder {
    state
        .http
        .request(method, url)
        .bearer_auth(token)
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "ksamint-notes-backup")
        .header("X-GitHub-Api-Version", "2022-11-28")
}

async fn github_object(response: reqwest::Response, action: &str) -> ApiResult<String> {
    github_object_full(response, action)
        .await
        .map(|value| value.sha)
}

async fn github_object_full(response: reqwest::Response, action: &str) -> ApiResult<GitObject> {
    if !response.status().is_success() {
        return Err(ApiError::Unavailable(format!(
            "GitHub {action} failed with {}",
            response.status()
        )));
    }
    response
        .json()
        .await
        .map_err(|error| ApiError::Unavailable(error.to_string()))
}

async fn download_cos_object(
    state: &AppState,
    vault_id: Uuid,
    object_id: Uuid,
) -> ApiResult<Vec<u8>> {
    let config = state
        .config
        .cos
        .as_ref()
        .ok_or_else(|| ApiError::Unavailable("COS backup source is disabled".to_owned()))?;
    let grant = sts::assume_role(state, config, vault_id, true).await?;
    let credentials = &grant["credentials"];
    let token = credentials["Token"]
        .as_str()
        .ok_or_else(|| ApiError::Unavailable("STS token is missing".to_owned()))?;
    let secret_id = credentials["TmpSecretId"]
        .as_str()
        .ok_or_else(|| ApiError::Unavailable("STS identity is missing".to_owned()))?;
    let secret_key = credentials["TmpSecretKey"]
        .as_str()
        .ok_or_else(|| ApiError::Unavailable("STS key is missing".to_owned()))?;
    let host = format!("{}.cos.{}.myqcloud.com", config.bucket, config.region);
    let path = format!("/vaults/{vault_id}/objects/{object_id}");
    let authorization = cos_authorization(&host, &path, token, secret_id, secret_key)?;
    let response = state
        .http
        .get(format!("https://{host}{path}"))
        .header("Authorization", authorization)
        .header("x-cos-security-token", token)
        .send()
        .await
        .map_err(|error| ApiError::Unavailable(error.to_string()))?;
    if !response.status().is_success() {
        return Err(ApiError::Unavailable(format!(
            "COS backup read failed with {}",
            response.status()
        )));
    }
    response
        .bytes()
        .await
        .map(|bytes| bytes.to_vec())
        .map_err(|error| ApiError::Unavailable(error.to_string()))
}

fn cos_authorization(
    host: &str,
    path: &str,
    token: &str,
    secret_id: &str,
    secret_key: &str,
) -> ApiResult<String> {
    let now = chrono::Utc::now().timestamp();
    let key_time = format!("{now};{}", now + 600);
    let canonical_headers = format!(
        "host={}&x-cos-security-token={}",
        percent(host),
        percent(token)
    );
    let http_string = format!("get\n{path}\n\n{canonical_headers}\n");
    let string_to_sign = format!(
        "sha1\n{key_time}\n{}\n",
        hex::encode(Sha1::digest(http_string))
    );
    let sign_key = hex::encode(hmac_sha1(secret_key.as_bytes(), key_time.as_bytes())?);
    let signature = hex::encode(hmac_sha1(sign_key.as_bytes(), string_to_sign.as_bytes())?);
    Ok(format!(
        "q-sign-algorithm=sha1&q-ak={}&q-sign-time={key_time}&q-key-time={key_time}&q-header-list=host%3Bx-cos-security-token&q-url-param-list=&q-signature={signature}",
        percent(secret_id)
    ))
}

fn hmac_sha1(key: &[u8], value: &[u8]) -> ApiResult<Vec<u8>> {
    let mut mac =
        HmacSha1::new_from_slice(key).map_err(|error| ApiError::Internal(error.into()))?;
    mac.update(value);
    Ok(mac.finalize().into_bytes().to_vec())
}

fn percent(value: &str) -> String {
    value
        .as_bytes()
        .iter()
        .map(|byte| {
            if byte.is_ascii_alphanumeric() || matches!(*byte, b'-' | b'.' | b'_' | b'~') {
                char::from(*byte).to_string()
            } else {
                format!("%{byte:02X}")
            }
        })
        .collect()
}

fn require_device_vault(session: &VaultDeviceSession, vault_id: Uuid) -> ApiResult<()> {
    if session.vault_id == vault_id {
        Ok(())
    } else {
        Err(ApiError::Forbidden)
    }
}

fn validate_sha(value: &str) -> ApiResult<()> {
    if value.len() == 40 && value.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        Ok(())
    } else {
        Err(ApiError::Invalid("invalid Git commit identity".to_owned()))
    }
}

fn valid_github_name(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 100
        && value.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.')
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn repository_names_reject_path_or_url_injection() {
        assert!(valid_github_name("ksamint-notes-backup"));
        assert!(!valid_github_name("../other"));
        assert!(!valid_github_name("owner/repo"));
        assert!(!valid_github_name("https://github.com"));
    }

    #[test]
    fn cos_signature_is_stable_and_does_not_expose_secret() {
        let value = cos_authorization(
            "bucket.cos.ap-singapore.myqcloud.com",
            "/vaults/a/objects/b",
            "token",
            "id",
            "secret",
        )
        .unwrap();
        assert!(value.contains("q-ak=id"));
        assert!(!value.contains("secret"));
    }
}
