import {
  button,
  element,
  installStyles,
  layout,
  readAll,
  showMetadata,
  text,
  walkFiles,
} from './runtime.js';

installStyles('styles.css');

export async function open(resource, root) {
  const view = layout(root, resource.displayName);
  view.preview.replaceChildren(element('div', 'empty-state', 'Reading OKF catalog…'));
  const candidates = resource.kind === 'file'
    ? [{
        id: resource.displayName,
        name: resource.displayName,
        kind: 'file',
        mediaType: resource.mediaType,
        byteCount: resource.byteCount ?? 0,
        modifiedAt: resource.modifiedAt,
      }]
    : await walkFiles(undefined, 20000);
  const files = candidates.filter(file => /\.(?:md|markdown|okf)$/i.test(file.name));
  const records = [];
  for (const file of files.slice(0, 5000)) {
    if ((file.byteCount ?? 0) > 5 * 1024 * 1024) continue;
    const source = text(await readAll(file.id, file.byteCount ?? 0, 5 * 1024 * 1024));
    records.push(parseRecord(file, source));
  }
  buildRelations(records);
  const hasIndex = records.some(record => /^(?:index|catalog)\./i.test(record.file.name));
  const version = records.map(record => record.metadata.okf_version ?? record.metadata.okfVersion)
    .find(Boolean) ?? 'v0.1/v0.2 compatible';

  function select(record) {
    view.preview.replaceChildren(recordView(record));
    showMetadata(view.metadata, {
      ID: record.id,
      Type: record.type,
      Source: record.source,
      Trust: record.trust,
      Tags: record.tags.join(', '),
      Links: record.links.length,
      Backlinks: record.backlinks.length,
      Path: record.file.id,
    });
    drawGraph(view.preview.querySelector('canvas'), record, records);
  }

  function renderList(values) {
    view.sidebar.replaceChildren();
    if (!hasIndex) {
      view.sidebar.append(element('p', 'synthetic-index', 'Synthetic catalog index (source files unchanged)'));
    }
    for (const record of values) {
      view.sidebar.append(button(record.title, () => select(record), 'list-row'));
    }
  }

  renderList(records);
  view.search.addEventListener('input', () => {
    const query = fold(view.search.value);
    renderList(records.filter(record => [record.title, record.id, record.type, ...record.tags]
      .some(value => fold(value).includes(query))));
  });
  if (records[0]) select(records[0]);
  else view.preview.replaceChildren(element('div', 'empty-state warning', 'No OKF Markdown records were found.'));
  view.header.append(element('span', 'catalog-version', String(version)));
}

function parseRecord(file, source) {
  const frontMatter = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  const metadata = frontMatter ? parseYAML(frontMatter[1]) : {};
  const body = frontMatter ? source.slice(frontMatter[0].length) : source;
  const title = metadata.title ?? metadata.name ?? body.match(/^#\s+(.+)$/m)?.[1] ?? file.name.replace(/\.[^.]+$/, '');
  const links = [];
  for (const match of body.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) links.push(match[1].trim());
  for (const match of body.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) links.push(match[1].trim());
  return {
    file,
    source: metadata.source ?? metadata.origin ?? '',
    metadata,
    body,
    title: String(title),
    id: String(metadata.id ?? metadata.identifier ?? title),
    type: String(metadata.type ?? metadata.kind ?? metadata.concept_type ?? 'Concept'),
    trust: String(metadata.trust ?? metadata.confidence ?? metadata.status ?? ''),
    tags: arrayValue(metadata.tags ?? metadata.labels),
    links: [...new Set(links)],
    backlinks: [],
    brokenLinks: [],
  };
}

function buildRelations(records) {
  const index = new Map();
  for (const record of records) {
    for (const key of [record.id, record.title, record.file.id, record.file.name, record.file.id.replace(/\.[^.]+$/, '')]) {
      index.set(fold(key), record);
    }
  }
  for (const record of records) {
    for (const link of record.links) {
      const clean = decodeURIComponent(link.split('#')[0]).replace(/^\.\//, '');
      const target = index.get(fold(clean)) ?? index.get(fold(clean.replace(/\.[^.]+$/, '')));
      if (target) target.backlinks.push(record);
      else if (!/^[a-z][a-z0-9+.-]*:/i.test(link)) record.brokenLinks.push(link);
    }
  }
}

function recordView(record) {
  const container = element('div', 'okf-record');
  container.append(element('h1', '', record.title));
  const badges = element('div', 'record-badges');
  badges.append(element('span', '', record.type));
  for (const tag of record.tags) badges.append(element('span', '', tag));
  container.append(badges);
  const summary = record.body.split(/\r?\n/).filter(line => line.trim() && !line.startsWith('#')).slice(0, 8).join('\n');
  container.append(element('pre', 'record-summary', summary));
  const relations = element('div', 'relations');
  relations.append(relationGroup('Links', record.links));
  relations.append(relationGroup('Backlinks', record.backlinks.map(item => item.title)));
  if (record.brokenLinks.length) relations.append(relationGroup('Broken links', record.brokenLinks, true));
  container.append(relations);
  const canvas = element('canvas', 'okf-graph');
  canvas.width = 900;
  canvas.height = 360;
  container.append(canvas);
  return container;
}

function relationGroup(title, values, warning = false) {
  const group = element('section', warning ? 'relation-group warning' : 'relation-group');
  group.append(element('h2', '', `${title} (${values.length})`));
  for (const value of values.slice(0, 100)) group.append(element('div', 'relation-row', value));
  return group;
}

function drawGraph(canvas, selected, records) {
  if (!canvas) return;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  const linked = new Set([...selected.links.map(fold), ...selected.backlinks.map(item => fold(item.id))]);
  const neighbors = records.filter(record => record === selected || linked.has(fold(record.id)) || linked.has(fold(record.title))).slice(0, 50);
  const center = { x: canvas.width / 2, y: canvas.height / 2 };
  context.strokeStyle = 'rgba(110,110,110,.45)';
  context.fillStyle = getComputedStyle(document.documentElement).color;
  context.font = '12px system-ui';
  neighbors.forEach((record, index) => {
    const angle = index / Math.max(1, neighbors.length - 1) * Math.PI * 2;
    const point = record === selected ? center : { x: center.x + Math.cos(angle) * 270, y: center.y + Math.sin(angle) * 130 };
    if (record !== selected) {
      context.beginPath(); context.moveTo(center.x, center.y); context.lineTo(point.x, point.y); context.stroke();
    }
    context.beginPath(); context.arc(point.x, point.y, record === selected ? 8 : 5, 0, Math.PI * 2); context.fill();
    context.fillText(record.title.slice(0, 28), point.x + 10, point.y + 4);
  });
}

function parseYAML(source) {
  const output = {};
  let activeArray;
  for (const rawLine of source.split(/\r?\n/)) {
    const arrayItem = rawLine.match(/^\s*-\s+(.+)$/);
    if (arrayItem && activeArray) { output[activeArray].push(unquote(arrayItem[1])); continue; }
    const pair = rawLine.match(/^([\w.-]+)\s*:\s*(.*)$/);
    if (!pair) continue;
    const [, key, rawValue] = pair;
    if (!rawValue.trim()) { output[key] = []; activeArray = key; continue; }
    activeArray = undefined;
    const value = rawValue.trim();
    output[key] = value.startsWith('[') && value.endsWith(']')
      ? value.slice(1, -1).split(',').map(item => unquote(item.trim())).filter(Boolean)
      : unquote(value);
  }
  return output;
}

function unquote(value) {
  return value.replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, (_, double, single) => double ?? single);
}

function arrayValue(value) {
  if (Array.isArray(value)) return value.map(String);
  if (!value) return [];
  return String(value).split(',').map(item => item.trim()).filter(Boolean);
}

function fold(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase();
}
