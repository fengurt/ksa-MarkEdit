export function parseZipDirectory(bytes, totalEntries) {
  const entries = [];
  let cursor = 0;
  while (cursor < bytes.length && entries.length < totalEntries) {
    if (cursor + 46 > bytes.length || u32(bytes, cursor) !== 0x02014b50) {
      throw new Error('Invalid ZIP directory entry');
    }
    const flags = u16(bytes, cursor + 8);
    const method = u16(bytes, cursor + 10);
    const nameLength = u16(bytes, cursor + 28);
    const extraLength = u16(bytes, cursor + 30);
    const commentLength = u16(bytes, cursor + 32);
    const end = cursor + 46 + nameLength + extraLength + commentLength;
    if (end > bytes.length) throw new Error('Truncated ZIP directory entry');
    entries.push({
      path: decodeName(bytes.slice(cursor + 46, cursor + 46 + nameLength), Boolean(flags & 0x0800)),
      flags,
      method,
      checksum: u32(bytes, cursor + 16),
      compressedSize: u32(bytes, cursor + 20),
      size: u32(bytes, cursor + 24),
      localOffset: u32(bytes, cursor + 42),
    });
    cursor = end;
  }
  if (entries.length !== totalEntries) throw new Error('ZIP entry count does not match its directory');
  return entries;
}

function decodeName(bytes, utf8) {
  if (utf8) return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  try {
    return new TextDecoder('ibm866', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }
}

function u16(bytes, offset) {
  return bytes[offset] | bytes[offset + 1] << 8;
}

function u32(bytes, offset) {
  return (bytes[offset] | bytes[offset + 1] << 8 | bytes[offset + 2] << 16 | bytes[offset + 3] << 24) >>> 0;
}
