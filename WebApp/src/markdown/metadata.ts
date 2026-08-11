import type { NoteMetadata } from '../types';

const fieldPattern = /^([A-Za-z0-9_-]+):(.*)$/;

export function canonicalTag(value: string): string {
  return value.trim().normalize('NFKC').toLocaleLowerCase('und');
}

export function parseMetadata(source: string): NoteMetadata {
  const lines = source.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') {
    return { tags: [] };
  }
  const closing = lines.slice(1).findIndex(line => ['---', '...'].includes(line.trim()));
  if (closing < 0) {
    return { tags: [] };
  }

  let category: string | undefined;
  const tags: string[] = [];
  for (let index = 1; index <= closing; index += 1) {
    const match = lines[index]?.match(fieldPattern);
    if (!match) {
      continue;
    }
    const [, key, rawValue] = match;
    if (key === 'category') {
      category = decodeScalar(rawValue);
    } else if (key === 'tags') {
      const value = rawValue.trim();
      if (value.startsWith('[')) {
        tags.push(...parseInlineList(value));
      } else {
        while (index + 1 <= closing && /^\s+-/.test(lines[index + 1] ?? '')) {
          index += 1;
          const tag = decodeScalar((lines[index] ?? '').replace(/^\s+-/, ''));
          if (tag) {
            tags.push(tag);
          }
        }
      }
    }
  }

  const identities = new Set<string>();
  return {
    category,
    tags: tags.filter(tag => {
      const identity = canonicalTag(tag);
      return identity.length > 0 && !identities.has(identity) && Boolean(identities.add(identity));
    }),
  };
}

export function applyMetadata(source: string, metadata: NoteMetadata): string {
  const lineEnding = source.includes('\r\n') ? '\r\n' : '\n';
  const lines = source.split(/\r?\n/);
  let closing = lines[0]?.trim() === '---'
    ? lines.slice(1).findIndex(line => ['---', '...'].includes(line.trim())) + 1
    : -1;

  if (closing <= 0) {
    if (!metadata.category && metadata.tags.length === 0) {
      return source;
    }
    const header = [
      '---',
      metadata.category ? `category: ${encodeScalar(metadata.category)}` : undefined,
      metadata.tags.length ? `tags: [${metadata.tags.map(encodeScalar).join(', ')}]` : undefined,
      '---',
    ].filter(Boolean);
    return `${header.join(lineEnding)}${lineEnding}${source}`;
  }

  replaceField(lines, 'category', metadata.category
    ? `category: ${encodeScalar(metadata.category)}`
    : undefined, closing);
  closing = lines.slice(1).findIndex(line => ['---', '...'].includes(line.trim())) + 1;
  replaceField(lines, 'tags', metadata.tags.length
    ? `tags: [${uniqueTags(metadata.tags).map(encodeScalar).join(', ')}]`
    : undefined, closing);
  return lines.join(lineEnding);
}

function replaceField(
  lines: string[],
  key: string,
  replacement: string | undefined,
  closing: number,
): void {
  const start = lines.findIndex((line, index) => {
    if (index < 1 || index >= closing || /^\s/.test(line)) {
      return false;
    }
    return line.match(fieldPattern)?.[1] === key;
  });

  if (start < 0) {
    if (replacement) {
      lines.splice(closing, 0, replacement);
    }
    return;
  }

  let end = start + 1;
  while (end < closing && /^\s/.test(lines[end] ?? '')) {
    end += 1;
  }
  const comment = inlineComment(lines[start] ?? '');
  lines.splice(start, end - start, ...(replacement ? [`${replacement}${comment}`] : []));
}

function inlineComment(line: string): string {
  let quote = '';
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if ((character === '"' || character === "'") && line[index - 1] !== '\\') {
      quote = quote === character ? '' : (quote || character);
    } else if (character === '#' && !quote && /\s/.test(line[index - 1] ?? '')) {
      return ` ${line.slice(index).trim()}`;
    }
  }
  return '';
}

function parseInlineList(value: string): string[] {
  const closing = value.lastIndexOf(']');
  if (!value.startsWith('[') || closing < 0) {
    return [];
  }
  const values: string[] = [];
  let quote = '';
  let buffer = '';
  for (const character of value.slice(1, closing)) {
    if ((character === '"' || character === "'") && !quote) {
      quote = character;
      buffer += character;
    } else if (character === quote) {
      quote = '';
      buffer += character;
    } else if (character === ',' && !quote) {
      const decoded = decodeScalar(buffer);
      if (decoded) {
        values.push(decoded);
      }
      buffer = '';
    } else {
      buffer += character;
    }
  }
  const decoded = decodeScalar(buffer);
  if (decoded) {
    values.push(decoded);
  }
  return values;
}

function decodeScalar(rawValue: string): string | undefined {
  let value = rawValue.trim().replace(/\s+#.*$/, '').trim();
  if (!value || value === 'null' || value === '~') {
    return undefined;
  }
  if (
    value.length >= 2
    && ((value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1);
  }
  return value.trim() || undefined;
}

function encodeScalar(value: string): string {
  const needsQuotes = !value || /[\s:#\[\]{},&*!|>'"%@`]/.test(value);
  return needsQuotes ? `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"` : value;
}

function uniqueTags(tags: string[]): string[] {
  const identities = new Set<string>();
  return tags.map(tag => tag.trim()).filter(tag => {
    const identity = canonicalTag(tag);
    return Boolean(identity) && !identities.has(identity) && Boolean(identities.add(identity));
  });
}
