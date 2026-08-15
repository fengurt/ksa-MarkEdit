import type { NoteFile } from '../types';

export function isClipboardKnowledgeRecord(file: NoteFile): boolean {
  return file.path.startsWith('Clipboard/')
    && file.path !== 'Clipboard/Labels.md'
    && file.metadata.tags.length > 0;
}

export function clipboardKnowledgeTitle(file: NoteFile): string {
  const heading = file.content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return heading || file.path.split('/').at(-1) || file.path;
}

export function isFavoriteClipboardRecord(file: NoteFile): boolean {
  return /^favorite:\s*true\s*$/m.test(file.content);
}
