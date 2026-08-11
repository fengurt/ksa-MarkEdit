import {
  button,
  element,
  installStyles,
  layout,
  readBatch,
  readAll,
  showMetadata,
  text,
  walkFiles,
} from './runtime.js';
import { load as parseYAML } from './vendor/yaml/index.js';

installStyles('styles.css');

export async function open(resource, root) {
  const controller = new AbortController();
  window.addEventListener('pagehide', () => controller.abort(), { once: true });
  const view = layout(root, resource.displayName);
  view.preview.replaceChildren(element('div', 'empty-state', 'Reading OKF catalog…'));
  const records = [];
  let hasIndex = false;
  let version = 'v0.1/v0.2 compatible';
  const versionBadge = element('span', 'catalog-version', version);
  view.header.append(versionBadge);

  async function select(record) {
    if (record.truncated && !record.loaded) {
      const source = text(await readAll(record.file.id, record.file.byteCount ?? 0, 5 * 1024 * 1024, controller.signal));
      Object.assign(record, parseRecord(record.file, source), { loaded: true, truncated: false });
      buildRelations(records);
    }
    view.preview.replaceChildren(recordView(record));
    showMetadata(view.metadata, {
      ID: record.id,
      Type: record.type,
      Description: record.description,
      Resource: record.resource,
      Trust: record.trust,
      Status: record.status,
      Freshness: record.freshness,
      Generated: record.generated,
      Verified: record.verified,
      Sources: record.sources.length,
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
      view.sidebar.append(button(record.title, () => void select(record), 'list-row'));
    }
  }

  function refresh() {
    buildRelations(records);
    const query = fold(view.search.value);
    renderList(query ? records.filter(record => [record.title, record.id, record.type, ...record.tags]
      .some(value => fold(value).includes(query))) : records);
    if (!view.preview.querySelector('.okf-record') && records[0]) void select(records[0]);
  }

  view.search.addEventListener('input', () => {
    const query = fold(view.search.value);
    renderList(records.filter(record => [record.title, record.id, record.type, ...record.tags]
      .some(value => fold(value).includes(query))));
  });
  async function ingest(files) {
    const indexFile = files.find(file => file.id.toLowerCase() === 'index.md');
    if (indexFile) {
      hasIndex = true;
      if ((indexFile.byteCount ?? 0) <= 1024 * 1024) {
        const indexSource = text(await readAll(
          indexFile.id,
          indexFile.byteCount ?? 0,
          1024 * 1024,
          controller.signal
        ));
        version = parseFrontMatter(indexSource).metadata.okf_version ?? version;
        versionBadge.textContent = String(version);
      }
    }
    const readable = files.filter(file => /\.(?:md|markdown|okf)$/i.test(file.name)
      && !['index.md', 'log.md'].includes(file.name.toLowerCase())
      && (file.byteCount ?? 0) <= 5 * 1024 * 1024);
    for (let offset = 0; offset < readable.length; offset += 16) {
      const batch = readable.slice(offset, offset + 16);
      const results = await readBatch(batch.map(file => ({
        entryID: file.id,
        offset: 0,
        length: Math.min(file.byteCount ?? 0, 256 * 1024),
      })), controller.signal);
      for (const result of results) {
        const file = batch.find(item => item.id === result.entryID);
        if (!file) continue;
        try {
          const record = parseRecord(file, text(result.bytes));
          record.truncated = result.bytes.length < (file.byteCount ?? 0);
          records.push(record);
        } catch (error) {
          records.push(invalidRecord(file, error));
        }
      }
      if (records.length <= 16 || records.length % 256 < 16) {
        refresh();
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
    }
  }

  if (resource.kind === 'file') {
    await ingest([{
      id: resource.displayName,
      name: resource.displayName,
      kind: 'file',
      mediaType: resource.mediaType,
      byteCount: resource.byteCount ?? 0,
      modifiedAt: resource.modifiedAt,
    }]);
  } else {
    await walkFiles(undefined, 50000, controller.signal, ingest);
  }
  refresh();
  if (!records.length) {
    view.preview.replaceChildren(element('div', 'empty-state warning', 'No conformant OKF concepts were found.'));
  }
}

function parseRecord(file, source) {
  const { metadata, body } = parseFrontMatter(source);
  const title = metadata.title ?? metadata.name ?? body.match(/^#\s+(.+)$/m)?.[1] ?? file.name.replace(/\.[^.]+$/, '');
  const links = [];
  for (const match of body.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) links.push(match[1].trim());
  for (const match of body.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) links.push(match[1].trim());
  return {
    file,
    description: String(metadata.description ?? ''),
    resource: String(metadata.resource ?? ''),
    metadata,
    body,
    title: String(title),
    id: String(metadata.id ?? metadata.identifier ?? file.id.replace(/\.md$/i, '')),
    type: String(metadata.type ?? metadata.kind ?? metadata.concept_type ?? 'Concept'),
    trust: trustTier(metadata.verified),
    status: String(metadata.status ?? ''),
    freshness: freshness(metadata.stale_after),
    generated: actorSummary(metadata.generated),
    verified: verifiedSummary(metadata.verified),
    sources: objectArray(metadata.sources),
    tags: arrayValue(metadata.tags ?? metadata.labels),
    links: [...new Set(links)],
    backlinks: [],
    brokenLinks: [],
  };
}

function buildRelations(records) {
  const index = new Map();
  for (const record of records) {
    record.backlinks = [];
    record.brokenLinks = [];
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

function invalidRecord(file, error) {
  return {
    file,
    description: error instanceof Error ? error.message : String(error),
    resource: '',
    metadata: {},
    body: '',
    title: file.name.replace(/\.[^.]+$/, ''),
    id: file.id.replace(/\.md$/i, ''),
    type: 'Invalid OKF record',
    trust: 'unverified',
    status: 'parse-error',
    freshness: 'unknown',
    generated: '',
    verified: '',
    sources: [],
    tags: [],
    links: [],
    backlinks: [],
    brokenLinks: [],
    loaded: true,
    truncated: false,
  };
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
  if (record.sources.length) {
    container.append(relationGroup(
      'Sources',
      record.sources.map(source => source.title ?? source.resource ?? source.id ?? 'Source')
    ));
  }
  if (record.type === 'Attested Computation') {
    const attestation = element('section', 'relation-group warning');
    attestation.append(element('h2', '', 'Attestation (not executed)'));
    attestation.append(element('div', 'relation-row', `Runtime: ${record.metadata.runtime ?? 'unspecified'}`));
    attestation.append(element('div', 'relation-row', `Executor: ${objectSummary(record.metadata.executor)}`));
    attestation.append(element('div', 'relation-row', `Attester: ${objectSummary(record.metadata.attester)}`));
    container.append(attestation);
  }
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

function parseFrontMatter(source) {
  const frontMatter = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  if (!frontMatter) return { metadata: {}, body: source };
  let metadata;
  try {
    metadata = parseYAML(frontMatter[1], { maxAliases: 50, json: false }) ?? {};
  } catch (error) {
    throw new Error(`Invalid OKF YAML: ${error instanceof Error ? error.message : String(error)}`);
  }
  return {
    metadata: metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {},
    body: source.slice(frontMatter[0].length),
  };
}

function arrayValue(value) {
  if (Array.isArray(value)) return value.map(String);
  if (!value) return [];
  return String(value).split(',').map(item => item.trim()).filter(Boolean);
}

function objectArray(value) {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).filter(item => item && typeof item === 'object');
}

function trustTier(value) {
  const verified = objectArray(value);
  if (verified.some(item => String(item.by ?? '').startsWith('human:'))) return 'human-reviewed';
  return verified.length ? 'machine-confirmed' : 'unverified';
}

function freshness(value) {
  if (!value) return 'unspecified';
  const time = Date.parse(String(value));
  return Number.isFinite(time) && time < Date.now() ? 'stale' : 'current';
}

function actorSummary(value) {
  if (!value || typeof value !== 'object') return '';
  return [value.by, value.at].filter(Boolean).join(' · ');
}

function verifiedSummary(value) {
  return objectArray(value).map(actorSummary).filter(Boolean).join(', ');
}

function objectSummary(value) {
  if (!value) return 'not declared';
  if (typeof value !== 'object') return String(value);
  return String(value.resource ?? value.id ?? value.runtime ?? 'declared');
}

function fold(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase();
}

export const testing = Object.freeze({
  buildRelations,
  parseFrontMatter,
  parseRecord,
  trustTier,
});
