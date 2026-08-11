import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.document = {
  head: {
    querySelector: () => undefined,
    append: () => undefined,
  },
  createElement: () => ({ dataset: {} }),
};
globalThis.window = {
  ksamintResource: {
    request: async request => request.method === 'render'
      ? { resourceURL: `ksamint-resource://session/${encodeURIComponent(request.entryID)}` }
      : {},
  },
};

const { testing } = await import('../dist/html-safe/index.js');

test('accepts workspace-relative URLs and blocks active or remote schemes', () => {
  assert.equal(testing.isLocal('./images/图.png'), true);
  assert.equal(testing.isLocal('../outside.png'), true);
  assert.equal(testing.isLocal('https://example.com/a.png'), false);
  assert.equal(testing.isLocal('javascript:alert(1)'), false);
  assert.equal(testing.isLocal('//example.com/a.png'), false);
});

test('removes CSS imports, remote URLs, and legacy expressions', async () => {
  const report = { blockedRequests: 0 };
  const sanitized = await testing.sanitizeCSS(
    '@import "https://x";a{background:url(https://x);width:expression(x)}',
    report
  );
  assert.doesNotMatch(sanitized, /https:|expression|@import/i);
  assert.equal(report.blockedRequests, 2);
});

test('rewrites workspace-local CSS assets through the read-only broker URL', async () => {
  const report = { blockedRequests: 0 };
  const sanitized = await testing.sanitizeCSS('a{background:url(../images/图.png)}', report, 'css');
  assert.match(sanitized, /ksamint-resource:\/\/session\/images%2F%E5%9B%BE\.png/);
  assert.equal(report.blockedRequests, 0);
});
