import {
  githubBackupCatalog,
  githubBackupObject,
  configureGitHubBackup,
  listGitHubBackups,
  triggerGitHubBackup,
  type GitHubBackupSnapshot,
} from '../api/client';
import { parseMetadata } from '../markdown/metadata';
import type { NoteFile } from '../types';
import { decodeAndVerifySignedManifest, decodeVaultObject, hex, openVaultObject, openVaultPath } from './vaultProtocol';
import { ensureVaultDeviceSession } from './VaultEnrollment';
import { loadOrCreateVaultIdentity, loadVaultSyncState } from './VaultKeyStore';

export class EncryptedBackupService {
  constructor(private readonly workspaceId: string) {}

  async history() {
    const access = await this.access();
    return listGitHubBackups(access.vaultId, access.deviceToken);
  }

  async backupNow(): Promise<void> {
    const access = await this.access();
    await triggerGitHubBackup(access.vaultId, access.deviceToken);
  }

  async configure(input: { installationId: number; owner: string; repository: string }): Promise<void> {
    const access = await this.access();
    await configureGitHubBackup({
      ...input,
      vaultId: access.vaultId,
      deviceToken: access.deviceToken,
    });
  }

  async open(snapshot: GitHubBackupSnapshot): Promise<NoteFile[]> {
    const access = await this.access();
    const identity = await loadOrCreateVaultIdentity(this.workspaceId);
    try {
      const catalog = await githubBackupCatalog(access.vaultId, snapshot.commit, access.deviceToken);
      const signedBytes = unbase64(catalog.signedManifest);
      if (await sha256(signedBytes) !== catalog.manifestDigest) {
        throw new Error('GitHub snapshot manifest digest is invalid');
      }
      const signed = await decodeAndVerifySignedManifest(signedBytes);
      if (signed.manifest.vaultId !== access.vaultId || signed.manifest.sequence !== snapshot.sequence) {
        throw new Error('GitHub snapshot belongs to another Vault or sequence');
      }
      const metadata = new Map(catalog.objects.map(object => [object.objectId, object]));
      const files: NoteFile[] = [];
      for (const entry of signed.manifest.entries) {
        const object = metadata.get(entry.currentVersionId);
        if (!object || object.kind !== 'markdown') continue;
        const response = await githubBackupObject(
          access.vaultId,
          snapshot.commit,
          entry.currentVersionId,
          access.deviceToken,
        );
        const ciphertext = unbase64(response.ciphertext);
        if (await sha256(ciphertext) !== hex(entry.objectDigest)) {
          throw new Error(`GitHub snapshot object ${entry.currentVersionId} failed integrity checks`);
        }
        const encrypted = decodeVaultObject(ciphertext);
        const plaintext = await openVaultObject({
          value: encrypted,
          plaintextSize: entry.byteSize,
          masterKey: identity.masterKey,
          fileId: entry.fileId,
          versionId: entry.currentVersionId,
          parentVersionId: encrypted.parentVersionId,
          kind: encrypted.kind,
          mimeType: encrypted.mimeType,
        });
        const content = new TextDecoder('utf-8', { fatal: true }).decode(plaintext);
        files.push({
          id: entry.fileId,
          path: await openVaultPath({
            masterKey: identity.masterKey,
            fileId: entry.fileId,
            value: entry.encryptedPath,
          }),
          content,
          modifiedAt: entry.modifiedUnixMs,
          metadata: parseMetadata(content),
        });
      }
      return files;
    } finally {
      identity.masterKey.fill(0);
    }
  }

  private async access() {
    const state = await loadVaultSyncState(this.workspaceId);
    if (!state.vaultId) throw new Error('Sync once before configuring GitHub backup');
    const session = await ensureVaultDeviceSession({ workspaceId: this.workspaceId, vaultId: state.vaultId });
    return { vaultId: state.vaultId, deviceToken: session.token };
  }
}

function unbase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0));
}

async function sha256(value: Uint8Array) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', value.slice().buffer));
  return [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
