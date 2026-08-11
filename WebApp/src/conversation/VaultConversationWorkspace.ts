import type { VaultStorage } from '../storage/VaultStorage';
import type {
  ConversationAttachmentV1,
  ConversationUndoTransactionV1,
  ConversationWorkspacePort,
} from './types';

export class VaultConversationWorkspace implements ConversationWorkspacePort {
  constructor(private readonly storage: VaultStorage) {}

  async listConversationDocuments() {
    const files = this.storage.listFiles().filter(file => (
      file.path.startsWith('Conversations/') && file.path.toLocaleLowerCase('en-US').endsWith('.md')
    ));
    return Promise.all(files.map(async file => {
      const note = await this.storage.readFile(file.id);
      return { id: note.id, path: note.path, content: note.content, modifiedAt: note.modifiedAt };
    }));
  }

  async writeConversation(input: { id?: string; path: string; content: string; modifiedAt: number }) {
    if (input.id) {
      const existing = this.storage.listFiles().find(file => file.id === input.id);
      if (!existing) throw new Error('Conversation file no longer exists');
      if (existing.path !== input.path) await this.storage.renameFile(input.id, input.path);
      const note = await this.storage.writeFile(input.id, input.content);
      return { id: note.id, path: note.path, content: note.content, modifiedAt: note.modifiedAt };
    }
    const note = await this.storage.createFile(input.path, input.content);
    return { id: note.id, path: note.path, content: note.content, modifiedAt: note.modifiedAt };
  }

  async removeConversation(id: string) {
    await this.storage.deleteFile(id);
  }

  async writeAttachment(attachment: ConversationAttachmentV1, path: string) {
    if (!attachment.bytes) throw new Error('Attachment bytes are unavailable');
    await this.storage.writeAttachment({
      path,
      bytes: attachment.bytes,
      mimeType: attachment.mimeType,
      contentDigest: attachment.digest,
    });
  }

  async attachmentExists(path: string) {
    return this.storage.listAllFiles().some(file => file.path === path && file.kind === 'attachment');
  }

  async removeAttachment(path: string) {
    const attachment = this.storage.listAllFiles().find(file => file.path === path && file.kind === 'attachment');
    if (attachment) await this.storage.deleteFile(attachment.id);
  }

  async saveUndoTransaction(transaction: ConversationUndoTransactionV1) {
    await this.storage.writeLocalRecord(
      'conversation-undo',
      transaction.id,
      transaction,
      transaction.expiresAt,
    );
  }

  async loadUndoTransaction(id: string) {
    return this.storage.readLocalRecord<ConversationUndoTransactionV1>('conversation-undo', id);
  }

  async removeUndoTransaction(id: string) {
    await this.storage.deleteLocalRecord('conversation-undo', id);
  }
}
