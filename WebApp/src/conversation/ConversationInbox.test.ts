import { describe, expect, it } from 'vitest';
import { ConversationInbox } from './ConversationInbox';
import { parseConversationMarkdown } from './markdown';
import type {
  ConversationImportSource,
  ConversationStoredDocument,
  ConversationWorkspacePort,
  ConversationUndoTransactionV1,
} from './types';

class MemoryWorkspace implements ConversationWorkspacePort {
  files: ConversationStoredDocument[] = [];
  undo = new Map<string, ConversationUndoTransactionV1>();

  async listConversationDocuments() {
    return structuredClone(this.files);
  }

  async writeConversation(input: { id?: string; path: string; content: string; modifiedAt: number }) {
    const file = { ...input, id: input.id ?? crypto.randomUUID() };
    const index = this.files.findIndex(candidate => candidate.id === file.id);
    if (index >= 0) this.files[index] = file;
    else this.files.push(file);
    return structuredClone(file);
  }

  async removeConversation(id: string) {
    this.files = this.files.filter(file => file.id !== id);
  }

  async saveUndoTransaction(transaction: ConversationUndoTransactionV1) {
    this.undo.set(transaction.id, structuredClone(transaction));
  }

  async loadUndoTransaction(id: string) {
    return structuredClone(this.undo.get(id));
  }

  async removeUndoTransaction(id: string) {
    this.undo.delete(id);
  }
}

function source(name: string, value: unknown, kind: ConversationImportSource['kind'] = 'file'): ConversationImportSource {
  const bytes = new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value));
  return {
    kind,
    name,
    mimeType: name.endsWith('.json') ? 'application/json' : 'text/markdown',
    read: async () => bytes,
  };
}

const claude = (messages: Array<{ uuid: string; sender: string; text: string }>) => ({
  uuid: 'claude-conversation-1',
  name: '多语言研究 Café',
  created_at: '2026-08-01T01:02:03Z',
  updated_at: '2026-08-01T01:05:03Z',
  chat_messages: messages,
});

describe('ConversationInbox interface', () => {
  it('plans and applies one Markdown file per Claude conversation', async () => {
    const workspace = new MemoryWorkspace();
    const inbox = new ConversationInbox(workspace, () => Date.parse('2026-08-05T00:00:00Z'));
    const plan = await inbox.plan([source('conversations.json', [claude([
      { uuid: 'm1', sender: 'human', text: '请解释 NFKC。' },
      { uuid: 'm2', sender: 'assistant', text: 'NFKC 是 Unicode 兼容性规范化。' },
    ])])]);

    expect(plan.failures).toEqual([]);
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]).toMatchObject({ action: 'create', newMessageCount: 2 });
    expect(plan.items[0].proposedPath).toMatch(/^Conversations\/2026\/08\/多语言研究 Café--/u);

    const report = await inbox.apply(plan);
    expect(report).toMatchObject({ created: 1, updated: 0, skipped: 0 });
    expect(workspace.files[0].content).toContain('source: "claude"');
    expect(workspace.files[0].content).toContain('## User');
    expect(parseConversationMarkdown(workspace.files[0].content).messages).toHaveLength(2);
  });

  it('skips exact reimports and appends only new source messages', async () => {
    const workspace = new MemoryWorkspace();
    const inbox = new ConversationInbox(workspace, () => Date.parse('2026-08-05T00:00:00Z'));
    const initial = await inbox.plan([source('conversations.json', [claude([
      { uuid: 'm1', sender: 'human', text: 'Question' },
      { uuid: 'm2', sender: 'assistant', text: 'Answer' },
    ])])]);
    await inbox.apply(initial);

    const duplicate = await inbox.plan([source('conversations.json', [claude([
      { uuid: 'm1', sender: 'human', text: 'Question' },
      { uuid: 'm2', sender: 'assistant', text: 'Answer' },
    ])])]);
    expect(duplicate.items[0].action).toBe('skip');

    const update = await inbox.plan([source('conversations.json', [claude([
      { uuid: 'm1', sender: 'human', text: 'Question' },
      { uuid: 'm2', sender: 'assistant', text: 'Answer' },
      { uuid: 'm3', sender: 'human', text: 'Follow-up' },
    ])])]);
    expect(update.items[0]).toMatchObject({ action: 'update', newMessageCount: 1 });
    await inbox.apply(update);
    expect(parseConversationMarkdown(workspace.files[0].content).messages).toHaveLength(3);
  });

  it('requires review when a provider message changes instead of overwriting it', async () => {
    const workspace = new MemoryWorkspace();
    const inbox = new ConversationInbox(workspace);
    await inbox.apply(await inbox.plan([source('claude.json', [claude([
      { uuid: 'm1', sender: 'human', text: 'Original' },
    ])])]));
    const changed = await inbox.plan([source('claude.json', [claude([
      { uuid: 'm1', sender: 'human', text: 'Changed' },
    ])])]);
    expect(changed.items[0]).toMatchObject({ action: 'review' });
    const report = await inbox.apply(changed);
    expect(report.reviewRequired).toBe(1);
    expect(workspace.files[0].content).toContain('Original');
  });

  it('preserves ChatGPT branch parent identities', async () => {
    const workspace = new MemoryWorkspace();
    const inbox = new ConversationInbox(workspace);
    const chatGPT = {
      id: 'gpt-1',
      title: 'Branches',
      mapping: {
        root: { parent: null, message: null },
        user: {
          parent: 'root',
          message: { id: 'u1', create_time: 1, author: { role: 'user' }, content: { parts: ['Hello'] } },
        },
        answer: {
          parent: 'user',
          message: { id: 'a1', create_time: 2, author: { role: 'assistant' }, content: { parts: ['Hi'] } },
        },
      },
    };
    const plan = await inbox.plan([source('conversations.json', [chatGPT])]);
    expect(plan.items[0].conversation.provider).toBe('chatgpt');
    expect(plan.items[0].conversation.messages[1]).toMatchObject({ parentMessageId: 'u1' });
  });

  it('keeps ChatGPT alternate branches visible in Markdown', async () => {
    const workspace = new MemoryWorkspace();
    const inbox = new ConversationInbox(workspace);
    const plan = await inbox.plan([source('conversations.json', [{
      id: 'branched',
      title: 'Alternates',
      mapping: {
        root: { parent: null, message: { id: 'u1', author: { role: 'user' }, content: { parts: ['Question'] } } },
        first: { parent: 'root', message: { id: 'a1', author: { role: 'assistant' }, content: { parts: ['First'] } } },
        second: { parent: 'root', message: { id: 'a2', author: { role: 'assistant' }, content: { parts: ['Second'] } } },
      },
    }])]);
    await inbox.apply(plan);
    expect(workspace.files[0].content).toContain('## Alternate branches');
    expect(workspace.files[0].content).toContain('`a1`, `a2`');
  });

  it('marks long copied transcripts as high confidence and can undo an import', async () => {
    const workspace = new MemoryWorkspace();
    const inbox = new ConversationInbox(workspace);
    const transcript = `## Human\n\n${'问题'.repeat(60)}\n\n## Assistant\n\n${'回答'.repeat(60)}`;
    const plan = await inbox.plan([source('Clipboard.md', transcript, 'clipboard')]);
    expect(plan.items[0].conversation.confidence).toBe('high');
    const report = await inbox.apply(plan);
    expect(workspace.files).toHaveLength(1);
    await inbox.undo(report.transactionId);
    expect(workspace.files).toEqual([]);
  });

  it('decodes signed RTF Unicode and Windows-1252 escapes without losing CJK text', async () => {
    const workspace = new MemoryWorkspace();
    const inbox = new ConversationInbox(workspace);
    const rtf = String.raw`{\rtf1\ansi\uc1 User: \u-29705?\u-30237?\u-28214?\par Assistant: \u26085?\u26412?\u-30050? Caf\'e9}`;
    const plan = await inbox.plan([source('multilingual.rtf', rtf)]);

    expect(plan.failures).toEqual([]);
    expect(plan.items[0].conversation.messages.map(message => message.content)).toEqual([
      '请解释',
      '日本語 Café',
    ]);
  });

  it('persists undo transactions across inbox instances', async () => {
    const workspace = new MemoryWorkspace();
    const first = new ConversationInbox(workspace);
    const report = await first.apply(await first.plan([source('chat.md', 'User: hello\n\nAssistant: hi')]));
    expect(workspace.files).toHaveLength(1);
    const reopened = new ConversationInbox(workspace);
    await reopened.undo(report.transactionId);
    expect(workspace.files).toEqual([]);
    expect(workspace.undo.size).toBe(0);
  });
});
