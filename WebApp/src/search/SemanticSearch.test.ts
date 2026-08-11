import { describe, expect, it } from 'vitest';
import { chunkNote } from './SemanticSearch';

describe('SemanticSearch chunking', () => {
  it('preserves multilingual prose and excludes code blocks from the semantic hot path', () => {
    const chunks = chunkNote({
      id: 'note-1',
      path: '研究/Café.md',
      modifiedAt: 1,
      metadata: { tags: [] },
      content: '# 多语言研究\n\n中文语义搜索与日本語の検索、français accentué。\n\n```swift\nlet secret = "exclude me"\n```\n\n## Résumé\n\n跨语言结果应该定位到原始段落。',
    });
    expect(chunks.map(chunk => chunk.text).join('\n')).toContain('日本語');
    expect(chunks.map(chunk => chunk.text).join('\n')).toContain('français');
    expect(chunks.map(chunk => chunk.text).join('\n')).not.toContain('exclude me');
    expect(chunks.at(-1)).toMatchObject({ heading: 'Résumé', fileId: 'note-1' });
  });
});
