import { describe, expect, test } from '@jest/globals';
import { applyTextChanges, treeChanges } from '../src/@preview/incremental';
import { renderMarkdown, safeURL } from '../src/@preview/renderer';

describe('rendered Markdown preview', () => {
  test('renders primary Markdown structures', () => {
    const html = renderMarkdown([
      '# Heading',
      '',
      '**bold** *italic* ~~deleted~~',
      '',
      '- [x] done',
      '- item',
      '',
      '> quote',
      '',
      '| A | B |',
      '|---|:--:|',
      '| 1 | 2 |',
      '',
      '[link](https://example.com)',
      '',
      '![alt](image.png)',
    ].join('\n'));

    expect(html).toContain('<h1');
    expect(html).toContain('<strong');
    expect(html).toContain('<em');
    expect(html).toContain('<del');
    expect(html).toContain('type="checkbox" disabled checked');
    expect(html).toContain('<blockquote');
    expect(html).toContain('<table>');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('src="image-loader://image.png"');
  });

  test('keeps raw HTML inert and rejects dangerous URLs', () => {
    const html = renderMarkdown([
      '<script>alert(1)</script>',
      '',
      '[bad](javascript:alert(1))',
      '',
      '![bad](data:text/html,payload)',
    ].join('\n'));

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain('src="data:');
  });

  test('normalizes safe relative and external URLs', () => {
    expect(safeURL('images/photo.png', true)).toBe('image-loader://images/photo.png');
    expect(safeURL('https://example.com/photo.png', true)).toBe('https://example.com/photo.png');
    expect(safeURL('mailto:test@example.com', false)).toBe('mailto:test@example.com');
    expect(safeURL('file:///tmp/secret', false)).toBeUndefined();
  });

  test('applies multi-range and multilingual changes without replacing the document', () => {
    const changes = [
      { from: 0, to: 2, insert: '中' },
      { from: 8, to: 10, insert: '日本語' },
    ];

    expect(applyTextChanges('AB / CD / Café', changes)).toBe('中 / CD 日本語Café');
    expect(treeChanges(changes)).toStrictEqual([
      { fromA: 0, toA: 2, fromB: 0, toB: 1 },
      { fromA: 8, toA: 10, fromB: 7, toB: 10 },
    ]);
  });
});
