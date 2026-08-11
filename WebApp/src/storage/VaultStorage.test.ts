import { describe, expect, it } from 'vitest';
import { migrateVaultManifest } from './VaultStorage';

describe('Vault manifest v2 migration', () => {
  it('upgrades v1 Markdown records without changing identities or paths', () => {
    const migrated = migrateVaultManifest({
      version: 1,
      id: 'offline',
      name: 'Personal Workspace',
      updatedAt: 42,
      files: [{ id: 'one', path: 'Café/计划.md', modifiedAt: 41 }],
    });
    expect(migrated).toEqual({
      version: 2,
      id: 'offline',
      name: 'Personal Workspace',
      updatedAt: 42,
      files: [{
        id: 'one',
        path: 'Café/计划.md',
        modifiedAt: 41,
        kind: 'markdown',
        mimeType: 'text/markdown',
        byteSize: 0,
      }],
    });
  });

  it('leaves v2 attachment metadata intact', () => {
    const manifest = {
      version: 2 as const,
      id: 'offline',
      name: 'Personal Workspace',
      updatedAt: 42,
      files: [{
        id: 'asset',
        path: 'Conversations/Assets/hash.png',
        modifiedAt: 41,
        kind: 'attachment' as const,
        mimeType: 'image/png',
        byteSize: 12,
        contentDigest: 'hash',
      }],
    };
    expect(migrateVaultManifest(manifest)).toEqual(manifest);
  });
});
