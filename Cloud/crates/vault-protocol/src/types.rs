use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use uuid::Uuid;

pub type FileID = Uuid;
pub type VersionID = Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CipherSuiteV1 {
    Aes256Gcm,
    HpkeP256Sha256Aes256Gcm,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ObjectKindV1 {
    Markdown,
    Attachment,
    VectorShard,
    Manifest,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EncryptedPathV1 {
    pub cipher_suite: CipherSuiteV1,
    #[serde(with = "serde_bytes")]
    pub nonce: Vec<u8>,
    #[serde(with = "serde_bytes")]
    pub ciphertext: Vec<u8>,
    #[serde(with = "serde_bytes")]
    pub authentication_tag: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct VaultObjectV1 {
    pub protocol_version: u16,
    pub file_id: FileID,
    pub version_id: VersionID,
    pub parent_version_id: Option<VersionID>,
    pub kind: ObjectKindV1,
    pub mime_type: String,
    pub padded_size: u64,
    pub cipher_suite: CipherSuiteV1,
    #[serde(with = "serde_bytes")]
    pub nonce: Vec<u8>,
    #[serde(with = "serde_bytes")]
    pub ciphertext: Vec<u8>,
    #[serde(with = "serde_bytes")]
    pub authentication_tag: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ManifestEntryV1 {
    pub file_id: FileID,
    pub current_version_id: VersionID,
    pub encrypted_path: EncryptedPathV1,
    pub object_digest: [u8; 32],
    pub byte_size: u64,
    pub modified_unix_ms: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TombstoneV1 {
    pub file_id: FileID,
    pub deleted_version_id: VersionID,
    pub deleted_unix_ms: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct VaultManifestV1 {
    pub protocol_version: u16,
    pub vault_id: Uuid,
    pub sequence: u64,
    pub previous_manifest_digest: Option<[u8; 32]>,
    pub entries: Vec<ManifestEntryV1>,
    pub tombstones: Vec<TombstoneV1>,
    pub key_version: u32,
    /// Forward-compatible extension values encoded as canonical CBOR byte strings.
    ///
    /// Keeping extension payloads opaque prevents a future generic map from
    /// introducing non-deterministic key ordering into signed manifests.
    pub extensions: BTreeMap<String, Vec<u8>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SignedManifestV1 {
    pub manifest: VaultManifestV1,
    #[serde(with = "serde_bytes")]
    pub device_signing_public_key: Vec<u8>,
    #[serde(with = "serde_bytes")]
    pub signature: Vec<u8>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PermissionV1 {
    ReadOnly,
    ReadWrite,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DeviceGrantV1 {
    pub protocol_version: u16,
    pub grant_id: Uuid,
    pub device_id: Uuid,
    #[serde(with = "serde_bytes")]
    pub device_hpke_public_key: Vec<u8>,
    #[serde(with = "serde_bytes")]
    pub device_signing_public_key: Vec<u8>,
    pub permission: PermissionV1,
    pub key_version: u32,
    pub created_unix_ms: i64,
    pub revoked_unix_ms: Option<i64>,
    pub wrapped_master_key: HpkeEnvelopeV1,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CapabilityGrantV1 {
    pub protocol_version: u16,
    pub grant_id: Uuid,
    #[serde(with = "serde_bytes")]
    pub agent_hpke_public_key: Vec<u8>,
    pub permission: PermissionV1,
    pub allowed_path_prefixes: Vec<EncryptedPathV1>,
    pub allowed_tag_identities: Vec<[u8; 32]>,
    pub expires_unix_ms: i64,
    pub revocation_id: Uuid,
    pub wrapped_capability_key: HpkeEnvelopeV1,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HpkeEnvelopeV1 {
    pub protocol_version: u16,
    pub cipher_suite: CipherSuiteV1,
    #[serde(with = "serde_bytes")]
    pub encapsulated_key: Vec<u8>,
    #[serde(with = "serde_bytes")]
    pub ciphertext: Vec<u8>,
}
