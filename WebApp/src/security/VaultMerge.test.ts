import { describe, expect, it } from 'vitest';
import type { NoteFile } from '../types';
import {
  combineConflictContent,
  mergeMarkdown,
  mergeWorkspaceFiles,
  suggestedConflictContent,
} from './VaultMerge';

function note(id: string, path: string, content: string, modifiedAt = 1): NoteFile {
  return { id, path, content, modifiedAt, metadata: { tags: [] } };
}

describe('Vault three-way merge', () => {
  it('combines edits to different Markdown ranges without changing Unicode', () => {
    const base = '# 研究\n\n日本語\n\nCafé\n';
    expect(mergeMarkdown(
      base,
      '# 研究计划\n\n日本語\n\nCafé\n',
      '# 研究\n\n日本語\n\nCafé résumé\n',
    )).toBe('# 研究计划\n\n日本語\n\nCafé résumé\n');
  });

  it('creates a visible conflict copy for overlapping changes', () => {
    const base = [note('a', 'Plan.md', '# Plan\nold\n')];
    const result = mergeWorkspaceFiles({
      base,
      local: [note('a', 'Plan.md', '# Plan\nlocal\n', 2)],
      remote: [note('a', 'Plan.md', '# Plan\nremote\n', 3)],
      now: Date.UTC(2026, 6, 29),
    });
    expect(result.conflicts).toBe(1);
    expect(result.files).toHaveLength(2);
    expect(result.files.map(file => file.content).sort()).toEqual([
      '# Plan\nlocal\n',
      '# Plan\nremote\n',
    ].sort());
    expect(result.files.find(file => file.id !== 'a')?.path).toContain('conflict remote');
    expect(result.conflictRecords).toMatchObject([{
      fileId: 'a',
      reason: 'content',
      versions: [
        { source: 'base', content: '# Plan\nold\n' },
        { source: 'local', content: '# Plan\nlocal\n' },
        { source: 'remote', content: '# Plan\nremote\n' },
      ],
    }]);
    const record = result.conflictRecords[0];
    expect(suggestedConflictContent(record)).toBe('# Plan\nlocal\n');
    expect(combineConflictContent(record)).toBe('# Plan\nlocal\n\n---\n\n# Plan\nremote\n');
    expect(record.preservedFileIds).toHaveLength(2);
  });

  it('accepts an unchanged-side deletion and retains changed content on delete conflict', () => {
    const base = [note('a', 'Archive.md', 'base')];
    expect(mergeWorkspaceFiles({ base, local: [], remote: base }).files).toEqual([]);
    const result = mergeWorkspaceFiles({
      base,
      local: [],
      remote: [note('a', 'Archive.md', 'changed', 2)],
      now: Date.UTC(2026, 6, 29),
    });
    expect(result.conflicts).toBe(1);
    expect(result.files[0].content).toBe('changed');
    expect(result.files[0].path).toContain('conflict remote');
    expect(result.conflictRecords[0].reason).toBe('delete');
  });

  it('keeps both files and exposes both snapshots when paths collide', () => {
    const result = mergeWorkspaceFiles({
      base: [],
      local: [note('a', 'Shared.md', 'local')],
      remote: [note('b', 'Shared.md', 'remote')],
      now: Date.UTC(2026, 7, 3),
    });
    expect(result.files).toHaveLength(2);
    expect(result.conflictRecords[0]).toMatchObject({
      reason: 'duplicate',
      preservedFileIds: ['a', expect.any(String)],
      versions: [
        { source: 'local', content: 'local' },
        { source: 'remote', content: 'remote' },
      ],
    });
  });
});
