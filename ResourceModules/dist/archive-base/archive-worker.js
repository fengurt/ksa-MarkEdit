import { parseZipDirectory } from './archive-format.js';

self.addEventListener('message', async event => {
  const { id, method, bytes, format, expectedSize } = event.data;
  try {
    const input = new Uint8Array(bytes);
    if (method === 'zipDirectory') {
      self.postMessage({ id, entries: parseZipDirectory(input, event.data.totalEntries) });
      return;
    }
    if (method === 'crc32') {
      self.postMessage({ id, value: crc32(input) });
      return;
    }
    if (method === 'decompress') {
      const stream = new Blob([input]).stream().pipeThrough(new DecompressionStream(format));
      const output = new Uint8Array(await new Response(stream).arrayBuffer());
      if (output.length > expectedSize || output.length > 100 * 1024 * 1024) {
        throw new Error('Decompressed data exceeded the declared size');
      }
      self.postMessage({ id, bytes: output.buffer }, [output.buffer]);
      return;
    }
    throw new Error('Unsupported archive worker operation');
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
});

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
