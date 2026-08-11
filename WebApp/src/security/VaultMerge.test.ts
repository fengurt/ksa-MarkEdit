import { describe, expect, it } from 'vitest';
import type { NoteFile } from '../types';
import { mergeMarkdown, mergeWorkspaceFiles } from './VaultMerge';

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
  });
});
