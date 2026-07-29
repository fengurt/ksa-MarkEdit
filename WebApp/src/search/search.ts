import { canonicalTag } from '../markdown/metadata';
import type { NoteFile, SearchHit } from '../types';

type QueryGroup = {
  text: string[];
  excluded: string[];
  tags: string[];
  categories: string[];
  paths: string[];
  regex: RegExp[];
};

export function searchNotes(files: NoteFile[], input: string, limit = 500): SearchHit[] {
  const groups = parseQuery(input);
  const hits: SearchHit[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    for (const group of groups) {
      if (!matches(file, group)) {
        continue;
      }
      const terms = group.text.length ? group.text : [''];
      const lines = file.content.split(/\r?\n/);
      const indexes = lines
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => !terms[0] || terms.some(term => fold(line).includes(fold(term))));
      const matchingLines = indexes.length ? indexes : [{ line: lines[0] ?? '', index: 0 }];
      for (const match of matchingLines) {
        const key = `${file.id}:${match.index}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        hits.push({
          fileId: file.id,
          path: file.path,
          line: match.index + 1,
          snippet: match.line.trim(),
        });
        if (hits.length >= limit) {
          return hits;
        }
      }
    }
  }
  return hits;
}

function parseQuery(input: string): QueryGroup[] {
  const groups: QueryGroup[] = [emptyGroup()];
  for (const token of tokens(input.trim())) {
    if (token.toUpperCase() === 'OR') {
      groups.push(emptyGroup());
      continue;
    }
    if (token.toUpperCase() === 'AND') {
      continue;
    }
    const group = groups.at(-1) ?? emptyGroup();
    const excluded = token.startsWith('-');
    const value = excluded ? token.slice(1) : token;
    const separator = value.indexOf(':');
    const key = separator > 0 ? value.slice(0, separator).toLowerCase() : '';
    const fieldValue = unquote(separator > 0 ? value.slice(separator + 1) : value);

    if (key === 'tag') {
      group.tags.push(canonicalTag(fieldValue));
    } else if (key === 'category') {
      group.categories.push(fold(fieldValue));
    } else if (key === 'path') {
      group.paths.push(fold(fieldValue));
    } else if (key === 'regex' || /^\/.+\/[a-z]*$/i.test(fieldValue)) {
      const expression = regularExpression(fieldValue);
      if (expression) {
        group.regex.push(expression);
      }
    } else if (excluded) {
      group.excluded.push(fieldValue);
    } else if (fieldValue) {
      group.text.push(fieldValue);
    }
  }
  return groups.filter(group => Object.values(group).some(values => values.length));
}

function matches(file: NoteFile, group: QueryGroup): boolean {
  const searchable = fold(`${file.path}\n${file.content}`);
  const category = file.metadata.category ? fold(file.metadata.category) : '';
  const tags = new Set(file.metadata.tags.map(canonicalTag));
  return group.text.every(value => searchable.includes(fold(value)))
    && group.excluded.every(value => !searchable.includes(fold(value)))
    && group.tags.every(tag => tags.has(tag))
    && group.categories.every(value => category === value || category.startsWith(`${value}/`))
    && group.paths.every(value => fold(file.path).includes(value))
    && group.regex.every(expression => expression.test(`${file.path}\n${file.content}`));
}

function emptyGroup(): QueryGroup {
  return { text: [], excluded: [], tags: [], categories: [], paths: [], regex: [] };
}

function tokens(input: string): string[] {
  const result: string[] = [];
  let quote = '';
  let buffer = '';
  for (const character of input) {
    if ((character === '"' || character === "'") && !quote) {
      quote = character;
      buffer += character;
    } else if (character === quote) {
      quote = '';
      buffer += character;
    } else if (/\s/.test(character) && !quote) {
      if (buffer) {
        result.push(buffer);
        buffer = '';
      }
    } else {
      buffer += character;
    }
  }
  if (buffer) {
    result.push(buffer);
  }
  return result;
}

function unquote(value: string): string {
  return value.length >= 2
    && ((value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'")))
    ? value.slice(1, -1)
    : value;
}

function regularExpression(value: string): RegExp | undefined {
  try {
    if (!value.startsWith('/')) {
      return new RegExp(value, 'u');
    }
    const closing = value.lastIndexOf('/');
    return new RegExp(value.slice(1, closing), value.slice(closing + 1).replace('g', ''));
  } catch {
    return undefined;
  }
}

function fold(value: string): string {
  return value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('und');
}
