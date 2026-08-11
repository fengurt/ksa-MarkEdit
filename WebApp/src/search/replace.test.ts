import { describe, expect, it } from 'vitest';

import type { NoteFile } from '../types';
import { planWorkspaceReplace } from './replace';

function note(id: string, content: string): NoteFile {
  return {
    id,
    path: `${id}.md`,
    content,
    modifiedAt: 42,
    kind: 'markdown',
    mimeType: 'text/markdown',
    byteSize: new TextEncoder().encode(content).length,
    metadata: { tags: [] },
  };
}

describe('workspace replace planning', () => {
  it('previews literal Unicode replacements without interpreting dollar syntax', () => {
    const plan = planWorkspaceReplace(
      [note('one', '中文 日本語 café CAFÉ'), note('two', 'unrelated')],
      { find: 'café', replacement: '$& 新', caseSensitive: false, regularExpression: false },
      'workspace',
    );

    expect(plan.occurrenceCount).toBe(2);
    expect(plan.changes).toHaveLength(1);
    expect(plan.changes[0]?.content).toBe('中文 日本語 $& 新 $& 新');
  });

  it('supports capture groups in regular-expression mode', () => {
    const plan = planWorkspaceReplace(
      [note('one', 'issue-12 issue-34')],
      { find: 'issue-(\\d+)', replacement: 'ticket-$1', caseSensitive: true, regularExpression: true },
      'workspace',
    );

    expect(plan.changes[0]?.content).toBe('ticket-12 ticket-34');
    expect(plan.occurrenceCount).toBe(2);
  });

  it('limits current-file replacements to the selected note', () => {
    const plan = planWorkspaceReplace(
      [note('one', 'draft'), note('two', 'draft')],
      { find: 'draft', replacement: 'final', caseSensitive: true, regularExpression: false },
      'current',
      'two',
    );

    expect(plan.changes.map(change => change.fileId)).toEqual(['two']);
  });

  it('rejects empty and zero-width expressions', () => {
    expect(() => planWorkspaceReplace(
      [note('one', 'text')],
      { find: '', replacement: 'x', caseSensitive: true, regularExpression: false },
      'workspace',
    )).toThrow('Enter text');
    expect(() => planWorkspaceReplace(
      [note('one', 'text')],
      { find: '^', replacement: 'x', caseSensitive: true, regularExpression: true },
      'workspace',
    )).toThrow('empty string');
  });
});
