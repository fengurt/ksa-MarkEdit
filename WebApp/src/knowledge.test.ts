import { describe, expect, it } from 'vitest';
import { buildGraph } from './graph/buildGraph';
import { applyMetadata, canonicalTag, parseMetadata } from './markdown/metadata';
import { searchNotes } from './search/search';
import type { NoteFile } from './types';

const files: NoteFile[] = [
  {
    id: 'one',
    path: 'Projects/研究.md',
    modifiedAt: Date.parse('2026-07-20T00:00:00Z'),
    content: [
      '---',
      'category: Projects/AI',
      'tags: [Ｒｅｓｅａｒｃｈ, 日本語]',
      'custom: keep-me',
      '---',
      '# Café 研究',
      'See [[Résumé]] and [plan](../Plans/plan.md).',
    ].join('\n'),
    metadata: {
      category: 'Projects/AI',
      tags: ['Ｒｅｓｅａｒｃｈ', '日本語'],
    },
  },
  {
    id: 'two',
    path: 'Résumé.md',
    modifiedAt: Date.parse('2026-07-21T00:00:00Z'),
    content: '# Résumé\nExpérience française',
    metadata: { tags: ['CV'] },
  },
  {
    id: 'three',
    path: 'Plans/plan.md',
    modifiedAt: Date.parse('2026-07-22T00:00:00Z'),
    content: '# Plan',
    metadata: { category: 'Projects', tags: [] },
  },
];

describe('Markdown metadata', () => {
  it('uses Unicode NFKC tag identities and preserves user display text', () => {
    expect(canonicalTag(' Ｒｅｓｅａｒｃｈ ')).toBe('research');
    expect(parseMetadata(files[0].content)).toEqual({
      category: 'Projects/AI',
      tags: ['Ｒｅｓｅａｒｃｈ', '日本語'],
    });
  });

  it('updates only managed fields while retaining comments, custom fields and CRLF', () => {
    const source = [
      '---',
      'title: Example # retained',
      'tags:',
      '  - old',
      'custom: yes',
      '---',
      '# Body',
    ].join('\r\n');
    const updated = applyMetadata(source, {
      category: 'Projects/AI',
      tags: ['Swift', 'Ｓｗｉｆｔ', '中文'],
    });

    expect(updated).toContain('title: Example # retained\r\n');
    expect(updated).toContain('custom: yes\r\n');
    expect(updated).toContain('category: Projects/AI\r\n');
    expect(updated).toContain('tags: [Swift, 中文]\r\n');
    expect(updated.replaceAll('\r\n', '')).not.toContain('\n');
  });
});

describe('knowledge search and graph', () => {
  it('searches accents, CJK, normalized tags, categories and exclusions', () => {
    expect(searchNotes(files, 'cafe 研究 tag:research category:Projects').map(hit => hit.fileId))
      .toEqual(['one']);
    expect(searchNotes(files, 'experience path:resume').map(hit => hit.fileId))
      .toEqual(['two']);
    expect(searchNotes(files, '研究 -javascript').map(hit => hit.fileId))
      .toEqual(['one']);
  });

  it('resolves Wiki and relative Markdown links without duplicate edges', () => {
    expect(buildGraph(files)).toMatchObject({
      nodes: expect.arrayContaining([
        expect.objectContaining({ id: 'one' }),
        expect.objectContaining({ id: 'two' }),
        expect.objectContaining({ id: 'three' }),
      ]),
      edges: expect.arrayContaining([
        { source: 'one', target: 'two', kind: 'wiki' },
        { source: 'one', target: 'three', kind: 'markdown' },
      ]),
    });
  });
});
