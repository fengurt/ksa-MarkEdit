import { createHash, verify } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourceRoot = join(root, 'src');
const distRoot = join(root, 'dist');
const publicKey = await readFile(join(root, 'keys', 'official-v1-public.pem'), 'utf8');
const config = JSON.parse(await readFile(join(root, 'modules.json'), 'utf8'));
const registryData = await readFile(join(distRoot, 'registry.json'));
const registry = JSON.parse(registryData);
const failures = [];

if (registry.schemaVersion !== 1 || registry.modules.length !== config.modules.length) {
  failures.push('registry schema or module count is invalid');
}

for (const definition of config.modules) {
  const moduleRoot = join(distRoot, definition.id);
  const manifestData = await readFile(join(moduleRoot, 'manifest.json'));
  const manifest = JSON.parse(manifestData);
  const { signature, ...unsigned } = manifest;
  if (!verify('sha256', Buffer.from(canonicalJSON(unsigned)), publicKey, Buffer.from(signature, 'base64'))) {
    failures.push(`${definition.id}: invalid manifest signature`);
  }
  if (manifest.id !== definition.id || manifest.version !== definition.version) {
    failures.push(`${definition.id}: manifest identity or version mismatch`);
  }
  const listed = new Set();
  for (const file of manifest.files) {
    const path = join(moduleRoot, file.path);
    const data = await readFile(path);
    listed.add(file.path);
    if (data.byteLength !== file.size || sha256(data) !== file.sha256) {
      failures.push(`${definition.id}/${file.path}: size or hash mismatch`);
    }
    const text = /\.(?:css|html|js|json)$/.test(path) ? data.toString('utf8') : '';
    if (/https?:\/\/|new\s+WebSocket|eval\s*\(|new\s+Function/.test(text)) {
      failures.push(`${definition.id}/${file.path}: forbidden network or dynamic-code primitive`);
    }
  }
  for (const path of await walk(moduleRoot)) {
    const name = relative(moduleRoot, path).split(sep).join('/');
    if (name !== 'manifest.json' && !listed.has(name)) {
      failures.push(`${definition.id}/${name}: file is missing from manifest`);
    }
  }
  const sourceFiles = await walk(join(sourceRoot, definition.id));
  for (const source of sourceFiles) {
    const name = relative(join(sourceRoot, definition.id), source).split(sep).join('/');
    const sourceData = await readFile(source);
    const distData = await readFile(join(moduleRoot, name));
    if (!sourceData.equals(distData)) failures.push(`${definition.id}/${name}: dist is stale`);
  }
  const shared = await readFile(join(sourceRoot, '_shared', 'runtime.js'));
  const runtime = await readFile(join(moduleRoot, 'runtime.js'));
  if (!shared.equals(runtime)) failures.push(`${definition.id}/runtime.js: shared runtime is stale`);
  const sharedCSS = await readFile(join(sourceRoot, '_shared', 'base.css'));
  const moduleCSS = await readFile(join(moduleRoot, 'base.css'));
  if (!sharedCSS.equals(moduleCSS)) failures.push(`${definition.id}/base.css: shared styles are stale`);

  const entry = registry.modules.find(item => item.id === definition.id);
  if (!entry || entry.manifestSHA256 !== sha256(manifestData)) {
    failures.push(`${definition.id}: registry manifest hash mismatch`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Verified ${config.modules.length} signed resource modules.`);

async function walk(directory) {
  const result = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isDirectory()) result.push(...await walk(path));
    else result.push(path);
  }
  return result;
}

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

function canonicalJSON(value) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortValue(value[key])]));
  }
  return value;
}
