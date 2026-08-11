use thiserror::Error;

#[derive(Debug, Error)]
pub enum ProtocolError {
    #[error("unsupported protocol version")]
    UnsupportedVersion,
    #[error("unsupported cipher suite")]
    UnsupportedCipherSuite,
    #[error("invalid vault key length")]
    InvalidKey,
    #[error("invalid nonce length")]
    InvalidNonce,
    #[error("invalid ciphertext framing")]
    InvalidCiphertext,
    #[error("invalid recovery phrase")]
    InvalidRecoveryPhrase,
    #[error("ciphertext authentication failed")]
    Authentication,
    #[error("invalid P-256 key")]
    InvalidPublicKey,
    #[error("invalid HPKE envelope")]
    InvalidEnvelope,
    #[error("signature verification failed")]
    InvalidSignature,
    #[error("CBOR encoding failed: {0}")]
    CborEncode(String),
    #[error("CBOR decoding failed: {0}")]
    CborDecode(String),
    #[error("randomness unavailable")]
    Randomness,
    #[error("HPKE operation failed")]
    Hpke,
}

pub type Result<T> = std::result::Result<T, ProtocolError>;
