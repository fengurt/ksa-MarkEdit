import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  authenticatedData,
  hex,
  openVaultObject,
  sealVaultObject,
  unhex,
} from './vaultProtocol';

type Vector = {
  masterKeyHex: string;
  fileId: string;
  versionId: string;
  plaintextUtf8: string;
  plaintextSize: number;
  nonceHex: string;
  aadHex: string;
  paddedSize: number;
  ciphertextSha256Hex: string;
  authenticationTagHex: string;
};

const vector = JSON.parse(readFileSync(
  new URL('../../../Cloud/test-vectors/vault-object-v1.json', import.meta.url),
  'utf8',
)) as Vector;

describe('VaultObjectV1 cross-language vector', () => {
  it('matches Rust AES-GCM, HKDF, padding and AAD bytes', async () => {
    const plaintext = new TextEncoder().encode(vector.plaintextUtf8);
    const sealed = await sealVaultObject({
      plaintext,
      masterKey: unhex(vector.masterKeyHex),
      fileId: vector.fileId,
      versionId: vector.versionId,
      nonce: unhex(vector.nonceHex),
    });
    expect(sealed.paddedSize).toBe(vector.paddedSize);
    expect(hex(sealed.authenticationTag)).toBe(vector.authenticationTagHex);
    expect(hex(new Uint8Array(await crypto.subtle.digest(
      'SHA-256',
      sealed.ciphertext.slice().buffer as ArrayBuffer,
    ))))
      .toBe(vector.ciphertextSha256Hex);
    expect(hex(authenticatedData({
      fileId: vector.fileId,
      versionId: vector.versionId,
      kind: 'markdown',
      mimeType: 'text/markdown',
      paddedSize: vector.paddedSize,
    }))).toBe(vector.aadHex);
    const opened = await openVaultObject({
      value: sealed,
      plaintextSize: vector.plaintextSize,
      masterKey: unhex(vector.masterKeyHex),
      fileId: vector.fileId,
      versionId: vector.versionId,
    });
    expect(new TextDecoder().decode(opened)).toBe(vector.plaintextUtf8);
  });

  it('rejects ciphertext mutation', async () => {
    const sealed = await sealVaultObject({
      plaintext: new TextEncoder().encode(vector.plaintextUtf8),
      masterKey: unhex(vector.masterKeyHex),
      fileId: vector.fileId,
      versionId: vector.versionId,
      nonce: unhex(vector.nonceHex),
    });
    sealed.ciphertext[0] ^= 1;
    await expect(openVaultObject({
      value: sealed,
      plaintextSize: vector.plaintextSize,
      masterKey: unhex(vector.masterKeyHex),
      fileId: vector.fileId,
      versionId: vector.versionId,
    })).rejects.toThrow();
  });
});
