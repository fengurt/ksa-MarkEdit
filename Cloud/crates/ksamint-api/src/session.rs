use crate::{
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{extract::FromRequestParts, http::request::Parts};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use sha2::{Digest, Sha256};
use std::time::{SystemTime, UNIX_EPOCH};
use tower_cookies::{Cookie, Cookies, cookie::SameSite};
use uuid::Uuid;

pub const SESSION_COOKIE: &str = "__Host-ksamint_session";
pub const CHALLENGE_COOKIE: &str = "__Host-ksamint_challenge";

pub struct AccountSession {
    pub account_id: Uuid,
}

impl FromRequestParts<AppState> for AccountSession {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let cookies = Cookies::from_request_parts(parts, state)
            .await
            .map_err(|_| ApiError::Unauthorized)?;
        let token = cookies.get(SESSION_COOKIE).ok_or(ApiError::Unauthorized)?;
        let digest = token_digest(token.value());
        let account_id = sqlx::query_scalar::<_, Uuid>(
            "SELECT account_id FROM sessions WHERE token_digest = $1 AND expires_at > now()",
        )
        .bind(digest)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(ApiError::Unauthorized)?;
        Ok(Self { account_id })
    }
}

pub async fn create_session(
    state: &AppState,
    cookies: &Cookies,
    account_id: Uuid,
) -> ApiResult<()> {
    let mut bytes = [0_u8; 32];
    getrandom::fill(&mut bytes)
        .map_err(|_| ApiError::Unavailable("secure randomness unavailable".to_owned()))?;
    let token = URL_SAFE_NO_PAD.encode(bytes);
    let expires_at = chrono::Utc::now()
        + chrono::Duration::from_std(state.config.session_ttl)
            .map_err(|error| ApiError::Internal(error.into()))?;
    sqlx::query("INSERT INTO sessions (token_digest, account_id, expires_at) VALUES ($1, $2, $3)")
        .bind(token_digest(&token))
        .bind(account_id)
        .bind(expires_at)
        .execute(&state.pool)
        .await?;
    let cookie = Cookie::build((SESSION_COOKIE, token))
        .path("/")
        .http_only(true)
        .secure(true)
        .same_site(SameSite::Strict)
        .max_age(tower_cookies::cookie::time::Duration::seconds(
            state.config.session_ttl.as_secs() as i64,
        ))
        .build();
    cookies.add(cookie);
    Ok(())
}

pub async fn optional_account(state: &AppState, cookies: &Cookies) -> ApiResult<Option<Uuid>> {
    let Some(token) = cookies.get(SESSION_COOKIE) else {
        return Ok(None);
    };
    let account_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT account_id FROM sessions WHERE token_digest = $1 AND expires_at > now()",
    )
    .bind(token_digest(token.value()))
    .fetch_optional(&state.pool)
    .await?;
    Ok(account_id)
}

pub fn set_challenge_cookie(cookies: &Cookies, id: Uuid) {
    cookies.add(challenge_cookie(id));
}

fn challenge_cookie(id: Uuid) -> Cookie<'static> {
    Cookie::build((CHALLENGE_COOKIE, id.to_string()))
        // Cookies with the __Host- prefix must use Path=/, otherwise
        // conforming browsers silently reject the Set-Cookie header.
        .path("/")
        .http_only(true)
        .secure(true)
        .same_site(SameSite::Strict)
        .max_age(tower_cookies::cookie::time::Duration::minutes(5))
        .build()
}

pub fn take_challenge_cookie(cookies: &Cookies) -> ApiResult<Uuid> {
    let cookie = cookies
        .get(CHALLENGE_COOKIE)
        .ok_or_else(|| ApiError::Invalid("challenge has expired".to_owned()))?;
    let id = Uuid::parse_str(cookie.value())
        .map_err(|_| ApiError::Invalid("invalid challenge".to_owned()))?;
    cookies.remove(Cookie::build((CHALLENGE_COOKIE, "")).path("/").build());
    Ok(id)
}

fn token_digest(value: &str) -> Vec<u8> {
    Sha256::digest(value.as_bytes()).to_vec()
}

pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn host_prefixed_challenge_cookie_uses_root_path() {
        let cookie = challenge_cookie(Uuid::nil());
        assert_eq!(cookie.name(), CHALLENGE_COOKIE);
        assert_eq!(cookie.path(), Some("/"));
        assert_eq!(cookie.secure(), Some(true));
        assert_eq!(cookie.http_only(), Some(true));
        assert_eq!(cookie.same_site(), Some(SameSite::Strict));
    }
}
