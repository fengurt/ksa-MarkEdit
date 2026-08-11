mod agent;
mod auth;
mod config;
mod enrollment;
mod error;
mod github;
mod session;
mod state;
mod sts;
mod sync_api;

use anyhow::Result;
use axum::{
    Json, Router,
    http::{HeaderValue, Method, StatusCode},
    routing::{delete, get, post, put},
};
use config::Config;
use serde_json::json;
use state::AppState;
use std::time::Duration;
use tower_cookies::CookieManagerLayer;
use tower_http::{
    catch_panic::CatchPanicLayer,
    compression::CompressionLayer,
    cors::CorsLayer,
    limit::RequestBodyLimitLayer,
    request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer},
    trace::TraceLayer,
};
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("ksamint_api=info,tower_http=info")),
        )
        .json()
        .init();
    let config = Config::from_env()?;
    let bind = config.bind;
    let state = AppState::new(config.clone()).await?;
    tokio::spawn(github::backup_worker(state.clone()));
    // Browsers serialize an Origin without a trailing slash. `Url::as_str()`
    // adds one for a bare origin, which would make every CORS preflight fail.
    let origin = HeaderValue::from_str(&config.public_origin.origin().ascii_serialization())?;
    let cors = CorsLayer::new()
        .allow_origin(origin)
        .allow_credentials(true)
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
        ])
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE]);
    let request_id = axum::http::HeaderName::from_static("x-request-id");

    let app = Router::new()
        .route("/healthz", get(health))
        .nest("/api/v1", api_routes())
        .with_state(state)
        // A signed manifest for 50,000 notes is intentionally much larger
        // than an ordinary JSON request. Encrypted objects upload directly to
        // COS, so this bound only needs to accommodate manifests and grants.
        .layer(RequestBodyLimitLayer::new(64 * 1024 * 1024))
        .layer(CookieManagerLayer::new())
        .layer(cors)
        .layer(CompressionLayer::new())
        .layer(PropagateRequestIdLayer::new(request_id.clone()))
        .layer(SetRequestIdLayer::new(request_id, MakeRequestUuid))
        .layer(TraceLayer::new_for_http())
        .layer(CatchPanicLayer::new());
    let listener = tokio::net::TcpListener::bind(bind).await?;
    tracing::info!(%bind, "ksamint API listening");
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await?;
    Ok(())
}

fn api_routes() -> Router<AppState> {
    Router::new()
        .route("/passkeys/register/options", post(auth::register_options))
        .route("/passkeys/register/verify", post(auth::register_verify))
        .route(
            "/passkeys/authenticate/options",
            post(auth::authenticate_options),
        )
        .route(
            "/passkeys/authenticate/verify",
            post(auth::authenticate_verify),
        )
        .route(
            "/vaults",
            get(sync_api::list_vaults).post(sync_api::create_vault),
        )
        .route(
            "/vaults/{vault_id}/manifest",
            get(sync_api::latest_manifest).put(sync_api::put_manifest),
        )
        .route(
            "/vaults/{vault_id}/objects",
            get(sync_api::list_objects).post(sync_api::register_object),
        )
        .route(
            "/vaults/{vault_id}/devices/{device_id}",
            put(sync_api::put_device)
                .patch(enrollment::rename_device)
                .delete(sync_api::revoke_device),
        )
        .route("/vaults/{vault_id}/devices", get(enrollment::list_devices))
        .route(
            "/vaults/{vault_id}/enrollments",
            post(enrollment::create_enrollment),
        )
        .route(
            "/vaults/{vault_id}/enrollments/{request_id}",
            get(enrollment::enrollment_status).delete(enrollment::reject_enrollment),
        )
        .route(
            "/vaults/{vault_id}/enrollments/{request_id}/approve",
            post(enrollment::approve_enrollment),
        )
        .route(
            "/vaults/{vault_id}/enrollments/{request_id}/recover",
            post(enrollment::recover_enrollment),
        )
        .route(
            "/device-sessions/exchange",
            post(enrollment::exchange_device_session),
        )
        .route(
            "/vaults/{vault_id}/capabilities/{grant_id}",
            put(sync_api::put_capability),
        )
        .route(
            "/vaults/{vault_id}/capabilities/revoke/{revocation_id}",
            delete(sync_api::revoke_capability),
        )
        .route("/vaults/{vault_id}/audit", post(sync_api::append_audit))
        .route("/vaults/{vault_id}/sts", post(sts::temporary_credentials))
        .route(
            "/vaults/{vault_id}/github",
            put(github::configure_repository),
        )
        .route(
            "/vaults/{vault_id}/github/backups",
            get(github::list_backups).post(github::trigger_backup),
        )
        .route(
            "/vaults/{vault_id}/github/backups/{commit}/catalog",
            get(github::backup_catalog),
        )
        .route(
            "/vaults/{vault_id}/github/backups/{commit}/objects/{object_id}",
            get(github::backup_object),
        )
        .route("/vaults/{vault_id}/recovery", put(sts::set_recovery_token))
        .route("/recovery/{vault_id}/catalog", post(sts::recovery_catalog))
        .route(
            "/agent/capabilities/{grant_id}/catalog",
            post(agent::capability_catalog),
        )
}

async fn health() -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::OK,
        Json(json!({
            "status": "ok",
            "service": "ksamint-api",
            "version": env!("CARGO_PKG_VERSION")
        })),
    )
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c().await.ok();
    };
    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("install SIGTERM handler")
            .recv()
            .await;
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
    tokio::time::sleep(Duration::from_millis(50)).await;
}
