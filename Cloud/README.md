# ksamint private cloud

This directory contains the optional, zero-knowledge backup service and the
independent `ksamint-vault` recovery utility. The Mac editor remains fully
usable when this service is absent.

## Components

- `vault-protocol`: deterministic CBOR, AES-256-GCM object and path
  encryption, HPKE P-256 grants, device signatures, and 24-word recovery keys.
- `ksamint-api`: Rust/Axum account, Passkey, device, manifest, object catalog,
  audit, Tencent STS, and GitHub App endpoints.
- `ksamint-vault`: recovery package creation, validation, and restore from COS,
  GitHub, or a local encrypted backup directory, plus expiring Agent grant
  creation from an offline recovery package.
- `migrations`: PostgreSQL account and encrypted-sync metadata. The database
  never receives Markdown plaintext, paths, attachment content, or vault keys.

The local MCP endpoint is implemented by the signed Mac app itself. It is not
part of the cloud container and remains disabled unless the app is launched
with `--mcp-stdio`.

## Verified infrastructure

The checked-in example uses the non-secret identifiers of the provisioned
private Singapore backup:

- COS bucket: `ksamint-vault-1308586823` (`ap-singapore`)
- STS role: `KsamintVaultStsRole`
- GitHub backup repository:
  `fengurt/ksamint-notes-backup` (private, encrypted Markdown only)

Permanent Tencent credentials and the GitHub App private key are server
secrets. They must never be copied into the Mac app, PWA, repository, build
artifact, or recovery package.

The bucket CORS rule accepts `GET`, `PUT`, and `HEAD` only from
`https://notes.apuch.cn`, with the authorization, content-type, and temporary
COS token headers needed by encrypted browser sync.

## Local validation

Use Rust 1.97 or newer:

```sh
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

Copy `.env.example` to `.env`, fill only server-side secrets, build the Web PWA,
and start Caddy plus the API:

```sh
cd ../WebApp
npm ci
npm test
npm run build
cd ../Cloud
docker compose up --build
```

## Tencent Lighthouse deployment

The production PWA and account API run at `notes.apuch.cn` and
`api.notes.apuch.cn`. The Lighthouse compose file keeps PostgreSQL, the Rust
API, and the static Web server on an internal Docker network. TLS is terminated
by the host's shared Caddy edge, so this stack does not claim public ports or
interrupt the other applications on the instance.

Deployment is executed through Tencent Automation Tools (`tccli tat
RunCommand`). On the host, run `Cloud/deploy-tencent-host.sh` from the checked
out release commit. It creates the database password on the server, serves the
already tested and committed PWA artifact, validates the Caddy and Nginx configurations,
and saves recoverable edge configuration backups under
`/opt/ksamint/backups/`.

`KSAMINT_ALLOW_REGISTRATION=true` is only needed for first-device enrollment.
After the first Passkey is registered, turn it off and restart the API.

## Recovery

Create the recovery package at vault initialization and keep the resulting file
offline. It contains the Vault Master Key as a 24-word phrase and is never
uploaded:

```sh
cargo run -p ksamint-vault -- generate-kit \
  --vault-id 00000000-0000-0000-0000-000000000000 \
  --github-repository fengurt/ksamint-notes-backup \
  --output /secure/offline/location/ksamint-recovery.json
```

Validate it without network access:

```sh
cargo run -p ksamint-vault -- verify-kit \
  --kit /secure/offline/location/ksamint-recovery.json
```

Restore a COS backup into an empty directory:

```sh
cargo run -p ksamint-vault -- restore \
  --kit /secure/offline/location/ksamint-recovery.json \
  --output /safe/restore/destination
```

The restore process verifies the signed manifest, each object digest and AEAD
tag, and refuses absolute or parent-traversal paths.

## Read-only Agent grants

Generate a dedicated P-256 identity with `@ksamint/agent-sdk`, then create a
short-lived whole-Vault grant from the offline recovery package:

```sh
cargo run -p ksamint-vault -- create-agent-grant \
  --kit /secure/offline/location/ksamint-recovery.json \
  --agent-public-key "$KSAMINT_HPKE_PUBLIC_KEY" \
  --expires-hours 24 \
  --output /secure/agent/ksamint-agent-grant.json
```

The output file is created with mode `0600`. Register its opaque
`encryptedGrant` and hashed `accessToken` through the authenticated capability
endpoint. The server can revoke or expire the capability but cannot unwrap the
Vault key. The first SDK release accepts whole-Vault read-only grants only;
path/tag scopes remain disabled until per-file key envelopes make those scopes
a cryptographic boundary.
