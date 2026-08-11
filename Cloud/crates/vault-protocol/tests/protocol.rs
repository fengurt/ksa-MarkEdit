use p256::ecdsa::SigningKey;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use uuid::Uuid;
use vault_protocol::{
    ObjectKindV1, VaultManifestV1, VaultMasterKey, decrypt_object, encrypt_object_with_nonce,
    generate_hpke_keypair, hpke_open, hpke_seal, recovery_phrase, sign_manifest, verify_manifest,
};

#[test]
fn deterministic_object_vector_and_tamper_detection() {
    let key = VaultMasterKey::from_bytes([7_u8; 32]);
    let file_id = Uuid::from_u128(1);
    let version_id = Uuid::from_u128(2);
    let object = encrypt_object_with_nonce(
        &key,
        file_id,
        version_id,
        None,
        ObjectKindV1::Markdown,
        "text/markdown",
        "中文 Café 日本語".as_bytes(),
        [3_u8; 12],
    )
    .expect("encrypt");
    let plaintext = decrypt_object(&key, &object, "中文 Café 日本語".len()).expect("decrypt");
    assert_eq!(plaintext, "中文 Café 日本語".as_bytes());
    assert_eq!(object.padded_size, 4_096);

    let mut corrupted = object;
    corrupted.ciphertext[0] ^= 1;
    assert!(decrypt_object(&key, &corrupted, 1).is_err());
}

#[test]
fn empty_object_uses_one_padding_block_and_rejects_suite_changes() {
    let key = VaultMasterKey::from_bytes([11_u8; 32]);
    let mut object = encrypt_object_with_nonce(
        &key,
        Uuid::from_u128(21),
        Uuid::from_u128(22),
        None,
        ObjectKindV1::Markdown,
        "text/markdown",
        b"",
        [8_u8; 12],
    )
    .expect("encrypt empty object");
    assert_eq!(object.padded_size, 4_096);
    assert_eq!(
        decrypt_object(&key, &object, 0).expect("decrypt empty object"),
        b""
    );

    object.cipher_suite = vault_protocol::CipherSuiteV1::HpkeP256Sha256Aes256Gcm;
    assert!(decrypt_object(&key, &object, 0).is_err());
}

#[test]
fn recovery_phrase_round_trip() {
    let key = VaultMasterKey::from_bytes([19_u8; 32]);
    let phrase = recovery_phrase(&key).expect("phrase");
    assert_eq!(phrase.split_whitespace().count(), 24);
    let recovered = VaultMasterKey::from_recovery_phrase(&phrase).expect("recover");
    assert_eq!(recovered.expose_for_wrapping(), key.expose_for_wrapping());
}

#[test]
fn hpke_p256_aes256_round_trip() {
    let key_pair = generate_hpke_keypair();
    let envelope = hpke_seal(&key_pair.public_key, b"vault key", b"device grant").expect("seal");
    let plaintext = hpke_open(&key_pair.private_key, &envelope, b"device grant").expect("open");
    assert_eq!(plaintext, b"vault key");
}

#[test]
fn signed_manifest_rejects_replay_mutation() {
    let key = SigningKey::from_slice(&[5_u8; 32]).expect("signing key");
    let manifest = VaultManifestV1 {
        protocol_version: 1,
        vault_id: Uuid::from_u128(9),
        sequence: 4,
        previous_manifest_digest: None,
        entries: vec![],
        tombstones: vec![],
        key_version: 1,
        extensions: BTreeMap::new(),
    };
    let mut signed = sign_manifest(manifest, &key).expect("sign");
    verify_manifest(&signed).expect("verify");
    signed.manifest.sequence = 3;
    assert!(verify_manifest(&signed).is_err());
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ObjectVector {
    master_key_hex: String,
    file_id: Uuid,
    version_id: Uuid,
    plaintext_utf8: String,
    nonce_hex: String,
    padded_size: u64,
    ciphertext_sha256_hex: String,
    authentication_tag_hex: String,
    object_digest_hex: String,
}

#[test]
fn checked_in_vector_matches_rust_protocol() {
    let vector_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../test-vectors/vault-object-v1.json");
    let vector: ObjectVector =
        serde_json::from_slice(&std::fs::read(vector_path).expect("read vector"))
            .expect("parse vector");
    let key_bytes: [u8; 32] = hex::decode(vector.master_key_hex)
        .expect("key hex")
        .try_into()
        .expect("key length");
    let nonce: [u8; 12] = hex::decode(vector.nonce_hex)
        .expect("nonce hex")
        .try_into()
        .expect("nonce length");
    let object = encrypt_object_with_nonce(
        &VaultMasterKey::from_bytes(key_bytes),
        vector.file_id,
        vector.version_id,
        None,
        ObjectKindV1::Markdown,
        "text/markdown",
        vector.plaintext_utf8.as_bytes(),
        nonce,
    )
    .expect("encrypt vector");
    assert_eq!(object.padded_size, vector.padded_size);
    assert_eq!(
        hex::encode(Sha256::digest(&object.ciphertext)),
        vector.ciphertext_sha256_hex
    );
    assert_eq!(
        hex::encode(&object.authentication_tag),
        vector.authentication_tag_hex
    );
    assert_eq!(
        hex::encode(vault_protocol::digest_cbor(&object).expect("digest")),
        vector.object_digest_hex
    );
}
