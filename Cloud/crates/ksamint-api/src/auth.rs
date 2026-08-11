use crate::{
    error::{ApiError, ApiResult},
    session::{create_session, optional_account, set_challenge_cookie, take_challenge_cookie},
    state::{AppState, PendingAuthentication, PendingRegistration},
};
use axum::{Json, extract::State};
use serde_json::{Value, json};
use std::time::Instant;
use tower_cookies::Cookies;
use uuid::Uuid;
use webauthn_rs::prelude::{
    CredentialID, Passkey, PublicKeyCredential, RegisterPublicKeyCredential,
};

pub async fn register_options(
    State(state): State<AppState>,
    cookies: Cookies,
) -> ApiResult<Json<Value>> {
    state.prune_challenges();
    let account_id = if let Some(account_id) = optional_account(&state, &cookies).await? {
        account_id
    } else {
        if !state.config.allow_registration {
            return Err(ApiError::Forbidden);
        }
        if let Some(account_id) = sqlx::query_scalar::<_, Uuid>("SELECT id FROM accounts LIMIT 1")
            .fetch_optional(&state.pool)
            .await?
        {
            let credential_count =
                sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM passkeys WHERE account_id = $1")
                    .bind(account_id)
                    .fetch_one(&state.pool)
                    .await?;
            if credential_count > 0 {
                return Err(ApiError::Forbidden);
            }
            account_id
        } else {
            let id = Uuid::new_v4();
            sqlx::query("INSERT INTO accounts (id) VALUES ($1)")
                .bind(id)
                .execute(&state.pool)
                .await?;
            sqlx::query(
                "INSERT INTO vaults (id, account_id, display_name) VALUES ($1, $2, 'Notes')",
            )
            .bind(Uuid::new_v4())
            .bind(id)
            .execute(&state.pool)
            .await?;
            id
        }
    };
    let credentials = load_passkeys_for_account(&state, account_id).await?;
    let excluded = (!credentials.is_empty()).then(|| {
        credentials
            .iter()
            .map(|passkey| CredentialID::from(passkey.cred_id().to_vec()))
            .collect()
    });
    let (options, registration) = state
        .webauthn
        .start_passkey_registration(
            account_id,
            &format!("user-{}", &account_id.to_string()[..8]),
            "ksamint MarkEdit",
            excluded,
        )
        .map_err(|error| ApiError::Invalid(error.to_string()))?;
    let challenge_id = Uuid::new_v4();
    state.registrations.insert(
        challenge_id,
        PendingRegistration {
            account_id,
            state: registration,
            created_at: Instant::now(),
        },
    );
    set_challenge_cookie(&cookies, challenge_id);
    Ok(Json(
        serde_json::to_value(options).map_err(|error| ApiError::Internal(error.into()))?,
    ))
}

pub async fn register_verify(
    State(state): State<AppState>,
    cookies: Cookies,
    Json(credential): Json<RegisterPublicKeyCredential>,
) -> ApiResult<Json<Value>> {
    let challenge_id = take_challenge_cookie(&cookies)?;
    let (_, pending) = state
        .registrations
        .remove(&challenge_id)
        .ok_or_else(|| ApiError::Invalid("challenge has expired".to_owned()))?;
    let passkey = state
        .webauthn
        .finish_passkey_registration(&credential, &pending.state)
        .map_err(|error| ApiError::Invalid(error.to_string()))?;
    let credential_id = passkey.cred_id().to_vec();
    let encoded =
        serde_json::to_value(&passkey).map_err(|error| ApiError::Internal(error.into()))?;
    let inserted = sqlx::query(
        "INSERT INTO passkeys (id, account_id, credential_id, credential) \
         VALUES ($1, $2, $3, $4) ON CONFLICT (credential_id) DO NOTHING",
    )
    .bind(Uuid::new_v4())
    .bind(pending.account_id)
    .bind(credential_id)
    .bind(encoded)
    .execute(&state.pool)
    .await?;
    if inserted.rows_affected() != 1 {
        return Err(ApiError::Conflict(
            "credential is already registered".to_owned(),
        ));
    }
    create_session(&state, &cookies, pending.account_id).await?;
    Ok(Json(json!({"ok": true})))
}

pub async fn authenticate_options(
    State(state): State<AppState>,
    cookies: Cookies,
) -> ApiResult<Json<Value>> {
    state.prune_challenges();
    let account_id = sqlx::query_scalar::<_, Uuid>("SELECT id FROM accounts LIMIT 1")
        .fetch_optional(&state.pool)
        .await?
        .ok_or(ApiError::NotFound)?;
    let passkeys = load_passkeys_for_account(&state, account_id).await?;
    if passkeys.is_empty() {
        return Err(ApiError::NotFound);
    }
    let (options, authentication) = state
        .webauthn
        .start_passkey_authentication(&passkeys)
        .map_err(|error| ApiError::Invalid(error.to_string()))?;
    let challenge_id = Uuid::new_v4();
    state.authentications.insert(
        challenge_id,
        PendingAuthentication {
            account_id,
            state: authentication,
            created_at: Instant::now(),
        },
    );
    set_challenge_cookie(&cookies, challenge_id);
    Ok(Json(
        serde_json::to_value(options).map_err(|error| ApiError::Internal(error.into()))?,
    ))
}

pub async fn authenticate_verify(
    State(state): State<AppState>,
    cookies: Cookies,
    Json(credential): Json<PublicKeyCredential>,
) -> ApiResult<Json<Value>> {
    let challenge_id = take_challenge_cookie(&cookies)?;
    let (_, pending) = state
        .authentications
        .remove(&challenge_id)
        .ok_or_else(|| ApiError::Invalid("challenge has expired".to_owned()))?;
    let result = state
        .webauthn
        .finish_passkey_authentication(&credential, &pending.state)
        .map_err(|error| ApiError::Invalid(error.to_string()))?;
    let row = sqlx::query_as::<_, (Uuid, Value)>(
        "SELECT id, credential FROM passkeys WHERE account_id = $1 AND credential_id = $2",
    )
    .bind(pending.account_id)
    .bind(result.cred_id().to_vec())
    .fetch_optional(&state.pool)
    .await?
    .ok_or(ApiError::Unauthorized)?;
    let mut passkey: Passkey =
        serde_json::from_value(row.1).map_err(|error| ApiError::Internal(error.into()))?;
    if passkey.update_credential(&result) == Some(true) {
        sqlx::query("UPDATE passkeys SET credential = $1, last_used_at = now() WHERE id = $2")
            .bind(serde_json::to_value(passkey).map_err(|error| ApiError::Internal(error.into()))?)
            .bind(row.0)
            .execute(&state.pool)
            .await?;
    } else {
        sqlx::query("UPDATE passkeys SET last_used_at = now() WHERE id = $1")
            .bind(row.0)
            .execute(&state.pool)
            .await?;
    }
    create_session(&state, &cookies, pending.account_id).await?;
    Ok(Json(json!({"ok": true})))
}

async fn load_passkeys_for_account(state: &AppState, account_id: Uuid) -> ApiResult<Vec<Passkey>> {
    let values = sqlx::query_scalar::<_, Value>(
        "SELECT credential FROM passkeys WHERE account_id = $1 AND revoked_at IS NULL",
    )
    .bind(account_id)
    .fetch_all(&state.pool)
    .await?;
    values
        .into_iter()
        .map(|value| {
            serde_json::from_value(value).map_err(|error| ApiError::Internal(error.into()))
        })
        .collect()
}
