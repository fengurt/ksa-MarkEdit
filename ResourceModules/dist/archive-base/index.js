import {
  button,
  element,
  formatBytes,
  installStyles,
  layout,
  readBytes,
  safeRelativePath,
  showMetadata,
  text,
} from './runtime.js';
import { parseZipDirectory } from './archive-format.js';

installStyles('styles.css');

const ENTRY_LIMIT = 200000;
const PREVIEW_LIMIT = 100 * 1024 * 1024;
const CENTRAL_DIRECTORY_LIMIT = 100 * 1024 * 1024;
const RATIO_LIMIT = 1000;
const CHUNK_SIZE = 8 * 1024 * 1024;

export async function open(resource, root) {
  const openController = new AbortController();
  window.addEventListener('pagehide', () => openController.abort(), { once: true });
  const view = layout(root, resource.displayName);
  view.preview.replaceChildren(element('div', 'empty-state', 'Reading archive directory…'));
  const reader = new BrokerReader(resource.displayName, resource.byteCount ?? 0, openController.signal);
  const format = detectFormat(resource.displayName);
  let entries;

  try {
    entries = format === 'zip'
      ? await readZipDirectory(reader)
      : format === 'tar'
        ? await readTarDirectory(reader)
        : await readTGZDirectory(reader);
  } catch (error) {
    view.preview.replaceChildren(element('div', 'empty-state warning', friendlyError(error)));
    return;
  }

  let visibleEntries = entries;
  const renderList = () => {
    view.sidebar.replaceChildren();
    const fragment = document.createDocumentFragment();
    for (const entry of visibleEntries.slice(0, 5000)) {
      const prefix = entry.kind === 'folder' ? '▸ ' : '';
      fragment.append(button(`${prefix}${entry.path}`, () => preview(entry), 'list-row'));
    }
    view.sidebar.append(fragment);
    if (visibleEntries.length > 5000) {
      view.sidebar.append(element('p', 'archive-note', `${visibleEntries.length - 5000} more entries. Use search to narrow the list.`));
    }
  };

  let previewController;
  async function preview(entry) {
    if (entry.kind === 'folder') return;
    previewController?.abort();
    previewController = new AbortController();
    openController.signal.addEventListener('abort', () => previewController.abort(), { once: true });
    reader.signal = previewController.signal;
    view.preview.replaceChildren(element('div', 'empty-state', `Reading ${entry.path}…`));
    try {
      const bytes = format === 'zip'
        ? await extractZipEntry(reader, entry)
        : format === 'tar'
          ? await reader.read(entry.dataOffset, entry.size)
          : await extractTGZEntry(reader, entry);
      renderPreview(view.preview, entry, bytes);
      showMetadata(view.metadata, {
        Path: entry.path,
        Size: formatBytes(entry.size),
        'Compressed size': entry.compressedSize === undefined ? '' : formatBytes(entry.compressedSize),
        Format: format.toUpperCase(),
        Compression: entry.methodName ?? (format === 'tgz' ? 'Gzip stream' : 'None'),
        Encryption: 'Not supported',
        'Safety checks': 'Passed',
      });
    } catch (error) {
      view.preview.replaceChildren(element('div', 'empty-state warning', friendlyError(error)));
    }
  }

  view.search.addEventListener('input', () => {
    const query = fold(view.search.value);
    visibleEntries = query ? entries.filter(entry => fold(entry.path).includes(query)) : entries;
    renderList();
  });
  renderList();
  view.preview.replaceChildren(element('div', 'empty-state', 'Select an archive entry to preview. The archive is never extracted to disk.'));
  showMetadata(view.metadata, {
    Format: format.toUpperCase(),
    Entries: entries.length,
    'Archive size': formatBytes(resource.byteCount ?? 0),
    Extraction: 'Range-based, in memory',
    'Nested archives': 'Manual, maximum depth 2',
  });
}

class BrokerReader {
  constructor(entryID, size, signal) {
    this.entryID = entryID;
    this.size = size;
    this.signal = signal;
  }

  async read(offset, length) {
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0) {
      throw new Error('Invalid archive range');
    }
    if (offset > this.size) return new Uint8Array();
    const requested = Math.min(length, this.size - offset);
    const output = new Uint8Array(requested);
    let written = 0;
    while (written < requested) {
      const chunk = await readBytes(
        this.entryID,
        offset + written,
        Math.min(CHUNK_SIZE, requested - written),
        this.signal
      );
      if (!chunk.length) break;
      output.set(chunk, written);
      written += chunk.length;
    }
    return written === output.length ? output : output.slice(0, written);
  }
}

function detectFormat(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.zip')) return 'zip';
  if (lower.endsWith('.tar')) return 'tar';
  if (lower.endsWith('.tgz') || lower.endsWith('.tar.gz')) return 'tgz';
  throw new Error('Only ZIP, TAR, and TGZ archives are supported by this module');
}

async function readZipDirectory(reader) {
  if (reader.size < 22) throw new Error('Truncated ZIP archive');
  const tailLength = Math.min(reader.size, 65557);
  const tailOffset = reader.size - tailLength;
  const tail = await reader.read(tailOffset, tailLength);
  let endOffset = -1;
  for (let index = tail.length - 22; index >= 0; index -= 1) {
    if (u32(tail, index) === 0x06054b50) { endOffset = index; break; }
  }
  if (endOffset < 0) throw new Error('ZIP end-of-directory record was not found');
  const disk = u16(tail, endOffset + 4);
  const centralDisk = u16(tail, endOffset + 6);
  const entriesOnDisk = u16(tail, endOffset + 8);
  const totalEntries = u16(tail, endOffset + 10);
  const centralSize = u32(tail, endOffset + 12);
  const centralOffset = u32(tail, endOffset + 16);
  if (disk !== 0 || centralDisk !== 0 || entriesOnDisk !== totalEntries) throw new Error('Multi-disk ZIP archives are not supported');
  if (totalEntries === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) throw new Error('ZIP64 archives require the optional large-archive module');
  if (totalEntries > ENTRY_LIMIT) throw new Error('Archive entry limit exceeded');
  if (centralSize > CENTRAL_DIRECTORY_LIMIT || centralOffset + centralSize > reader.size) throw new Error('Invalid or oversized ZIP directory');
  const directory = await reader.read(centralOffset, centralSize);
  const parsed = typeof Worker === 'function'
    ? (await archiveWorkerCall(
        'zipDirectory',
        directory,
        { totalEntries },
        reader.signal,
        true
      )).entries
    : parseZipDirectory(directory, totalEntries);
  const entries = [];
  for (const value of parsed) {
    const { path, flags, method, checksum, compressedSize, size, localOffset } = value;
    validateArchivePath(path);
    if (flags & 0x0001) throw new Error(`Encrypted ZIP entry is not supported: ${path}`);
    if (![0, 8].includes(method) && !path.endsWith('/')) throw new Error(`Unsupported ZIP compression method ${method}: ${path}`);
    validateEntrySize(path, size, compressedSize);
    entries.push({
      path: path.replace(/\/$/, ''),
      kind: path.endsWith('/') ? 'folder' : 'file',
      size,
      compressedSize,
      method,
      methodName: method === 0 ? 'Stored' : method === 8 ? 'Deflate' : `Method ${method}`,
      localOffset,
      flags,
      checksum,
    });
  }
  return entries;
}

async function extractZipEntry(reader, entry) {
  validateEntrySize(entry.path, entry.size, entry.compressedSize);
  const header = await reader.read(entry.localOffset, 30);
  if (header.length !== 30 || u32(header, 0) !== 0x04034b50) throw new Error('Invalid ZIP local entry header');
  const nameLength = u16(header, 26);
  const extraLength = u16(header, 28);
  const dataOffset = entry.localOffset + 30 + nameLength + extraLength;
  if (dataOffset + entry.compressedSize > reader.size) throw new Error('Truncated ZIP entry data');
  const compressed = await reader.read(dataOffset, entry.compressedSize);
  if (entry.method === 0) {
    if (compressed.length !== entry.size) throw new Error('Stored ZIP entry size mismatch');
    if (await checksum(compressed, reader.signal) !== entry.checksum) throw new Error(`ZIP CRC32 mismatch: ${entry.path}`);
    return compressed;
  }
  const bytes = await decompressBytesOffMain(compressed, 'deflate-raw', entry.size, reader.signal);
  if (bytes.length !== entry.size) throw new Error('Inflated ZIP entry size mismatch');
  if (await checksum(bytes, reader.signal) !== entry.checksum) throw new Error(`ZIP CRC32 mismatch: ${entry.path}`);
  return bytes;
}

async function readTarDirectory(reader) {
  const entries = [];
  let offset = 0;
  while (offset + 512 <= reader.size) {
    const header = await reader.read(offset, 512);
    if (isZeroBlock(header)) break;
    const entry = parseTarHeader(header, offset);
    entries.push(entry);
    if (entries.length > ENTRY_LIMIT) throw new Error('Archive entry limit exceeded');
    offset = entry.dataOffset + align512(entry.size);
    if (offset > reader.size) throw new Error(`Truncated TAR entry: ${entry.path}`);
  }
  return entries;
}

async function readTGZDirectory(reader) {
  const entries = [];
  let offset = 0;
  let pending = new Uint8Array();
  let current;
  for await (const chunk of gzipChunks(reader)) {
    pending = concat(pending, chunk);
    while (true) {
      if (!current) {
        if (pending.length < 512) break;
        const header = pending.slice(0, 512);
        pending = pending.slice(512);
        offset += 512;
        if (isZeroBlock(header)) return entries;
        current = parseTarHeader(header, offset - 512);
        entries.push(current);
        if (entries.length > ENTRY_LIMIT) throw new Error('Archive entry limit exceeded');
        current.remaining = align512(current.size);
      }
      if (pending.length < current.remaining) {
        current.remaining -= pending.length;
        offset += pending.length;
        pending = new Uint8Array();
        break;
      }
      pending = pending.slice(current.remaining);
      offset += current.remaining;
      current = undefined;
    }
  }
  if (current) throw new Error(`Truncated TGZ entry: ${current.path}`);
  return entries;
}

async function extractTGZEntry(reader, wanted) {
  let pending = new Uint8Array();
  let current;
  let collected = [];
  let collectedSize = 0;
  for await (const chunk of gzipChunks(reader)) {
    pending = concat(pending, chunk);
    while (true) {
      if (!current) {
        if (pending.length < 512) break;
        const header = pending.slice(0, 512);
        pending = pending.slice(512);
        if (isZeroBlock(header)) throw new Error('TGZ entry was not found');
        current = parseTarHeader(header, 0);
        current.remainingData = current.size;
        current.remainingPadding = align512(current.size) - current.size;
        collected = [];
        collectedSize = 0;
      }
      if (current.remainingData > 0) {
        if (!pending.length) break;
        const count = Math.min(pending.length, current.remainingData);
        if (current.path === wanted.path) {
          collected.push(pending.slice(0, count));
          collectedSize += count;
        }
        pending = pending.slice(count);
        current.remainingData -= count;
        if (current.remainingData > 0) break;
      }
      if (current.remainingPadding > 0) {
        if (!pending.length) break;
        const count = Math.min(pending.length, current.remainingPadding);
        pending = pending.slice(count);
        current.remainingPadding -= count;
        if (current.remainingPadding > 0) break;
      }
      if (current.path === wanted.path) return concatMany(collected, collectedSize);
      current = undefined;
    }
  }
  throw new Error('TGZ entry was not found');
}

async function* gzipChunks(reader) {
  if (typeof DecompressionStream !== 'function') throw new Error('Gzip preview requires macOS 13 or later');
  let offset = 0;
  const input = new ReadableStream({
    async pull(controller) {
      if (offset >= reader.size) { controller.close(); return; }
      const chunk = await reader.read(offset, Math.min(CHUNK_SIZE, reader.size - offset));
      offset += chunk.length;
      if (!chunk.length) controller.close();
      else controller.enqueue(chunk);
    },
  });
  const output = input.pipeThrough(new DecompressionStream('gzip')).getReader();
  try {
    while (true) {
      const { value, done } = await output.read();
      if (done) break;
      yield value;
    }
  } finally {
    output.releaseLock();
  }
}

function parseTarHeader(header, headerOffset) {
  if (header.length !== 512) throw new Error('Truncated TAR header');
  const storedChecksum = parseTarNumber(header.slice(148, 156));
  let sum = 0;
  for (let index = 0; index < 512; index += 1) sum += index >= 148 && index < 156 ? 32 : header[index];
  if (storedChecksum !== sum) throw new Error('Invalid TAR header checksum');
  const name = tarString(header.slice(0, 100));
  const prefix = tarString(header.slice(345, 500));
  const path = prefix ? `${prefix}/${name}` : name;
  validateArchivePath(path);
  const size = parseTarNumber(header.slice(124, 136));
  const type = String.fromCharCode(header[156] || 48);
  if (['2', '3', '4', '6'].includes(type)) throw new Error(`TAR links and device entries are not allowed: ${path}`);
  if (!['0', '\0', '5', '7'].includes(type)) throw new Error(`Unsupported TAR entry type ${type}: ${path}`);
  validateEntrySize(path, size);
  return {
    path: path.replace(/\/$/, ''),
    kind: type === '5' || path.endsWith('/') ? 'folder' : 'file',
    size,
    dataOffset: headerOffset + 512,
  };
}

function validateArchivePath(path) {
  if (!safeRelativePath(path.replace(/\/$/, ''))) throw new Error(`Unsafe archive path: ${path}`);
}

function validateEntrySize(path, size, compressedSize) {
  if (!Number.isSafeInteger(size) || size < 0 || size > PREVIEW_LIMIT) throw new Error(`Entry exceeds the ${formatBytes(PREVIEW_LIMIT)} preview limit: ${path}`);
  if (compressedSize !== undefined) {
    if (!Number.isSafeInteger(compressedSize) || compressedSize < 0) throw new Error(`Invalid compressed size: ${path}`);
    if (size > 0 && compressedSize === 0 || compressedSize > 0 && size / compressedSize > RATIO_LIMIT) {
      throw new Error(`Suspicious compression ratio: ${path}`);
    }
  }
}

async function decompressBytes(bytes, format, expectedSize) {
  if (typeof DecompressionStream !== 'function') throw new Error('Deflate preview requires macOS 13 or later');
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format)).getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > PREVIEW_LIMIT || size > expectedSize) throw new Error('Decompressed data exceeds its declared size');
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return concatMany(chunks, size);
}

async function decompressBytesOffMain(bytes, format, expectedSize, signal) {
  if (typeof Worker !== 'function') return decompressBytes(bytes, format, expectedSize);
  const result = await archiveWorkerCall('decompress', bytes, { format, expectedSize }, signal);
  return new Uint8Array(result.bytes);
}

async function checksum(bytes, signal) {
  if (bytes.length < 64 * 1024 || typeof Worker !== 'function') return crc32(bytes);
  const result = await archiveWorkerCall('crc32', bytes, {}, signal);
  return result.value;
}

function archiveWorkerCall(method, bytes, fields, signal, transferOwnership = false) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./archive-worker.js', import.meta.url), { type: 'module' });
    const id = crypto.randomUUID();
    const finish = action => {
      signal?.removeEventListener('abort', cancel);
      worker.terminate();
      action();
    };
    const cancel = () => finish(() => reject(new DOMException('Operation cancelled', 'AbortError')));
    if (signal?.aborted) return cancel();
    signal?.addEventListener('abort', cancel, { once: true });
    worker.addEventListener('error', event => finish(() => reject(new Error(event.message))));
    worker.addEventListener('message', event => {
      if (event.data.id !== id) return;
      if (event.data.error) finish(() => reject(new Error(event.data.error)));
      else finish(() => resolve(event.data));
    });
    const transferable = transferOwnership && bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
      ? bytes.buffer
      : bytes.slice().buffer;
    worker.postMessage({ id, method, bytes: transferable, ...fields }, [transferable]);
  });
}

function renderPreview(container, entry, bytes) {
  container.replaceChildren();
  const extension = entry.path.split('.').at(-1)?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg'].includes(extension)) {
    const image = element('img', 'preview-image');
    const type = extension === 'svg' ? 'image/svg+xml' : extension === 'jpg' ? 'image/jpeg' : `image/${extension}`;
    image.src = URL.createObjectURL(new Blob([bytes], { type }));
    image.alt = entry.path;
    image.addEventListener('load', () => URL.revokeObjectURL(image.src), { once: true });
    container.append(image);
    return;
  }
  if (isArchiveName(entry.path)) {
    container.append(element('div', 'empty-state', 'Nested archive detected. Open it manually as a resource; automatic nesting is disabled. Maximum supported nesting depth is 2.'));
    return;
  }
  if (looksBinary(bytes)) {
    container.append(element('div', 'empty-state', 'Binary entry preview is not available.'));
    return;
  }
  container.append(element('pre', 'preview-code', text(bytes)));
}

function parseTarNumber(bytes) {
  if (bytes[0] & 0x80) {
    let value = BigInt(bytes[0] & 0x7f);
    for (const byte of bytes.slice(1)) value = value * 256n + BigInt(byte);
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('TAR entry size is too large');
    return Number(value);
  }
  const value = tarString(bytes).trim();
  if (!value) return 0;
  if (!/^[0-7]+$/.test(value)) throw new Error('Invalid TAR numeric field');
  return Number.parseInt(value, 8);
}

function tarString(bytes) {
  const end = bytes.indexOf(0);
  return text(end >= 0 ? bytes.slice(0, end) : bytes).trim();
}

function isZeroBlock(bytes) {
  return bytes.every(byte => byte === 0);
}

function align512(value) {
  return Math.ceil(value / 512) * 512;
}

function concat(left, right) {
  if (!left.length) return right;
  const output = new Uint8Array(left.length + right.length);
  output.set(left); output.set(right, left.length);
  return output;
}

function concatMany(chunks, size) {
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
}

function u16(bytes, offset) {
  return bytes[offset] | bytes[offset + 1] << 8;
}

function u32(bytes, offset) {
  return (bytes[offset] | bytes[offset + 1] << 8 | bytes[offset + 2] << 16 | bytes[offset + 3] << 24) >>> 0;
}

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value >>> 1 ^ (value & 1 ? 0xedb88320 : 0);
    }
  }
  return (value ^ 0xffffffff) >>> 0;
}

function fold(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase();
}

function looksBinary(bytes) {
  const sample = bytes.slice(0, Math.min(bytes.length, 4096));
  return sample.some(byte => byte === 0);
}

function isArchiveName(path) {
  return /\.(?:zip|tar|tgz|tar\.gz)$/i.test(path);
}

function friendlyError(error) {
  return error instanceof Error ? error.message : String(error);
}

export const testing = Object.freeze({
  detectFormat,
  readZipDirectory,
  extractZipEntry,
  readTarDirectory,
});
