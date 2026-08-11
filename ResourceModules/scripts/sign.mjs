import { createHash, sign } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourceRoot = join(root, 'src');
const distRoot = join(root, 'dist');
const config = JSON.parse(await readFile(join(root, 'modules.json'), 'utf8'));
const keyPath = process.env.KSAMINT_RESOURCE_MODULE_SIGNING_KEY_FILE;
const privateKey = process.env.KSAMINT_RESOURCE_MODULE_SIGNING_KEY_PEM
  ?? (keyPath ? await readFile(resolve(keyPath), 'utf8') : undefined);

if (!privateKey) {
  throw new Error('Set KSAMINT_RESOURCE_MODULE_SIGNING_KEY_PEM or KSAMINT_RESOURCE_MODULE_SIGNING_KEY_FILE');
}

await rm(distRoot, { recursive: true, force: true });
await mkdir(distRoot, { recursive: true });
const registry = { schemaVersion: 1, modules: [] };

for (const definition of config.modules) {
  const moduleRoot = join(distRoot, definition.id);
  await mkdir(moduleRoot, { recursive: true });
  await cp(join(sourceRoot, definition.id), moduleRoot, { recursive: true });
  await cp(join(sourceRoot, '_shared', 'runtime.js'), join(moduleRoot, 'runtime.js'));
  await cp(join(sourceRoot, '_shared', 'base.css'), join(moduleRoot, 'base.css'));
  const files = [];
  for (const path of await walk(moduleRoot)) {
    const data = await readFile(path);
    files.push({
      path: relative(moduleRoot, path).split(sep).join('/'),
      sha256: sha256(data),
      size: data.byteLength,
      mediaType: mediaType(path),
    });
  }
  files.sort((left, right) => left.path.localeCompare(right.path));
  const unsigned = {
    schemaVersion: 1,
    id: definition.id,
    version: definition.version,
    displayName: definition.displayName,
    entrypoint: definition.entrypoint,
    files,
    probes: definition.probes,
    signingKeyID: 'official-v1',
  };
  const signature = sign('sha256', Buffer.from(canonicalJSON(unsigned)), privateKey).toString('base64');
  const manifest = { ...unsigned, signature };
  const manifestData = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(join(moduleRoot, 'manifest.json'), manifestData);
  registry.modules.push({
    id: definition.id,
    displayName: definition.displayName,
    version: definition.version,
    manifestURL: `https://raw.githubusercontent.com/fengurt/ksa-MarkEdit/main/ResourceModules/dist/${definition.id}/manifest.json`,
    manifestSHA256: sha256(manifestData),
    downloadBytes: files.reduce((sum, file) => sum + file.size, manifestData.byteLength),
    minAppVersion: definition.minAppVersion,
    probes: definition.probes,
  });
}

await writeFile(join(distRoot, 'registry.json'), `${JSON.stringify(registry, null, 2)}\n`);
console.log(`Signed ${registry.modules.length} resource modules.`);

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

function mediaType(path) {
  return ({
    '.css': 'text/css',
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.wasm': 'application/wasm',
  })[extname(path).toLowerCase()] ?? 'application/octet-stream';
}
