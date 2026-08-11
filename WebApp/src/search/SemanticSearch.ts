import type { NoteFile } from '../types';

export type SemanticSearchHit = {
  fileId: string;
  path: string;
  heading?: string;
  text: string;
  offset: number;
  score: number;
};

export class SemanticSearch {
  private readonly worker = new Worker(new URL('./SemanticSearchWorker.ts', import.meta.url), { type: 'module' });
  private pending = new Map<string, { resolve: (hits: SemanticSearchHit[]) => void; reject: (error: Error) => void }>();

  constructor(
    private readonly onProgress: (completed: number, total: number) => void = () => undefined,
    private readonly onStatus: (status: 'indexed' | 'error', message?: string) => void = () => undefined,
  ) {
    this.worker.onmessage = event => {
      const message = event.data as Record<string, unknown>;
      if (message.type === 'progress') this.onProgress(Number(message.completed), Number(message.total));
      if (message.type === 'error') {
        const request = this.pending.get(String(message.requestId ?? ''));
        if (request) request.reject(new Error(String(message.message)));
        else this.onStatus('error', String(message.message));
      }
      if (message.type === 'indexed') this.onStatus('indexed');
      if (message.type === 'results') {
        const requestId = String(message.requestId);
        this.pending.get(requestId)?.resolve(message.results as SemanticSearchHit[]);
        this.pending.delete(requestId);
      }
    };
  }

  index(files: NoteFile[]): void {
    this.worker.postMessage({ type: 'index', chunks: files.flatMap(chunkNote) });
  }

  search(query: string, limit = 20): Promise<SemanticSearchHit[]> {
    const requestId = crypto.randomUUID();
    this.worker.postMessage({ type: 'search', requestId, query, limit });
    return new Promise((resolve, reject) => this.pending.set(requestId, { resolve, reject }));
  }

  cancel(): void {
    this.worker.postMessage({ type: 'cancel' });
  }

  close(): void {
    this.worker.terminate();
    for (const request of this.pending.values()) request.reject(new Error('Deep Search closed'));
    this.pending.clear();
  }
}

export function chunkNote(file: NoteFile) {
  const withoutCode = file.content.replaceAll(/```[\s\S]*?```|~~~[\s\S]*?~~~/gu, '');
  const chunks: Array<{ fileId: string; path: string; heading?: string; text: string; offset: number }> = [];
  let heading: string | undefined;
  let cursor = 0;
  for (const block of withoutCode.split(/\n{2,}/u)) {
    const offset = file.content.indexOf(block, cursor);
    cursor = Math.max(cursor, offset + block.length);
    const match = block.match(/^#{1,6}\s+(.+)$/mu);
    if (match) heading = match[1].trim();
    const text = block.replace(/^#{1,6}\s+/gmu, '').trim();
    if (text.length < 8) continue;
    chunks.push({ fileId: file.id, path: file.path, heading, text: text.slice(0, 2_000), offset: Math.max(0, offset) });
  }
  return chunks;
}
