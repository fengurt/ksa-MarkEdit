use crate::{
    error::{ApiError, ApiResult},
    session::AccountSession,
    state::AppState,
};
use axum::{
    Json,
    extract::{Path, State},
};
use jsonwebtoken::{Algorithm, EncodingKey, Header, encode};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryConfiguration {
    installation_id: i64,
    owner: String,
    repository: String,
}

#[derive(Serialize)]
struct AppClaims {
    iat: i64,
    exp: i64,
    iss: String,
}

#[derive(Deserialize)]
struct InstallationToken {
    token: String,
    expires_at: String,
    permissions: Value,
}

pub async fn configure_repository(
    State(state): State<AppState>,
    session: AccountSession,
    Path(vault_id): Path<Uuid>,
    Json(input): Json<RepositoryConfiguration>,
) -> ApiResult<Json<Value>> {
    if input.installation_id <= 0
        || !valid_github_name(&input.owner)
        || !valid_github_name(&input.repository)
    {
        return Err(ApiError::Invalid(
            "invalid GitHub installation or repository".to_owned(),
        ));
    }
    let result = sqlx::query(
        "UPDATE vaults SET github_installation_id = $3, github_repository_owner = $4, \
         github_repository_name = $5, updated_at = now() WHERE id = $1 AND account_id = $2",
    )
    .bind(vault_id)
    .bind(session.account_id)
    .bind(input.installation_id)
    .bind(&input.owner)
    .bind(&input.repository)
    .execute(&state.pool)
    .await?;
    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound);
    }
    Ok(Json(json!({
        "configured": true,
        "repository": format!("{}/{}", input.owner, input.repository)
    })))
}

pub async fn installation_token(
    State(state): State<AppState>,
    session: AccountSession,
    Path(vault_id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let github = state
        .config
        .github
        .as_ref()
        .ok_or_else(|| ApiError::Unavailable("GitHub backup is disabled".to_owned()))?;
    let repository = sqlx::query_as::<_, (i64, String, String)>(
        "SELECT github_installation_id, github_repository_owner, github_repository_name \
         FROM vaults WHERE id = $1 AND account_id = $2 \
         AND github_installation_id IS NOT NULL",
    )
    .bind(vault_id)
    .bind(session.account_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(ApiError::NotFound)?;
    let now = chrono::Utc::now().timestamp();
    let claims = AppClaims {
        iat: now - 30,
        exp: now + 9 * 60,
        iss: github.app_id.to_string(),
    };
    let key = EncodingKey::from_rsa_pem(github.private_key_pem.as_bytes())
        .map_err(|error| ApiError::Unavailable(error.to_string()))?;
    let jwt = encode(&Header::new(Algorithm::RS256), &claims, &key)
        .map_err(|error| ApiError::Unavailable(error.to_string()))?;
    let response = state
        .http
        .post(format!(
            "https://api.github.com/app/installations/{}/access_tokens",
            repository.0
        ))
        .bearer_auth(jwt)
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "ksamint-notes-backup")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .json(&json!({
            "repositories": [repository.2],
            "permissions": {"contents": "write"}
        }))
        .send()
        .await
        .map_err(|error| ApiError::Unavailable(error.to_string()))?;
    if !response.status().is_success() {
        tracing::warn!(
            status = %response.status(),
            "GitHub rejected installation token request"
        );
        return Err(ApiError::Unavailable(
            "GitHub App installation is unavailable".to_owned(),
        ));
    }
    let token: InstallationToken = response
        .json()
        .await
        .map_err(|error| ApiError::Unavailable(error.to_string()))?;
    if token.permissions.get("contents").and_then(Value::as_str) != Some("write") {
        return Err(ApiError::Forbidden);
    }
    Ok(Json(json!({
        "token": token.token,
        "expiresAt": token.expires_at,
        "repository": format!("{}/{}", repository.1, repository.2),
        "permissions": {"contents": "write"}
    })))
}

fn valid_github_name(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 100
        && value.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.')
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn repository_names_reject_path_or_url_injection() {
        assert!(valid_github_name("ksamint-notes-backup"));
        assert!(!valid_github_name("../other"));
        assert!(!valid_github_name("owner/repo"));
        assert!(!valid_github_name("https://github.com"));
    }
}
