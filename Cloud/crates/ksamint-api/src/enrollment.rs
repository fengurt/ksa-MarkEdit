use crate::{
    error::{ApiError, ApiResult},
    session::{AccountSession, create_device_session, now_ms},
    state::AppState,
};
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use base64::{Engine, engine::general_purpose::STANDARD};
use p256::ecdsa::{Signature, VerifyingKey, signature::Verifier};
use serde::Deserialize;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use uuid::Uuid;
use vault_protocol::{SignedDeviceGrantV1, decode_cbor, verify_device_grant};

const ENROLLMENT_TTL_MINUTES: i64 = 5;
const SESSION_PROOF_WINDOW_MS: i64 = 2 * 60 * 1_000;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEnrollment {
    device_id: Uuid,
    display_name: String,
    hpke_public_key: String,
    signing_public_key: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApproveEnrollment {
    signed_grant: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoverEnrollment {
    recovery_token: String,
    signed_grant: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExchangeDeviceSession {
    vault_id: Uuid,
    device_id: Uuid,
    unix_ms: i64,
    signature: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameDevice {
    display_name: String,
}

pub async fn create_enrollment(
    State(state): State<AppState>,
    session: AccountSession,
    Path(vault_id): Path<Uuid>,
    Json(input): Json<CreateEnrollment>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    require_account_vault(&state, session.account_id, vault_id).await?;
    let hpke = public_key(&input.hpke_public_key)?;
    let signing = public_key(&input.signing_public_key)?;
    let display_name = input.display_name.trim();
    if display_name.is_empty() || display_name.chars().count() > 80 {
        return Err(ApiError::Invalid(
            "device name must contain 1-80 characters".to_owned(),
        ));
    }
    let id = Uuid::new_v4();
    let verification_code = verification_code(id, input.device_id, &hpke, &signing);
    let expires_at = chrono::Utc::now() + chrono::Duration::minutes(ENROLLMENT_TTL_MINUTES);
    sqlx::query(
        "INSERT INTO device_enrollments \
         (id, vault_id, account_id, device_id, display_name, hpke_public_key, \
          signing_public_key, verification_code, expires_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) \
         ON CONFLICT (vault_id, device_id) DO UPDATE SET \
          id = excluded.id, display_name = excluded.display_name, \
          hpke_public_key = excluded.hpke_public_key, \
          signing_public_key = excluded.signing_public_key, \
          verification_code = excluded.verification_code, created_at = now(), \
          expires_at = excluded.expires_at, approved_at = NULL, rejected_at = NULL, \
          consumed_at = NULL, signed_grant = NULL, authorizer_device_id = NULL",
    )
    .bind(id)
    .bind(vault_id)
    .bind(session.account_id)
    .bind(input.device_id)
    .bind(display_name)
    .bind(&hpke)
    .bind(&signing)
    .bind(&verification_code)
    .bind(expires_at)
    .execute(&state.pool)
    .await?;
    Ok((
        StatusCode::CREATED,
        Json(json!({
            "requestId": id,
            "vaultId": vault_id,
            "deviceId": input.device_id,
            "displayName": display_name,
            "verificationCode": verification_code,
            "hpkePublicKey": STANDARD.encode(&hpke),
            "signingPublicKey": STANDARD.encode(&signing),
            "expiresAt": expires_at
        })),
    ))
}

pub async fn enrollment_status(
    State(state): State<AppState>,
    session: AccountSession,
    Path((vault_id, request_id)): Path<(Uuid, Uuid)>,
) -> ApiResult<Json<Value>> {
    let row = enrollment(&state, session.account_id, vault_id, request_id).await?;
    let status = if row.approved_at.is_some() {
        if row.consumed_at.is_some() {
            "consumed"
        } else {
            "approved"
        }
    } else if row.rejected_at.is_some() {
        "rejected"
    } else if row.expires_at <= chrono::Utc::now() {
        "expired"
    } else {
        "pending"
    };
    Ok(Json(json!({
        "requestId": request_id,
        "vaultId": vault_id,
        "deviceId": row.device_id,
        "displayName": row.display_name,
        "verificationCode": row.verification_code,
        "hpkePublicKey": STANDARD.encode(&row.hpke_public_key),
        "signingPublicKey": STANDARD.encode(&row.signing_public_key),
        "status": status,
        "expiresAt": row.expires_at,
        "signedGrant": if row.consumed_at.is_none() {
            row.signed_grant.map(|value| STANDARD.encode(value))
        } else {
            None
        }
    })))
}

pub async fn list_devices(
    State(state): State<AppState>,
    session: AccountSession,
    Path(vault_id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    require_account_vault(&state, session.account_id, vault_id).await?;
    let devices = sqlx::query_as::<
        _,
        (
            Uuid,
            String,
            i32,
            Vec<u8>,
            chrono::DateTime<chrono::Utc>,
            Option<chrono::DateTime<chrono::Utc>>,
            Option<chrono::DateTime<chrono::Utc>>,
        ),
    >(
        "SELECT id, display_name, key_version, signing_public_key, created_at, last_used_at, revoked_at \
         FROM devices WHERE vault_id = $1 ORDER BY created_at",
    )
    .bind(vault_id)
    .fetch_all(&state.pool)
    .await?;
    let pending = sqlx::query_as::<
        _,
        (
            Uuid,
            Uuid,
            String,
            String,
            Vec<u8>,
            Vec<u8>,
            chrono::DateTime<chrono::Utc>,
        ),
    >(
        "SELECT id, device_id, display_name, verification_code, hpke_public_key, \
         signing_public_key, expires_at \
         FROM device_enrollments WHERE vault_id = $1 AND approved_at IS NULL \
         AND rejected_at IS NULL AND expires_at > now() ORDER BY created_at",
    )
    .bind(vault_id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(json!({
        "devices": devices.into_iter().map(|row| json!({
            "id": row.0, "displayName": row.1, "keyVersion": row.2,
            "signingPublicKey": STANDARD.encode(row.3),
            "createdAt": row.4, "lastUsedAt": row.5, "revokedAt": row.6
        })).collect::<Vec<_>>(),
        "pending": pending.into_iter().map(|row| json!({
            "requestId": row.0, "deviceId": row.1, "displayName": row.2,
            "verificationCode": row.3, "hpkePublicKey": STANDARD.encode(row.4),
            "signingPublicKey": STANDARD.encode(row.5), "expiresAt": row.6
        })).collect::<Vec<_>>()
    })))
}

pub async fn approve_enrollment(
    State(state): State<AppState>,
    session: AccountSession,
    Path((vault_id, request_id)): Path<(Uuid, Uuid)>,
    Json(input): Json<ApproveEnrollment>,
) -> ApiResult<Json<Value>> {
    let request = enrollment(&state, session.account_id, vault_id, request_id).await?;
    ensure_pending(&request)?;
    let bytes = decode_limited(&input.signed_grant, 32 * 1024)?;
    let signed: SignedDeviceGrantV1 =
        decode_cbor(&bytes).map_err(|error| ApiError::Invalid(error.to_string()))?;
    let authorizer_id = signed.authorization.authorizer_device_id;
    let authorizer_key = sqlx::query_scalar::<_, Vec<u8>>(
        "SELECT signing_public_key FROM devices WHERE id = $1 AND vault_id = $2 \
         AND revoked_at IS NULL",
    )
    .bind(authorizer_id)
    .bind(vault_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(ApiError::Forbidden)?;
    verify_device_grant(&signed, &authorizer_key)
        .map_err(|error| ApiError::Invalid(error.to_string()))?;
    validate_grant(&signed, &request)?;
    approve(&state, vault_id, request_id, request, bytes, authorizer_id).await?;
    Ok(Json(
        json!({"approved": true, "deviceId": signed.authorization.grant.device_id}),
    ))
}

pub async fn recover_enrollment(
    State(state): State<AppState>,
    session: AccountSession,
    Path((vault_id, request_id)): Path<(Uuid, Uuid)>,
    Json(input): Json<RecoverEnrollment>,
) -> ApiResult<Json<Value>> {
    let request = enrollment(&state, session.account_id, vault_id, request_id).await?;
    ensure_pending(&request)?;
    let token = decode_limited(&input.recovery_token, 128)?;
    if token.len() < 32 {
        return Err(ApiError::Unauthorized);
    }
    let valid = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM vaults WHERE id = $1 AND account_id = $2 \
         AND recovery_token_digest = $3)",
    )
    .bind(vault_id)
    .bind(session.account_id)
    .bind(Sha256::digest(token).to_vec())
    .fetch_one(&state.pool)
    .await?;
    if !valid {
        return Err(ApiError::Unauthorized);
    }
    let bytes = decode_limited(&input.signed_grant, 32 * 1024)?;
    let signed: SignedDeviceGrantV1 =
        decode_cbor(&bytes).map_err(|error| ApiError::Invalid(error.to_string()))?;
    if signed.authorization.authorizer_device_id != request.device_id {
        return Err(ApiError::Invalid(
            "recovery grant must be signed by the recovered device".to_owned(),
        ));
    }
    verify_device_grant(&signed, &request.signing_public_key)
        .map_err(|error| ApiError::Invalid(error.to_string()))?;
    validate_grant(&signed, &request)?;
    approve(
        &state,
        vault_id,
        request_id,
        request,
        bytes,
        signed.authorization.authorizer_device_id,
    )
    .await?;
    Ok(Json(json!({"approved": true, "recovered": true})))
}

pub async fn reject_enrollment(
    State(state): State<AppState>,
    session: AccountSession,
    Path((vault_id, request_id)): Path<(Uuid, Uuid)>,
) -> ApiResult<StatusCode> {
    require_account_vault(&state, session.account_id, vault_id).await?;
    let result = sqlx::query(
        "UPDATE device_enrollments SET rejected_at = now() WHERE id = $1 AND vault_id = $2 \
         AND approved_at IS NULL AND rejected_at IS NULL",
    )
    .bind(request_id)
    .bind(vault_id)
    .execute(&state.pool)
    .await?;
    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

pub async fn rename_device(
    State(state): State<AppState>,
    session: AccountSession,
    Path((vault_id, device_id)): Path<(Uuid, Uuid)>,
    Json(input): Json<RenameDevice>,
) -> ApiResult<Json<Value>> {
    require_account_vault(&state, session.account_id, vault_id).await?;
    let name = input.display_name.trim();
    if name.is_empty() || name.chars().count() > 80 {
        return Err(ApiError::Invalid(
            "device name must contain 1-80 characters".to_owned(),
        ));
    }
    let result = sqlx::query(
        "UPDATE devices SET display_name = $3, updated_at = now() WHERE id = $1 AND vault_id = $2",
    )
    .bind(device_id)
    .bind(vault_id)
    .bind(name)
    .execute(&state.pool)
    .await?;
    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound);
    }
    Ok(Json(json!({"renamed": true, "displayName": name})))
}

pub async fn exchange_device_session(
    State(state): State<AppState>,
    session: AccountSession,
    Json(input): Json<ExchangeDeviceSession>,
) -> ApiResult<Json<Value>> {
    if (now_ms() - input.unix_ms).abs() > SESSION_PROOF_WINDOW_MS {
        return Err(ApiError::Unauthorized);
    }
    let key = sqlx::query_scalar::<_, Vec<u8>>(
        "SELECT d.signing_public_key FROM devices d JOIN vaults v ON v.id = d.vault_id \
         WHERE d.id = $1 AND d.vault_id = $2 AND v.account_id = $3 AND d.revoked_at IS NULL",
    )
    .bind(input.device_id)
    .bind(input.vault_id)
    .bind(session.account_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(ApiError::Unauthorized)?;
    let signature = decode_limited(&input.signature, 256)?;
    let verifying_key = VerifyingKey::from_sec1_bytes(&key).map_err(|_| ApiError::Unauthorized)?;
    let signature = Signature::from_slice(&signature).map_err(|_| ApiError::Unauthorized)?;
    verifying_key
        .verify(
            &session_proof(input.vault_id, input.device_id, input.unix_ms),
            &signature,
        )
        .map_err(|_| ApiError::Unauthorized)?;
    let (token, expires_at) =
        create_device_session(&state, session.account_id, input.vault_id, input.device_id).await?;
    sqlx::query(
        "UPDATE device_enrollments SET consumed_at = now() WHERE vault_id = $1 \
         AND device_id = $2 AND approved_at IS NOT NULL AND consumed_at IS NULL",
    )
    .bind(input.vault_id)
    .bind(input.device_id)
    .execute(&state.pool)
    .await?;
    Ok(Json(json!({"token": token, "expiresAt": expires_at})))
}

pub fn session_proof(vault_id: Uuid, device_id: Uuid, unix_ms: i64) -> Vec<u8> {
    format!("ksamint/device-session/v1:{vault_id}:{device_id}:{unix_ms}").into_bytes()
}

#[derive(sqlx::FromRow)]
struct EnrollmentRow {
    device_id: Uuid,
    display_name: String,
    hpke_public_key: Vec<u8>,
    signing_public_key: Vec<u8>,
    verification_code: String,
    expires_at: chrono::DateTime<chrono::Utc>,
    approved_at: Option<chrono::DateTime<chrono::Utc>>,
    rejected_at: Option<chrono::DateTime<chrono::Utc>>,
    signed_grant: Option<Vec<u8>>,
    consumed_at: Option<chrono::DateTime<chrono::Utc>>,
}

async fn enrollment(
    state: &AppState,
    account_id: Uuid,
    vault_id: Uuid,
    request_id: Uuid,
) -> ApiResult<EnrollmentRow> {
    sqlx::query_as(
        "SELECT device_id, display_name, hpke_public_key, signing_public_key, \
         verification_code, expires_at, approved_at, rejected_at, signed_grant, consumed_at \
         FROM device_enrollments WHERE id = $1 AND vault_id = $2 AND account_id = $3",
    )
    .bind(request_id)
    .bind(vault_id)
    .bind(account_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(ApiError::NotFound)
}

fn ensure_pending(row: &EnrollmentRow) -> ApiResult<()> {
    if row.approved_at.is_some() || row.rejected_at.is_some() {
        return Err(ApiError::Conflict(
            "enrollment is already resolved".to_owned(),
        ));
    }
    if row.expires_at <= chrono::Utc::now() {
        return Err(ApiError::Conflict("enrollment has expired".to_owned()));
    }
    Ok(())
}

fn validate_grant(signed: &SignedDeviceGrantV1, request: &EnrollmentRow) -> ApiResult<()> {
    let grant = &signed.authorization.grant;
    if grant.device_id != request.device_id
        || grant.device_hpke_public_key != request.hpke_public_key
        || grant.device_signing_public_key != request.signing_public_key
        || grant.revoked_unix_ms.is_some()
    {
        return Err(ApiError::Invalid(
            "device grant does not match enrollment".to_owned(),
        ));
    }
    Ok(())
}

async fn approve(
    state: &AppState,
    vault_id: Uuid,
    request_id: Uuid,
    request: EnrollmentRow,
    signed_grant: Vec<u8>,
    authorizer_id: Uuid,
) -> ApiResult<()> {
    let grant: SignedDeviceGrantV1 =
        decode_cbor(&signed_grant).map_err(|error| ApiError::Invalid(error.to_string()))?;
    let mut transaction = state.pool.begin().await?;
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))")
        .bind(vault_id.to_string())
        .execute(&mut *transaction)
        .await?;
    let existing = sqlx::query_as::<_, (Uuid, Vec<u8>, Vec<u8>)>(
        "SELECT vault_id, hpke_public_key, signing_public_key FROM devices WHERE id = $1",
    )
    .bind(request.device_id)
    .fetch_optional(&mut *transaction)
    .await?;
    if existing
        .as_ref()
        .is_some_and(|(existing_vault, hpke, signing)| {
            *existing_vault != vault_id
                || *hpke != request.hpke_public_key
                || *signing != request.signing_public_key
        })
    {
        return Err(ApiError::Conflict(
            "device identity is already bound to different Vault keys".to_owned(),
        ));
    }
    sqlx::query(
        "INSERT INTO devices \
         (id, vault_id, hpke_public_key, signing_public_key, wrapped_grant, display_name, key_version) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) \
         ON CONFLICT (id) DO UPDATE SET wrapped_grant = excluded.wrapped_grant, \
         display_name = excluded.display_name, key_version = excluded.key_version, revoked_at = NULL",
    )
    .bind(request.device_id)
    .bind(vault_id)
    .bind(request.hpke_public_key)
    .bind(request.signing_public_key)
    .bind(&signed_grant)
    .bind(request.display_name)
    .bind(i32::try_from(grant.authorization.grant.key_version).unwrap_or(i32::MAX))
    .execute(&mut *transaction)
    .await?;
    let result = sqlx::query(
        "UPDATE device_enrollments SET approved_at = now(), signed_grant = $3, \
         authorizer_device_id = $4 WHERE id = $1 AND vault_id = $2 AND approved_at IS NULL \
         AND rejected_at IS NULL AND expires_at > now()",
    )
    .bind(request_id)
    .bind(vault_id)
    .bind(signed_grant)
    .bind(authorizer_id)
    .execute(&mut *transaction)
    .await?;
    if result.rows_affected() != 1 {
        return Err(ApiError::Conflict(
            "enrollment changed while it was approved".to_owned(),
        ));
    }
    transaction.commit().await?;
    Ok(())
}

fn public_key(value: &str) -> ApiResult<Vec<u8>> {
    let bytes = decode_limited(value, 512)?;
    if bytes.len() != 65 || bytes.first() != Some(&4) {
        return Err(ApiError::Invalid(
            "device key must be an uncompressed P-256 point".to_owned(),
        ));
    }
    Ok(bytes)
}

fn decode_limited(value: &str, maximum: usize) -> ApiResult<Vec<u8>> {
    let bytes = STANDARD
        .decode(value)
        .map_err(|_| ApiError::Invalid("value must be base64".to_owned()))?;
    if bytes.len() > maximum {
        return Err(ApiError::Invalid("encoded value is too large".to_owned()));
    }
    Ok(bytes)
}

fn verification_code(request_id: Uuid, device_id: Uuid, hpke: &[u8], signing: &[u8]) -> String {
    let digest =
        Sha256::digest([request_id.as_bytes(), device_id.as_bytes(), hpke, signing].concat());
    let number = u32::from_be_bytes(digest[..4].try_into().unwrap_or_default()) % 100_000_000;
    format!("{number:08}")
}

async fn require_account_vault(
    state: &AppState,
    account_id: Uuid,
    vault_id: Uuid,
) -> ApiResult<()> {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn verification_code_is_stable_and_eight_digits() {
        let code = verification_code(Uuid::nil(), Uuid::max(), &[4; 65], &[5; 65]);
        assert_eq!(code.len(), 8);
        assert!(code.chars().all(|value| value.is_ascii_digit()));
        assert_eq!(
            code,
            verification_code(Uuid::nil(), Uuid::max(), &[4; 65], &[5; 65])
        );
    }

    #[test]
    fn device_session_proof_is_bound_to_every_identifier() {
        let first = session_proof(Uuid::nil(), Uuid::max(), 10);
        assert_ne!(first, session_proof(Uuid::max(), Uuid::max(), 10));
        assert_ne!(first, session_proof(Uuid::nil(), Uuid::nil(), 10));
        assert_ne!(first, session_proof(Uuid::nil(), Uuid::max(), 11));
    }
}
