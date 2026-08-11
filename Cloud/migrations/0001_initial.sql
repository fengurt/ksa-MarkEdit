CREATE TABLE accounts (
    id UUID PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE passkeys (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    credential_id BYTEA NOT NULL UNIQUE,
    credential JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);

CREATE TABLE sessions (
    token_digest BYTEA PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX sessions_expiry_idx ON sessions (expires_at);

CREATE TABLE vaults (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    sync_sequence BIGINT NOT NULL DEFAULT 0,
    latest_manifest_digest BYTEA,
    audit_sequence BIGINT NOT NULL DEFAULT 0,
    latest_audit_hash BYTEA,
    recovery_token_digest BYTEA,
    github_installation_id BIGINT,
    github_repository_owner TEXT,
    github_repository_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX vaults_account_idx ON vaults (account_id);

CREATE TABLE devices (
    id UUID PRIMARY KEY,
    vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
    hpke_public_key BYTEA NOT NULL,
    signing_public_key BYTEA NOT NULL,
    wrapped_grant BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ
);
CREATE INDEX devices_vault_idx ON devices (vault_id);

CREATE TABLE manifests (
    vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
    sequence BIGINT NOT NULL,
    previous_digest BYTEA,
    digest BYTEA NOT NULL,
    signed_cbor BYTEA NOT NULL,
    device_public_key BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (vault_id, sequence),
    UNIQUE (vault_id, digest)
);

CREATE SEQUENCE object_event_sequence;
CREATE TABLE objects (
    id UUID PRIMARY KEY,
    vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('markdown', 'attachment', 'vector_shard', 'manifest')),
    cipher_size BIGINT NOT NULL CHECK (cipher_size > 0),
    digest BYTEA NOT NULL,
    event_sequence BIGINT NOT NULL DEFAULT nextval('object_event_sequence'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX objects_vault_cursor_idx ON objects (vault_id, event_sequence);
CREATE UNIQUE INDEX objects_vault_digest_idx ON objects (vault_id, digest);

CREATE TABLE capability_grants (
    id UUID PRIMARY KEY,
    vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
    revocation_id UUID NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    encrypted_grant BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ
);
CREATE INDEX capability_vault_idx ON capability_grants (vault_id);

CREATE TABLE audit_events (
    vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
    sequence BIGINT NOT NULL,
    previous_hash BYTEA NOT NULL,
    entry_hash BYTEA NOT NULL,
    encrypted_entry BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (vault_id, sequence)
);
