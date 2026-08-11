import {
  button,
  element,
  formatBytes,
  installStyles,
  layout,
  listAll,
  readAll,
  renderInfo,
  request,
  showMetadata,
  text,
} from './runtime.js';

installStyles('styles.css');

export async function open(resource, root) {
  const view = layout(root, resource.displayName);
  const entryByID = new Map();

  async function select(entry) {
    entryByID.set(entry.id, entry);
    view.preview.replaceChildren(element('div', 'empty-state', 'Loading preview…'));
    try {
      await previewEntry(entry, view.preview);
      showMetadata(view.metadata, {
        Name: entry.name,
        Type: entry.mediaType ?? entry.kind,
        Size: entry.byteCount === undefined ? '' : formatBytes(entry.byteCount),
        Modified: entry.modifiedAt ? new Date(entry.modifiedAt).toLocaleString() : '',
        Path: entry.id,
      });
    } catch (error) {
      view.preview.replaceChildren(element('div', 'empty-state warning', String(error)));
    }
  }

  async function addEntries(container, parentID) {
    const entries = await listAll(parentID);
    for (const entry of entries) {
      entryByID.set(entry.id, entry);
      const wrapper = element('div', 'tree-item');
      const isFolder = entry.kind === 'folder' || entry.kind === 'symbolicLink' && !entry.byteCount;
      const row = button(`${isFolder ? '▸' : ' '} ${entry.name}`, async () => {
        if (!isFolder) return select(entry);
        let children = wrapper.querySelector('.tree-children');
        if (children) {
          children.hidden = !children.hidden;
          row.textContent = `${children.hidden ? '▸' : '▾'} ${entry.name}`;
          return;
        }
        children = element('div', 'tree-children');
        wrapper.append(children);
        row.textContent = `▾ ${entry.name}`;
        await addEntries(children, entry.id);
      }, 'tree-row');
      wrapper.append(row);
      container.append(wrapper);
    }
  }

  if (resource.kind === 'folder') {
    await addEntries(view.sidebar, undefined);
    view.preview.append(element('div', 'empty-state', 'Select a file to preview.'));
  } else {
    const entry = {
      id: resource.displayName,
      name: resource.displayName,
      kind: 'file',
      mediaType: resource.mediaType,
      byteCount: resource.byteCount,
      modifiedAt: resource.modifiedAt,
    };
    view.sidebar.append(button(entry.name, () => select(entry), 'tree-row'));
    await select(entry);
  }

  view.search.addEventListener('input', async () => {
    const query = view.search.value.trim();
    if (!query) {
      view.sidebar.replaceChildren();
      if (resource.kind === 'folder') await addEntries(view.sidebar, undefined);
      return;
    }
    const results = await request('search', { query, limit: 500 });
    view.sidebar.replaceChildren(...results.map(entry => button(entry.id, () => select(entry), 'list-row')));
  });
}

async function previewEntry(entry, container) {
  const extension = entry.name.split('.').at(-1)?.toLowerCase() ?? '';
  const mediaType = entry.mediaType ?? '';
  const info = await renderInfo(entry.id);
  container.replaceChildren();

  if (mediaType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg'].includes(extension)) {
    const image = element('img', 'preview-image');
    image.alt = entry.name;
    image.src = info.resourceURL;
    container.append(image);
    return;
  }
  if (mediaType === 'application/pdf' || extension === 'pdf') {
    const frame = element('iframe', 'preview-pdf');
    frame.title = entry.name;
    frame.src = info.resourceURL;
    container.append(frame);
    return;
  }

  const bytes = await readAll(entry.id, entry.byteCount ?? 0, 10 * 1024 * 1024);
  let source = text(bytes);
  const toolbar = element('div', 'toolbar');
  if (['md', 'markdown', 'mdown', 'mkd'].includes(extension)) {
    toolbar.append(button('Open in editor', () => request('openInEditor', { entryID: entry.id })));
    container.append(toolbar, markdown(source));
    return;
  }
  if (extension === 'json') {
    try { source = JSON.stringify(JSON.parse(source), null, 2); } catch { /* preserve source */ }
  }
  if (extension === 'csv') {
    container.append(csvTable(source));
    return;
  }
  const code = element('pre', 'preview-code', source);
  container.append(code);
}

function markdown(source) {
  const article = element('article', 'markdown-preview');
  let code;
  for (const line of source.split(/\r?\n/)) {
    if (line.startsWith('```')) {
      if (code) {
        article.append(code);
        code = undefined;
      } else {
        code = element('pre', 'preview-code');
      }
      continue;
    }
    if (code) {
      code.textContent += `${line}\n`;
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      article.append(element(`h${heading[1].length}`, '', heading[2]));
    } else if (/^>\s?/.test(line)) {
      article.append(element('blockquote', '', line.replace(/^>\s?/, '')));
    } else if (/^[-*+]\s+/.test(line)) {
      const item = element('div', 'markdown-list-item', line.replace(/^[-*+]\s+/, ''));
      article.append(item);
    } else if (line.trim()) {
      article.append(element('p', '', line));
    }
  }
  if (code) article.append(code);
  return article;
}

function csvTable(source) {
  const table = element('table', 'csv-table');
  for (const row of parseCSV(source).slice(0, 5000)) {
    const tr = element('tr');
    for (const value of row) tr.append(element('td', '', value));
    table.append(tr);
  }
  return table;
}

function parseCSV(source) {
  const rows = [[]];
  let value = '';
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"' && quoted && source[index + 1] === '"') {
      value += '"'; index += 1;
    } else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { rows.at(-1).push(value); value = ''; }
    else if ((character === '\n' || character === '\r' && source[index + 1] !== '\n') && !quoted) {
      rows.at(-1).push(value); value = ''; rows.push([]);
    } else if (character !== '\r') value += character;
  }
  rows.at(-1).push(value);
  return rows;
}
