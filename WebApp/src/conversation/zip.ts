const MAX_ENTRIES = 100_000;
const MAX_ENTRY_BYTES = 250 * 1024 * 1024;
const MAX_RATIO = 1_000;

export type ZipEntry = { path: string; bytes: Uint8Array };
export type ZipArchiveReader = {
  paths: string[];
  textCandidatePaths: string[];
  read(path: string): Promise<ZipEntry | undefined>;
};

export function openZipArchive(archive: Uint8Array): ZipArchiveReader {
  const directory = zipDirectory(archive);
  const byPath = new Map(directory.map(entry => [entry.path, entry]));
  return {
    paths: directory.map(entry => entry.path),
    textCandidatePaths: preferredTextEntries(directory).map(entry => entry.path),
    async read(path) {
      const entry = byPath.get(path);
      return entry ? { path, bytes: await extractEntry(archive, entry) } : undefined;
    },
  };
}

type DirectoryEntry = {
  path: string;
  flags: number;
  method: number;
  checksum: number;
  compressedSize: number;
  size: number;
  localOffset: number;
};

export async function extractZipTextEntries(archive: Uint8Array): Promise<ZipEntry[]> {
  const reader = openZipArchive(archive);
  const output: ZipEntry[] = [];
  for (const path of reader.textCandidatePaths) {
    const entry = await reader.read(path);
    if (entry) output.push(entry);
  }
  return output;
}

function zipDirectory(bytes: Uint8Array): DirectoryEntry[] {
  if (bytes.length < 22) throw new Error('Truncated ZIP archive');
  const start = Math.max(0, bytes.length - 65_557);
  let end = -1;
  for (let offset = bytes.length - 22; offset >= start; offset -= 1) {
    if (u32(bytes, offset) === 0x06054b50) {
      end = offset;
      break;
    }
  }
  if (end < 0) throw new Error('ZIP end-of-directory record was not found');
  const disk = u16(bytes, end + 4);
  const centralDisk = u16(bytes, end + 6);
  const entriesOnDisk = u16(bytes, end + 8);
  const totalEntries = u16(bytes, end + 10);
  const centralSize = u32(bytes, end + 12);
  const centralOffset = u32(bytes, end + 16);
  if (disk || centralDisk || entriesOnDisk !== totalEntries) throw new Error('Multi-disk ZIP is unsupported');
  if (totalEntries === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    throw new Error('ZIP64 is unsupported');
  }
  if (totalEntries > MAX_ENTRIES) throw new Error('ZIP entry limit exceeded');
  if (centralOffset + centralSize > bytes.length) throw new Error('Invalid ZIP central directory');
  const entries: DirectoryEntry[] = [];
  let cursor = centralOffset;
  while (cursor < centralOffset + centralSize && entries.length < totalEntries) {
    if (cursor + 46 > bytes.length || u32(bytes, cursor) !== 0x02014b50) {
      throw new Error('Invalid ZIP directory entry');
    }
    const flags = u16(bytes, cursor + 8);
    const method = u16(bytes, cursor + 10);
    const nameLength = u16(bytes, cursor + 28);
    const extraLength = u16(bytes, cursor + 30);
    const commentLength = u16(bytes, cursor + 32);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    if (next > bytes.length) throw new Error('Truncated ZIP directory entry');
    const path = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    validatePath(path);
    const entry = {
      path: path.replace(/\/$/u, ''),
      flags,
      method,
      checksum: u32(bytes, cursor + 16),
      compressedSize: u32(bytes, cursor + 20),
      size: u32(bytes, cursor + 24),
      localOffset: u32(bytes, cursor + 42),
    };
    if ((flags & 1) !== 0) throw new Error(`Encrypted ZIP entry is unsupported: ${path}`);
    if (![0, 8].includes(method) && !path.endsWith('/')) throw new Error(`Unsupported ZIP method: ${method}`);
    validateSize(entry);
    if (!path.endsWith('/')) entries.push(entry);
    cursor = next;
  }
  if (entries.length > totalEntries) throw new Error('ZIP entry count mismatch');
  return entries;
}

function preferredTextEntries(entries: DirectoryEntry[]): DirectoryEntry[] {
  const preferred = entries.filter(entry => /(?:^|\/)(?:conversations|claude_conversations)\.json$/iu.test(entry.path));
  const candidates = preferred.length ? preferred : entries.filter(entry => (
    /\.(?:json|md|markdown|txt|html?|rtf)$/iu.test(entry.path)
    && !/(?:^|\/)(?:user|message_feedback|shared_conversations)\.json$/iu.test(entry.path)
  ));
  if (candidates.length > 256) throw new Error('ZIP contains too many conversation candidates');
  return candidates;
}

async function extractEntry(archive: Uint8Array, entry: DirectoryEntry): Promise<Uint8Array> {
  if (entry.localOffset + 30 > archive.length || u32(archive, entry.localOffset) !== 0x04034b50) {
    throw new Error(`Invalid ZIP local header: ${entry.path}`);
  }
  const nameLength = u16(archive, entry.localOffset + 26);
  const extraLength = u16(archive, entry.localOffset + 28);
  const start = entry.localOffset + 30 + nameLength + extraLength;
  const end = start + entry.compressedSize;
  if (end > archive.length) throw new Error(`Truncated ZIP entry: ${entry.path}`);
  const compressed = archive.slice(start, end);
  const bytes = entry.method === 0 ? compressed : await inflate(compressed, entry.size);
  if (bytes.length !== entry.size) throw new Error(`ZIP size mismatch: ${entry.path}`);
  if (crc32(bytes) !== entry.checksum) throw new Error(`ZIP CRC32 mismatch: ${entry.path}`);
  return bytes;
}

async function inflate(bytes: Uint8Array, expectedSize: number): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'function') throw new Error('Deflate ZIP requires a modern browser');
  const stream = new Blob([bytes.slice().buffer]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > expectedSize || size > MAX_ENTRY_BYTES) throw new Error('ZIP output exceeded declared size');
    chunks.push(value);
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function validatePath(path: string) {
  const normalized = path.replace(/\/$/u, '');
  const segments = normalized.split('/');
  if (!normalized || normalized.startsWith('/') || /^[a-z]:/iu.test(normalized) || segments.some(part => part === '..' || part === '.')) {
    throw new Error(`Unsafe ZIP path: ${path}`);
  }
}

function validateSize(entry: Pick<DirectoryEntry, 'path' | 'size' | 'compressedSize'>) {
  if (entry.size > MAX_ENTRY_BYTES) throw new Error(`ZIP entry is too large: ${entry.path}`);
  if (entry.size > 0 && entry.compressedSize === 0) throw new Error(`Suspicious ZIP ratio: ${entry.path}`);
  if (entry.compressedSize > 0 && entry.size / entry.compressedSize > MAX_RATIO) {
    throw new Error(`Suspicious ZIP ratio: ${entry.path}`);
  }
}

function u16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
