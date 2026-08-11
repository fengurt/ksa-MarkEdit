import {
  Aes256Gcm,
  CipherSuite,
  DhkemP256HkdfSha256,
  HkdfSha256,
} from '@hpke/core';
import {
  decodeAndVerifySignedManifest,
  decodeCapabilityGrant,
  decodeVaultObject,
  hex,
  openVaultObject,
  openVaultPath,
  vaultUUIDBytes,
} from '@ksamint/vault-protocol';

const HPKE_INFO = new TextEncoder().encode('ksamint/device-grant/v1');

export type AgentConnection = {
  apiBase: string;
  grantId: string;
  accessToken: string;
  recipientPrivateKey: string | Uint8Array;
};

export type AgentIdentity = {
  privateKeyHex: string;
  publicKeyHex: string;
};

export type AgentFile = {
  id: string;
  path: string;
  modifiedUnixMs: number;
  content: string;
};

type CapabilityCatalog = {
  protocolVersion: number;
  grantId: string;
  vaultId: string;
  encryptedGrant: string;
  manifest: {
    sequence: number;
    digest: string;
    signedCbor: string;
  };
  objects: Array<{
    objectId: string;
    kind: string;
    cipherSize: number;
    digest: string;
    objectKey: string;
  }>;
  cos: CosGrant;
};

type CosGrant = {
  bucket: string;
  region: string;
  prefix: string;
  credentials: {
    Token: string;
    TmpSecretId: string;
    TmpSecretKey: string;
  };
};

export async function generateAgentIdentity(): Promise<AgentIdentity> {
  const suite = hpkeSuite();
  const keys = await suite.kem.generateKeyPair();
  const privateKey = new Uint8Array(await suite.kem.serializePrivateKey(keys.privateKey));
  const publicKey = new Uint8Array(await suite.kem.serializePublicKey(keys.publicKey));
  if (privateKey.length !== 32 || publicKey.length !== 65 || publicKey[0] !== 0x04) {
    throw new Error('HPKE provider returned an invalid P-256 identity');
  }
  return {
    privateKeyHex: hex(privateKey),
    publicKeyHex: hex(publicKey),
  };
}

export class KsamintAgentClient {
  readonly vaultId: string;
  readonly manifestSequence: number;

  private constructor(
    private readonly catalog: CapabilityCatalog,
    private readonly masterKey: Uint8Array,
    private readonly filesByPath: Map<string, AgentFile>,
  ) {
    this.vaultId = catalog.vaultId;
    this.manifestSequence = catalog.manifest.sequence;
  }

  static async connect(connection: AgentConnection): Promise<KsamintAgentClient> {
    const response = await fetch(
      `${connection.apiBase.replace(/\/$/u, '')}`
      + `/api/v1/agent/capabilities/${encodeURIComponent(connection.grantId)}/catalog`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${connection.accessToken}` },
      },
    );
    if (!response.ok) {
      throw new Error(`Capability service returned ${response.status}`);
    }
    const catalog = await response.json() as CapabilityCatalog;
    validateCatalog(catalog, connection.grantId);
    const grant = decodeCapabilityGrant(unbase64(catalog.encryptedGrant));
    if (
      grant.grantId !== connection.grantId
      || grant.permission !== 'read_only'
      || grant.expiresUnixMs <= Date.now()
    ) {
      throw new Error('Capability grant is invalid, expired, or not read-only');
    }
    if (grant.allowedPathPrefixes.length || grant.allowedTagIdentities.length) {
      throw new Error(
        'Scoped Agent grants require per-file key envelopes and are not accepted by this SDK version',
      );
    }
    const masterKey = await openCapabilityKey(
      connection.recipientPrivateKey,
      grant.wrappedCapabilityKey.encapsulatedKey,
      grant.wrappedCapabilityKey.ciphertext,
      vaultUUIDBytes(grant.grantId),
    );
    if (masterKey.length !== 32) {
      throw new Error('Capability did not unwrap a 256-bit Vault key');
    }
    const signedBytes = unbase64(catalog.manifest.signedCbor);
    if (await sha256Hex(signedBytes) !== catalog.manifest.digest) {
      throw new Error('Capability manifest digest mismatch');
    }
    const signed = await decodeAndVerifySignedManifest(signedBytes);
    if (
      signed.manifest.vaultId !== catalog.vaultId
      || signed.manifest.sequence !== catalog.manifest.sequence
    ) {
      throw new Error('Capability manifest identity mismatch');
    }
    const objectCatalog = new Map(catalog.objects.map(object => [object.objectId, object]));
    const files = await mapConcurrent(signed.manifest.entries, 4, async entry => {
      const metadata = objectCatalog.get(entry.currentVersionId);
      if (!metadata || metadata.kind !== 'markdown') {
        return undefined;
      }
      const encrypted = await downloadCosObject(catalog.cos, metadata.objectKey);
      if (
        encrypted.length !== metadata.cipherSize
        || await sha256Hex(encrypted) !== metadata.digest
        || hex(entry.objectDigest) !== metadata.digest
      ) {
        throw new Error(`Encrypted object ${entry.currentVersionId} failed integrity checks`);
      }
      const object = decodeVaultObject(encrypted);
      if (
        object.fileId !== entry.fileId
        || object.versionId !== entry.currentVersionId
      ) {
        throw new Error('Encrypted object identity mismatch');
      }
      const path = await openVaultPath({
        masterKey,
        fileId: entry.fileId,
        value: entry.encryptedPath,
      });
      const plaintext = await openVaultObject({
        value: object,
        plaintextSize: entry.byteSize,
        masterKey,
        fileId: entry.fileId,
        versionId: entry.currentVersionId,
        parentVersionId: object.parentVersionId,
        kind: object.kind,
        mimeType: object.mimeType,
      });
      return {
        id: entry.fileId,
        path,
        modifiedUnixMs: entry.modifiedUnixMs,
        content: new TextDecoder('utf-8', { fatal: true }).decode(plaintext),
      } satisfies AgentFile;
    });
    return new KsamintAgentClient(
      catalog,
      masterKey,
      new Map(files.filter(file => file !== undefined).map(file => [file.path, file])),
    );
  }

  listFiles(): Omit<AgentFile, 'content'>[] {
    return [...this.filesByPath.values()]
      .map(file => ({
        id: file.id,
        path: file.path,
        modifiedUnixMs: file.modifiedUnixMs,
      }))
      .sort((left, right) => left.path.localeCompare(right.path));
  }

  readFile(path: string): AgentFile | undefined {
    const file = this.filesByPath.get(path);
    return file ? structuredClone(file) : undefined;
  }

  search(query: string, limit = 100): Array<AgentFile & { line: number; context: string }> {
    const normalized = query.normalize('NFKC').toLocaleLowerCase();
    if (!normalized) {
      return [];
    }
    const results: Array<AgentFile & { line: number; context: string }> = [];
    for (const file of this.filesByPath.values()) {
      const lines = file.content.split(/\r?\n/u);
      for (const [index, line] of lines.entries()) {
        if (line.normalize('NFKC').toLocaleLowerCase().includes(normalized)) {
          results.push({ ...file, line: index + 1, context: line });
          if (results.length >= Math.max(1, Math.min(limit, 500))) {
            return results;
          }
        }
      }
    }
    return results;
  }

  close() {
    this.masterKey.fill(0);
    this.filesByPath.clear();
  }
}

async function openCapabilityKey(
  privateKeyBytes: string | Uint8Array,
  encapsulatedKey: Uint8Array,
  ciphertext: Uint8Array,
  aad: Uint8Array,
): Promise<Uint8Array> {
  const suite = hpkeSuite();
  const privateKey = await suite.kem.deserializePrivateKey(
    typeof privateKeyBytes === 'string' ? unhex(privateKeyBytes) : privateKeyBytes,
  );
  const recipient = await suite.createRecipientContext({
    recipientKey: privateKey,
    enc: encapsulatedKey,
    info: HPKE_INFO,
  });
  return new Uint8Array(await recipient.open(ciphertext, aad));
}

function hpkeSuite(): CipherSuite {
  return new CipherSuite({
    kem: new DhkemP256HkdfSha256(),
    kdf: new HkdfSha256(),
    aead: new Aes256Gcm(),
  });
}

async function downloadCosObject(grant: CosGrant, objectKey: string): Promise<Uint8Array> {
  if (!objectKey.startsWith(grant.prefix) || objectKey.split('/').includes('..')) {
    throw new Error('COS object key is outside the granted Vault prefix');
  }
  const host = `${grant.bucket}.cos.${grant.region}.myqcloud.com`;
  const path = `/${objectKey.split('/').map(percentEncode).join('/')}`;
  const authorization = await cosAuthorization({
    host,
    path,
    token: grant.credentials.Token,
    secretId: grant.credentials.TmpSecretId,
    secretKey: grant.credentials.TmpSecretKey,
  });
  const response = await fetch(`https://${host}${path}`, {
    headers: {
      Authorization: authorization,
      'x-cos-security-token': grant.credentials.Token,
    },
  });
  if (!response.ok) {
    throw new Error(`COS download failed with ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function cosAuthorization({
  host,
  path,
  token,
  secretId,
  secretKey,
}: {
  host: string;
  path: string;
  token: string;
  secretId: string;
  secretKey: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1_000);
  const keyTime = `${now};${now + 600}`;
  const headerList = 'host;x-cos-security-token';
  const canonicalHeaders = `host=${percentEncode(host.toLowerCase())}`
    + `&x-cos-security-token=${percentEncode(token)}`;
  const httpString = `get\n${path}\n\n${canonicalHeaders}\n`;
  const stringToSign = `sha1\n${keyTime}\n${await sha1Hex(new TextEncoder().encode(httpString))}\n`;
  const signKey = await hmacSha1(new TextEncoder().encode(secretKey), keyTime);
  const signature = hex(await hmacSha1(signKey, stringToSign));
  return `q-sign-algorithm=sha1&q-ak=${percentEncode(secretId)}`
    + `&q-sign-time=${keyTime}&q-key-time=${keyTime}`
    + `&q-header-list=${headerList}&q-url-param-list=&q-signature=${signature}`;
}

function validateCatalog(catalog: CapabilityCatalog, grantId: string) {
  if (
    catalog.protocolVersion !== 1
    || catalog.grantId !== grantId
    || !catalog.vaultId
    || !catalog.cos.prefix.startsWith(`vaults/${catalog.vaultId}/`)
  ) {
    throw new Error('Capability catalog identity mismatch');
  }
}

async function hmacSha1(key: Uint8Array, value: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    copyBuffer(key),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    new TextEncoder().encode(value),
  ));
}

async function sha1Hex(value: Uint8Array): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-1', copyBuffer(value))));
}

async function sha256Hex(value: Uint8Array): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', copyBuffer(value))));
}

function unhex(value: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})+$/iu.test(value)) {
    throw new Error('Invalid hexadecimal key');
  }
  return Uint8Array.from(value.match(/.{2}/gu) ?? [], byte => Number.parseInt(byte, 16));
}

function unbase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0));
}

function percentEncode(value: string): string {
  return [...new TextEncoder().encode(value)]
    .map(byte => (
      isUnreserved(byte)
        ? String.fromCharCode(byte)
        : `%${byte.toString(16).toUpperCase().padStart(2, '0')}`
    ))
    .join('');
}

function isUnreserved(byte: number): boolean {
  return (byte >= 0x41 && byte <= 0x5a)
    || (byte >= 0x61 && byte <= 0x7a)
    || (byte >= 0x30 && byte <= 0x39)
    || [0x2d, 0x2e, 0x5f, 0x7e].includes(byte);
}

async function mapConcurrent<Input, Output>(
  values: Input[],
  concurrency: number,
  operation: (value: Input) => Promise<Output>,
): Promise<Output[]> {
  const output = new Array<Output>(values.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      const value = values[index];
      if (value !== undefined) {
        output[index] = await operation(value);
      }
    }
  });
  await Promise.all(workers);
  return output;
}

function copyBuffer(value: Uint8Array): ArrayBuffer {
  return value.slice().buffer as ArrayBuffer;
}
