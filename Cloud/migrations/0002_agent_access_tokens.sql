ALTER TABLE capability_grants
    ADD COLUMN access_token_digest BYTEA;

-- v1.4 did not expose remote Agent catalogs, so pre-v2 grants cannot possess
-- the required bearer token. Invalidate only those ephemeral grants during
-- upgrade instead of manufacturing an authentication secret.
DELETE FROM capability_grants;

ALTER TABLE capability_grants
    ALTER COLUMN access_token_digest SET NOT NULL;
