use crate::config::Config;
use anyhow::{Context, Result};
use dashmap::DashMap;
use sqlx::PgPool;
use std::{sync::Arc, time::Instant};
use url::Url;
use uuid::Uuid;
use webauthn_rs::{
    Webauthn, WebauthnBuilder,
    prelude::{PasskeyAuthentication, PasskeyRegistration},
};

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub config: Config,
    pub webauthn: Arc<Webauthn>,
    pub registrations: Arc<DashMap<Uuid, PendingRegistration>>,
    pub authentications: Arc<DashMap<Uuid, PendingAuthentication>>,
    pub http: reqwest::Client,
}

pub struct PendingRegistration {
    pub account_id: Uuid,
    pub state: PasskeyRegistration,
    pub created_at: Instant,
}

pub struct PendingAuthentication {
    pub account_id: Uuid,
    pub state: PasskeyAuthentication,
    pub created_at: Instant,
}

impl AppState {
    pub async fn new(config: Config) -> Result<Self> {
        let pool = PgPool::connect(&config.database_url)
            .await
            .context("connect PostgreSQL")?;
        sqlx::migrate!("../../migrations")
            .run(&pool)
            .await
            .context("run migrations")?;
        let rp_origin = Url::parse(config.public_origin.as_str())?;
        let webauthn = WebauthnBuilder::new(&config.rp_id, &rp_origin)
            .context("create WebAuthn configuration")?
            .rp_name("kmd")
            .build()
            .context("build WebAuthn configuration")?;
        Ok(Self {
            pool,
            config,
            webauthn: Arc::new(webauthn),
            registrations: Arc::new(DashMap::new()),
            authentications: Arc::new(DashMap::new()),
            http: reqwest::Client::builder()
                .https_only(true)
                .timeout(std::time::Duration::from_secs(15))
                .build()?,
        })
    }

    pub fn prune_challenges(&self) {
        let ttl = self.config.challenge_ttl;
        self.registrations
            .retain(|_, pending| pending.created_at.elapsed() < ttl);
        self.authentications
            .retain(|_, pending| pending.created_at.elapsed() < ttl);
    }
}
