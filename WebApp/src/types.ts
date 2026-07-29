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
