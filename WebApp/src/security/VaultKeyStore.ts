const DATABASE_NAME = 'ksamint-vault-keys-v1';
const STORE_NAME = 'device-state';
const MASTER_KEY_AAD = new TextEncoder().encode('ksamint/web-master-key/v1');

export type VaultDeviceIdentity = {
  deviceId: string;
  masterKey: Uint8Array;
  signingPrivateKey: CryptoKey;
  signingPublicKey: CryptoKey;
  agreementPrivateKey: CryptoKey;
  agreementPublicKey: CryptoKey;
  wrappedMasterKey: Uint8Array;
};

export type VaultSyncState = {
  vaultId?: string;
  sequence: number;
  previousDigest?: string;
  files: Record<string, {
    versionId: string;
    parentVersionId?: string;
    path?: string;
    contentDigest: string;
    objectDigest: string;
    byteSize: number;
  }>;
};

type StoredIdentity = {
  deviceId: string;
  wrappingKey: CryptoKey;
  masterKeyNonce: Uint8Array;
  wrappedMasterKey: ArrayBuffer;
  signingPrivateKey: CryptoKey;
  signingPublicKey: CryptoKey;
  agreementPrivateKey: CryptoKey;
  agreementPublicKey: CryptoKey;
};

export async function loadOrCreateVaultIdentity(
  workspaceId: string,
  importedMasterKey?: Uint8Array,
): Promise<VaultDeviceIdentity> {
  const existing = await readIdentity(workspaceId);
  if (existing) {
    return openIdentity(existing, workspaceId);
  }
  if (importedMasterKey && importedMasterKey.length !== 32) {
    throw new Error('The imported Vault Master Key must contain 256 bits');
  }
  const wrappingKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  const masterKey = importedMasterKey?.slice()
    ?? crypto.getRandomValues(new Uint8Array(32));
  const masterKeyNonce = crypto.getRandomValues(new Uint8Array(12));
  const wrappedMasterKey = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: copyBuffer(masterKeyNonce),
      additionalData: copyBuffer(identityAAD(workspaceId)),
      tagLength: 128,
    },
    wrappingKey,
    copyBuffer(masterKey),
  );
  const signing = await persistentKeyPair('ECDSA', ['sign']);
  const agreement = await persistentKeyPair('ECDH', ['deriveBits']);
  const stored: StoredIdentity = {
    deviceId: crypto.randomUUID(),
    wrappingKey,
    masterKeyNonce,
    wrappedMasterKey,
    signingPrivateKey: signing.privateKey,
    signingPublicKey: signing.publicKey,
    agreementPrivateKey: agreement.privateKey,
    agreementPublicKey: agreement.publicKey,
  };
  await writeIdentity(workspaceId, stored);
  return openIdentity(stored, workspaceId);
}

export async function loadVaultSyncState(workspaceId: string): Promise<VaultSyncState> {
  const database = await openDatabase();
  const value = await new Promise<VaultSyncState | undefined>((resolve, reject) => {
    const request = database
      .transaction(STORE_NAME)
      .objectStore(STORE_NAME)
      .get(`sync:${workspaceId}`);
    request.onsuccess = () => resolve(request.result as VaultSyncState | undefined);
    request.onerror = () => reject(request.error);
  });
  return value ?? { sequence: 0, files: {} };
}

export async function saveVaultSyncState(
  workspaceId: string,
  state: VaultSyncState,
): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database
      .transaction(STORE_NAME, 'readwrite')
      .objectStore(STORE_NAME)
      .put(state, `sync:${workspaceId}`);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function openIdentity(
  identity: StoredIdentity,
  workspaceId: string,
): Promise<VaultDeviceIdentity> {
  const masterKey = new Uint8Array(await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: copyBuffer(identity.masterKeyNonce),
      additionalData: copyBuffer(identityAAD(workspaceId)),
      tagLength: 128,
    },
    identity.wrappingKey,
    identity.wrappedMasterKey,
  ));
  if (masterKey.length !== 32) {
    throw new Error('The local Vault identity is damaged');
  }
  return {
    deviceId: identity.deviceId,
    masterKey,
    signingPrivateKey: identity.signingPrivateKey,
    signingPublicKey: identity.signingPublicKey,
    agreementPrivateKey: identity.agreementPrivateKey,
    agreementPublicKey: identity.agreementPublicKey,
    wrappedMasterKey: concatenate(
      identity.masterKeyNonce,
      new Uint8Array(identity.wrappedMasterKey),
    ),
  };
}

async function persistentKeyPair(
  name: 'ECDSA' | 'ECDH',
  usages: KeyUsage[],
): Promise<CryptoKeyPair> {
  const algorithm = { name, namedCurve: 'P-256' };
  const generated = await crypto.subtle.generateKey(algorithm, true, usages) as CryptoKeyPair;
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    await crypto.subtle.exportKey('pkcs8', generated.privateKey),
    algorithm,
    false,
    usages,
  );
  return { privateKey, publicKey: generated.publicKey };
}

function identityAAD(workspaceId: string): Uint8Array {
  return concatenate(MASTER_KEY_AAD, new TextEncoder().encode(workspaceId));
}

async function readIdentity(workspaceId: string): Promise<StoredIdentity | undefined> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME).objectStore(STORE_NAME).get(workspaceId);
    request.onsuccess = () => resolve(request.result as StoredIdentity | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function writeIdentity(workspaceId: string, identity: StoredIdentity): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database
      .transaction(STORE_NAME, 'readwrite')
      .objectStore(STORE_NAME)
      .put(identity, workspaceId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function concatenate(...values: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(values.reduce((size, value) => size + value.length, 0));
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
