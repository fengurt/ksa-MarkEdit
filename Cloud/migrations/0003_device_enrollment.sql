ALTER TABLE devices
    ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT 'Device',
    ADD COLUMN IF NOT EXISTS key_version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

CREATE TABLE device_enrollments (
    id UUID PRIMARY KEY,
    vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    device_id UUID NOT NULL,
    display_name TEXT NOT NULL,
    hpke_public_key BYTEA NOT NULL,
    signing_public_key BYTEA NOT NULL,
    verification_code TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    consumed_at TIMESTAMPTZ,
    signed_grant BYTEA,
    authorizer_device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    UNIQUE (vault_id, device_id)
);
CREATE INDEX device_enrollments_pending_idx
    ON device_enrollments (vault_id, expires_at)
    WHERE approved_at IS NULL AND rejected_at IS NULL;

CREATE TABLE device_sessions (
    token_digest BYTEA PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ
);
CREATE INDEX device_sessions_device_idx ON device_sessions (device_id, expires_at);
