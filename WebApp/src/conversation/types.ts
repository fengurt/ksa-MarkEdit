export type ConversationProvider = 'claude' | 'chatgpt' | 'generic';

export type ConversationAttachmentV1 = {
  id: string;
  name: string;
  mimeType: string;
  byteSize: number;
  digest: string;
  bytes?: Uint8Array;
};

export type ConversationMessageV1 = {
  id: string;
  sourceMessageId?: string;
  parentMessageId?: string;
  role: 'user' | 'assistant' | 'system' | 'tool' | 'unknown';
  createdAt?: number;
  content: string;
  digest: string;
  attachments: ConversationAttachmentV1[];
};

export type ConversationDocumentV1 = {
  version: 1;
  id: string;
  provider: ConversationProvider;
  sourceConversationId?: string;
  title: string;
  createdAt?: number;
  updatedAt?: number;
  importedAt: number;
  messages: ConversationMessageV1[];
  attachments: ConversationAttachmentV1[];
  sourcePackage?: ConversationAttachmentV1;
  contentDigest: string;
  simhash: string;
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
};

export type ConversationImportSource = {
  id?: string;
  kind: 'file' | 'clipboard';
  name: string;
  mimeType?: string;
  lastModified?: number;
  read(): Promise<Uint8Array>;
};

export type ConversationStoredDocument = {
  id: string;
  path: string;
  content: string;
  modifiedAt: number;
};

export type ConversationUndoTransactionV1 = {
  version: 1;
  id: string;
  createdAt: number;
  expiresAt: number;
  createdIds: string[];
  previous: ConversationStoredDocument[];
  createdAttachmentPaths: string[];
};

export type ConversationWorkspacePort = {
  listConversationDocuments(): Promise<ConversationStoredDocument[]>;
  writeConversation(input: {
    id?: string;
    path: string;
    content: string;
    modifiedAt: number;
  }): Promise<ConversationStoredDocument>;
  removeConversation(id: string): Promise<void>;
  writeAttachment?(attachment: ConversationAttachmentV1, path: string): Promise<void>;
  attachmentExists?(path: string): Promise<boolean>;
  removeAttachment?(path: string): Promise<void>;
  saveUndoTransaction?(transaction: ConversationUndoTransactionV1): Promise<void>;
  loadUndoTransaction?(id: string): Promise<ConversationUndoTransactionV1 | undefined>;
  removeUndoTransaction?(id: string): Promise<void>;
};

export type ConversationImportAction = 'create' | 'update' | 'skip' | 'review';

export type ConversationImportItem = {
  id: string;
  sourceName: string;
  conversation: ConversationDocumentV1;
  proposedPath: string;
  proposedContent: string;
  action: ConversationImportAction;
  reason: string;
  existing?: ConversationStoredDocument;
  possibleDuplicate?: ConversationStoredDocument;
  newMessageCount: number;
};

export type ConversationImportPlan = {
  version: 1;
  id: string;
  createdAt: number;
  items: ConversationImportItem[];
  failures: Array<{ sourceName: string; reason: string }>;
};

export type ConversationImportDecision = {
  itemId: string;
  action: 'apply' | 'skip' | 'keep-both';
  title?: string;
  category?: string;
  tags?: string[];
  retainOriginalPackage?: boolean;
  selectedAttachmentIDs?: string[];
};

export type ConversationImportReport = {
  transactionId: string;
  created: number;
  updated: number;
  skipped: number;
  reviewRequired: number;
  files: ConversationStoredDocument[];
};
