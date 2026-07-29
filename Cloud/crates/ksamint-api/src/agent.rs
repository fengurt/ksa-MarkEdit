use crate::{
    error::{ApiError, ApiResult},
    state::AppState,
    sts,
};
use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, header::AUTHORIZATION},
};
use base64::{Engine, engine::general_purpose::STANDARD};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use uuid::Uuid;
use vault_protocol::{SignedManifestV1, decode_cbor};

pub async fn capability_catalog(
    State(state): State<AppState>,
    Path(grant_id): Path<Uuid>,
    headers: HeaderMap,
) -> ApiResult<Json<Value>> {
    let token = bearer_token(&headers)?;
    let digest = Sha256::digest(token).to_vec();
    let grant = sqlx::query_as::<_, (Uuid, Vec<u8>)>(
        "SELECT vault_id, encrypted_grant FROM capability_grants \
         WHERE id = $1 AND access_token_digest = $2 \
         AND revoked_at IS NULL AND expires_at > now()",
    )
    .bind(grant_id)
    .bind(digest)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(ApiError::Unauthorized)?;
    let config = state
        .config
        .cos
        .as_ref()
        .ok_or_else(|| ApiError::Unavailable("COS Agent access is disabled".to_owned()))?;
    let manifest = sqlx::query_as::<_, (i64, Vec<u8>, Vec<u8>)>(
        "SELECT sequence, digest, signed_cbor FROM manifests \
         WHERE vault_id = $1 ORDER BY sequence DESC LIMIT 1",
    )
    .bind(grant.0)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(ApiError::NotFound)?;
    let signed: SignedManifestV1 = decode_cbor(&manifest.2)
        .map_err(|error| ApiError::Unavailable(format!("stored manifest is invalid: {error}")))?;
    let current_versions = signed
        .manifest
        .entries
        .iter()
        .map(|entry| entry.current_version_id)
        .collect::<Vec<_>>();
    let objects = sqlx::query_as::<_, (Uuid, String, i64, Vec<u8>)>(
        "SELECT id, kind, cipher_size, digest FROM objects \
         WHERE vault_id = $1 AND id = ANY($2)",
    )
    .bind(grant.0)
    .bind(current_versions)
    .fetch_all(&state.pool)
    .await?;
    let credentials = sts::assume_role(&state, config, grant.0, true).await?;
    tracing::info!(grant_id = %grant_id, vault_id = %grant.0, "issued read-only Agent catalog");
    Ok(Json(json!({
        "protocolVersion": 1,
        "grantId": grant_id,
        "vaultId": grant.0,
        "encryptedGrant": STANDARD.encode(grant.1),
        "manifest": {
            "sequence": manifest.0,
            "digest": hex::encode(manifest.1),
            "signedCbor": STANDARD.encode(manifest.2)
        },
        "objects": objects.into_iter().map(|(id, kind, cipher_size, digest)| json!({
            "objectId": id,
            "kind": kind,
            "cipherSize": cipher_size,
            "digest": hex::encode(digest),
            "objectKey": format!("vaults/{}/objects/{id}", grant.0)
        })).collect::<Vec<_>>(),
        "cos": credentials
    })))
}

fn bearer_token(headers: &HeaderMap) -> ApiResult<Vec<u8>> {
    let value = headers
        .get(AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .ok_or(ApiError::Unauthorized)?;
    let token = STANDARD.decode(value).map_err(|_| ApiError::Unauthorized)?;
    if token.len() < 32 {
        return Err(ApiError::Unauthorized);
    }
    Ok(token)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    #[test]
    fn agent_catalog_requires_a_256_bit_bearer_token() {
        let mut headers = HeaderMap::new();
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_static("Bearer AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="),
        );
        assert_eq!(bearer_token(&headers).unwrap().len(), 32);

        headers.insert(AUTHORIZATION, HeaderValue::from_static("Bearer c2hvcnQ="));
        assert!(matches!(
            bearer_token(&headers),
            Err(ApiError::Unauthorized)
        ));
    }
}
