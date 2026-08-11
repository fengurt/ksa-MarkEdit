import { describe, expect, it } from 'vitest';
import { extractZipTextEntries } from './zip';

describe('conversation ZIP reader', () => {
  it('extracts a stored Unicode conversations.json entry', async () => {
    const content = new TextEncoder().encode('[{"title":"日本語 Café"}]');
    const archive = zip('导出/conversations.json', content);
    await expect(extractZipTextEntries(archive)).resolves.toEqual([{
      path: '导出/conversations.json',
      bytes: content,
    }]);
  });

  it('rejects traversal before extracting content', async () => {
    await expect(extractZipTextEntries(zip('../conversations.json', new Uint8Array([1]))))
      .rejects.toThrow('Unsafe ZIP path');
  });

  it('rejects CRC mutations', async () => {
    const path = 'conversations.json';
    const archive = zip(path, new TextEncoder().encode('trusted'));
    archive[30 + new TextEncoder().encode(path).length] ^= 1;
    await expect(extractZipTextEntries(archive)).rejects.toThrow('CRC32');
  });
});

function zip(path: string, content: Uint8Array): Uint8Array {
  const name = new TextEncoder().encode(path);
  const checksum = crc32(content);
  const local = new Uint8Array(30 + name.length + content.length);
  write32(local, 0, 0x04034b50);
  write16(local, 4, 20);
  write16(local, 6, 0x0800);
  write32(local, 14, checksum);
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
  write32(central, 16, checksum);
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
  const output = new Uint8Array(local.length + central.length + end.length);
  output.set(local);
  output.set(central, local.length);
  output.set(end, local.length + central.length);
  return output;
}

function crc32(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function write16(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = value;
  bytes[offset + 1] = value >>> 8;
}

function write32(bytes: Uint8Array, offset: number, value: number) {
  write16(bytes, offset, value);
  write16(bytes, offset + 2, value >>> 16);
}
