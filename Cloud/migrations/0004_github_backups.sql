CREATE TABLE github_backup_jobs (
    vault_id UUID PRIMARY KEY REFERENCES vaults(id) ON DELETE CASCADE,
    requested_sequence BIGINT NOT NULL,
    not_before TIMESTAMPTZ NOT NULL,
    leased_until TIMESTAMPTZ,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE github_backups (
    id UUID PRIMARY KEY,
    vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
    sequence BIGINT NOT NULL,
    commit_sha TEXT NOT NULL,
    catalog JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (vault_id, sequence),
    UNIQUE (vault_id, commit_sha)
);

CREATE INDEX github_backups_vault_created_idx
    ON github_backups(vault_id, created_at DESC);

CREATE TABLE github_backup_objects (
    vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
    object_id UUID NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
    first_commit_sha TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (vault_id, object_id)
);
