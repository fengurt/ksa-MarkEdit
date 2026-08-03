import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  importDocumentFromURL,
  prepareBrowserImport,
  uniqueImportPath,
  type ImportSource,
} from './BrowserImport';

function source(path: string, content: string, overrides: Partial<ImportSource> = {}): ImportSource {
  const bytes = new TextEncoder().encode(content);
  return {
    name: path.split('/').at(-1) ?? path,
    webkitRelativePath: path,
    size: bytes.length,
    lastModified: 42,
    arrayBuffer: async () => bytes.slice().buffer,
    ...overrides,
  };
}

describe('browser note import', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('preserves Unicode folder paths and converts supported names to Markdown', async () => {
    const result = await prepareBrowserImport([
      source('研究/日本語/计划.txt', 'Café\n'),
      source('研究/首頁.md', '# 首頁\n'),
    ]);
    expect(result.failures).toEqual([]);
    expect(result.documents).toMatchObject([
      { path: '研究/日本語/计划.md', content: 'Café\n', modifiedAt: 42 },
      { path: '研究/首頁.md', content: '# 首頁\n', modifiedAt: 42 },
    ]);
  });

  it('rejects traversal, binary and unsupported files without stopping the batch', async () => {
    const result = await prepareBrowserImport([
      source('../secret.md', 'no'),
      source('photo.png', 'not really an image'),
      source('binary.md', '\0unsafe'),
      source('safe.md', 'safe'),
    ]);
    expect(result.documents.map(document => document.path)).toEqual(['safe.md']);
    expect(result.failures).toHaveLength(3);
  });

  it('allocates stable non-destructive names for duplicate imports', () => {
    const occupied = new Set(['Plan.md', 'Plan (imported 2).md']);
    expect(uniqueImportPath('Plan.md', occupied)).toBe('Plan (imported 3).md');
    expect(uniqueImportPath('Folder/New.md', occupied)).toBe('Folder/New.md');
  });

  it('imports a UTF-8 note from an HTTPS URL without sending browser credentials', async () => {
    const fetchMock = vi.fn(async () => new Response('# Remote\n', {
      headers: { 'content-type': 'text/markdown' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(importDocumentFromURL('https://example.com/shared/note')).resolves.toMatchObject({
      path: 'note.md',
      content: '# Remote\n',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://example.com/shared/note'),
      expect.objectContaining({ credentials: 'omit' }),
    );
  });

  it('rejects insecure remote import URLs before making a request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(importDocumentFromURL('http://example.com/note.md')).rejects.toThrow('HTTPS');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
