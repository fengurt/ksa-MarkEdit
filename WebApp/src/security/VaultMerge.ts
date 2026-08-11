import type { NoteFile } from '../types';

export type WorkspaceMergeResult = {
  files: NoteFile[];
  conflicts: number;
};

export function mergeWorkspaceFiles({
  base,
  local,
  remote,
  remoteLabel = 'remote',
  now = Date.now(),
}: {
  base: NoteFile[];
  local: NoteFile[];
  remote: NoteFile[];
  remoteLabel?: string;
  now?: number;
}): WorkspaceMergeResult {
  const baseById = new Map(base.map(file => [file.id, file]));
  const localById = new Map(local.map(file => [file.id, file]));
  const remoteById = new Map(remote.map(file => [file.id, file]));
  const allIDs = new Set([...baseById.keys(), ...localById.keys(), ...remoteById.keys()]);
  const files: NoteFile[] = [];
  let conflicts = 0;

  for (const id of [...allIDs].sort()) {
    const ancestor = baseById.get(id);
    const ours = localById.get(id);
    const theirs = remoteById.get(id);
    if (!ancestor) {
      if (ours && theirs) {
        if (sameFile(ours, theirs)) {
          files.push(newer(ours, theirs));
        } else {
          files.push(ours, conflictCopy(theirs, remoteLabel, now));
          conflicts += 1;
        }
      } else if (ours || theirs) {
        files.push((ours ?? theirs) as NoteFile);
      }
      continue;
    }

    if (!ours && !theirs) {
      continue;
    }
    if (!ours) {
      if (theirs && sameFile(ancestor, theirs)) {
        continue;
      }
      if (theirs) {
        files.push(conflictCopy(theirs, remoteLabel, now));
        conflicts += 1;
      }
      continue;
    }
    if (!theirs) {
      if (sameFile(ancestor, ours)) {
        continue;
      }
      files.push(conflictCopy(ours, 'local', now));
      conflicts += 1;
      continue;
    }

    const localChanged = !sameFile(ancestor, ours);
    const remoteChanged = !sameFile(ancestor, theirs);
    if (!localChanged) {
      files.push(theirs);
      continue;
    }
    if (!remoteChanged) {
      files.push(ours);
      continue;
    }
    const path = mergeValue(ancestor.path, ours.path, theirs.path);
    const content = mergeMarkdown(ancestor.content, ours.content, theirs.content);
    if (path === undefined || content === undefined) {
      files.push(ours, conflictCopy(theirs, remoteLabel, now));
      conflicts += 1;
      continue;
    }
    files.push({
      ...newer(ours, theirs),
      id,
      path,
      content,
      metadata: ours.metadata,
    });
  }

  const unique: NoteFile[] = [];
  const usedPaths = new Set<string>();
  for (const file of files.sort((left, right) => left.path.localeCompare(right.path))) {
    if (usedPaths.has(file.path)) {
      unique.push(conflictCopy(file, remoteLabel, now, usedPaths));
      conflicts += 1;
    } else {
      usedPaths.add(file.path);
      unique.push(file);
    }
  }
  return { files: unique, conflicts };
}

export function mergeMarkdown(
  base: string,
  local: string,
  remote: string,
): string | undefined {
  if (local === remote) {
    return local;
  }
  if (local === base) {
    return remote;
  }
  if (remote === base) {
    return local;
  }
  const baseLines = lines(base);
  const localChange = contiguousChange(baseLines, lines(local));
  const remoteChange = contiguousChange(baseLines, lines(remote));
  if (changesOverlap(localChange, remoteChange)) {
    return undefined;
  }
  const output = [...baseLines];
  for (const change of [localChange, remoteChange].sort((a, b) => b.start - a.start)) {
    output.splice(change.start, change.end - change.start, ...change.replacement);
  }
  return output.join('');
}

type Change = {
  start: number;
  end: number;
  replacement: string[];
};

function contiguousChange(base: string[], changed: string[]): Change {
  let prefix = 0;
  while (prefix < base.length && prefix < changed.length && base[prefix] === changed[prefix]) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < base.length - prefix
    && suffix < changed.length - prefix
    && base[base.length - suffix - 1] === changed[changed.length - suffix - 1]
  ) {
    suffix += 1;
  }
  return {
    start: prefix,
    end: base.length - suffix,
    replacement: changed.slice(prefix, changed.length - suffix),
  };
}

function changesOverlap(left: Change, right: Change): boolean {
  if (left.start === left.end) {
    return right.start <= left.start && left.start <= right.end;
  }
  if (right.start === right.end) {
    return left.start <= right.start && right.start <= left.end;
  }
  return left.start < right.end && right.start < left.end;
}

function mergeValue(base: string, local: string, remote: string): string | undefined {
  if (local === remote) {
    return local;
  }
  if (local === base) {
    return remote;
  }
  if (remote === base) {
    return local;
  }
  return undefined;
}

function sameFile(left: NoteFile, right: NoteFile): boolean {
  return left.path === right.path && left.content === right.content;
}

function newer(left: NoteFile, right: NoteFile): NoteFile {
  return left.modifiedAt >= right.modifiedAt ? left : right;
}

function conflictCopy(
  file: NoteFile,
  label: string,
  now: number,
  usedPaths?: Set<string>,
): NoteFile {
  let path = conflictPath(file.path, label, now);
  let counter = 2;
  while (usedPaths?.has(path)) {
    path = conflictPath(file.path, `${label} ${counter}`, now);
    counter += 1;
  }
  usedPaths?.add(path);
  return {
    ...file,
    id: crypto.randomUUID(),
    path,
    modifiedAt: Math.max(file.modifiedAt, now),
  };
}

function conflictPath(path: string, label: string, now: number): string {
  const dot = path.lastIndexOf('.');
  const stem = dot > path.lastIndexOf('/') ? path.slice(0, dot) : path;
  const extension = dot > path.lastIndexOf('/') ? path.slice(dot) : '.md';
  const timestamp = new Date(now).toISOString().replaceAll(':', '-').replace('.000Z', 'Z');
  const safeLabel = label.replaceAll(/[^a-z0-9 _-]/giu, '').trim() || 'remote';
  return `${stem} (conflict ${safeLabel} ${timestamp})${extension}`;
}

function lines(value: string): string[] {
  return value.match(/[^\n]*\n|[^\n]+$/gu) ?? [];
}
