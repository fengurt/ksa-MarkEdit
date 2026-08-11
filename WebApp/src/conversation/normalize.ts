import type { ConversationMessageV1 } from './types';

export function normalizeConversationText(value: string): string {
  const fenced = value.split(/(```[\s\S]*?```)/gu);
  return fenced.map((part, index) => {
    const normalized = part.replaceAll('\r\n', '\n').replaceAll('\r', '\n').normalize('NFKC');
    if (index % 2 === 1) {
      return normalized;
    }
    return normalized
      .replaceAll(/[\t ]+$/gmu, '')
      .replaceAll(/\n{3,}/gu, '\n\n')
      .trim();
  }).join('').trim();
}

export async function sha256(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes.slice().buffer));
  return [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function messageDigest(input: {
  role: ConversationMessageV1['role'];
  content: string;
  attachmentDigests?: string[];
}): Promise<string> {
  return sha256(JSON.stringify({
    role: input.role,
    content: normalizeConversationText(input.content),
    attachments: [...input.attachmentDigests ?? []].sort(),
  }));
}

export async function conversationDigest(messages: ConversationMessageV1[]): Promise<string> {
  return sha256(JSON.stringify(messages.map(message => ({
    parent: message.parentMessageId ?? '',
    digest: message.digest,
  }))));
}

export function conversationSimhash(messages: ConversationMessageV1[]): string {
  const normalized = normalizeConversationText(messages.map(message => message.content).join('\n'));
  const grams = characterGrams(normalized.toLocaleLowerCase('und'), 3);
  const weights = Array.from({ length: 128 }, () => 0);
  for (const gram of grams) {
    const pair = hash128(gram);
    for (let index = 0; index < 128; index += 1) {
      const half = index < 64 ? pair[0] : pair[1];
      const bit = BigInt(index % 64);
      weights[index] += (half & (1n << bit)) === 0n ? -1 : 1;
    }
  }
  let high = 0n;
  let low = 0n;
  for (let index = 0; index < 128; index += 1) {
    if (weights[index] <= 0) continue;
    if (index < 64) low |= 1n << BigInt(index);
    else high |= 1n << BigInt(index - 64);
  }
  return `${high.toString(16).padStart(16, '0')}${low.toString(16).padStart(16, '0')}`;
}

export function simhashDistance(left: string, right: string): number {
  if (!/^[0-9a-f]{32}$/iu.test(left) || !/^[0-9a-f]{32}$/iu.test(right)) return 128;
  let value = BigInt(`0x${left}`) ^ BigInt(`0x${right}`);
  let count = 0;
  while (value) {
    value &= value - 1n;
    count += 1;
  }
  return count;
}

function characterGrams(value: string, width: number): string[] {
  const characters = [...value].filter(character => !/\s/u.test(character));
  if (characters.length <= width) return characters.length ? [characters.join('')] : [''];
  return Array.from({ length: characters.length - width + 1 }, (_, index) => (
    characters.slice(index, index + width).join('')
  ));
}

function hash128(value: string): [bigint, bigint] {
  let first = 0xcbf29ce484222325n;
  let second = 0x84222325cbf29ce4n;
  for (const byte of new TextEncoder().encode(value)) {
    first = BigInt.asUintN(64, (first ^ BigInt(byte)) * 0x100000001b3n);
    second = BigInt.asUintN(64, (second ^ BigInt(byte + 31)) * 0x100000001b3n);
  }
  return [first, second];
}
