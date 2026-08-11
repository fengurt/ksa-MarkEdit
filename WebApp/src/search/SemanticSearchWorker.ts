/// <reference lib="webworker" />
import { Tokenizer } from '@huggingface/tokenizers';
import * as ort from 'onnxruntime-web';

type NoteChunk = { fileId: string; path: string; heading?: string; text: string; offset: number };
type IndexedChunk = NoteChunk & { vector: Float32Array };
type ModelManifest = {
  protocolVersion: 1;
  dimension: 384;
  files: Array<{ name: string; url: string; sha256: string; byteSize: number }>;
};

let tokenizer: Tokenizer | undefined;
let session: ort.InferenceSession | undefined;
let chunks: IndexedChunk[] = [];
let hnsw: HNSWIndex | undefined;
let cancelled = false;

type HNSWIndex = {
  entryPoint: number;
  maximumLevel: number;
  levels: number[][][];
};

const HNSW_THRESHOLD = 5_000;
const HNSW_CONNECTIONS = 8;
const HNSW_EF_CONSTRUCTION = 32;

self.onmessage = (event: MessageEvent) => {
  const message = event.data as Record<string, unknown>;
  if (message.type === 'cancel') {
    cancelled = true;
    return;
  }
  if (message.type === 'index') void index(message);
  if (message.type === 'search') void search(message);
};

async function index(message: Record<string, unknown>) {
  cancelled = false;
  try {
    await loadModel();
    const values = message.chunks as NoteChunk[];
    const existing = new Map(chunks.map(chunk => [chunkKey(chunk), chunk.vector]));
    const indexed: IndexedChunk[] = [];
    for (let offset = 0; offset < values.length; offset += 16) {
      if (cancelled) throw new DOMException('Indexing cancelled', 'AbortError');
      const batch = values.slice(offset, offset + 16);
      const missing = batch.filter(value => !existing.has(chunkKey(value)));
      const vectors = missing.length ? await embed(missing.map(value => `passage: ${value.text}`)) : [];
      const embedded = new Map(missing.map((value, index) => [chunkKey(value), vectors[index]]));
      indexed.push(...batch.map(value => ({
        ...value,
        vector: existing.get(chunkKey(value)) ?? embedded.get(chunkKey(value))!,
      })));
      self.postMessage({ type: 'progress', completed: indexed.length, total: values.length });
    }
    chunks = indexed;
    hnsw = indexed.length >= HNSW_THRESHOLD ? buildHNSW(indexed) : undefined;
    await persistFloat16Index(indexed);
    self.postMessage({ type: 'indexed', count: indexed.length });
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
}

async function search(message: Record<string, unknown>) {
  cancelled = false;
  try {
    if (!chunks.length) throw new Error('Build the local semantic index first');
    const [query] = await embed([`query: ${String(message.query ?? '')}`]);
    const limit = Math.min(50, Math.max(1, Number(message.limit ?? 20)));
    const candidates = hnsw
      ? searchHNSW(query, Math.max(64, limit * 4)).map(result => ({ chunk: chunks[result.index], score: result.score }))
      : chunks.map(chunk => ({ chunk, score: dot(query, chunk.vector) }));
    const results = candidates.map(({ chunk, score }) => ({
      fileId: chunk.fileId,
      path: chunk.path,
      heading: chunk.heading,
      text: chunk.text,
      offset: chunk.offset,
      score,
    })).sort((left, right) => right.score - left.score).slice(0, limit);
    self.postMessage({ type: 'results', requestId: message.requestId, results });
  } catch (error) {
    self.postMessage({ type: 'error', requestId: message.requestId, message: error instanceof Error ? error.message : String(error) });
  }
}

function chunkKey(value: NoteChunk): string {
  return `${value.fileId}\u0000${value.path}\u0000${value.offset}\u0000${value.text}`;
}

function buildHNSW(values: IndexedChunk[]): HNSWIndex {
  const levels: number[][][] = values.map((value, index) => (
    Array.from({ length: deterministicLevel(chunkKey(value)) + 1 }, () => index === 0 ? [] : [])
  ));
  const index: HNSWIndex = { entryPoint: 0, maximumLevel: levels[0].length - 1, levels };
  for (let node = 1; node < values.length; node += 1) {
    if (cancelled) throw new DOMException('Indexing cancelled', 'AbortError');
    const nodeLevel = levels[node].length - 1;
    let entry = index.entryPoint;
    for (let level = index.maximumLevel; level > nodeLevel; level -= 1) {
      entry = greedyNearest(values[node].vector, entry, level, index);
    }
    for (let level = Math.min(nodeLevel, index.maximumLevel); level >= 0; level -= 1) {
      const selected = searchLayer(values[node].vector, [entry], level, HNSW_EF_CONSTRUCTION, index)
        .slice(0, HNSW_CONNECTIONS);
      levels[node][level] = selected.map(candidate => candidate.index);
      for (const neighbor of levels[node][level]) {
        const links = levels[neighbor][level] ?? (levels[neighbor][level] = []);
        links.push(node);
        links.sort((left, right) => dot(values[neighbor].vector, values[right].vector)
          - dot(values[neighbor].vector, values[left].vector));
        if (links.length > HNSW_CONNECTIONS) links.length = HNSW_CONNECTIONS;
      }
      entry = selected[0]?.index ?? entry;
    }
    if (nodeLevel > index.maximumLevel) {
      index.entryPoint = node;
      index.maximumLevel = nodeLevel;
    }
  }
  return index;
}

function searchHNSW(query: Float32Array, ef: number) {
  if (!hnsw) return [];
  let entry = hnsw.entryPoint;
  for (let level = hnsw.maximumLevel; level > 0; level -= 1) {
    entry = greedyNearest(query, entry, level, hnsw);
  }
  return searchLayer(query, [entry], 0, ef, hnsw);
}

function greedyNearest(query: Float32Array, start: number, level: number, index: HNSWIndex): number {
  let current = start;
  let score = dot(query, chunks[current].vector);
  let changed = true;
  while (changed) {
    changed = false;
    for (const neighbor of index.levels[current][level] ?? []) {
      const candidate = dot(query, chunks[neighbor].vector);
      if (candidate > score) {
        current = neighbor;
        score = candidate;
        changed = true;
      }
    }
  }
  return current;
}

function searchLayer(
  query: Float32Array,
  entries: number[],
  level: number,
  ef: number,
  index: HNSWIndex,
): Array<{ index: number; score: number }> {
  const visited = new Set(entries);
  const candidates = entries.map(node => ({ index: node, score: dot(query, chunks[node].vector) }));
  const best = [...candidates];
  while (candidates.length) {
    candidates.sort((left, right) => right.score - left.score);
    const current = candidates.shift()!;
    best.sort((left, right) => right.score - left.score);
    if (best.length >= ef && current.score < best.at(-1)!.score) break;
    for (const neighbor of index.levels[current.index][level] ?? []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      const candidate = { index: neighbor, score: dot(query, chunks[neighbor].vector) };
      if (best.length < ef || candidate.score > best.at(-1)!.score) {
        candidates.push(candidate);
        best.push(candidate);
        best.sort((left, right) => right.score - left.score);
        if (best.length > ef) best.length = ef;
      }
    }
  }
  return best.sort((left, right) => right.score - left.score);
}

function deterministicLevel(key: string): number {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash = Math.imul(hash ^ key.charCodeAt(index), 16777619) >>> 0;
  }
  let level = 0;
  while ((hash & 0xff) < 94 && level < 8) {
    level += 1;
    hash = Math.imul(hash ^ (hash >>> 13), 0x5bd1e995) >>> 0;
  }
  return level;
}

async function loadModel() {
  if (tokenizer && session) return;
  const manifestResponse = await fetch('/models/multilingual-e5-small/manifest.json', { cache: 'no-cache' });
  if (!manifestResponse.ok) throw new Error('The first-party Deep Search model is unavailable');
  const manifest = await manifestResponse.json() as ModelManifest;
  if (manifest.protocolVersion !== 1 || manifest.dimension !== 384) throw new Error('Unsupported Deep Search model manifest');
  const files = new Map<string, Uint8Array>();
  for (const file of manifest.files) {
    const bytes = await cachedModelFile(file);
    files.set(file.name, bytes);
  }
  const tokenizerJSON = files.get('tokenizer.json');
  const tokenizerConfig = files.get('tokenizer_config.json');
  const model = files.get('model_quantized.onnx');
  if (!tokenizerJSON || !tokenizerConfig || !model) throw new Error('Deep Search model files are incomplete');
  tokenizer = new Tokenizer(
    JSON.parse(new TextDecoder().decode(tokenizerJSON)) as object,
    JSON.parse(new TextDecoder().decode(tokenizerConfig)) as object,
  );
  const executionProviders = 'gpu' in navigator ? ['webgpu', 'wasm'] : ['wasm'];
  session = await ort.InferenceSession.create(model, { executionProviders });
}

async function cachedModelFile(file: ModelManifest['files'][number]): Promise<Uint8Array> {
  const root = await navigator.storage.getDirectory();
  const directory = await root.getDirectoryHandle('semantic-model-v1', { create: true });
  const handle = await directory.getFileHandle(file.name.replaceAll('/', '_'), { create: true });
  const existing = new Uint8Array(await (await handle.getFile()).arrayBuffer());
  if (existing.length === file.byteSize && await sha256(existing) === file.sha256) return existing;
  const response = await fetch(file.url, { cache: 'reload' });
  if (!response.ok) throw new Error(`Deep Search model download failed: ${file.name}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length !== file.byteSize || await sha256(bytes) !== file.sha256) {
    throw new Error(`Deep Search model integrity check failed: ${file.name}`);
  }
  const writer = await handle.createWritable();
  await writer.write(bytes.slice().buffer);
  await writer.close();
  return bytes;
}

async function embed(texts: string[]): Promise<Float32Array[]> {
  if (!tokenizer || !session) throw new Error('Deep Search model is not loaded');
  const encoded = texts.map(text => {
    const value = tokenizer!.encode(text);
    if (value.ids.length <= 512) return value;
    // Preserve the tokenizer's terminal special token when truncating. E5
    // quality drops noticeably if the final SEP/EOS token is discarded.
    return {
      ...value,
      ids: [...value.ids.slice(0, 511), value.ids.at(-1)!],
      attention_mask: [...value.attention_mask.slice(0, 511), value.attention_mask.at(-1)!],
    };
  });
  const width = Math.max(...encoded.map(value => value.ids.length));
  const inputIDs = new BigInt64Array(texts.length * width);
  const attention = new BigInt64Array(texts.length * width);
  encoded.forEach((value, row) => value.ids.forEach((id, column) => {
    inputIDs[row * width + column] = BigInt(id);
    attention[row * width + column] = 1n;
  }));
  const feeds: Record<string, ort.Tensor> = {
    input_ids: new ort.Tensor('int64', inputIDs, [texts.length, width]),
    attention_mask: new ort.Tensor('int64', attention, [texts.length, width]),
  };
  if (session.inputNames.includes('token_type_ids')) {
    feeds.token_type_ids = new ort.Tensor('int64', new BigInt64Array(texts.length * width), [texts.length, width]);
  }
  const output = await session.run(feeds);
  const hidden = output.last_hidden_state ?? output[session.outputNames[0]];
  const dimension = hidden.dims.at(-1) ?? 384;
  const values = hidden.data as Float32Array;
  return texts.map((_, row) => normalize(meanPool(values, attention, row, width, dimension)));
}

function meanPool(values: Float32Array, mask: BigInt64Array, row: number, width: number, dimension: number) {
  const output = new Float32Array(dimension);
  let count = 0;
  for (let token = 0; token < width; token += 1) {
    if (mask[row * width + token] === 0n) continue;
    count += 1;
    const start = (row * width + token) * dimension;
    for (let index = 0; index < dimension; index += 1) output[index] += values[start + index];
  }
  for (let index = 0; index < dimension; index += 1) output[index] /= Math.max(1, count);
  return output;
}

function normalize(value: Float32Array) {
  const norm = Math.sqrt(dot(value, value)) || 1;
  return value.map(item => item / norm);
}

function dot(left: Float32Array, right: Float32Array) {
  let value = 0;
  for (let index = 0; index < left.length; index += 1) value += left[index] * right[index];
  return value;
}

async function persistFloat16Index(values: IndexedChunk[]) {
  const root = await navigator.storage.getDirectory();
  const directory = await root.getDirectoryHandle('semantic-index-v1', { create: true });
  const handle = await directory.getFileHandle('vectors.f16', { create: true });
  const output = new Uint16Array(values.length * 384);
  values.forEach((value, row) => value.vector.forEach((item, column) => {
    output[row * 384 + column] = float16(item);
  }));
  const writer = await handle.createWritable();
  await writer.write(output.buffer);
  await writer.close();
}

function float16(value: number): number {
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, value, false);
  const bits = view.getUint32(0, false);
  const sign = (bits >>> 16) & 0x8000;
  const exponent = ((bits >>> 23) & 0xff) - 127 + 15;
  const fraction = (bits >>> 13) & 0x3ff;
  if (exponent <= 0) return sign;
  if (exponent >= 31) return sign | 0x7c00;
  return sign | (exponent << 10) | fraction;
}

async function sha256(value: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', value.slice().buffer));
  return [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export {};
