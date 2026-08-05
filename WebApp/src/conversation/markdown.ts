import type { ConversationDocumentV1, ConversationMessageV1 } from './types';

const markerPattern = /<!-- ksamint-message-v1 ([A-Za-z0-9_-]+) -->/gu;

export function renderConversationMarkdown(
  conversation: ConversationDocumentV1,
  options: { title?: string; category?: string; tags?: string[] } = {},
): string {
  const provider = providerName(conversation.provider);
  const category = options.category ?? `Conversations/${provider}`;
  const tags = options.tags ?? ['conversation', conversation.provider];
  const title = options.title?.trim() || conversation.title;
  const frontMatter = [
    '---',
    'type: Conversation',
    `source: ${yamlString(conversation.provider)}`,
    ...(conversation.sourceConversationId
      ? [`source_conversation_id: ${yamlString(conversation.sourceConversationId)}`]
      : []),
    ...(conversation.createdAt ? [`started_at: ${new Date(conversation.createdAt).toISOString()}`] : []),
    ...(conversation.updatedAt ? [`updated_at: ${new Date(conversation.updatedAt).toISOString()}`] : []),
    `imported_at: ${new Date(conversation.importedAt).toISOString()}`,
    `message_count: ${conversation.messages.length}`,
    `content_digest: ${conversation.contentDigest}`,
    `conversation_simhash: ${conversation.simhash}`,
    `category: ${yamlString(category)}`,
    `tags: [${tags.map(yamlString).join(', ')}]`,
    '---',
    '',
    `# ${title}`,
    '',
  ];
  const sourceAttachments = conversation.attachments.length
    ? `## Source files\n\n${conversation.attachments.map(attachment => (
      `- [${attachment.name}](../../Assets/${attachment.digest}.${safeExtension(attachment.name)})`
    )).join('\n')}\n\n`
    : '';
  const branches = renderAlternateBranches(conversation);
  return `${frontMatter.join('\n')}${conversation.messages.map(renderMessage).join('')}${branches}${sourceAttachments}\n`;
}

function renderAlternateBranches(conversation: ConversationDocumentV1): string {
  if (conversation.provider !== 'chatgpt') return '';
  const children = new Map<string, string[]>();
  for (const message of conversation.messages) {
    if (!message.parentMessageId) continue;
    const values = children.get(message.parentMessageId) ?? [];
    values.push(message.sourceMessageId ?? message.id);
    children.set(message.parentMessageId, values);
  }
  const branches = [...children.entries()].filter(([, values]) => values.length > 1);
  if (!branches.length) return '';
  return `## Alternate branches\n\n${branches.map(([parent, values]) => (
    `- Parent \`${parent}\`: ${values.map(value => `\`${value}\``).join(', ')}`
  )).join('\n')}\n\n`;
}

export function renderMessage(message: ConversationMessageV1): string {
  const payload = encodeMarker({
    id: message.sourceMessageId ?? message.id,
    parent: message.parentMessageId,
    digest: message.digest,
    createdAt: message.createdAt,
    role: message.role,
  });
  const timestamp = message.createdAt ? ` · ${new Date(message.createdAt).toISOString()}` : '';
  const attachments = message.attachments.map(attachment => (
    `\n[${attachment.name}](../../Assets/${attachment.digest}.${safeExtension(attachment.name)})`
  )).join('');
  return `<!-- ksamint-message-v1 ${payload} -->\n## ${roleName(message.role)}${timestamp}\n\n${message.content.trim()}${attachments}\n\n`;
}

export function parseConversationMarkdown(content: string): {
  provider?: string;
  sourceConversationId?: string;
  contentDigest?: string;
  simhash?: string;
  messages: Array<{ id: string; digest: string; role?: string }>;
} {
  const frontMatter = content.match(/^---\n([\s\S]*?)\n---(?:\n|$)/u)?.[1] ?? '';
  const fields = new Map<string, string>();
  for (const line of frontMatter.split('\n')) {
    const match = line.match(/^([a-z_]+):\s*(.*)$/u);
    if (match) fields.set(match[1], unquote(match[2]));
  }
  const messages = [...content.matchAll(markerPattern)].flatMap(match => {
    try {
      const marker = decodeMarker(match[1]);
      return typeof marker.id === 'string' && typeof marker.digest === 'string'
        ? [{ id: marker.id, digest: marker.digest, role: typeof marker.role === 'string' ? marker.role : undefined }]
        : [];
    } catch {
      return [];
    }
  });
  return {
    provider: fields.get('source'),
    sourceConversationId: fields.get('source_conversation_id'),
    contentDigest: fields.get('content_digest'),
    simhash: fields.get('conversation_simhash'),
    messages,
  };
}

export function appendMessages(
  content: string,
  messages: ConversationMessageV1[],
  conversation?: ConversationDocumentV1,
): string {
  if (!messages.length) return content;
  let updated = content;
  if (conversation) {
    updated = replaceFrontMatterValue(updated, 'message_count', String(conversation.messages.length));
    updated = replaceFrontMatterValue(updated, 'content_digest', conversation.contentDigest);
    updated = replaceFrontMatterValue(updated, 'conversation_simhash', conversation.simhash);
    updated = replaceFrontMatterValue(updated, 'imported_at', new Date(conversation.importedAt).toISOString());
    if (conversation.updatedAt) {
      updated = replaceFrontMatterValue(updated, 'updated_at', new Date(conversation.updatedAt).toISOString());
    }
  }
  return `${updated.trimEnd()}\n\n${messages.map(renderMessage).join('')}`;
}

export function applyConversationMetadata(
  content: string,
  options: { title?: string; category?: string; tags?: string[] },
): string {
  let updated = content;
  if (options.title?.trim()) {
    const frontMatterEnd = updated.startsWith('---\n') ? updated.indexOf('\n---', 4) : -1;
    const bodyStart = frontMatterEnd < 0 ? 0 : frontMatterEnd + 4;
    const body = updated.slice(bodyStart).replace(/^# .*$/mu, `# ${options.title.trim()}`);
    updated = `${updated.slice(0, bodyStart)}${body}`;
  }
  if (options.category?.trim()) {
    updated = replaceFrontMatterValue(updated, 'category', yamlString(options.category.trim()));
  }
  if (options.tags) {
    const tags = options.tags.map(tag => tag.trim()).filter(Boolean);
    updated = replaceFrontMatterValue(updated, 'tags', `[${tags.map(yamlString).join(', ')}]`);
  }
  return updated;
}

function providerName(provider: ConversationDocumentV1['provider']): string {
  if (provider === 'chatgpt') return 'ChatGPT';
  if (provider === 'claude') return 'Claude';
  return 'Imported';
}

function roleName(role: ConversationMessageV1['role']): string {
  return ({
    user: 'User',
    assistant: 'Assistant',
    system: 'System',
    tool: 'Tool',
    unknown: 'Message',
  })[role];
}

function yamlString(value: string): string {
  return JSON.stringify(value.normalize('NFC'));
}

function encodeMarker(value: object): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function decodeMarker(value: string): Record<string, unknown> {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, character => character.charCodeAt(0)))) as Record<string, unknown>;
}

function unquote(value: string): string {
  try {
    return JSON.parse(value) as string;
  } catch {
    return value.trim();
  }
}

function safeExtension(name: string): string {
  const extension = name.split('.').at(-1)?.toLocaleLowerCase('en-US') ?? 'bin';
  return /^[a-z0-9]{1,10}$/u.test(extension) ? extension : 'bin';
}

function replaceFrontMatterValue(content: string, key: string, value: string): string {
  const frontMatterEnd = content.indexOf('\n---', 4);
  if (!content.startsWith('---\n') || frontMatterEnd < 0) return content;
  const frontMatter = content.slice(0, frontMatterEnd);
  const pattern = new RegExp(`^${key}:.*$`, 'mu');
  if (pattern.test(frontMatter)) {
    return `${frontMatter.replace(pattern, `${key}: ${value}`)}${content.slice(frontMatterEnd)}`;
  }
  return `${frontMatter}\n${key}: ${value}${content.slice(frontMatterEnd)}`;
}
