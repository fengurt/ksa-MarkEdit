const OBJECT_DOMAIN = new TextEncoder().encode('ksamint/vault-object/v1');
const KEY_SALT = new TextEncoder().encode('ksamint/vault/v1');
const PADDING_BLOCK = 4_096;

export type VaultObjectCiphertext = {
  nonce: Uint8Array;
  ciphertext: Uint8Array;
  authenticationTag: Uint8Array;
  paddedSize: number;
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

async function objectKey(
  masterKey: Uint8Array,
  fileId: string,
  versionId: string,
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    copyBuffer(masterKey),
    'HKDF',
    false,
    ['deriveKey'],
  );
  const info = concatenate(
    new TextEncoder().encode('object'),
    uuidBytes(fileId),
    uuidBytes(versionId),
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

  null() {
    this.bytesValue.push(0xf6);
  }

  output(): Uint8Array {
    return Uint8Array.from(this.bytesValue);
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
