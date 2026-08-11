export type EditorTextChange = {
  from: number;
  to: number;
  insert: string;
};

export function applyTextChanges(source: string, changes: EditorTextChange[]): string {
  let updatedSource = source;
  for (const change of changes.toReversed()) {
    updatedSource = updatedSource.slice(0, change.from) + change.insert + updatedSource.slice(change.to);
  }
  return updatedSource;
}

export function treeChanges(changes: EditorTextChange[]) {
  let offset = 0;
  return changes.map(change => {
    const fromB = change.from + offset;
    offset += change.insert.length - (change.to - change.from);
    return {
      fromA: change.from,
      toA: change.to,
      fromB,
      toB: fromB + change.insert.length,
    };
  });
}
