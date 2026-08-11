const MAX_READ = 10 * 1024 * 1024;
const MAX_PREVIEW = 100 * 1024 * 1024;
let sequence = 0;

export function request(method, fields = {}, signal) {
  sequence += 1;
  const operationID = `module-${Date.now()}-${sequence}`;
  if (signal?.aborted) return Promise.reject(new DOMException('Operation cancelled', 'AbortError'));
  const promise = window.ksamintResource.request({
    operationID,
    method,
    ...fields,
  });
  if (!signal) return promise;
  const cancel = () => {
    window.ksamintResource.request({
      operationID: `cancel-${Date.now()}-${sequence}`,
      method: 'cancel',
      entryID: operationID,
    }).catch(() => {});
  };
  signal.addEventListener('abort', cancel, { once: true });
  return promise.finally(() => signal.removeEventListener('abort', cancel));
}

export function installStyles(...names) {
  for (const name of ['base.css', ...names]) {
    if (document.head.querySelector(`link[data-module-style="${name}"]`)) continue;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = name;
    link.dataset.moduleStyle = name;
    document.head.append(link);
  }
}

export async function listAll(parentID, maximum = 200000, signal) {
  const entries = [];
  let cursor;
  do {
    const page = await request('listChildren', { parentID, cursor }, signal);
    entries.push(...page.entries);
    if (entries.length > maximum) throw new Error('Resource entry limit exceeded');
    cursor = page.nextCursor;
  } while (cursor);
  return entries;
}

export async function walkFiles(parentID, maximum = 50000, signal, onBatch) {
  const pending = [parentID];
  const files = [];
  for (let cursor = 0; cursor < pending.length; cursor += 1) {
    const parent = pending[cursor];
    let pageCursor;
    do {
      const page = await request('listChildren', { parentID: parent, cursor: pageCursor }, signal);
      const batch = [];
      for (const entry of page.entries) {
        if (entry.kind === 'folder' || entry.kind === 'symbolicLink' && !entry.byteCount) pending.push(entry.id);
        else { files.push(entry); batch.push(entry); }
        if (files.length + pending.length > maximum) throw new Error('Resource entry limit exceeded');
      }
      if (batch.length) await onBatch?.(batch);
      pageCursor = page.nextCursor;
    } while (pageCursor);
  }
  return files;
}

export async function readBytes(entryID, offset = 0, length = MAX_READ, signal) {
  const result = await request('readRange', { entryID, offset, length: Math.min(length, MAX_READ) }, signal);
  const binary = atob(result.base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function readBatch(reads, signal) {
  if (!reads.length) return [];
  const results = await request('readBatch', { reads }, signal);
  return results.map(result => ({
    entryID: result.entryID,
    offset: result.offset,
    bytes: decodeBase64(result.data),
  }));
}

export async function readAll(entryID, byteCount, maximum = MAX_PREVIEW, signal) {
  if (byteCount > maximum) throw new Error(`Preview is limited to ${formatBytes(maximum)}`);
  const result = new Uint8Array(byteCount);
  for (let offset = 0; offset < byteCount; offset += MAX_READ) {
    const chunk = await readBytes(entryID, offset, Math.min(MAX_READ, byteCount - offset), signal);
    result.set(chunk, offset);
    if (!chunk.length) break;
  }
  return result;
}

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function renderInfo(entryID) {
  return request('render', { entryID, mode: 'preview' });
}

export async function resourceURL(entryID) {
  return (await renderInfo(entryID)).resourceURL;
}

export function layout(root, title) {
  root.replaceChildren();
  const shell = element('div', 'resource-shell');
  const header = element('header', 'resource-header');
  const heading = element('strong', 'resource-title', title);
  const search = element('input', 'resource-search');
  search.type = 'search';
  search.placeholder = 'Search resource';
  header.append(heading, search);
  const body = element('div', 'resource-body');
  const sidebar = element('nav', 'resource-sidebar');
  const preview = element('main', 'resource-preview');
  const metadata = element('aside', 'resource-metadata');
  body.append(sidebar, preview, metadata);
  shell.append(header, body);
  root.append(shell);
  return { shell, header, search, sidebar, preview, metadata };
}

export function element(tag, className, text) {
  const value = document.createElement(tag);
  if (className) value.className = className;
  if (text !== undefined) value.textContent = text;
  return value;
}

export function button(label, action, className = '') {
  const value = element('button', className, label);
  value.type = 'button';
  value.addEventListener('click', action);
  return value;
}

export function showMetadata(container, values) {
  container.replaceChildren();
  for (const [label, value] of Object.entries(values)) {
    const row = element('div', 'metadata-row');
    row.append(element('span', '', label), element('strong', '', String(value ?? '')));
    container.append(row);
  }
}

export function formatBytes(value) {
  if (!Number.isFinite(value)) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KiB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MiB`;
  return `${(value / 1024 ** 3).toFixed(1)} GiB`;
}

export function safeRelativePath(path) {
  const normalized = path.replaceAll('\\', '/');
  return normalized.length > 0
    && !normalized.startsWith('/')
    && !/^[a-z]:/i.test(normalized)
    && normalized.split('/').every(part => part && part !== '.' && part !== '..');
}

export function joinPath(base, path) {
  const parts = `${base ? `${base}/` : ''}${path}`.split('/');
  const output = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') output.pop();
    else output.push(part);
  }
  const joined = output.join('/');
  if (!safeRelativePath(joined)) throw new Error('Unsafe resource path');
  return joined;
}

export function text(bytes) {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

export const limits = Object.freeze({ maxRead: MAX_READ, maxPreview: MAX_PREVIEW });
