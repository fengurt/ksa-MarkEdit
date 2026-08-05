import { conversationPath, parseConversationSource } from './adapters';
import {
  appendMessages,
  applyConversationMetadata,
  parseConversationMarkdown,
  renderConversationMarkdown,
} from './markdown';
import { simhashDistance } from './normalize';
import type {
  ConversationImportDecision,
  ConversationImportItem,
  ConversationImportPlan,
  ConversationImportReport,
  ConversationImportSource,
  ConversationStoredDocument,
  ConversationUndoTransactionV1,
  ConversationWorkspacePort,
} from './types';

const UNDO_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;

export class ConversationInbox {
  private readonly undoTransactions = new Map<string, ConversationUndoTransactionV1>();

  constructor(
    private readonly workspace: ConversationWorkspacePort,
    private readonly clock: () => number = Date.now,
  ) {}

  async plan(sources: Iterable<ConversationImportSource>): Promise<ConversationImportPlan> {
    const existing = await this.workspace.listConversationDocuments();
    const parsed = existing.map(document => ({ document, metadata: parseConversationMarkdown(document.content) }));
    const items: ConversationImportItem[] = [];
    const failures: ConversationImportPlan['failures'] = [];

    for (const source of sources) {
      try {
        const conversations = await parseConversationSource(source, this.clock());
        for (const conversation of conversations) {
          const exactIdentity = parsed.find(candidate => (
            conversation.sourceConversationId
            && candidate.metadata.provider === conversation.provider
            && candidate.metadata.sourceConversationId === conversation.sourceConversationId
          ));
          const exactContent = parsed.find(candidate => candidate.metadata.contentDigest === conversation.contentDigest);
          const matched = exactIdentity ?? exactContent;
          let action: ConversationImportItem['action'] = 'create';
          let reason = 'New conversation';
          let newMessages = conversation.messages;
          let proposedContent = renderConversationMarkdown(conversation);
          let possibleDuplicate: ConversationStoredDocument | undefined;

          if (matched) {
            const knownById = new Map(matched.metadata.messages.map(message => [message.id, message.digest]));
            const changedIdentity = conversation.messages.some(message => (
              message.sourceMessageId
              && knownById.has(message.sourceMessageId)
              && knownById.get(message.sourceMessageId) !== message.digest
            ));
            newMessages = conversation.messages.filter(message => (
              !knownById.has(message.sourceMessageId ?? message.id)
              && !matched.metadata.messages.some(existingMessage => existingMessage.digest === message.digest)
            ));
            if (changedIdentity) {
              action = 'review';
              reason = 'A source message changed; both versions must be reviewed';
            } else if (!newMessages.length) {
              action = 'skip';
              reason = 'Exact conversation already exists';
              proposedContent = matched.document.content;
            } else {
              action = 'update';
              reason = `${newMessages.length} new message${newMessages.length === 1 ? '' : 's'}`;
              proposedContent = appendMessages(matched.document.content, newMessages, conversation);
            }
          } else if (conversation.messages.map(message => message.content).join('').length >= 200) {
            const near = parsed.find(candidate => (
              candidate.metadata.simhash
              && simhashDistance(candidate.metadata.simhash, conversation.simhash) <= 10
            ));
            if (near) {
              action = 'review';
              reason = 'Possible near-duplicate conversation';
              possibleDuplicate = near.document;
            }
          }

          items.push({
            id: crypto.randomUUID(),
            sourceName: source.name,
            conversation,
            proposedPath: matched?.document.path ?? conversationPath(conversation),
            proposedContent,
            action,
            reason,
            existing: matched?.document,
            possibleDuplicate,
            newMessageCount: newMessages.length,
          });
        }
      } catch (error) {
        failures.push({
          sourceName: source.name,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return { version: 1, id: crypto.randomUUID(), createdAt: this.clock(), items, failures };
  }

  async apply(
    plan: ConversationImportPlan,
    decisions: ConversationImportDecision[] = [],
  ): Promise<ConversationImportReport> {
    const decisionByItem = new Map(decisions.map(decision => [decision.itemId, decision]));
    const transactionId = crypto.randomUUID();
    const createdAt = this.clock();
    const transaction: ConversationUndoTransactionV1 = {
      version: 1,
      id: transactionId,
      createdAt,
      expiresAt: createdAt + UNDO_RETENTION_MS,
      createdIds: [],
      previous: [],
      createdAttachmentPaths: [],
    };
    const files: ConversationStoredDocument[] = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let reviewRequired = 0;

    try {
      for (const item of plan.items) {
        const decision = decisionByItem.get(item.id);
        if (decision?.action === 'skip' || (!decision && item.action === 'skip')) {
          skipped += 1;
          continue;
        }
        if (!decision && item.action === 'review') {
          reviewRequired += 1;
          continue;
        }
        const keepBoth = decision?.action === 'keep-both';
        const path = keepBoth ? conversationPath(item.conversation, `-imported-${this.clock()}`) : item.proposedPath;
        const baseContent = item.action === 'create' || keepBoth
          ? renderConversationMarkdown(item.conversation, decision)
          : item.proposedContent;
        const content = applyConversationMetadata(baseContent, decision ?? {});
        if (item.existing && !keepBoth) transaction.previous.push(item.existing);
        const file = await this.workspace.writeConversation({
          id: item.existing && !keepBoth ? item.existing.id : undefined,
          path,
          content,
          modifiedAt: this.clock(),
        });
        files.push(file);
        if (!item.existing || keepBoth) transaction.createdIds.push(file.id);
        for (const attachment of item.conversation.attachments) {
          if (!this.workspace.writeAttachment || !attachment.bytes) continue;
          const attachmentPath = assetPath(attachment.name, attachment.digest);
          const exists = await this.workspace.attachmentExists?.(attachmentPath) ?? false;
          await this.workspace.writeAttachment(attachment, attachmentPath);
          if (!exists) transaction.createdAttachmentPaths.push(attachmentPath);
        }
        if (item.existing && !keepBoth) updated += 1;
        else {
          created += 1;
        }
      }
      await this.workspace.saveUndoTransaction?.(transaction);
      this.undoTransactions.set(transactionId, transaction);
    } catch (error) {
      await this.rollback(transaction);
      throw error;
    }
    return { transactionId, created, updated, skipped, reviewRequired, files };
  }

  async undo(transactionId: string): Promise<void> {
    const transaction = this.undoTransactions.get(transactionId)
      ?? await this.workspace.loadUndoTransaction?.(transactionId);
    if (!transaction) throw new Error('Import transaction is unavailable or expired');
    await this.rollback(transaction);
    await this.workspace.removeUndoTransaction?.(transactionId);
    this.undoTransactions.delete(transactionId);
  }

  private async rollback(transaction: ConversationUndoTransactionV1): Promise<void> {
    for (const id of transaction.createdIds) await this.workspace.removeConversation(id);
    for (const previous of transaction.previous) {
      await this.workspace.writeConversation(previous);
    }
    if (this.workspace.removeAttachment) {
      for (const path of transaction.createdAttachmentPaths) await this.workspace.removeAttachment(path);
    }
  }
}

function assetPath(name: string, digest: string): string {
  const extension = name.split('.').at(-1)?.toLocaleLowerCase('en-US') ?? 'bin';
  const safeExtension = /^[a-z0-9]{1,10}$/u.test(extension) ? extension : 'bin';
  return `Conversations/Assets/${digest}.${safeExtension}`;
}

export type {
  ConversationImportDecision,
  ConversationImportPlan,
  ConversationImportReport,
  ConversationImportSource,
  ConversationWorkspacePort,
} from './types';
