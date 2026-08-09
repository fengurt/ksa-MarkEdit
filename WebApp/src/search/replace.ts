import type { NoteFile } from '../types';

export type ReplaceScope = 'current' | 'workspace';

export type ReplaceOptions = {
  find: string;
  replacement: string;
  caseSensitive: boolean;
  regularExpression: boolean;
};

export type ReplaceFileChange = {
  fileId: string;
  path: string;
  sourceModifiedAt: number;
  occurrences: number;
  content: string;
};

export type WorkspaceReplacePlan = {
  options: ReplaceOptions;
  scope: ReplaceScope;
  changes: ReplaceFileChange[];
  occurrenceCount: number;
};

const MAX_OCCURRENCES = 100_000;

export function planWorkspaceReplace(
  files: NoteFile[],
  options: ReplaceOptions,
  scope: ReplaceScope,
  currentFileId?: string,
): WorkspaceReplacePlan {
  if (!options.find) {
    throw new Error('Enter text to replace.');
  }
  const expression = replacementExpression(options);
  if (new RegExp(expression.source, expression.flags.replace('g', '')).test('')) {
    throw new Error('A replace expression cannot match an empty string.');
  }
  const candidates = scope === 'current'
    ? files.filter(file => file.id === currentFileId)
    : files;
  const changes: ReplaceFileChange[] = [];
  let occurrenceCount = 0;

  for (const file of candidates) {
    const matches = [...file.content.matchAll(expression)];
    if (!matches.length) continue;
    occurrenceCount += matches.length;
    if (occurrenceCount > MAX_OCCURRENCES) {
      throw new Error(`Replace is limited to ${MAX_OCCURRENCES.toLocaleString()} matches per operation.`);
    }
    const content = options.regularExpression
      ? file.content.replace(expression, options.replacement)
      : file.content.replace(expression, () => options.replacement);
    changes.push({
      fileId: file.id,
      path: file.path,
      sourceModifiedAt: file.modifiedAt,
      occurrences: matches.length,
      content,
    });
  }

  return { options, scope, changes, occurrenceCount };
}

function replacementExpression(options: ReplaceOptions): RegExp {
  const source = options.regularExpression ? options.find : escapeRegExp(options.find);
  return new RegExp(source, options.caseSensitive ? 'gu' : 'giu');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
