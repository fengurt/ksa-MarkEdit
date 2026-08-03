import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.document = {
  head: {
    querySelector: () => undefined,
    append: () => undefined,
  },
  createElement: () => ({ dataset: {} }),
};

const { testing } = await import('../dist/okf/index.js');

test('parses nested OKF v0.2 provenance without flattening unknown fields', () => {
  const source = `---
type: Attested Computation
title: 检索结果
tags: [研究, français]
sources:
  - title: 原始资料
    resource: ./source.md
generated:
  by: machine:codex
  at: 2026-08-03T12:00:00Z
verified:
  - by: human:af
    at: 2026-08-03T13:00:00Z
custom:
  nested: preserved
---
See [[source]].`;
  const file = { id: '资料/結果.md', name: '結果.md' };
  const record = testing.parseRecord(file, source);
  assert.equal(record.type, 'Attested Computation');
  assert.equal(record.trust, 'human-reviewed');
  assert.equal(record.sources[0].resource, './source.md');
  assert.equal(record.metadata.custom.nested, 'preserved');
  assert.deepEqual(record.tags, ['研究', 'français']);
});

test('relation rebuild is idempotent and reports broken links', () => {
  const left = testing.parseRecord({ id: 'a.md', name: 'a.md' }, '---\ntype: Concept\n---\n[[b]] [[missing]]');
  const right = testing.parseRecord({ id: 'b.md', name: 'b.md' }, '---\ntype: Concept\n---\n# B');
  testing.buildRelations([left, right]);
  testing.buildRelations([left, right]);
  assert.equal(right.backlinks.length, 1);
  assert.deepEqual(left.brokenLinks, ['missing']);
});

test('rejects YAML alias expansion beyond the bounded parser limit', () => {
  const aliases = Array.from({ length: 51 }, () => '*shared').join(', ');
  assert.throws(
    () => testing.parseFrontMatter(`---\nshared: &shared value\nitems: [${aliases}]\n---\n`),
    /aliases exceeded|maxAliases/i
  );
});
