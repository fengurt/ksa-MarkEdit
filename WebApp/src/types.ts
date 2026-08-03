export type NoteMetadata = {
  category?: string;
  tags: string[];
};

export type VaultFile = {
  id: string;
  path: string;
  modifiedAt: number;
};

export type VaultManifest = {
  version: 1;
  id: string;
  name: string;
  files: VaultFile[];
  updatedAt: number;
};

export type NoteFile = VaultFile & {
  content: string;
  metadata: NoteMetadata;
};

export type ConflictVersionSource = 'base' | 'local' | 'remote';

export type ConflictVersion = {
  source: ConflictVersionSource;
  label: string;
  fileId?: string;
  path?: string;
  content?: string;
  modifiedAt?: number;
};

export type ConflictResolution = {
  resolvedAt: number;
  strategy: 'local' | 'remote' | 'combined' | 'manual';
  resultFileId: string;
};

export type ConflictRecord = {
  version: 1;
  id: string;
  fileId: string;
  path: string;
  reason: 'content' | 'path' | 'delete' | 'duplicate';
  createdAt: number;
  versions: ConflictVersion[];
  preservedFileIds: string[];
  resolution?: ConflictResolution;
};

export type SearchHit = {
  fileId: string;
  path: string;
  line: number;
  snippet: string;
};

export type GraphNode = {
  id: string;
  path: string;
  title: string;
  category?: string;
  tags: string[];
};

export type GraphEdge = {
  source: string;
  target: string;
  kind: 'markdown' | 'wiki';
};
