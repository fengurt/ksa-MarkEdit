import {
  button,
  element,
  formatBytes,
  installStyles,
  joinPath,
  layout,
  readAll,
  renderInfo,
  showMetadata,
  text,
  walkFiles,
} from './runtime.js';

installStyles('styles.css');

export async function open(resource, root) {
  const view = layout(root, resource.displayName);
  view.preview.replaceChildren(element('div', 'empty-state', 'Reading MinerU output…'));
  const files = await walkFiles(undefined, 50000);
  const byName = new Map(files.map(file => [file.name.toLowerCase(), file]));
  const contentFile = byName.get('content_list_v2.json') ?? byName.get('content_list.json');
  const markdown = files.filter(file => /\.md$/i.test(file.name)).sort((left, right) => (right.byteCount ?? 0) - (left.byteCount ?? 0))[0];
  const blocks = contentFile ? await loadBlocks(contentFile) : [];
  const headings = markdown ? await loadHeadings(markdown) : [];
  let visible = 500;
  let selectedPage;

  function filteredBlocks() {
    const query = fold(view.search.value);
    return blocks.filter(block => (selectedPage === undefined || block.page === selectedPage)
      && (!query || fold(`${block.type} ${block.text}`).includes(query)));
  }

  async function renderBlocks() {
    const values = filteredBlocks();
    const container = element('div', 'mineru-blocks');
    for (const block of values.slice(0, visible)) container.append(await blockView(block, contentFile?.id ?? ''));
    if (values.length > visible) {
      container.append(button(`Load ${Math.min(500, values.length - visible)} more`, async () => {
        visible += 500;
        await renderBlocks();
      }, 'load-more'));
    }
    view.preview.replaceChildren(container);
  }

  const pages = [...new Set(blocks.map(block => block.page).filter(Number.isFinite))].sort((a, b) => a - b);
  view.sidebar.append(button('All pages', async () => { selectedPage = undefined; visible = 500; await renderBlocks(); }, 'list-row'));
  for (const page of pages) {
    view.sidebar.append(button(`Page ${page + 1}`, async () => { selectedPage = page; visible = 500; await renderBlocks(); }, 'list-row'));
  }
  if (headings.length) {
    view.sidebar.append(element('h2', 'sidebar-heading', 'Document outline'));
    for (const heading of headings.slice(0, 500)) view.sidebar.append(element('div', `outline-row level-${heading.level}`, heading.title));
  }

  const artifacts = ['middle.json', 'model.json', 'layout.pdf', 'span.pdf']
    .map(name => byName.get(name)).filter(Boolean);
  const toolbar = element('div', 'artifact-toolbar');
  for (const artifact of artifacts.filter(file => /\.pdf$/i.test(file.name))) {
    toolbar.append(button(`Open ${artifact.name}`, async () => {
      const info = await renderInfo(artifact.id);
      const frame = element('iframe', 'preview-pdf');
      frame.title = artifact.name; frame.src = info.resourceURL;
      view.preview.replaceChildren(frame);
    }));
  }
  view.header.append(toolbar);
  view.search.addEventListener('input', () => { visible = 500; renderBlocks(); });
  showMetadata(view.metadata, {
    Format: byName.has('content_list_v2.json') ? 'MinerU 3.0 content_list_v2' : contentFile ? 'MinerU legacy content_list' : 'Markdown only',
    'Content blocks': blocks.length,
    Pages: pages.length,
    Markdown: markdown?.id ?? 'Missing',
    Images: files.filter(file => /\.(?:png|jpe?g|webp)$/i.test(file.name)).length,
    'middle.json': byName.has('middle.json') ? formatBytes(byName.get('middle.json').byteCount) : 'Missing',
    'model.json': byName.has('model.json') ? formatBytes(byName.get('model.json').byteCount) : 'Missing',
  });
  await renderBlocks();
  if (!blocks.length && markdown) {
    const source = text(await readAll(markdown.id, markdown.byteCount ?? 0, 20 * 1024 * 1024));
    view.preview.replaceChildren(element('pre', 'preview-code', source));
  }
}

async function loadBlocks(file) {
  const source = text(await readAll(file.id, file.byteCount ?? 0, 100 * 1024 * 1024));
  const data = JSON.parse(source);
  const blocks = [];
  const pending = [data];
  while (pending.length && blocks.length < 200000) {
    const value = pending.pop();
    if (Array.isArray(value)) { for (let index = value.length - 1; index >= 0; index -= 1) pending.push(value[index]); continue; }
    if (!value || typeof value !== 'object') continue;
    const type = value.type ?? value.block_type ?? value.category;
    const content = value.text ?? value.content ?? value.value;
    const page = Number(value.page_idx ?? value.page_index ?? value.page_id ?? value.page ?? 0);
    const image = value.img_path ?? value.image_path ?? value.path;
    if (type || typeof content === 'string' || image) {
      blocks.push({ type: String(type ?? 'block'), text: typeof content === 'string' ? content : '', page, image, bbox: value.bbox ?? value.box });
    } else {
      for (const child of Object.values(value)) if (child && typeof child === 'object') pending.push(child);
    }
  }
  return blocks;
}

async function loadHeadings(file) {
  if ((file.byteCount ?? 0) > 20 * 1024 * 1024) return [];
  const source = text(await readAll(file.id, file.byteCount ?? 0, 20 * 1024 * 1024));
  return [...source.matchAll(/^(#{1,6})\s+(.+)$/gm)].map(match => ({ level: match[1].length, title: match[2] }));
}

async function blockView(block, contentRoot) {
  const card = element('article', 'mineru-block');
  const heading = element('header', 'block-heading');
  heading.append(element('strong', '', block.type), element('span', '', `Page ${block.page + 1}`));
  card.append(heading);
  if (block.text) card.append(element('p', 'block-text', block.text));
  if (block.image && typeof block.image === 'string') {
    try {
      const base = contentRoot.includes('/') ? contentRoot.slice(0, contentRoot.lastIndexOf('/')) : '';
      const id = joinPath(base, block.image);
      const image = element('img', 'block-image');
      image.alt = block.text || block.type;
      image.src = (await renderInfo(id)).resourceURL;
      card.append(image);
    } catch {
      card.append(element('p', 'warning', `Missing image: ${block.image}`));
    }
  }
  if (block.bbox) card.append(element('code', 'bbox', JSON.stringify(block.bbox)));
  return card;
}

function fold(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase();
}
