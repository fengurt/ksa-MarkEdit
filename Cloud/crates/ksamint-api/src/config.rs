use anyhow::{Context, Result, bail};
use std::{env, net::SocketAddr, time::Duration};
use url::Url;

#[derive(Clone)]
pub struct Config {
    pub bind: SocketAddr,
    pub database_url: String,
    pub public_origin: Url,
    pub rp_id: String,
    pub allow_registration: bool,
    pub session_ttl: Duration,
    pub challenge_ttl: Duration,
    pub cos: Option<CosConfig>,
    pub github: Option<GitHubConfig>,
}

#[derive(Clone)]
pub struct CosConfig {
    pub secret_id: String,
    pub secret_key: String,
    pub role_arn: String,
    pub bucket: String,
    pub region: String,
    pub app_id: String,
    pub duration_seconds: u32,
}

#[derive(Clone)]
pub struct GitHubConfig {
    pub app_id: u64,
    pub private_key_pem: String,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let public_origin = env::var("KSAMINT_PUBLIC_ORIGIN")
            .unwrap_or_else(|_| "https://notes.apuch.cn".to_owned())
            .parse::<Url>()
            .context("invalid KSAMINT_PUBLIC_ORIGIN")?;
        if public_origin.scheme() != "https" && public_origin.host_str() != Some("localhost") {
            bail!("passkeys require HTTPS outside localhost");
        }
        let rp_id = env::var("KSAMINT_RP_ID").unwrap_or_else(|_| {
            public_origin
                .host_str()
                .unwrap_or("notes.apuch.cn")
                .to_owned()
        });
        let cos = match (
            env::var("TENCENT_SECRET_ID").ok(),
            env::var("TENCENT_SECRET_KEY").ok(),
            env::var("TENCENT_STS_ROLE_ARN").ok(),
            env::var("TENCENT_COS_BUCKET").ok(),
            env::var("TENCENT_APP_ID").ok(),
        ) {
            (Some(secret_id), Some(secret_key), Some(role_arn), Some(bucket), Some(app_id)) => {
                Some(CosConfig {
                    secret_id,
                    secret_key,
                    role_arn,
                    bucket,
                    region: env::var("TENCENT_COS_REGION")
                        .unwrap_or_else(|_| "ap-singapore".to_owned()),
                    app_id,
                    duration_seconds: 1_800,
                })
            }
            _ => None,
        };
        let github = match (
            env::var("GITHUB_APP_ID")
                .ok()
                .filter(|value| !value.trim().is_empty()),
            env::var("GITHUB_APP_PRIVATE_KEY_PEM")
                .ok()
                .filter(|value| !value.trim().is_empty()),
        ) {
            (Some(app_id), Some(private_key_pem)) => Some(GitHubConfig {
                app_id: app_id.parse().context("invalid GITHUB_APP_ID")?,
                private_key_pem: private_key_pem.replace("\\n", "\n"),
            }),
            _ => None,
        };
        Ok(Self {
            bind: env::var("KSAMINT_BIND")
                .unwrap_or_else(|_| "127.0.0.1:8080".to_owned())
                .parse()
                .context("invalid KSAMINT_BIND")?,
            database_url: env::var("DATABASE_URL").context("DATABASE_URL is required")?,
            public_origin,
            rp_id,
            allow_registration: env::var("KSAMINT_ALLOW_REGISTRATION").as_deref() == Ok("true"),
            session_ttl: Duration::from_secs(30 * 24 * 60 * 60),
            challenge_ttl: Duration::from_secs(5 * 60),
            cos,
            github,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn public_origin_serializes_without_a_trailing_slash_for_cors() {
        let origin = "https://notes.apuch.cn".parse::<Url>().unwrap();
        assert_eq!(
            origin.origin().ascii_serialization(),
            "https://notes.apuch.cn"
        );
    }
}
