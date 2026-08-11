use crate::{ProtocolError, Result};
use serde::{Serialize, de::DeserializeOwned};
use sha2::{Digest, Sha256};

/// Encodes structs in declaration order and requires map-like protocol fields to use
/// `BTreeMap`. Ciborium emits shortest integer encodings, producing deterministic bytes
/// for every versioned protocol type in this crate.
pub fn canonical_cbor<T: Serialize>(value: &T) -> Result<Vec<u8>> {
    let mut output = Vec::new();
    ciborium::into_writer(value, &mut output)
        .map_err(|error| ProtocolError::CborEncode(error.to_string()))?;
    Ok(output)
}

pub fn decode_cbor<T: DeserializeOwned>(value: &[u8]) -> Result<T> {
    ciborium::from_reader(value).map_err(|error| ProtocolError::CborDecode(error.to_string()))
}

pub fn digest_cbor<T: Serialize>(value: &T) -> Result<[u8; 32]> {
    Ok(Sha256::digest(canonical_cbor(value)?).into())
}
