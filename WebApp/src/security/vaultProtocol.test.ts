import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  authenticatedData,
  decodeAndVerifySignedManifest,
  decodeVaultObject,
  encodeVaultManifest,
  encodeVaultObject,
  hex,
  openVaultObject,
  openVaultPath,
  sealVaultPath,
  signVaultManifest,
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
  objectDigestHex: string;
  pathNonceHex: string;
  pathCiphertextHex: string;
  pathAuthenticationTagHex: string;
  manifestCborSha256Hex: string;
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
    const object = encodeVaultObject({
      fileId: vector.fileId,
      versionId: vector.versionId,
      nonce: sealed.nonce,
      ciphertext: sealed.ciphertext,
      authenticationTag: sealed.authenticationTag,
      paddedSize: sealed.paddedSize,
    });
    const decodedObject = decodeVaultObject(object);
    expect(decodedObject.fileId).toBe(vector.fileId);
    expect(decodedObject.versionId).toBe(vector.versionId);
    expect(decodedObject.paddedSize).toBe(vector.paddedSize);
    expect(hex(new Uint8Array(await crypto.subtle.digest(
      'SHA-256',
      object.slice().buffer as ArrayBuffer,
    ))))
      .toBe(vector.objectDigestHex);
    const encryptedPath = await sealVaultPath({
      masterKey: unhex(vector.masterKeyHex),
      fileId: vector.fileId,
      path: 'notes/语言.md',
      nonce: unhex(vector.pathNonceHex),
    });
    expect(hex(encryptedPath.ciphertext)).toBe(vector.pathCiphertextHex);
    expect(hex(encryptedPath.authenticationTag)).toBe(vector.pathAuthenticationTagHex);
    expect(await openVaultPath({
      masterKey: unhex(vector.masterKeyHex),
      fileId: vector.fileId,
      value: encryptedPath,
    })).toBe('notes/语言.md');
    const manifestRecord = {
      vaultId: '00000000-0000-0000-0000-000000000009',
      sequence: 1,
      entries: [{
        fileId: vector.fileId,
        currentVersionId: vector.versionId,
        encryptedPath,
        objectDigest: unhex(vector.objectDigestHex),
        byteSize: vector.plaintextSize,
        modifiedUnixMs: 1_700_000_000_000,
      }],
    };
    const manifest = encodeVaultManifest(manifestRecord);
    expect(hex(new Uint8Array(await crypto.subtle.digest(
      'SHA-256',
      manifest.slice().buffer as ArrayBuffer,
    ))))
      .toBe(vector.manifestCborSha256Hex);
    const signing = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    );
    const signedManifest = await signVaultManifest(
      manifestRecord,
      signing.privateKey,
      signing.publicKey,
    );
    const verifiedManifest = await decodeAndVerifySignedManifest(signedManifest);
    expect(verifiedManifest.manifest.vaultId).toBe(manifestRecord.vaultId);
    expect(verifiedManifest.manifest.entries[0].currentVersionId).toBe(vector.versionId);
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
