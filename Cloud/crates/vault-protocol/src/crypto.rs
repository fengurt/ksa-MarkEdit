use crate::{
    CipherSuiteV1, EncryptedPathV1, HpkeEnvelopeV1, ObjectKindV1, ProtocolError, Result,
    SignedManifestV1, VaultManifestV1, VaultObjectV1, canonical_cbor,
};
use aes_gcm::{
    Aes256Gcm, KeyInit, Nonce,
    aead::{AeadInPlace, generic_array::GenericArray},
};
use bip39::Mnemonic;
use hkdf::Hkdf;
use hpke::{
    Deserializable, OpModeR, OpModeS, Serializable,
    aead::AesGcm256,
    kdf::HkdfSha256,
    kem::{DhP256HkdfSha256, Kem},
    single_shot_open, single_shot_seal,
};
use p256::ecdsa::{
    Signature, SigningKey, VerifyingKey,
    signature::{Signer, Verifier},
};
use sha2::Sha256;
use uuid::Uuid;
use zeroize::{Zeroize, ZeroizeOnDrop};

const OBJECT_AAD_DOMAIN: &[u8] = b"ksamint/vault-object/v1";
const PATH_AAD_DOMAIN: &[u8] = b"ksamint/vault-path/v1";
const HPKE_INFO: &[u8] = b"ksamint/device-grant/v1";
const PADDING_BLOCK: usize = 4_096;

#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct VaultMasterKey([u8; 32]);

impl VaultMasterKey {
    pub fn generate() -> Result<Self> {
        let mut value = [0_u8; 32];
        getrandom::fill(&mut value).map_err(|_| ProtocolError::Randomness)?;
        Ok(Self(value))
    }

    pub fn from_bytes(value: [u8; 32]) -> Self {
        Self(value)
    }

    pub fn from_recovery_phrase(value: &str) -> Result<Self> {
        let mnemonic = Mnemonic::parse(value).map_err(|_| ProtocolError::InvalidRecoveryPhrase)?;
        let entropy = mnemonic.to_entropy();
        let value: [u8; 32] = entropy
            .try_into()
            .map_err(|_| ProtocolError::InvalidRecoveryPhrase)?;
        Ok(Self(value))
    }

    pub fn expose_for_wrapping(&self) -> &[u8; 32] {
        &self.0
    }
}

pub fn recovery_phrase(key: &VaultMasterKey) -> Result<String> {
    Mnemonic::from_entropy(&key.0)
        .map(|value| value.to_string())
        .map_err(|_| ProtocolError::InvalidRecoveryPhrase)
}

pub fn encrypt_object(
    key: &VaultMasterKey,
    file_id: Uuid,
    version_id: Uuid,
    parent_version_id: Option<Uuid>,
    kind: ObjectKindV1,
    mime_type: impl Into<String>,
    plaintext: &[u8],
) -> Result<VaultObjectV1> {
    let mut nonce = [0_u8; 12];
    getrandom::fill(&mut nonce).map_err(|_| ProtocolError::Randomness)?;
    encrypt_object_with_nonce(
        key,
        file_id,
        version_id,
        parent_version_id,
        kind,
        mime_type,
        plaintext,
        nonce,
    )
}

#[allow(clippy::too_many_arguments)]
pub fn encrypt_object_with_nonce(
    key: &VaultMasterKey,
    file_id: Uuid,
    version_id: Uuid,
    parent_version_id: Option<Uuid>,
    kind: ObjectKindV1,
    mime_type: impl Into<String>,
    plaintext: &[u8],
    nonce: [u8; 12],
) -> Result<VaultObjectV1> {
    let mime_type = mime_type.into();
    let padded_size = (plaintext.len().div_ceil(PADDING_BLOCK) * PADDING_BLOCK).max(PADDING_BLOCK);
    let mut padded = Vec::with_capacity(padded_size);
    padded.extend_from_slice(plaintext);
    padded.resize(padded_size, 0);
    let object_key = object_key(key, file_id, version_id)?;
    let cipher = Aes256Gcm::new_from_slice(&object_key).map_err(|_| ProtocolError::InvalidKey)?;
    let aad = object_aad(
        file_id,
        version_id,
        parent_version_id,
        kind,
        &mime_type,
        padded_size as u64,
    )?;
    let tag = cipher
        .encrypt_in_place_detached(Nonce::from_slice(&nonce), &aad, &mut padded)
        .map_err(|_| ProtocolError::Authentication)?;

    Ok(VaultObjectV1 {
        protocol_version: 1,
        file_id,
        version_id,
        parent_version_id,
        kind,
        mime_type,
        padded_size: padded_size as u64,
        cipher_suite: CipherSuiteV1::Aes256Gcm,
        nonce: nonce.to_vec(),
        ciphertext: padded,
        authentication_tag: tag.to_vec(),
    })
}

pub fn decrypt_object(
    key: &VaultMasterKey,
    object: &VaultObjectV1,
    plaintext_size: usize,
) -> Result<Vec<u8>> {
    if object.protocol_version != 1 {
        return Err(ProtocolError::UnsupportedVersion);
    }
    if object.cipher_suite != CipherSuiteV1::Aes256Gcm {
        return Err(ProtocolError::UnsupportedCipherSuite);
    }
    if object.nonce.len() != 12 || object.authentication_tag.len() != 16 {
        return Err(ProtocolError::InvalidNonce);
    }
    if object.padded_size as usize != object.ciphertext.len()
        || object.padded_size < PADDING_BLOCK as u64
        || !object.padded_size.is_multiple_of(PADDING_BLOCK as u64)
    {
        return Err(ProtocolError::InvalidCiphertext);
    }
    let object_key = object_key(key, object.file_id, object.version_id)?;
    let cipher = Aes256Gcm::new_from_slice(&object_key).map_err(|_| ProtocolError::InvalidKey)?;
    let aad = object_aad(
        object.file_id,
        object.version_id,
        object.parent_version_id,
        object.kind,
        &object.mime_type,
        object.padded_size,
    )?;
    let nonce = Nonce::from_slice(&object.nonce);
    let tag = GenericArray::from_slice(&object.authentication_tag);
    let mut plaintext = object.ciphertext.clone();
    cipher
        .decrypt_in_place_detached(nonce, &aad, &mut plaintext, tag)
        .map_err(|_| ProtocolError::Authentication)?;
    if plaintext_size > plaintext.len() {
        return Err(ProtocolError::Authentication);
    }
    plaintext.truncate(plaintext_size);
    Ok(plaintext)
}

pub fn encrypt_path(key: &VaultMasterKey, file_id: Uuid, path: &str) -> Result<EncryptedPathV1> {
    let mut nonce = [0_u8; 12];
    getrandom::fill(&mut nonce).map_err(|_| ProtocolError::Randomness)?;
    encrypt_path_with_nonce(key, file_id, path, nonce)
}

pub fn encrypt_path_with_nonce(
    key: &VaultMasterKey,
    file_id: Uuid,
    path: &str,
    nonce: [u8; 12],
) -> Result<EncryptedPathV1> {
    let path_key = path_key(key, file_id)?;
    let cipher = Aes256Gcm::new_from_slice(&path_key).map_err(|_| ProtocolError::InvalidKey)?;
    let mut ciphertext = path.as_bytes().to_vec();
    let aad = [PATH_AAD_DOMAIN, file_id.as_bytes().as_slice()].concat();
    let tag = cipher
        .encrypt_in_place_detached(Nonce::from_slice(&nonce), &aad, &mut ciphertext)
        .map_err(|_| ProtocolError::Authentication)?;
    Ok(EncryptedPathV1 {
        cipher_suite: CipherSuiteV1::Aes256Gcm,
        nonce: nonce.to_vec(),
        ciphertext,
        authentication_tag: tag.to_vec(),
    })
}

pub fn decrypt_path(key: &VaultMasterKey, file_id: Uuid, path: &EncryptedPathV1) -> Result<String> {
    if path.cipher_suite != CipherSuiteV1::Aes256Gcm {
        return Err(ProtocolError::UnsupportedCipherSuite);
    }
    if path.nonce.len() != 12 || path.authentication_tag.len() != 16 {
        return Err(ProtocolError::InvalidNonce);
    }
    let path_key = path_key(key, file_id)?;
    let cipher = Aes256Gcm::new_from_slice(&path_key).map_err(|_| ProtocolError::InvalidKey)?;
    let mut plaintext = path.ciphertext.clone();
    let aad = [PATH_AAD_DOMAIN, file_id.as_bytes().as_slice()].concat();
    cipher
        .decrypt_in_place_detached(
            Nonce::from_slice(&path.nonce),
            &aad,
            &mut plaintext,
            GenericArray::from_slice(&path.authentication_tag),
        )
        .map_err(|_| ProtocolError::Authentication)?;
    String::from_utf8(plaintext).map_err(|_| ProtocolError::Authentication)
}

#[derive(Zeroize, ZeroizeOnDrop)]
pub struct HpkeKeyPair {
    pub private_key: Vec<u8>,
    pub public_key: Vec<u8>,
}

pub fn generate_hpke_keypair() -> HpkeKeyPair {
    let (private_key, public_key) = DhP256HkdfSha256::gen_keypair();
    HpkeKeyPair {
        private_key: private_key.to_bytes().to_vec(),
        public_key: public_key.to_bytes().to_vec(),
    }
}

pub fn hpke_seal(
    recipient_public_key: &[u8],
    plaintext: &[u8],
    aad: &[u8],
) -> Result<HpkeEnvelopeV1> {
    let public_key = <DhP256HkdfSha256 as Kem>::PublicKey::from_bytes(recipient_public_key)
        .map_err(|_| ProtocolError::InvalidPublicKey)?;
    let (encapsulated_key, ciphertext) =
        single_shot_seal::<AesGcm256, HkdfSha256, DhP256HkdfSha256>(
            &OpModeS::Base,
            &public_key,
            HPKE_INFO,
            plaintext,
            aad,
        )
        .map_err(|_| ProtocolError::Hpke)?;
    Ok(HpkeEnvelopeV1 {
        protocol_version: 1,
        cipher_suite: CipherSuiteV1::HpkeP256Sha256Aes256Gcm,
        encapsulated_key: encapsulated_key.to_bytes().to_vec(),
        ciphertext,
    })
}

pub fn hpke_open(
    recipient_private_key: &[u8],
    envelope: &HpkeEnvelopeV1,
    aad: &[u8],
) -> Result<Vec<u8>> {
    if envelope.protocol_version != 1 {
        return Err(ProtocolError::UnsupportedVersion);
    }
    if envelope.cipher_suite != CipherSuiteV1::HpkeP256Sha256Aes256Gcm {
        return Err(ProtocolError::UnsupportedCipherSuite);
    }
    let private_key = <DhP256HkdfSha256 as Kem>::PrivateKey::from_bytes(recipient_private_key)
        .map_err(|_| ProtocolError::InvalidPublicKey)?;
    let encapsulated_key =
        <DhP256HkdfSha256 as Kem>::EncappedKey::from_bytes(&envelope.encapsulated_key)
            .map_err(|_| ProtocolError::InvalidEnvelope)?;
    single_shot_open::<AesGcm256, HkdfSha256, DhP256HkdfSha256>(
        &OpModeR::Base,
        &private_key,
        &encapsulated_key,
        HPKE_INFO,
        &envelope.ciphertext,
        aad,
    )
    .map_err(|_| ProtocolError::Hpke)
}

pub fn sign_manifest(
    manifest: VaultManifestV1,
    signing_key: &SigningKey,
) -> Result<SignedManifestV1> {
    let encoded = canonical_cbor(&manifest)?;
    let signature: Signature = signing_key.sign(&encoded);
    Ok(SignedManifestV1 {
        manifest,
        device_signing_public_key: signing_key
            .verifying_key()
            .to_encoded_point(true)
            .as_bytes()
            .to_vec(),
        signature: signature.to_bytes().to_vec(),
    })
}

pub fn verify_manifest(value: &SignedManifestV1) -> Result<()> {
    if value.manifest.protocol_version != 1 {
        return Err(ProtocolError::UnsupportedVersion);
    }
    let key = VerifyingKey::from_sec1_bytes(&value.device_signing_public_key)
        .map_err(|_| ProtocolError::InvalidPublicKey)?;
    let signature =
        Signature::from_slice(&value.signature).map_err(|_| ProtocolError::InvalidSignature)?;
    key.verify(&canonical_cbor(&value.manifest)?, &signature)
        .map_err(|_| ProtocolError::InvalidSignature)
}

fn object_key(key: &VaultMasterKey, file_id: Uuid, version_id: Uuid) -> Result<[u8; 32]> {
    let info = [
        b"object".as_slice(),
        file_id.as_bytes(),
        version_id.as_bytes(),
    ]
    .concat();
    derive_key(key, &info)
}

fn path_key(key: &VaultMasterKey, file_id: Uuid) -> Result<[u8; 32]> {
    let info = [b"path".as_slice(), file_id.as_bytes()].concat();
    derive_key(key, &info)
}

fn derive_key(key: &VaultMasterKey, info: &[u8]) -> Result<[u8; 32]> {
    let hkdf = Hkdf::<Sha256>::new(Some(b"ksamint/vault/v1"), &key.0);
    let mut output = [0_u8; 32];
    hkdf.expand(info, &mut output)
        .map_err(|_| ProtocolError::InvalidKey)?;
    Ok(output)
}

fn object_aad(
    file_id: Uuid,
    version_id: Uuid,
    parent_version_id: Option<Uuid>,
    kind: ObjectKindV1,
    mime_type: &str,
    padded_size: u64,
) -> Result<Vec<u8>> {
    canonical_cbor(&(
        OBJECT_AAD_DOMAIN,
        1_u16,
        file_id,
        version_id,
        parent_version_id,
        kind,
        mime_type,
        padded_size,
    ))
}
