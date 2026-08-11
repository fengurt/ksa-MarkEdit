export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

export type ImportSource = {
  name: string;
  size: number;
  type?: string;
  lastModified?: number;
  webkitRelativePath?: string;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type ImportedDocument = {
  path: string;
  content: string;
  modifiedAt: number;
};

export type ImportFailure = {
  name: string;
  reason: string;
};

export type PreparedImport = {
  documents: ImportedDocument[];
  failures: ImportFailure[];
};

const supportedExtensions = new Set([
  'md', 'markdown', 'mdown', 'mkd', 'txt', 'text', 'html', 'htm',
]);

export async function prepareBrowserImport(
  sources: Iterable<ImportSource>,
): Promise<PreparedImport> {
  const documents: ImportedDocument[] = [];
  const failures: ImportFailure[] = [];
  for (const source of sources) {
    const rawPath = source.webkitRelativePath || source.name;
    try {
      if (source.size > MAX_IMPORT_BYTES) {
        throw new Error('File exceeds the 10 MB import limit');
      }
      const path = importPath(rawPath);
      const bytes = new Uint8Array(await source.arrayBuffer());
      if (bytes.subarray(0, 8_192).includes(0)) {
        throw new Error('Binary files are not imported as notes');
      }
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      const extension = source.name.split('.').at(-1)?.toLocaleLowerCase('en-US') ?? '';
      documents.push({
        path,
        content: extension === 'html' || extension === 'htm' ? htmlToMarkdown(decoded) : decoded,
        modifiedAt: source.lastModified || Date.now(),
      });
    } catch (error) {
      failures.push({
        name: rawPath,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { documents, failures };
}

export async function importDocumentFromURL(rawURL: string): Promise<ImportedDocument> {
  const url = new URL(rawURL);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalHost(url.hostname))) {
    throw new Error('Only HTTPS import URLs are allowed');
  }
  const response = await fetch(url, {
    credentials: 'omit',
    redirect: 'follow',
    headers: { Accept: 'text/markdown, text/plain, text/html;q=0.9' },
  });
  if (!response.ok) {
    throw new Error(`Import failed with HTTP ${response.status}`);
  }
  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_IMPORT_BYTES) {
    throw new Error('Remote file exceeds the 10 MB import limit');
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > MAX_IMPORT_BYTES || bytes.subarray(0, 8_192).includes(0)) {
    throw new Error('Remote file is too large or binary');
  }
  const contentType = response.headers.get('content-type')?.split(';')[0].trim() ?? '';
  if (contentType && !['text/markdown', 'text/plain', 'text/html', 'application/octet-stream'].includes(contentType)) {
    throw new Error(`Unsupported remote content type: ${contentType}`);
  }
  const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const lastSegment = decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) ?? 'Imported');
  const path = importPath(hasSupportedExtension(lastSegment)
    ? lastSegment
    : `${lastSegment || 'Imported'}.${contentType === 'text/html' ? 'html' : 'md'}`);
  return {
    path,
    content: contentType === 'text/html' || /\.html?$/iu.test(lastSegment)
      ? htmlToMarkdown(decoded)
      : decoded,
    modifiedAt: Date.now(),
  };
}

export function uniqueImportPath(path: string, occupied: Set<string>): string {
  if (!occupied.has(path)) {
    occupied.add(path);
    return path;
  }
  const dot = path.lastIndexOf('.');
  const slash = path.lastIndexOf('/');
  const stem = dot > slash ? path.slice(0, dot) : path;
  const extension = dot > slash ? path.slice(dot) : '.md';
  let index = 2;
  let candidate = `${stem} (imported ${index})${extension}`;
  while (occupied.has(candidate)) {
    index += 1;
    candidate = `${stem} (imported ${index})${extension}`;
  }
  occupied.add(candidate);
  return candidate;
}

function importPath(rawPath: string): string {
  const segments = rawPath.normalize('NFC').replaceAll('\\', '/').split('/').filter(Boolean);
  if (!segments.length || segments.some(segment => segment === '.' || segment === '..')) {
    throw new Error('Unsafe import path');
  }
  const filename = segments.at(-1) ?? '';
  const extension = filename.split('.').at(-1)?.toLocaleLowerCase('en-US') ?? '';
  if (!supportedExtensions.has(extension)) {
    throw new Error('Only Markdown, text and HTML files can be imported');
  }
  const markdownName = extension === 'md'
    ? filename
    : `${filename.slice(0, -(extension.length + 1)) || 'Imported'}.md`;
  segments[segments.length - 1] = markdownName;
  return segments.join('/');
}

function hasSupportedExtension(filename: string): boolean {
  const extension = filename.split('.').at(-1)?.toLocaleLowerCase('en-US') ?? '';
  return supportedExtensions.has(extension);
}

function htmlToMarkdown(html: string): string {
  if (typeof DOMParser === 'undefined') {
    return html.replaceAll(/<script[\s\S]*?<\/script>/giu, '').replaceAll(/<[^>]+>/gu, ' ');
  }
  const document = new DOMParser().parseFromString(html, 'text/html');
  for (const blocked of document.querySelectorAll('script, style, iframe, object, embed, form')) {
    blocked.remove();
  }
  for (const heading of document.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    const level = Number(heading.tagName.slice(1));
    heading.replaceWith(`${'#'.repeat(level)} ${heading.textContent?.trim() ?? ''}\n\n`);
  }
  for (const anchor of document.querySelectorAll('a')) {
    const href = anchor.getAttribute('href') ?? '';
    const safeHref = /^(?:https?:|mailto:|\/|\.|#)/iu.test(href) ? href : '';
    anchor.replaceWith(safeHref ? `[${anchor.textContent ?? ''}](${safeHref})` : (anchor.textContent ?? ''));
  }
  for (const element of document.querySelectorAll('p, div, section, article, header, footer, li, br')) {
    element.append('\n');
  }
  return (document.body.textContent ?? '')
    .replaceAll(/[\t ]+\n/gu, '\n')
    .replaceAll(/\n{3,}/gu, '\n\n')
    .trim()
    .concat('\n');
}

function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}
