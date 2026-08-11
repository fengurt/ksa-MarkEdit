use serde::Serialize;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use uuid::Uuid;
use vault_protocol::{
    ManifestEntryV1, ObjectKindV1, VaultManifestV1, VaultMasterKey, canonical_cbor, digest_cbor,
    encrypt_object_with_nonce, encrypt_path_with_nonce, sign_manifest,
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Vector {
    name: &'static str,
    master_key_hex: String,
    file_id: Uuid,
    version_id: Uuid,
    plaintext_utf8: &'static str,
    plaintext_size: usize,
    nonce_hex: String,
    aad_hex: String,
    padded_size: u64,
    ciphertext_sha256_hex: String,
    authentication_tag_hex: String,
    object_digest_hex: String,
    signed_manifest_digest_hex: String,
}

fn main() {
    let master_key = VaultMasterKey::from_bytes([7; 32]);
    let file_id = Uuid::from_u128(1);
    let version_id = Uuid::from_u128(2);
    let plaintext = "中文 Café 日本語";
    let object = encrypt_object_with_nonce(
        &master_key,
        file_id,
        version_id,
        None,
        ObjectKindV1::Markdown,
        "text/markdown",
        plaintext.as_bytes(),
        [3; 12],
    )
    .expect("encrypt object");
    let object_digest = digest_cbor(&object).expect("digest object");
    let aad = canonical_cbor(&(
        b"ksamint/vault-object/v1".as_slice(),
        1_u16,
        file_id,
        version_id,
        Option::<Uuid>::None,
        ObjectKindV1::Markdown,
        "text/markdown",
        object.padded_size,
    ))
    .expect("object aad");
    let manifest = VaultManifestV1 {
        protocol_version: 1,
        vault_id: Uuid::from_u128(9),
        sequence: 1,
        previous_manifest_digest: None,
        entries: vec![ManifestEntryV1 {
            file_id,
            current_version_id: version_id,
            encrypted_path: encrypt_path_with_nonce(&master_key, file_id, "notes/语言.md", [4; 12])
                .expect("encrypt path"),
            object_digest,
            byte_size: plaintext.len() as u64,
            modified_unix_ms: 1_700_000_000_000,
        }],
        tombstones: vec![],
        key_version: 1,
        extensions: BTreeMap::new(),
    };
    let signing_key = p256::ecdsa::SigningKey::from_slice(&[5; 32]).expect("signing key");
    let signed = sign_manifest(manifest, &signing_key).expect("sign manifest");
    let vector = Vector {
        name: "vault-object-v1-multilingual",
        master_key_hex: hex::encode([7; 32]),
        file_id,
        version_id,
        plaintext_utf8: plaintext,
        plaintext_size: plaintext.len(),
        nonce_hex: hex::encode([3; 12]),
        aad_hex: hex::encode(aad),
        padded_size: object.padded_size,
        ciphertext_sha256_hex: hex::encode(Sha256::digest(&object.ciphertext)),
        authentication_tag_hex: hex::encode(&object.authentication_tag),
        object_digest_hex: hex::encode(object_digest),
        signed_manifest_digest_hex: hex::encode(Sha256::digest(
            canonical_cbor(&signed).expect("manifest cbor"),
        )),
    };
    println!(
        "{}",
        serde_json::to_string_pretty(&vector).expect("JSON vector")
    );
}
