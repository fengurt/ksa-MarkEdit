use crate::{
    error::{ApiError, ApiResult},
    session::{AccountSession, now_ms},
    state::AppState,
};
use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use base64::{Engine, engine::general_purpose::STANDARD};
use serde::Deserialize;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use uuid::Uuid;
use vault_protocol::{SignedManifestV1, decode_cbor, verify_manifest};

#[derive(Deserialize)]
pub struct CreateVault {
    pub display_name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PutManifest {
    pub sequence: i64,
    pub previous_digest: Option<String>,
    pub digest: String,
    pub signed_cbor: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterObject {
    pub object_id: Uuid,
    pub kind: String,
    pub cipher_size: i64,
    pub digest: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PutDevice {
    pub hpke_public_key: String,
    pub signing_public_key: String,
    pub wrapped_grant: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PutCapability {
    pub encrypted_grant: String,
    pub expires_unix_ms: i64,
    pub revocation_id: Uuid,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditInput {
    pub sequence: i64,
    pub previous_hash: String,
    pub entry_hash: String,
    pub encrypted_entry: String,
}

#[derive(Deserialize)]
pub struct Cursor {
    #[serde(default)]
    after: i64,
    #[serde(default = "default_limit")]
    limit: i64,
}

fn default_limit() -> i64 {
    100
}

pub async fn list_vaults(
    State(state): State<AppState>,
    session: AccountSession,
) -> ApiResult<Json<Value>> {
    let rows = sqlx::query_as::<_, (Uuid, String, i64)>(
        "SELECT id, display_name, sync_sequence FROM vaults WHERE account_id = $1 ORDER BY created_at",
    )
    .bind(session.account_id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(json!(
        rows.into_iter()
            .map(|(id, display_name, sequence)| json!({
                "id": id, "displayName": display_name, "syncSequence": sequence
            }))
            .collect::<Vec<_>>()
    )))
}

pub async fn create_vault(
    State(state): State<AppState>,
    session: AccountSession,
    Json(input): Json<CreateVault>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    let id = Uuid::new_v4();
    sqlx::query("INSERT INTO vaults (id, account_id, display_name) VALUES ($1, $2, $3)")
        .bind(id)
        .bind(session.account_id)
        .bind(input.display_name.trim())
        .execute(&state.pool)
        .await?;
    Ok((StatusCode::CREATED, Json(json!({"id": id}))))
}

pub async fn latest_manifest(
    State(state): State<AppState>,
    session: AccountSession,
    Path(vault_id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    require_vault(&state, session.account_id, vault_id).await?;
    let row = sqlx::query_as::<_, (i64, Option<Vec<u8>>, Vec<u8>, Vec<u8>)>(
        "SELECT sequence, previous_digest, digest, signed_cbor FROM manifests \
         WHERE vault_id = $1 ORDER BY sequence DESC LIMIT 1",
    )
    .bind(vault_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(ApiError::NotFound)?;
    Ok(Json(json!({
        "sequence": row.0,
        "previousDigest": row.1.map(hex::encode),
        "digest": hex::encode(row.2),
        "signedCbor": STANDARD.encode(row.3)
    })))
}

pub async fn put_manifest(
    State(state): State<AppState>,
    session: AccountSession,
    Path(vault_id): Path<Uuid>,
    Json(input): Json<PutManifest>,
) -> ApiResult<Json<Value>> {
    require_vault(&state, session.account_id, vault_id).await?;
    let bytes = STANDARD
        .decode(input.signed_cbor)
        .map_err(|_| ApiError::Invalid("signedCbor must be base64".to_owned()))?;
    let signed: SignedManifestV1 =
        decode_cbor(&bytes).map_err(|error| ApiError::Invalid(error.to_string()))?;
    verify_manifest(&signed).map_err(|error| ApiError::Invalid(error.to_string()))?;
    if signed.manifest.vault_id != vault_id || signed.manifest.sequence as i64 != input.sequence {
        return Err(ApiError::Invalid(
            "manifest identity or sequence mismatch".to_owned(),
        ));
    }
    let active_device = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM devices \
         WHERE vault_id = $1 AND signing_public_key = $2 AND revoked_at IS NULL)",
    )
    .bind(vault_id)
    .bind(&signed.device_signing_public_key)
    .fetch_one(&state.pool)
    .await?;
    if !active_device {
        return Err(ApiError::Forbidden);
    }
    let digest = decode_digest(&input.digest)?;
    if Sha256::digest(&bytes).as_slice() != digest.as_slice() {
        return Err(ApiError::Invalid("manifest digest mismatch".to_owned()));
    }
    let previous = input
        .previous_digest
        .as_deref()
        .map(decode_digest)
        .transpose()?;
    let mut transaction = state.pool.begin().await?;
    let current = sqlx::query_as::<_, (i64, Option<Vec<u8>>)>(
        "SELECT sync_sequence, latest_manifest_digest FROM vaults \
         WHERE id = $1 FOR UPDATE",
    )
    .bind(vault_id)
    .fetch_one(&mut *transaction)
    .await?;
    if input.sequence != current.0 + 1 || (current.0 > 0 && previous.as_ref() != current.1.as_ref())
    {
        return Err(ApiError::Conflict(format!(
            "expected sequence {} with the current parent digest",
            current.0 + 1
        )));
    }
    sqlx::query(
        "INSERT INTO manifests \
         (vault_id, sequence, previous_digest, digest, signed_cbor, device_public_key) \
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(vault_id)
    .bind(input.sequence)
    .bind(previous)
    .bind(&digest)
    .bind(&bytes)
    .bind(&signed.device_signing_public_key)
    .execute(&mut *transaction)
    .await?;
    sqlx::query(
        "UPDATE vaults SET sync_sequence = $2, latest_manifest_digest = $3, updated_at = now() WHERE id = $1",
    )
    .bind(vault_id)
    .bind(input.sequence)
    .bind(&digest)
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(Json(json!({"sequence": input.sequence, "accepted": true})))
}

pub async fn register_object(
    State(state): State<AppState>,
    session: AccountSession,
    Path(vault_id): Path<Uuid>,
    Json(input): Json<RegisterObject>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    require_vault(&state, session.account_id, vault_id).await?;
    if input.cipher_size <= 0 || input.cipher_size > 10 * 1024 * 1024 * 1024_i64 {
        return Err(ApiError::Invalid("invalid cipher size".to_owned()));
    }
    let digest = decode_digest(&input.digest)?;
    let result = sqlx::query(
        "INSERT INTO objects (id, vault_id, kind, cipher_size, digest) \
         VALUES ($1, $2, $3, $4, $5) \
         ON CONFLICT (id) DO UPDATE SET last_seen_at = now() \
         WHERE objects.vault_id = EXCLUDED.vault_id AND objects.digest = EXCLUDED.digest",
    )
    .bind(input.object_id)
    .bind(vault_id)
    .bind(input.kind)
    .bind(input.cipher_size)
    .bind(digest)
    .execute(&state.pool)
    .await?;
    if result.rows_affected() == 0 {
        return Err(ApiError::Conflict(
            "object identity is already bound to different ciphertext".to_owned(),
        ));
    }
    Ok((
        StatusCode::CREATED,
        Json(json!({
            "objectKey": format!("vaults/{vault_id}/objects/{}", input.object_id)
        })),
    ))
}

pub async fn list_objects(
    State(state): State<AppState>,
    session: AccountSession,
    Path(vault_id): Path<Uuid>,
    Query(cursor): Query<Cursor>,
) -> ApiResult<Json<Value>> {
    require_vault(&state, session.account_id, vault_id).await?;
    let rows = sqlx::query_as::<_, (Uuid, String, i64, Vec<u8>, i64)>(
        "SELECT id, kind, cipher_size, digest, event_sequence FROM objects \
         WHERE vault_id = $1 AND event_sequence > $2 ORDER BY event_sequence LIMIT $3",
    )
    .bind(vault_id)
    .bind(cursor.after.max(0))
    .bind(cursor.limit.clamp(1, 500))
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(json!(
        rows.into_iter()
            .map(|(id, kind, cipher_size, digest, sequence)| json!({
                "objectId": id,
                "kind": kind,
                "cipherSize": cipher_size,
                "digest": hex::encode(digest),
                "sequence": sequence,
                "objectKey": format!("vaults/{vault_id}/objects/{id}")
            }))
            .collect::<Vec<_>>()
    )))
}

pub async fn put_device(
    State(state): State<AppState>,
    session: AccountSession,
    Path((vault_id, device_id)): Path<(Uuid, Uuid)>,
    Json(input): Json<PutDevice>,
) -> ApiResult<Json<Value>> {
    require_vault(&state, session.account_id, vault_id).await?;
    let hpke = decode_limited(&input.hpke_public_key, 512)?;
    let signing = decode_limited(&input.signing_public_key, 512)?;
    let wrapped = decode_limited(&input.wrapped_grant, 16 * 1024)?;
    sqlx::query(
        "INSERT INTO devices \
         (id, vault_id, hpke_public_key, signing_public_key, wrapped_grant) \
         VALUES ($1, $2, $3, $4, $5) \
         ON CONFLICT (id) DO UPDATE SET wrapped_grant = EXCLUDED.wrapped_grant, \
         updated_at = now() WHERE devices.vault_id = EXCLUDED.vault_id",
    )
    .bind(device_id)
    .bind(vault_id)
    .bind(hpke)
    .bind(signing)
    .bind(wrapped)
    .execute(&state.pool)
    .await?;
    Ok(Json(json!({"id": device_id})))
}

pub async fn revoke_device(
    State(state): State<AppState>,
    session: AccountSession,
    Path((vault_id, device_id)): Path<(Uuid, Uuid)>,
) -> ApiResult<StatusCode> {
    require_vault(&state, session.account_id, vault_id).await?;
    let result = sqlx::query(
        "UPDATE devices SET revoked_at = now(), updated_at = now() \
         WHERE id = $1 AND vault_id = $2 AND revoked_at IS NULL",
    )
    .bind(device_id)
    .bind(vault_id)
    .execute(&state.pool)
    .await?;
    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

pub async fn put_capability(
    State(state): State<AppState>,
    session: AccountSession,
    Path((vault_id, grant_id)): Path<(Uuid, Uuid)>,
    Json(input): Json<PutCapability>,
) -> ApiResult<Json<Value>> {
    require_vault(&state, session.account_id, vault_id).await?;
    if input.expires_unix_ms <= now_ms() {
        return Err(ApiError::Invalid(
            "capability is already expired".to_owned(),
        ));
    }
    sqlx::query(
        "INSERT INTO capability_grants \
         (id, vault_id, revocation_id, expires_at, encrypted_grant) \
         VALUES ($1, $2, $3, to_timestamp($4 / 1000.0), $5)",
    )
    .bind(grant_id)
    .bind(vault_id)
    .bind(input.revocation_id)
    .bind(input.expires_unix_ms)
    .bind(decode_limited(&input.encrypted_grant, 64 * 1024)?)
    .execute(&state.pool)
    .await?;
    Ok(Json(json!({"id": grant_id})))
}

pub async fn revoke_capability(
    State(state): State<AppState>,
    session: AccountSession,
    Path((vault_id, revocation_id)): Path<(Uuid, Uuid)>,
) -> ApiResult<StatusCode> {
    require_vault(&state, session.account_id, vault_id).await?;
    let result = sqlx::query(
        "UPDATE capability_grants SET revoked_at = now() \
         WHERE vault_id = $1 AND revocation_id = $2 AND revoked_at IS NULL",
    )
    .bind(vault_id)
    .bind(revocation_id)
    .execute(&state.pool)
    .await?;
    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

pub async fn append_audit(
    State(state): State<AppState>,
    session: AccountSession,
    Path(vault_id): Path<Uuid>,
    Json(input): Json<AuditInput>,
) -> ApiResult<Json<Value>> {
    require_vault(&state, session.account_id, vault_id).await?;
    let previous = decode_digest(&input.previous_hash)?;
    let hash = decode_digest(&input.entry_hash)?;
    let encrypted = decode_limited(&input.encrypted_entry, 64 * 1024)?;
    let expected_hash = Sha256::new()
        .chain_update(&previous)
        .chain_update(&encrypted)
        .finalize()
        .to_vec();
    if hash != expected_hash {
        return Err(ApiError::Invalid("audit entry hash mismatch".to_owned()));
    }
    let mut transaction = state.pool.begin().await?;
    let current = sqlx::query_as::<_, (i64, Option<Vec<u8>>)>(
        "SELECT audit_sequence, latest_audit_hash FROM vaults WHERE id = $1 FOR UPDATE",
    )
    .bind(vault_id)
    .fetch_one(&mut *transaction)
    .await?;
    let expected_previous = current.1.unwrap_or_else(|| vec![0; 32]);
    if input.sequence != current.0 + 1 || previous != expected_previous {
        return Err(ApiError::Conflict("audit chain head changed".to_owned()));
    }
    sqlx::query(
        "INSERT INTO audit_events (vault_id, sequence, previous_hash, entry_hash, encrypted_entry) \
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(vault_id)
    .bind(input.sequence)
    .bind(&previous)
    .bind(&hash)
    .bind(encrypted)
    .execute(&mut *transaction)
    .await?;
    sqlx::query("UPDATE vaults SET audit_sequence = $2, latest_audit_hash = $3 WHERE id = $1")
        .bind(vault_id)
        .bind(input.sequence)
        .bind(hash)
        .execute(&mut *transaction)
        .await?;
    transaction.commit().await?;
    Ok(Json(json!({"sequence": input.sequence})))
}

async fn require_vault(state: &AppState, account_id: Uuid, vault_id: Uuid) -> ApiResult<()> {
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM vaults WHERE id = $1 AND account_id = $2)",
    )
    .bind(vault_id)
    .bind(account_id)
    .fetch_one(&state.pool)
    .await?;
    if exists {
        Ok(())
    } else {
        Err(ApiError::NotFound)
    }
}

fn decode_digest(value: &str) -> ApiResult<Vec<u8>> {
    let value = hex::decode(value).map_err(|_| ApiError::Invalid("invalid digest".to_owned()))?;
    if value.len() != 32 {
        return Err(ApiError::Invalid("digest must be SHA-256".to_owned()));
    }
    Ok(value)
}

fn decode_limited(value: &str, maximum: usize) -> ApiResult<Vec<u8>> {
    let value = STANDARD
        .decode(value)
        .map_err(|_| ApiError::Invalid("invalid base64".to_owned()))?;
    if value.len() > maximum {
        return Err(ApiError::Invalid("value is too large".to_owned()));
    }
    Ok(value)
}
