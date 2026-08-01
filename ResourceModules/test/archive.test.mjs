import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.document = {
  head: {
    querySelector: () => undefined,
    append: () => undefined,
  },
  createElement: () => ({ dataset: {} }),
};

const { testing } = await import('../dist/archive-base/index.js');

test('reads and extracts a stored ZIP entry', async () => {
  const archive = zip('文档/readme.md', new TextEncoder().encode('# Hello'));
  const reader = memoryReader(archive);
  const entries = await testing.readZipDirectory(reader);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].path, '文档/readme.md');
  assert.equal(new TextDecoder().decode(await testing.extractZipEntry(reader, entries[0])), '# Hello');
});

test('rejects Zip Slip paths', async () => {
  const archive = zip('../outside.md', new TextEncoder().encode('unsafe'));
  await assert.rejects(testing.readZipDirectory(memoryReader(archive)), /Unsafe archive path/);
});

test('reads a Unicode TAR entry without extracting it', async () => {
  const archive = tar('资料/笔记.md', new TextEncoder().encode('内容'));
  const entries = await testing.readTarDirectory(memoryReader(archive));
  assert.equal(entries.length, 1);
  assert.equal(entries[0].path, '资料/笔记.md');
  assert.equal(entries[0].size, 6);
});

function memoryReader(bytes) {
  return {
    size: bytes.length,
    async read(offset, length) {
      return bytes.slice(offset, offset + length);
    },
  };
}

function zip(path, content) {
  const name = new TextEncoder().encode(path);
  const local = new Uint8Array(30 + name.length + content.length);
  write32(local, 0, 0x04034b50);
  write16(local, 4, 20);
  write16(local, 6, 0x0800);
  write32(local, 18, content.length);
  write32(local, 22, content.length);
  write16(local, 26, name.length);
  local.set(name, 30);
  local.set(content, 30 + name.length);

  const central = new Uint8Array(46 + name.length);
  write32(central, 0, 0x02014b50);
  write16(central, 4, 20);
  write16(central, 6, 20);
  write16(central, 8, 0x0800);
  write32(central, 20, content.length);
  write32(central, 24, content.length);
  write16(central, 28, name.length);
  central.set(name, 46);

  const end = new Uint8Array(22);
  write32(end, 0, 0x06054b50);
  write16(end, 8, 1);
  write16(end, 10, 1);
  write32(end, 12, central.length);
  write32(end, 16, local.length);
  return concat(local, central, end);
}

function tar(path, content) {
  const header = new Uint8Array(512);
  header.set(new TextEncoder().encode(path), 0);
  writeASCII(header, 100, '0000644\0');
  writeASCII(header, 108, '0000000\0');
  writeASCII(header, 116, '0000000\0');
  writeASCII(header, 124, `${content.length.toString(8).padStart(11, '0')}\0`);
  writeASCII(header, 136, '00000000000\0');
  header.fill(32, 148, 156);
  header[156] = 48;
  writeASCII(header, 257, 'ustar\0');
  writeASCII(header, 263, '00');
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  writeASCII(header, 148, `${checksum.toString(8).padStart(6, '0')}\0 `);
  const data = new Uint8Array(Math.ceil(content.length / 512) * 512);
  data.set(content);
  return concat(header, data, new Uint8Array(1024));
}

function writeASCII(target, offset, value) {
  target.set(new TextEncoder().encode(value), offset);
}

function write16(target, offset, value) {
  target[offset] = value & 255;
  target[offset + 1] = value >>> 8 & 255;
}

function write32(target, offset, value) {
  write16(target, offset, value & 0xffff);
  write16(target, offset + 2, value >>> 16);
}

function concat(...values) {
  const output = new Uint8Array(values.reduce((sum, value) => sum + value.length, 0));
  let offset = 0;
  for (const value of values) { output.set(value, offset); offset += value.length; }
  return output;
}
