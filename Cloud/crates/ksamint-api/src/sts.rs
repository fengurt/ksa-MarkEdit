use crate::{
    config::CosConfig,
    error::{ApiError, ApiResult},
    session::AccountSession,
    state::AppState,
};
use axum::{
    Json,
    extract::{Path, State},
};
use base64::{Engine, engine::general_purpose::STANDARD};
use chrono::Utc;
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use uuid::Uuid;
use vault_protocol::{SignedManifestV1, decode_cbor};

type HmacSha256 = Hmac<Sha256>;

#[derive(Deserialize)]
#[serde(rename_all = "PascalCase")]
struct TencentResponse<T> {
    response: T,
}

#[derive(Deserialize)]
#[serde(rename_all = "PascalCase")]
struct AssumeRoleResponse {
    credentials: Option<TemporaryCredentials>,
    expiration: Option<String>,
    request_id: String,
    error: Option<TencentError>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "PascalCase")]
struct TemporaryCredentials {
    token: String,
    tmp_secret_id: String,
    tmp_secret_key: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "PascalCase")]
struct TencentError {
    code: String,
    message: String,
}

pub async fn temporary_credentials(
    State(state): State<AppState>,
    session: AccountSession,
    Path(vault_id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM vaults WHERE id = $1 AND account_id = $2)",
    )
    .bind(vault_id)
    .bind(session.account_id)
    .fetch_one(&state.pool)
    .await?;
    if !exists {
        return Err(ApiError::NotFound);
    }
    let config = state
        .config
        .cos
        .as_ref()
        .ok_or_else(|| ApiError::Unavailable("COS sync is disabled".to_owned()))?;
    let response = assume_role(&state, config, vault_id, false).await?;
    Ok(Json(response))
}

pub async fn recovery_catalog(
    State(state): State<AppState>,
    Path(vault_id): Path<Uuid>,
    Json(input): Json<RecoveryRequest>,
) -> ApiResult<Json<Value>> {
    let token = STANDARD
        .decode(input.recovery_token)
        .map_err(|_| ApiError::Unauthorized)?;
    if token.len() < 32 {
        return Err(ApiError::Unauthorized);
    }
    let digest = Sha256::digest(&token).to_vec();
    let matches = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM vaults WHERE id = $1 AND recovery_token_digest = $2)",
    )
    .bind(vault_id)
    .bind(digest)
    .fetch_one(&state.pool)
    .await?;
    if !matches {
        return Err(ApiError::Unauthorized);
    }
    let config = state
        .config
        .cos
        .as_ref()
        .ok_or_else(|| ApiError::Unavailable("COS recovery is disabled".to_owned()))?;
    let manifest = sqlx::query_as::<_, (i64, Vec<u8>, Vec<u8>)>(
        "SELECT sequence, digest, signed_cbor FROM manifests \
         WHERE vault_id = $1 ORDER BY sequence DESC LIMIT 1",
    )
    .bind(vault_id)
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
    .bind(vault_id)
    .bind(current_versions)
    .fetch_all(&state.pool)
    .await?;
    let credentials = assume_role(&state, config, vault_id, true).await?;
    Ok(Json(json!({
        "protocolVersion": 1,
        "vaultId": vault_id,
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
            "objectKey": format!("vaults/{vault_id}/objects/{id}")
        })).collect::<Vec<_>>(),
        "cos": credentials
    })))
}

pub async fn set_recovery_token(
    State(state): State<AppState>,
    session: AccountSession,
    Path(vault_id): Path<Uuid>,
    Json(input): Json<RecoveryRequest>,
) -> ApiResult<Json<Value>> {
    let token = STANDARD
        .decode(input.recovery_token)
        .map_err(|_| ApiError::Invalid("recovery token must be base64".to_owned()))?;
    if token.len() < 32 {
        return Err(ApiError::Invalid(
            "recovery token must contain at least 256 bits".to_owned(),
        ));
    }
    let result = sqlx::query(
        "UPDATE vaults SET recovery_token_digest = $3, updated_at = now() \
         WHERE id = $1 AND account_id = $2",
    )
    .bind(vault_id)
    .bind(session.account_id)
    .bind(Sha256::digest(token).to_vec())
    .execute(&state.pool)
    .await?;
    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound);
    }
    Ok(Json(json!({"configured": true})))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryRequest {
    recovery_token: String,
}

pub(crate) async fn assume_role(
    state: &AppState,
    config: &CosConfig,
    vault_id: Uuid,
    read_only: bool,
) -> ApiResult<Value> {
    let policy = cos_policy(config, vault_id, read_only);
    let body = json!({
        "RoleArn": config.role_arn,
        "RoleSessionName": format!("ksamint-{}", &vault_id.to_string()[..8]),
        "DurationSeconds": config.duration_seconds,
        "Policy": serde_json::to_string(&policy).map_err(|error| ApiError::Internal(error.into()))?
    });
    let body = serde_json::to_string(&body).map_err(|error| ApiError::Internal(error.into()))?;
    let timestamp = Utc::now().timestamp();
    let authorization = tc3_authorization(config, timestamp, &body)?;
    let response = sts_request(&state.http, config, timestamp, authorization, body)
        .send()
        .await
        .map_err(|error| ApiError::Unavailable(error.to_string()))?;
    let response: TencentResponse<AssumeRoleResponse> = response
        .json()
        .await
        .map_err(|error| ApiError::Unavailable(error.to_string()))?;
    if let Some(error) = response.response.error {
        tracing::warn!(
            code = error.code,
            request_id = response.response.request_id,
            "Tencent STS rejected AssumeRole"
        );
        return Err(ApiError::Unavailable(error.message));
    }
    Ok(json!({
        "protocolVersion": 1,
        "bucket": config.bucket,
        "region": config.region,
        "prefix": format!("vaults/{vault_id}/"),
        "expiration": response.response.expiration,
        "credentials": response.response.credentials
    }))
}

fn sts_request(
    client: &reqwest::Client,
    config: &CosConfig,
    timestamp: i64,
    authorization: String,
    body: String,
) -> reqwest::RequestBuilder {
    client
        .post("https://sts.tencentcloudapi.com")
        .header("Authorization", authorization)
        .header("Content-Type", "application/json; charset=utf-8")
        .header("Host", "sts.tencentcloudapi.com")
        .header("X-TC-Action", "AssumeRole")
        .header("X-TC-Region", &config.region)
        .header("X-TC-Timestamp", timestamp)
        .header("X-TC-Version", "2018-08-13")
        .body(body)
}

fn cos_policy(config: &CosConfig, vault_id: Uuid, read_only: bool) -> Value {
    let actions = if read_only {
        vec!["name/cos:GetObject", "name/cos:HeadObject"]
    } else {
        vec![
            "name/cos:GetObject",
            "name/cos:PutObject",
            "name/cos:HeadObject",
            "name/cos:InitiateMultipartUpload",
            "name/cos:UploadPart",
            "name/cos:CompleteMultipartUpload",
            "name/cos:ListParts",
        ]
    };
    json!({
        "version": "2.0",
        "statement": [{
            "effect": "allow",
            "action": actions,
            "resource": [
                format!(
                    "qcs::cos:{}:uid/{}:{}/vaults/{}/*",
                    config.region, config.app_id, config.bucket, vault_id
                )
            ]
        }]
    })
}

fn tc3_authorization(config: &CosConfig, timestamp: i64, body: &str) -> ApiResult<String> {
    let date = chrono::DateTime::from_timestamp(timestamp, 0)
        .ok_or_else(|| ApiError::Invalid("invalid timestamp".to_owned()))?
        .format("%Y-%m-%d")
        .to_string();
    let canonical_headers =
        "content-type:application/json; charset=utf-8\nhost:sts.tencentcloudapi.com\n";
    let signed_headers = "content-type;host";
    let hashed_payload = hex::encode(Sha256::digest(body.as_bytes()));
    let canonical_request =
        format!("POST\n/\n\n{canonical_headers}\n{signed_headers}\n{hashed_payload}");
    let credential_scope = format!("{date}/sts/tc3_request");
    let string_to_sign = format!(
        "TC3-HMAC-SHA256\n{timestamp}\n{credential_scope}\n{}",
        hex::encode(Sha256::digest(canonical_request.as_bytes()))
    );
    let secret_date = hmac(
        format!("TC3{}", config.secret_key).as_bytes(),
        date.as_bytes(),
    )?;
    let secret_service = hmac(&secret_date, b"sts")?;
    let secret_signing = hmac(&secret_service, b"tc3_request")?;
    let signature = hex::encode(hmac(&secret_signing, string_to_sign.as_bytes())?);
    Ok(format!(
        "TC3-HMAC-SHA256 Credential={}/{}, SignedHeaders={}, Signature={}",
        config.secret_id, credential_scope, signed_headers, signature
    ))
}

fn hmac(key: &[u8], value: &[u8]) -> ApiResult<Vec<u8>> {
    let mut mac = HmacSha256::new_from_slice(key)
        .map_err(|error| ApiError::Internal(anyhow::anyhow!(error)))?;
    mac.update(value);
    Ok(mac.finalize().into_bytes().to_vec())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_config() -> CosConfig {
        CosConfig {
            secret_id: "id".to_owned(),
            secret_key: "key".to_owned(),
            role_arn: "role".to_owned(),
            bucket: "bucket-123".to_owned(),
            region: "ap-singapore".to_owned(),
            app_id: "123".to_owned(),
            duration_seconds: 900,
        }
    }

    #[test]
    fn signing_is_stable() {
        let config = test_config();
        let first = tc3_authorization(&config, 1_700_000_000, "{}").expect("sign");
        let second = tc3_authorization(&config, 1_700_000_000, "{}").expect("sign");
        assert_eq!(first, second);
        assert!(first.contains("Credential=id/"));
    }

    #[test]
    fn assume_role_request_includes_required_region() {
        let request = sts_request(
            &reqwest::Client::new(),
            &test_config(),
            1_700_000_000,
            "authorization".to_owned(),
            "{}".to_owned(),
        )
        .build()
        .expect("build request");

        assert_eq!(
            request.headers().get("X-TC-Region").unwrap(),
            "ap-singapore"
        );
    }
}
