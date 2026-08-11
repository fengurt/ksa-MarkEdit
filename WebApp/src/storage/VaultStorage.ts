import { applyMetadata, parseMetadata } from '../markdown/metadata';
import type { NoteFile, NoteMetadata, VaultFile, VaultManifest } from '../types';

const MAGIC = new TextEncoder().encode('KSV1');
const MANIFEST_FILE = 'manifest.ksv';
const DATABASE_NAME = 'ksamint-device-v1';
const KEY_STORE = 'device-keys';
const FALLBACK_STORE = 'vault-objects';

type EncryptedPayload = {
  nonce: Uint8Array;
  ciphertext: ArrayBuffer;
};

export class VaultStorage {
  private constructor(
    private readonly workspaceId: string,
    private readonly key: CryptoKey,
    private manifest: VaultManifest,
    private readonly opfsRoot?: FileSystemDirectoryHandle,
  ) {}

  static async open(workspaceId = 'offline'): Promise<VaultStorage> {
    const key = await deviceKey(workspaceId);
    const opfsRoot = await workspaceDirectory(workspaceId);
    const encryptedManifest = await readObject(opfsRoot, workspaceId, MANIFEST_FILE);
    let manifest: VaultManifest;

    if (encryptedManifest) {
      manifest = JSON.parse(await decryptText(key, encryptedManifest)) as VaultManifest;
    } else {
      manifest = {
        version: 1,
        id: workspaceId,
        name: 'Personal Workspace',
        files: [],
        updatedAt: Date.now(),
      };
    }

    const storage = new VaultStorage(workspaceId, key, manifest, opfsRoot);
    if (manifest.files.length === 0) {
      await storage.createFile(
        'Welcome.md',
        '# Welcome to ksamint Notes\n\nYour Markdown stays local until you enable encrypted sync.\n',
      );
    }
    return storage;
  }

  workspace(): VaultManifest {
    return structuredClone(this.manifest);
  }

  listFiles(): VaultFile[] {
    return [...this.manifest.files].sort((left, right) => left.path.localeCompare(right.path));
  }

  async readFile(id: string): Promise<NoteFile> {
    const file = this.manifest.files.find(candidate => candidate.id === id);
    if (!file) {
      throw new Error('File not found');
    }
    const payload = await readObject(this.opfsRoot, this.workspaceId, objectName(file.id));
    if (!payload) {
      throw new Error('Encrypted file object is missing');
    }
    const content = await decryptText(this.key, payload);
    return { ...file, content, metadata: parseMetadata(content) };
  }

  async createFile(path: string, content = ''): Promise<NoteFile> {
    const normalizedPath = normalizePath(path);
    if (this.manifest.files.some(file => file.path === normalizedPath)) {
      throw new Error('A file already exists at that path');
    }
    const file: VaultFile = {
      id: crypto.randomUUID(),
      path: normalizedPath,
      modifiedAt: Date.now(),
    };
    this.manifest.files.push(file);
    await this.writeContent(file, content);
    await this.persistManifest();
    return { ...file, content, metadata: parseMetadata(content) };
  }

  async writeFile(id: string, content: string): Promise<NoteFile> {
    const file = this.manifest.files.find(candidate => candidate.id === id);
    if (!file) {
      throw new Error('File not found');
    }
    file.modifiedAt = Date.now();
    await this.writeContent(file, content);
    await this.persistManifest();
    return { ...file, content, metadata: parseMetadata(content) };
  }

  async setMetadata(id: string, metadata: NoteMetadata): Promise<NoteFile> {
    const file = await this.readFile(id);
    return this.writeFile(id, applyMetadata(file.content, metadata));
  }

  async renameFile(id: string, path: string): Promise<void> {
    const normalizedPath = normalizePath(path);
    if (this.manifest.files.some(file => file.id !== id && file.path === normalizedPath)) {
      throw new Error('A file already exists at that path');
    }
    const file = this.manifest.files.find(candidate => candidate.id === id);
    if (!file) {
      throw new Error('File not found');
    }
    file.path = normalizedPath;
    file.modifiedAt = Date.now();
    await this.persistManifest();
  }

  async replaceFiles(files: NoteFile[]): Promise<NoteFile[]> {
    const ids = new Set<string>();
    const paths = new Set<string>();
    const normalized = files.map(file => {
      const path = normalizePath(file.path);
      if (ids.has(file.id) || paths.has(path)) {
        throw new Error('Remote workspace contains duplicate file identities or paths');
      }
      ids.add(file.id);
      paths.add(path);
      return {
        ...file,
        path,
        modifiedAt: Math.max(0, Math.floor(file.modifiedAt)),
        metadata: parseMetadata(file.content),
      };
    });
    for (const file of normalized) {
      await this.writeContent(file, file.content);
    }
    this.manifest.files = normalized.map(({ id, path, modifiedAt }) => ({
      id,
      path,
      modifiedAt,
    }));
    await this.persistManifest();
    return structuredClone(normalized);
  }

  private async writeContent(file: VaultFile, content: string): Promise<void> {
    const payload = await encryptText(this.key, content);
    await writeObject(this.opfsRoot, this.workspaceId, objectName(file.id), payload);
  }

  private async persistManifest(): Promise<void> {
    this.manifest.updatedAt = Date.now();
    const payload = await encryptText(this.key, JSON.stringify(this.manifest));
    await writeObject(this.opfsRoot, this.workspaceId, MANIFEST_FILE, payload);
  }
}

function objectName(id: string): string {
  return `objects/${id}.ksv`;
}

function normalizePath(path: string): string {
  const segments = path.replaceAll('\\', '/').split('/').filter(Boolean);
  if (!segments.length || segments.some(segment => segment === '..' || segment === '.')) {
    throw new Error('Invalid workspace path');
  }
  const normalized = segments.join('/');
  return /\.[a-z0-9]+$/i.test(normalized) ? normalized : `${normalized}.md`;
}

async function encryptText(key: CryptoKey, value: string): Promise<ArrayBuffer> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce.buffer as ArrayBuffer,
      additionalData: MAGIC.buffer as ArrayBuffer,
    },
    key,
    new TextEncoder().encode(value),
  );
  const output = new Uint8Array(MAGIC.length + nonce.length + ciphertext.byteLength);
  output.set(MAGIC, 0);
  output.set(nonce, MAGIC.length);
  output.set(new Uint8Array(ciphertext), MAGIC.length + nonce.length);
  return output.buffer;
}

async function decryptText(key: CryptoKey, value: ArrayBuffer): Promise<string> {
  const payload = splitPayload(value);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: payload.nonce.buffer as ArrayBuffer,
      additionalData: MAGIC.buffer as ArrayBuffer,
    },
    key,
    payload.ciphertext,
  );
  return new TextDecoder().decode(plaintext);
}

function splitPayload(value: ArrayBuffer): EncryptedPayload {
  const bytes = new Uint8Array(value);
  if (bytes.length < 32 || !MAGIC.every((byte, index) => bytes[index] === byte)) {
    throw new Error('Invalid encrypted vault object');
  }
  return {
    nonce: bytes.slice(MAGIC.length, MAGIC.length + 12),
    ciphertext: bytes.slice(MAGIC.length + 12).buffer,
  };
}

async function workspaceDirectory(
  workspaceId: string,
): Promise<FileSystemDirectoryHandle | undefined> {
  try {
    const root = await navigator.storage.getDirectory();
    const workspaces = await root.getDirectoryHandle('workspaces', { create: true });
    return workspaces.getDirectoryHandle(workspaceId, { create: true });
  } catch {
    return undefined;
  }
}

async function readObject(
  root: FileSystemDirectoryHandle | undefined,
  workspaceId: string,
  path: string,
): Promise<ArrayBuffer | undefined> {
  if (root) {
    try {
      const handle = await nestedFile(root, path, false);
      return (await handle.getFile()).arrayBuffer();
    } catch {
      return undefined;
    }
  }
  const value = await idbGet(FALLBACK_STORE, `${workspaceId}/${path}`);
  return value instanceof ArrayBuffer ? value : undefined;
}

async function writeObject(
  root: FileSystemDirectoryHandle | undefined,
  workspaceId: string,
  path: string,
  payload: ArrayBuffer,
): Promise<void> {
  if (root) {
    const handle = await nestedFile(root, path, true);
    const writable = await handle.createWritable();
    await writable.write(payload);
    await writable.close();
    return;
  }
  await idbPut(FALLBACK_STORE, `${workspaceId}/${path}`, payload);
}

async function nestedFile(
  root: FileSystemDirectoryHandle,
  path: string,
  create: boolean,
): Promise<FileSystemFileHandle> {
  const segments = path.split('/');
  let directory = root;
  for (const segment of segments.slice(0, -1)) {
    directory = await directory.getDirectoryHandle(segment, { create });
  }
  return directory.getFileHandle(segments.at(-1) ?? path, { create });
}

async function deviceKey(workspaceId: string): Promise<CryptoKey> {
  const existing = await idbGet(KEY_STORE, workspaceId);
  if (existing instanceof CryptoKey) {
    return existing;
  }
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  await idbPut(KEY_STORE, workspaceId, key);
  return key;
}

async function idbGet(store: string, key: string): Promise<unknown> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(store).objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbPut(store: string, key: string, value: unknown): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(store, 'readwrite').objectStore(store).put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(KEY_STORE)) {
        database.createObjectStore(KEY_STORE);
      }
      if (!database.objectStoreNames.contains(FALLBACK_STORE)) {
        database.createObjectStore(FALLBACK_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
