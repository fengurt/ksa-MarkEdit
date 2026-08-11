const MAX_READ = 10 * 1024 * 1024;
const MAX_PREVIEW = 100 * 1024 * 1024;
let sequence = 0;

export function request(method, fields = {}) {
  sequence += 1;
  return window.ksamintResource.request({
    operationID: `module-${Date.now()}-${sequence}`,
    method,
    ...fields,
  });
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

export async function listAll(parentID, maximum = 200000) {
  const entries = [];
  let cursor;
  do {
    const page = await request('listChildren', { parentID, cursor });
    entries.push(...page.entries);
    if (entries.length > maximum) throw new Error('Resource entry limit exceeded');
    cursor = page.nextCursor;
  } while (cursor);
  return entries;
}

export async function walkFiles(parentID, maximum = 50000) {
  const pending = [parentID];
  const files = [];
  while (pending.length) {
    const parent = pending.shift();
    for (const entry of await listAll(parent, maximum)) {
      if (entry.kind === 'folder' || entry.kind === 'symbolicLink' && !entry.byteCount) pending.push(entry.id);
      else files.push(entry);
      if (files.length + pending.length > maximum) throw new Error('Resource entry limit exceeded');
    }
  }
  return files;
}

export async function readBytes(entryID, offset = 0, length = MAX_READ) {
  const result = await request('readRange', { entryID, offset, length: Math.min(length, MAX_READ) });
  const binary = atob(result.base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function readAll(entryID, byteCount, maximum = MAX_PREVIEW) {
  if (byteCount > maximum) throw new Error(`Preview is limited to ${formatBytes(maximum)}`);
  const result = new Uint8Array(byteCount);
  for (let offset = 0; offset < byteCount; offset += MAX_READ) {
    const chunk = await readBytes(entryID, offset, Math.min(MAX_READ, byteCount - offset));
    result.set(chunk, offset);
    if (!chunk.length) break;
  }
  return result;
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
