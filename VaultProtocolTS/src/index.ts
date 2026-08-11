// Shared by the Web PWA and the read-only Agent SDK.
const OBJECT_DOMAIN = new TextEncoder().encode('ksamint/vault-object/v1');
const PATH_DOMAIN = new TextEncoder().encode('ksamint/vault-path/v1');
const KEY_SALT = new TextEncoder().encode('ksamint/vault/v1');
const PADDING_BLOCK = 4_096;

export type VaultObjectCiphertext = {
  nonce: Uint8Array;
  ciphertext: Uint8Array;
  authenticationTag: Uint8Array;
  paddedSize: number;
};

export type VaultObjectRecord = VaultObjectCiphertext & {
  fileId: string;
  versionId: string;
  parentVersionId?: string;
  kind?: 'markdown' | 'attachment' | 'vector_shard' | 'manifest';
  mimeType?: string;
};

export type EncryptedPathRecord = {
  nonce: Uint8Array;
  ciphertext: Uint8Array;
  authenticationTag: Uint8Array;
};

export type VaultManifestEntry = {
  fileId: string;
  currentVersionId: string;
  encryptedPath: EncryptedPathRecord;
  objectDigest: Uint8Array;
  byteSize: number;
  modifiedUnixMs: number;
};

export type VaultTombstone = {
  fileId: string;
  deletedVersionId: string;
  deletedUnixMs: number;
};

export type VaultManifestRecord = {
  vaultId: string;
  sequence: number;
  previousManifestDigest?: Uint8Array;
  entries: VaultManifestEntry[];
  tombstones?: VaultTombstone[];
  keyVersion?: number;
  extensions?: Record<string, Uint8Array>;
};

export type SignedVaultManifestRecord = {
  manifest: VaultManifestRecord;
  deviceSigningPublicKey: Uint8Array;
  signature: Uint8Array;
};

export type HpkeEnvelopeRecord = {
  encapsulatedKey: Uint8Array;
  ciphertext: Uint8Array;
};

export type CapabilityGrantRecord = {
  grantId: string;
  agentHpkePublicKey: Uint8Array;
  permission: 'read_only' | 'read_write';
  allowedPathPrefixes: EncryptedPathRecord[];
  allowedTagIdentities: Uint8Array[];
  expiresUnixMs: number;
  revocationId: string;
  wrappedCapabilityKey: HpkeEnvelopeRecord;
};

export async function sealVaultObject({
  plaintext,
  masterKey,
  fileId,
  versionId,
  parentVersionId,
  kind = 'markdown',
  mimeType = 'text/markdown',
  nonce = crypto.getRandomValues(new Uint8Array(12)),
}: {
  plaintext: Uint8Array;
  masterKey: Uint8Array;
  fileId: string;
  versionId: string;
  parentVersionId?: string;
  kind?: string;
  mimeType?: string;
  nonce?: Uint8Array;
}): Promise<VaultObjectCiphertext> {
  if (masterKey.length !== 32 || nonce.length !== 12) {
    throw new Error('Invalid Vault key or nonce');
  }
  const paddedSize = Math.max(PADDING_BLOCK, Math.ceil(plaintext.length / PADDING_BLOCK) * PADDING_BLOCK);
  const padded = new Uint8Array(paddedSize);
  padded.set(plaintext);
  const key = await objectKey(masterKey, fileId, versionId);
  const sealed = new Uint8Array(await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: copyBuffer(nonce),
      additionalData: copyBuffer(authenticatedData({
        fileId,
        versionId,
        parentVersionId,
        kind,
        mimeType,
        paddedSize,
      })),
      tagLength: 128,
    },
    key,
    copyBuffer(padded),
  ));
  return {
    nonce,
    ciphertext: sealed.slice(0, -16),
    authenticationTag: sealed.slice(-16),
    paddedSize,
  };
}

export async function openVaultObject({
  value,
  plaintextSize,
  masterKey,
  fileId,
  versionId,
  parentVersionId,
  kind = 'markdown',
  mimeType = 'text/markdown',
}: {
  value: VaultObjectCiphertext;
  plaintextSize: number;
  masterKey: Uint8Array;
  fileId: string;
  versionId: string;
  parentVersionId?: string;
  kind?: string;
  mimeType?: string;
}): Promise<Uint8Array> {
  if (
    masterKey.length !== 32
    || value.nonce.length !== 12
    || value.authenticationTag.length !== 16
    || value.paddedSize !== value.ciphertext.length
    || value.paddedSize < PADDING_BLOCK
    || value.paddedSize % PADDING_BLOCK !== 0
  ) {
    throw new Error('Invalid Vault ciphertext');
  }
  const combined = new Uint8Array(value.ciphertext.length + value.authenticationTag.length);
  combined.set(value.ciphertext);
  combined.set(value.authenticationTag, value.ciphertext.length);
  const key = await objectKey(masterKey, fileId, versionId);
  const plaintext = new Uint8Array(await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: copyBuffer(value.nonce),
      additionalData: copyBuffer(authenticatedData({
        fileId,
        versionId,
        parentVersionId,
        kind,
        mimeType,
        paddedSize: value.paddedSize,
      })),
      tagLength: 128,
    },
    key,
    copyBuffer(combined),
  ));
  if (plaintextSize < 0 || plaintextSize > plaintext.length) {
    throw new Error('Invalid Vault plaintext size');
  }
  return plaintext.slice(0, plaintextSize);
}

export function authenticatedData({
  fileId,
  versionId,
  parentVersionId,
  kind,
  mimeType,
  paddedSize,
}: {
  fileId: string;
  versionId: string;
  parentVersionId?: string;
  kind: string;
  mimeType: string;
  paddedSize: number;
}): Uint8Array {
  const encoder = new CborEncoder();
  encoder.array(8);
  encoder.array(OBJECT_DOMAIN.length);
  for (const byte of OBJECT_DOMAIN) {
    encoder.unsigned(byte);
  }
  encoder.unsigned(1);
  encoder.bytes(uuidBytes(fileId));
  encoder.bytes(uuidBytes(versionId));
  if (parentVersionId) {
    encoder.bytes(uuidBytes(parentVersionId));
  } else {
    encoder.null();
  }
  encoder.text(kind);
  encoder.text(mimeType);
  encoder.unsigned(paddedSize);
  return encoder.output();
}

export function encodeVaultObject({
  fileId,
  versionId,
  parentVersionId,
  kind = 'markdown',
  mimeType = 'text/markdown',
  paddedSize,
  nonce,
  ciphertext,
  authenticationTag,
}: VaultObjectRecord): Uint8Array {
  const encoder = new CborEncoder();
  encoder.map(11);
  encoder.text('protocol_version');
  encoder.unsigned(1);
  encoder.text('file_id');
  encoder.bytes(uuidBytes(fileId));
  encoder.text('version_id');
  encoder.bytes(uuidBytes(versionId));
  encoder.text('parent_version_id');
  if (parentVersionId) {
    encoder.bytes(uuidBytes(parentVersionId));
  } else {
    encoder.null();
  }
  encoder.text('kind');
  encoder.text(kind);
  encoder.text('mime_type');
  encoder.text(mimeType);
  encoder.text('padded_size');
  encoder.unsigned(paddedSize);
  encoder.text('cipher_suite');
  encoder.text('aes256_gcm');
  encoder.text('nonce');
  encoder.bytes(nonce);
  encoder.text('ciphertext');
  encoder.bytes(ciphertext);
  encoder.text('authentication_tag');
  encoder.bytes(authenticationTag);
  return encoder.output();
}

export async function sealVaultPath({
  masterKey,
  fileId,
  path,
  nonce = crypto.getRandomValues(new Uint8Array(12)),
}: {
  masterKey: Uint8Array;
  fileId: string;
  path: string;
  nonce?: Uint8Array;
}): Promise<EncryptedPathRecord> {
  if (masterKey.length !== 32 || nonce.length !== 12) {
    throw new Error('Invalid Vault key or nonce');
  }
  const key = await deriveVaultKey(
    masterKey,
    concatenate(new TextEncoder().encode('path'), uuidBytes(fileId)),
  );
  const sealed = new Uint8Array(await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: copyBuffer(nonce),
      additionalData: copyBuffer(concatenate(PATH_DOMAIN, uuidBytes(fileId))),
      tagLength: 128,
    },
    key,
    copyBuffer(new TextEncoder().encode(path)),
  ));
  return {
    nonce,
    ciphertext: sealed.slice(0, -16),
    authenticationTag: sealed.slice(-16),
  };
}

export async function openVaultPath({
  masterKey,
  fileId,
  value,
}: {
  masterKey: Uint8Array;
  fileId: string;
  value: EncryptedPathRecord;
}): Promise<string> {
  if (
    masterKey.length !== 32
    || value.nonce.length !== 12
    || value.authenticationTag.length !== 16
  ) {
    throw new Error('Invalid encrypted Vault path');
  }
  const key = await deriveVaultKey(
    masterKey,
    concatenate(new TextEncoder().encode('path'), uuidBytes(fileId)),
  );
  const sealed = concatenate(value.ciphertext, value.authenticationTag);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: copyBuffer(value.nonce),
      additionalData: copyBuffer(concatenate(PATH_DOMAIN, uuidBytes(fileId))),
      tagLength: 128,
    },
    key,
    copyBuffer(sealed),
  );
  return new TextDecoder('utf-8', { fatal: true }).decode(plaintext);
}

export function encodeVaultManifest({
  vaultId,
  sequence,
  previousManifestDigest,
  entries,
  tombstones = [],
  keyVersion = 1,
  extensions = {},
}: VaultManifestRecord): Uint8Array {
  const encoder = new CborEncoder();
  encoder.map(8);
  encoder.text('protocol_version');
  encoder.unsigned(1);
  encoder.text('vault_id');
  encoder.bytes(uuidBytes(vaultId));
  encoder.text('sequence');
  encoder.unsigned(sequence);
  encoder.text('previous_manifest_digest');
  if (previousManifestDigest) {
    encoder.bytes(previousManifestDigest);
  } else {
    encoder.null();
  }
  encoder.text('entries');
  encoder.array(entries.length);
  for (const entry of entries) {
    encodeManifestEntry(encoder, entry);
  }
  encoder.text('tombstones');
  encoder.array(tombstones.length);
  for (const tombstone of tombstones) {
    encoder.map(3);
    encoder.text('file_id');
    encoder.bytes(uuidBytes(tombstone.fileId));
    encoder.text('deleted_version_id');
    encoder.bytes(uuidBytes(tombstone.deletedVersionId));
    encoder.text('deleted_unix_ms');
    encoder.unsigned(tombstone.deletedUnixMs);
  }
  encoder.text('key_version');
  encoder.unsigned(keyVersion);
  encoder.text('extensions');
  const extensionEntries = Object.entries(extensions).sort(([left], [right]) => (
    left.localeCompare(right)
  ));
  encoder.map(extensionEntries.length);
  for (const [key, value] of extensionEntries) {
    encoder.text(key);
    encoder.bytes(value);
  }
  return encoder.output();
}

export async function signVaultManifest(
  manifest: VaultManifestRecord,
  signingKey: CryptoKey,
  signingPublicKey: CryptoKey,
): Promise<Uint8Array> {
  const encodedManifest = encodeVaultManifest(manifest);
  const signature = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    signingKey,
    copyBuffer(encodedManifest),
  ));
  if (signature.length !== 64) {
    throw new Error('The device signature is not a raw P-256 signature');
  }
  const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', signingPublicKey));
  const encoder = new CborEncoder();
  encoder.map(3);
  encoder.text('manifest');
  encoder.raw(encodedManifest);
  encoder.text('device_signing_public_key');
  encoder.bytes(publicKey);
  encoder.text('signature');
  encoder.bytes(signature);
  return encoder.output();
}

export async function decodeAndVerifySignedManifest(
  value: Uint8Array,
): Promise<SignedVaultManifestRecord> {
  const decoded = new CborDecoder(value).decodeComplete();
  const map = record(decoded);
  const manifest = decodeManifestRecord(record(map.manifest));
  const deviceSigningPublicKey = bytes(map.device_signing_public_key);
  const signature = bytes(map.signature);
  const publicKey = await crypto.subtle.importKey(
    'raw',
    copyBuffer(deviceSigningPublicKey),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );
  const verified = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    publicKey,
    copyBuffer(signature),
    copyBuffer(encodeVaultManifest(manifest)),
  );
  if (!verified) {
    throw new Error('Vault manifest signature verification failed');
  }
  return { manifest, deviceSigningPublicKey, signature };
}

export function decodeVaultObject(value: Uint8Array): VaultObjectRecord {
  const map = record(new CborDecoder(value).decodeComplete());
  if (number(map.protocol_version) !== 1 || string(map.cipher_suite) !== 'aes256_gcm') {
    throw new Error('Unsupported Vault object protocol');
  }
  const parent = map.parent_version_id;
  return {
    fileId: bytesUUID(map.file_id),
    versionId: bytesUUID(map.version_id),
    parentVersionId: parent === null ? undefined : bytesUUID(parent),
    kind: vaultKind(map.kind),
    mimeType: string(map.mime_type),
    paddedSize: number(map.padded_size),
    nonce: bytes(map.nonce),
    ciphertext: bytes(map.ciphertext),
    authenticationTag: bytes(map.authentication_tag),
  };
}

export function decodeHpkeEnvelope(value: unknown): HpkeEnvelopeRecord {
  const map = value instanceof Uint8Array
    ? record(new CborDecoder(value).decodeComplete())
    : record(value);
  if (
    number(map.protocol_version) !== 1
    || string(map.cipher_suite) !== 'hpke_p256_sha256_aes256_gcm'
  ) {
    throw new Error('Unsupported Vault HPKE envelope');
  }
  return {
    encapsulatedKey: bytes(map.encapsulated_key),
    ciphertext: bytes(map.ciphertext),
  };
}

export function decodeCapabilityGrant(value: Uint8Array): CapabilityGrantRecord {
  const map = record(new CborDecoder(value).decodeComplete());
  if (number(map.protocol_version) !== 1) {
    throw new Error('Unsupported Vault capability protocol');
  }
  const permission = string(map.permission);
  if (permission !== 'read_only' && permission !== 'read_write') {
    throw new Error('Unsupported Vault capability permission');
  }
  return {
    grantId: bytesUUID(map.grant_id),
    agentHpkePublicKey: bytes(map.agent_hpke_public_key),
    permission,
    allowedPathPrefixes: array(map.allowed_path_prefixes).map(value => {
      const path = record(value);
      if (string(path.cipher_suite) !== 'aes256_gcm') {
        throw new Error('Unsupported capability path protocol');
      }
      return {
        nonce: bytes(path.nonce),
        ciphertext: bytes(path.ciphertext),
        authenticationTag: bytes(path.authentication_tag),
      };
    }),
    allowedTagIdentities: array(map.allowed_tag_identities).map(value => {
      if (value instanceof Uint8Array) {
        return value;
      }
      return Uint8Array.from(array(value).map(number));
    }),
    expiresUnixMs: number(map.expires_unix_ms),
    revocationId: bytesUUID(map.revocation_id),
    wrappedCapabilityKey: decodeHpkeEnvelope(map.wrapped_capability_key),
  };
}

export function vaultUUIDBytes(value: string): Uint8Array {
  return uuidBytes(value);
}

function decodeManifestRecord(map: Record<string, unknown>): VaultManifestRecord {
  if (number(map.protocol_version) !== 1) {
    throw new Error('Unsupported Vault manifest protocol');
  }
  return {
    vaultId: bytesUUID(map.vault_id),
    sequence: number(map.sequence),
    previousManifestDigest: map.previous_manifest_digest === null
      ? undefined
      : bytes(map.previous_manifest_digest),
    entries: array(map.entries).map(value => {
      const entry = record(value);
      const encryptedPath = record(entry.encrypted_path);
      if (string(encryptedPath.cipher_suite) !== 'aes256_gcm') {
        throw new Error('Unsupported encrypted path protocol');
      }
      return {
        fileId: bytesUUID(entry.file_id),
        currentVersionId: bytesUUID(entry.current_version_id),
        encryptedPath: {
          nonce: bytes(encryptedPath.nonce),
          ciphertext: bytes(encryptedPath.ciphertext),
          authenticationTag: bytes(encryptedPath.authentication_tag),
        },
        objectDigest: bytes(entry.object_digest),
        byteSize: number(entry.byte_size),
        modifiedUnixMs: number(entry.modified_unix_ms),
      };
    }),
    tombstones: array(map.tombstones).map(value => {
      const tombstone = record(value);
      return {
        fileId: bytesUUID(tombstone.file_id),
        deletedVersionId: bytesUUID(tombstone.deleted_version_id),
        deletedUnixMs: number(tombstone.deleted_unix_ms),
      };
    }),
    keyVersion: number(map.key_version),
    extensions: Object.fromEntries(
      Object.entries(record(map.extensions)).map(([key, extension]) => [key, bytes(extension)]),
    ),
  };
}

function encodeManifestEntry(encoder: CborEncoder, entry: VaultManifestEntry) {
  encoder.map(6);
  encoder.text('file_id');
  encoder.bytes(uuidBytes(entry.fileId));
  encoder.text('current_version_id');
  encoder.bytes(uuidBytes(entry.currentVersionId));
  encoder.text('encrypted_path');
  encoder.map(4);
  encoder.text('cipher_suite');
  encoder.text('aes256_gcm');
  encoder.text('nonce');
  encoder.bytes(entry.encryptedPath.nonce);
  encoder.text('ciphertext');
  encoder.bytes(entry.encryptedPath.ciphertext);
  encoder.text('authentication_tag');
  encoder.bytes(entry.encryptedPath.authenticationTag);
  encoder.text('object_digest');
  encoder.bytes(entry.objectDigest);
  encoder.text('byte_size');
  encoder.unsigned(entry.byteSize);
  encoder.text('modified_unix_ms');
  encoder.unsigned(entry.modifiedUnixMs);
}

async function objectKey(
  masterKey: Uint8Array,
  fileId: string,
  versionId: string,
): Promise<CryptoKey> {
  return deriveVaultKey(
    masterKey,
    concatenate(
      new TextEncoder().encode('object'),
      uuidBytes(fileId),
      uuidBytes(versionId),
    ),
  );
}

async function deriveVaultKey(
  masterKey: Uint8Array,
  info: Uint8Array,
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    copyBuffer(masterKey),
    'HKDF',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: copyBuffer(KEY_SALT),
      info: copyBuffer(info),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

class CborEncoder {
  private bytesValue: number[] = [];

  unsigned(value: number) {
    this.major(0, value);
  }

  bytes(value: Uint8Array) {
    this.major(2, value.length);
    this.bytesValue.push(...value);
  }

  text(value: string) {
    const encoded = new TextEncoder().encode(value);
    this.major(3, encoded.length);
    this.bytesValue.push(...encoded);
  }

  array(count: number) {
    this.major(4, count);
  }

  map(count: number) {
    this.major(5, count);
  }

  null() {
    this.bytesValue.push(0xf6);
  }

  output(): Uint8Array {
    return Uint8Array.from(this.bytesValue);
  }

  raw(value: Uint8Array) {
    this.bytesValue.push(...value);
  }

  private major(type: number, value: number) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error('CBOR value is outside the safe integer range');
    }
    const prefix = type << 5;
    if (value < 24) {
      this.bytesValue.push(prefix | value);
    } else if (value <= 0xff) {
      this.bytesValue.push(prefix | 24, value);
    } else if (value <= 0xffff) {
      this.bytesValue.push(prefix | 25, value >>> 8, value & 0xff);
    } else if (value <= 0xffffffff) {
      this.bytesValue.push(
        prefix | 26,
        (value >>> 24) & 0xff,
        (value >>> 16) & 0xff,
        (value >>> 8) & 0xff,
        value & 0xff,
      );
    } else {
      const high = Math.floor(value / 0x1_0000_0000);
      const low = value % 0x1_0000_0000;
      this.bytesValue.push(
        prefix | 27,
        (high >>> 24) & 0xff,
        (high >>> 16) & 0xff,
        (high >>> 8) & 0xff,
        high & 0xff,
        (low >>> 24) & 0xff,
        (low >>> 16) & 0xff,
        (low >>> 8) & 0xff,
        low & 0xff,
      );
    }
  }
}

class CborDecoder {
  private offset = 0;

  constructor(private readonly value: Uint8Array) {}

  decodeComplete(): unknown {
    const decoded = this.decode();
    if (this.offset !== this.value.length) {
      throw new Error('Trailing bytes in Vault CBOR');
    }
    return decoded;
  }

  private decode(): unknown {
    const first = this.byte();
    const major = first >>> 5;
    const additional = first & 0x1f;
    if (major === 7 && additional === 22) {
      return null;
    }
    const length = this.length(additional);
    switch (major) {
      case 0:
        return length;
      case 2:
        return this.take(length);
      case 3:
        return new TextDecoder('utf-8', { fatal: true }).decode(this.take(length));
      case 4:
        return Array.from({ length }, () => this.decode());
      case 5: {
        const output: Record<string, unknown> = {};
        for (let index = 0; index < length; index += 1) {
          const key = this.decode();
          if (typeof key !== 'string' || Object.hasOwn(output, key)) {
            throw new Error('Invalid or duplicate Vault CBOR map key');
          }
          output[key] = this.decode();
        }
        return output;
      }
      default:
        throw new Error('Unsupported Vault CBOR value');
    }
  }

  private length(additional: number): number {
    if (additional < 24) {
      return additional;
    }
    const byteCount = additional === 24
      ? 1
      : additional === 25
        ? 2
        : additional === 26
          ? 4
          : additional === 27
            ? 8
            : 0;
    if (!byteCount) {
      throw new Error('Indefinite Vault CBOR is not supported');
    }
    let output = 0;
    for (let index = 0; index < byteCount; index += 1) {
      output = output * 256 + this.byte();
      if (!Number.isSafeInteger(output)) {
        throw new Error('Vault CBOR integer exceeds the safe range');
      }
    }
    return output;
  }

  private byte(): number {
    const output = this.value[this.offset];
    if (output === undefined) {
      throw new Error('Truncated Vault CBOR');
    }
    this.offset += 1;
    return output;
  }

  private take(length: number): Uint8Array {
    const end = this.offset + length;
    if (end > this.value.length) {
      throw new Error('Truncated Vault CBOR');
    }
    const output = this.value.slice(this.offset, end);
    this.offset = end;
    return output;
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value instanceof Uint8Array) {
    throw new Error('Expected a Vault CBOR map');
  }
  return value as Record<string, unknown>;
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error('Expected a Vault CBOR array');
  }
  return value;
}

function bytes(value: unknown): Uint8Array {
  if (!(value instanceof Uint8Array)) {
    throw new Error('Expected Vault CBOR bytes');
  }
  return value;
}

function string(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Expected Vault CBOR text');
  }
  return value;
}

function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error('Expected a nonnegative Vault CBOR integer');
  }
  return value;
}

function bytesUUID(value: unknown): string {
  const valueBytes = bytes(value);
  if (valueBytes.length !== 16) {
    throw new Error('Expected a 16-byte Vault UUID');
  }
  const compact = hex(valueBytes);
  return [
    compact.slice(0, 8),
    compact.slice(8, 12),
    compact.slice(12, 16),
    compact.slice(16, 20),
    compact.slice(20),
  ].join('-');
}

function vaultKind(value: unknown): VaultObjectRecord['kind'] {
  const kind = string(value);
  if (!['markdown', 'attachment', 'vector_shard', 'manifest'].includes(kind)) {
    throw new Error('Unsupported Vault object kind');
  }
  return kind as VaultObjectRecord['kind'];
}

function uuidBytes(value: string): Uint8Array {
  const compact = value.replaceAll('-', '');
  if (!/^[0-9a-f]{32}$/iu.test(compact)) {
    throw new Error('Invalid UUID');
  }
  return Uint8Array.from(compact.match(/.{2}/gu) ?? [], byte => Number.parseInt(byte, 16));
}

function concatenate(...values: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(values.reduce((total, value) => total + value.length, 0));
  let offset = 0;
  for (const value of values) {
    output.set(value, offset);
    offset += value.length;
  }
  return output;
}

function copyBuffer(value: Uint8Array): ArrayBuffer {
  return value.slice().buffer as ArrayBuffer;
}

export function hex(value: Uint8Array): string {
  return [...value].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export function unhex(value: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})*$/iu.test(value)) {
    throw new Error('Invalid hexadecimal value');
  }
  return Uint8Array.from(value.match(/.{2}/gu) ?? [], byte => Number.parseInt(byte, 16));
}
