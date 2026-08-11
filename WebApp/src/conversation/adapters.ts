import {
  conversationDigest,
  conversationSimhash,
  messageDigest,
  normalizeConversationText,
  sha256,
} from './normalize';
import type {
  ConversationAttachmentV1,
  ConversationDocumentV1,
  ConversationImportSource,
  ConversationMessageV1,
} from './types';
import { extractZipTextEntries } from './zip';

export async function parseConversationSource(
  source: ConversationImportSource,
  now = Date.now(),
): Promise<ConversationDocumentV1[]> {
  const bytes = await source.read();
  const extension = source.name.split('.').at(-1)?.toLocaleLowerCase('en-US') ?? '';
  if (extension === 'zip' || source.mimeType === 'application/zip') {
    const digest = await sha256(bytes);
    const original: ConversationAttachmentV1 = {
      id: digest,
      name: source.name,
      mimeType: 'application/zip',
      byteSize: bytes.length,
      digest,
      bytes,
    };
    const entries = await extractZipTextEntries(bytes);
    if (!entries.length) throw new Error('ZIP does not contain a supported conversation export');
    const conversations: ConversationDocumentV1[] = [];
    for (const entry of entries) {
      conversations.push(...await parseConversationSource({
        kind: 'file',
        name: entry.path,
        mimeType: mimeType(entry.path),
        read: async () => entry.bytes,
      }, now));
    }
    return conversations.map(conversation => ({
      ...conversation,
      attachments: [...conversation.attachments, original],
    }));
  }
  if (bytes.length > 250 * 1024 * 1024) {
    throw new Error('Conversation source exceeds the 250 MB text-entry limit');
  }
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (extension === 'json' || source.mimeType?.includes('json')) {
    const conversations = await parseJSON(text, source.name, now);
    const digest = await sha256(bytes);
    const original: ConversationAttachmentV1 = {
      id: digest,
      name: source.name,
      mimeType: source.mimeType || 'application/json',
      byteSize: bytes.length,
      digest,
      bytes,
    };
    return conversations.map(conversation => ({
      ...conversation,
      attachments: [...conversation.attachments, original],
    }));
  }
  const normalized = extension === 'html' || extension === 'htm' || source.mimeType?.includes('html')
    ? htmlToText(text)
    : extension === 'rtf' || source.mimeType?.includes('rtf')
      ? rtfToText(text)
      : text;
  return [await genericConversation(normalized, source.name, now, source.kind === 'clipboard')];
}

function mimeType(path: string): string {
  const extension = path.split('.').at(-1)?.toLocaleLowerCase('en-US');
  if (extension === 'json') return 'application/json';
  if (extension === 'html' || extension === 'htm') return 'text/html';
  if (extension === 'rtf') return 'application/rtf';
  return 'text/markdown';
}

async function parseJSON(text: string, sourceName: string, now: number): Promise<ConversationDocumentV1[]> {
  const value = JSON.parse(text) as unknown;
  const values = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.conversations)
      ? value.conversations
      : [value];
  if (values.some(isClaudeConversation)) {
    return Promise.all(values.filter(isClaudeConversation).map(item => claudeConversation(item, sourceName, now)));
  }
  if (values.some(isChatGPTConversation)) {
    return Promise.all(values.filter(isChatGPTConversation).map(item => chatGPTConversation(item, sourceName, now)));
  }
  return [await genericConversation(JSON.stringify(value, null, 2), sourceName, now, false)];
}

function isClaudeConversation(value: unknown): value is Record<string, unknown> {
  return isRecord(value)
    && (typeof value.uuid === 'string' || typeof value.id === 'string')
    && (Array.isArray(value.chat_messages) || Array.isArray(value.messages));
}

function isChatGPTConversation(value: unknown): value is Record<string, unknown> {
  return isRecord(value)
    && typeof value.title === 'string'
    && isRecord(value.mapping);
}

async function claudeConversation(
  value: Record<string, unknown>,
  sourceName: string,
  now: number,
): Promise<ConversationDocumentV1> {
  const rawMessages = array(value.chat_messages ?? value.messages);
  const messages: ConversationMessageV1[] = [];
  for (const [index, raw] of rawMessages.entries()) {
    if (!isRecord(raw)) continue;
    const content = claudeContent(raw);
    if (!content.trim()) continue;
    messages.push(await buildMessage({
      sourceMessageId: string(raw.uuid ?? raw.id),
      parentMessageId: string(raw.parent_message_uuid ?? raw.parent_id),
      role: role(raw.sender ?? raw.role),
      createdAt: timestamp(raw.created_at ?? raw.createdAt),
      content,
      fallbackId: `claude-${index}`,
    }));
  }
  return finalize({
    provider: 'claude',
    sourceConversationId: string(value.uuid ?? value.id),
    title: string(value.name ?? value.title) || titleFromSource(sourceName),
    createdAt: timestamp(value.created_at ?? value.createdAt),
    updatedAt: timestamp(value.updated_at ?? value.updatedAt),
    importedAt: now,
    messages,
    confidence: 'high',
    warnings: [],
  });
}

async function chatGPTConversation(
  value: Record<string, unknown>,
  sourceName: string,
  now: number,
): Promise<ConversationDocumentV1> {
  const mapping = record(value.mapping);
  const messages: ConversationMessageV1[] = [];
  const nodeMessageIDs = new Map(Object.entries(mapping).flatMap(([nodeId, node]) => (
    isRecord(node) && isRecord(node.message) && typeof node.message.id === 'string'
      ? [[nodeId, node.message.id] as const]
      : []
  )));
  const nodes = Object.entries(mapping).sort(([, left], [, right]) => {
    const leftMessage = isRecord(left) && isRecord(left.message) ? left.message : {};
    const rightMessage = isRecord(right) && isRecord(right.message) ? right.message : {};
    return (timestamp(leftMessage.create_time) ?? 0) - (timestamp(rightMessage.create_time) ?? 0);
  });
  for (const [nodeId, rawNode] of nodes) {
    if (!isRecord(rawNode) || !isRecord(rawNode.message)) continue;
    const raw = rawNode.message;
    const content = chatGPTContent(raw.content);
    if (!content.trim()) continue;
    messages.push(await buildMessage({
      sourceMessageId: string(raw.id) || nodeId,
      parentMessageId: nodeMessageIDs.get(string(rawNode.parent)) ?? string(rawNode.parent),
      role: role(isRecord(raw.author) ? raw.author.role : undefined),
      createdAt: timestamp(raw.create_time),
      content,
      fallbackId: nodeId,
    }));
  }
  return finalize({
    provider: 'chatgpt',
    sourceConversationId: string(value.id ?? value.conversation_id),
    title: string(value.title) || titleFromSource(sourceName),
    createdAt: timestamp(value.create_time),
    updatedAt: timestamp(value.update_time),
    importedAt: now,
    messages,
    confidence: 'high',
    warnings: [],
  });
}

async function genericConversation(
  text: string,
  sourceName: string,
  now: number,
  clipboard: boolean,
): Promise<ConversationDocumentV1> {
  const blocks = splitRoleBlocks(text);
  const messages: ConversationMessageV1[] = [];
  for (const [index, block] of blocks.entries()) {
    messages.push(await buildMessage({
      role: block.role,
      content: block.content,
      fallbackId: `generic-${index}`,
    }));
  }
  const turns = new Set(messages.filter(message => message.role !== 'unknown').map(message => message.role));
  const highConfidence = messages.length >= 2
    && turns.has('user')
    && turns.has('assistant')
    && normalizeConversationText(text).length >= 200;
  return finalize({
    provider: 'generic',
    title: titleFromSource(sourceName),
    importedAt: now,
    messages,
    confidence: highConfidence ? 'high' : clipboard ? 'low' : 'medium',
    warnings: highConfidence ? [] : ['Conversation roles could not be identified with high confidence'],
  });
}

async function buildMessage(input: {
  sourceMessageId?: string;
  parentMessageId?: string;
  role: ConversationMessageV1['role'];
  createdAt?: number;
  content: string;
  fallbackId: string;
}): Promise<ConversationMessageV1> {
  const content = normalizeConversationText(input.content);
  const digest = await messageDigest({ role: input.role, content });
  return {
    id: input.sourceMessageId || `${input.fallbackId}-${digest.slice(0, 12)}`,
    sourceMessageId: input.sourceMessageId || undefined,
    parentMessageId: input.parentMessageId || undefined,
    role: input.role,
    createdAt: input.createdAt,
    content,
    digest,
    attachments: [],
  };
}

async function finalize(input: Omit<ConversationDocumentV1, 'version' | 'id' | 'contentDigest' | 'simhash' | 'attachments'>): Promise<ConversationDocumentV1> {
  const contentDigest = await conversationDigest(input.messages);
  const stableSource = input.sourceConversationId
    ? `${input.provider}:${input.sourceConversationId}`
    : `${input.provider}:${contentDigest}`;
  return {
    version: 1,
    id: await sha256(stableSource),
    ...input,
    attachments: input.messages.flatMap(message => message.attachments),
    contentDigest,
    simhash: conversationSimhash(input.messages),
  };
}

function splitRoleBlocks(text: string): Array<{ role: ConversationMessageV1['role']; content: string }> {
  const normalized = text.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
  const marker = /^(?:#{1,4}\s*)?(User|Human|You|Assistant|Claude|ChatGPT|System|Tool)\s*(?:(?:·|said)[^\n:]*)?:\s*|^(?:#{1,4}\s+)(User|Human|You|Assistant|Claude|ChatGPT|System|Tool)(?:\s*(?:·|said)[^\n]*)?\s*$/gimu;
  const matches = [...normalized.matchAll(marker)];
  if (!matches.length) return [{ role: 'unknown', content: normalized.trim() }];
  const blocks: Array<{ role: ConversationMessageV1['role']; content: string }> = [];
  for (const [index, match] of matches.entries()) {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? normalized.length;
    const content = normalized.slice(start, end).trim();
    if (content) blocks.push({ role: role(match[1] ?? match[2]), content });
  }
  return blocks.length ? blocks : [{ role: 'unknown', content: normalized.trim() }];
}

function claudeContent(raw: Record<string, unknown>): string {
  if (typeof raw.text === 'string') return raw.text;
  return array(raw.content).map(part => {
    if (typeof part === 'string') return part;
    if (isRecord(part)) return string(part.text ?? part.content);
    return '';
  }).filter(Boolean).join('\n\n');
}

function chatGPTContent(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!isRecord(value)) return '';
  return array(value.parts).map(part => {
    if (typeof part === 'string') return part;
    if (isRecord(part)) return string(part.text ?? part.content);
    return '';
  }).filter(Boolean).join('\n\n');
}

function htmlToText(html: string): string {
  if (typeof DOMParser === 'undefined') {
    return html
      .replaceAll(/<script[\s\S]*?<\/script>/giu, '')
      .replaceAll(/<style[\s\S]*?<\/style>/giu, '')
      .replaceAll(/<\/(?:div|p|article|section|h[1-6]|li)>/giu, '\n')
      .replaceAll(/<br\s*\/?>/giu, '\n')
      .replaceAll(/<[^>]+>/gu, ' ');
  }
  const document = new DOMParser().parseFromString(html, 'text/html');
  for (const blocked of document.querySelectorAll('script, style, iframe, object, embed, form')) blocked.remove();
  for (const block of document.querySelectorAll('p, div, article, section, li, h1, h2, h3, h4, h5, h6, br')) {
    block.append('\n');
  }
  return document.body.textContent ?? '';
}

function rtfToText(value: string): string {
  type RTFState = { ignorable: boolean; unicodeFallbackLength: number };
  const destinations = new Set([
    'colortbl', 'datastore', 'filetbl', 'fonttbl', 'footer', 'footerf', 'footerl',
    'footerr', 'header', 'headerf', 'headerl', 'headerr', 'info', 'listtable',
    'listoverridetable', 'object', 'pict', 'revtbl', 'stylesheet', 'themedata',
  ]);
  const states: RTFState[] = [];
  let state: RTFState = { ignorable: false, unicodeFallbackLength: 1 };
  let output = '';
  let index = 0;

  while (index < value.length) {
    const character = value[index];
    if (character === '{') {
      states.push({ ...state });
      index += 1;
      continue;
    }
    if (character === '}') {
      state = states.pop() ?? state;
      index += 1;
      continue;
    }
    if (character !== '\\') {
      if (!state.ignorable && character !== '\r' && character !== '\n') output += character;
      index += 1;
      continue;
    }

    const symbol = value[index + 1];
    if (symbol === '\\' || symbol === '{' || symbol === '}') {
      if (!state.ignorable) output += symbol;
      index += 2;
      continue;
    }
    if (symbol === '*') {
      state.ignorable = true;
      index += 2;
      continue;
    }
    if (symbol === "'" && /^[0-9a-f]{2}$/iu.test(value.slice(index + 2, index + 4))) {
      if (!state.ignorable) output += decodeRTFByte(Number.parseInt(value.slice(index + 2, index + 4), 16));
      index += 4;
      continue;
    }
    if (symbol === '~') {
      if (!state.ignorable) output += '\u00a0';
      index += 2;
      continue;
    }
    if (symbol === '_') {
      if (!state.ignorable) output += '\u2011';
      index += 2;
      continue;
    }
    if (symbol === '-') {
      index += 2;
      continue;
    }

    const control = /^\\([a-z]+)(-?\d+)? ?/iu.exec(value.slice(index));
    if (!control) {
      index += 2;
      continue;
    }
    const word = control[1].toLocaleLowerCase('en-US');
    const parameter = control[2] === undefined ? undefined : Number.parseInt(control[2], 10);
    index += control[0].length;
    if (destinations.has(word)) {
      state.ignorable = true;
    } else if (word === 'uc' && parameter !== undefined) {
      state.unicodeFallbackLength = Math.max(0, parameter);
    } else if (word === 'u' && parameter !== undefined) {
      if (!state.ignorable) output += String.fromCharCode(parameter < 0 ? parameter + 65_536 : parameter);
      index = skipRTFFallback(value, index, state.unicodeFallbackLength);
    } else if (!state.ignorable && (word === 'par' || word === 'line')) {
      output += '\n';
    } else if (!state.ignorable && word === 'tab') {
      output += '\t';
    }
  }
  return output;
}

function decodeRTFByte(byte: number): string {
  return new TextDecoder('windows-1252').decode(Uint8Array.of(byte));
}

function skipRTFFallback(value: string, start: number, count: number): number {
  let index = start;
  for (let skipped = 0; skipped < count && index < value.length; skipped += 1) {
    if (value[index] === '\\' && value[index + 1] === "'") {
      index += 4;
    } else if (value[index] === '\\' && ['\\', '{', '}'].includes(value[index + 1] ?? '')) {
      index += 2;
    } else {
      index += 1;
    }
  }
  return index;
}

function role(value: unknown): ConversationMessageV1['role'] {
  const normalized = string(value).toLocaleLowerCase('en-US');
  if (['human', 'user', 'you'].includes(normalized)) return 'user';
  if (['assistant', 'claude', 'chatgpt'].includes(normalized)) return 'assistant';
  if (normalized === 'system') return 'system';
  if (normalized === 'tool') return 'tool';
  return 'unknown';
}

function timestamp(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value < 10_000_000_000 ? value * 1_000 : value;
  if (typeof value !== 'string' || !value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function titleFromSource(name: string): string {
  return name.replace(/\.(?:md|markdown|txt|text|html?|rtf|json)$/iu, '').trim() || 'Imported conversation';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function string(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function conversationPath(conversation: ConversationDocumentV1, suffix = ''): string {
  const date = new Date(conversation.createdAt ?? conversation.importedAt);
  const year = String(date.getUTCFullYear()).padStart(4, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const slug = conversation.title
    .normalize('NFKC')
    .replaceAll(/[\\/:*?"<>|]/gu, '-')
    .replaceAll(/\p{Cc}/gu, '-')
    .replaceAll(/\s+/gu, ' ')
    .trim()
    .slice(0, 80) || 'Conversation';
  return `Conversations/${year}/${month}/${slug}--${conversation.id.slice(0, 12)}${suffix}.md`;
}
