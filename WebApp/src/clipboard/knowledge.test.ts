import { describe, expect, it } from 'vitest';
import {
  clipboardKnowledgeTitle,
  isClipboardKnowledgeRecord,
  isFavoriteClipboardRecord,
} from './knowledge';
import type { NoteFile } from '../types';

function file(path: string, content: string, tags: string[]): NoteFile {
  return { id: path, path, content, modifiedAt: 1, metadata: { tags } };
}

describe('clipboard knowledge', () => {
  it('shows every synced labeled clipboard record but not the label catalog', () => {
    expect(isClipboardKnowledgeRecord(file('Clipboard/2026/08/Clip--1.md', '# 发票资料', ['clipboard', '发票']))).toBe(true);
    expect(isClipboardKnowledgeRecord(file('Clipboard/Labels.md', '# Clipboard Labels', []))).toBe(false);
    expect(isClipboardKnowledgeRecord(file('Notes/Other.md', '# Other', ['clipboard']))).toBe(false);
  });

  it('uses the first Markdown heading as the display title', () => {
    expect(clipboardKnowledgeTitle(file('Clipboard/2026/08/Clip--1.md', '---\n---\n# 公司介绍\n', ['clipboard'])))
      .toBe('公司介绍');
  });

  it('recognizes favorite metadata without exposing it outside decrypted Markdown', () => {
    expect(isFavoriteClipboardRecord(file('Clipboard/2026/08/Clip--1.md', 'favorite: true\n', ['clipboard'])))
      .toBe(true);
  });
});
