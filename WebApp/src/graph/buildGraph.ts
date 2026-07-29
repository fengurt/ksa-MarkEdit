import type { GraphEdge, GraphNode, NoteFile } from '../types';

export type KnowledgeGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export function buildGraph(files: NoteFile[], limit = 300): KnowledgeGraph {
  const boundedFiles = files.slice(0, Math.min(Math.max(limit, 1), 2_000));
  const nodes = boundedFiles.map(file => ({
    id: file.id,
    path: file.path,
    title: basename(file.path).replace(/\.[^.]+$/, ''),
    category: file.metadata.category,
    tags: file.metadata.tags,
  }));
  const targets = new Map<string, string>();
  for (const node of nodes) {
    for (const key of targetKeys(node.path)) {
      if (!targets.has(key)) {
        targets.set(key, node.id);
      }
    }
  }

  const edges: GraphEdge[] = [];
  const edgeKeys = new Set<string>();
  for (const file of boundedFiles) {
    for (const link of links(file)) {
      const target = targetKeys(link.target).map(key => targets.get(key)).find(Boolean);
      if (!target || target === file.id) {
        continue;
      }
      const key = `${file.id}:${target}:${link.kind}`;
      if (edgeKeys.has(key)) {
        continue;
      }
      edgeKeys.add(key);
      edges.push({ source: file.id, target, kind: link.kind });
    }
  }
  return { nodes, edges };
}

function links(file: NoteFile): Array<{ target: string; kind: 'markdown' | 'wiki' }> {
  const result: Array<{ target: string; kind: 'markdown' | 'wiki' }> = [];
  for (const match of file.content.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/gu)) {
    result.push({ target: match[1]?.trim() ?? '', kind: 'wiki' });
  }

  const directory = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : '';
  for (const match of file.content.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/gu)) {
    const target = decodeURIComponent(match[1] ?? '').split('#')[0] ?? '';
    if (!target || /^[a-z][a-z0-9+.-]*:/iu.test(target)) {
      continue;
    }
    result.push({
      target: normalizePath(directory ? `${directory}/${target}` : target),
      kind: 'markdown',
    });
  }
  return result;
}

function targetKeys(path: string): string[] {
  const clean = normalizePath(path.split('|')[0]?.split('#')[0] ?? '');
  const name = basename(clean);
  const withoutExtension = clean.replace(/\.[^.]+$/, '');
  const stem = name.replace(/\.[^.]+$/, '');
  return [...new Set([clean, withoutExtension, name, stem].map(value => value.normalize('NFKC').toLowerCase()))];
}

function normalizePath(path: string): string {
  const output: string[] = [];
  for (const segment of path.replaceAll('\\', '/').split('/')) {
    if (!segment || segment === '.') {
      continue;
    }
    if (segment === '..') {
      output.pop();
    } else {
      output.push(segment);
    }
  }
  return output.join('/');
}

function basename(path: string): string {
  return path.split('/').at(-1) ?? path;
}
