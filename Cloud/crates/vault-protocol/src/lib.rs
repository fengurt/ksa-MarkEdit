//! Versioned zero-knowledge vault wire formats and cryptographic operations.
//!
//! The server is only allowed to see opaque object identifiers, ciphertext lengths,
//! sequence numbers, digests, device grants and audit metadata. Paths, Markdown,
//! attachment bytes, vector chunks and manifests are encrypted by a device.

mod cbor;
mod crypto;
mod error;
mod types;

pub use cbor::{canonical_cbor, decode_cbor, digest_cbor};
pub use crypto::{
    HpkeKeyPair, VaultMasterKey, decrypt_object, decrypt_path, encrypt_object,
    encrypt_object_with_nonce, encrypt_path, encrypt_path_with_nonce, generate_hpke_keypair,
    hpke_open, hpke_seal, recovery_phrase, sign_manifest, verify_manifest,
};
pub use error::{ProtocolError, Result};
pub use types::{
    CapabilityGrantV1, CipherSuiteV1, DeviceGrantV1, EncryptedPathV1, FileID, HpkeEnvelopeV1,
    ManifestEntryV1, ObjectKindV1, PermissionV1, SignedManifestV1, TombstoneV1, VaultManifestV1,
    VaultObjectV1, VersionID,
};
