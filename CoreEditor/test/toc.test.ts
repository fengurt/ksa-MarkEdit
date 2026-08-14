import { describe, expect, test } from '@jest/globals';
import { sleep } from './utils/helpers';
import * as editor from './utils/editor';
import * as toc from '../src/modules/toc';

describe('Table of contents module', () => {
  test('test getting table of contents', async() => {
    editor.setUp('## Hello\n\n- One\n- Two\n- Three\n\n### MarkEdit\n\nHave fun.');
    await sleep(200);
    const results = toc.getTableOfContents();

    expect(results[0].level).toBe(2);
    expect(results[0].title).toBe('Hello');
    expect(results[1].level).toBe(3);
    expect(results[1].title).toBe('MarkEdit');
    expect(results[0].sectionWordCount).toBe(5);
    expect(results[1].sectionWordCount).toBe(2);
    expect(results[0].documentWordCount).toBe(7);
    expect(results[0].directChildCount).toBe(1);
  });

  test('calculates nested section metadata without counting heading titles', async() => {
    editor.setUp('Preface\n\n# Alpha\n\none two\n\n## Beta\n\nthree four five\n\n### Gamma\n\nsix\n\n# Delta\n\nseven eight');
    await sleep(200);
    const results = toc.getTableOfContents();

    expect(results.map(({ sectionWordCount }) => sectionWordCount)).toEqual([6, 4, 1, 2]);
    expect(results.map(({ documentWordCount }) => documentWordCount)).toEqual([13, 13, 13, 13]);
    expect(results.map(({ directChildCount }) => directChildCount)).toEqual([1, 1, 0, 0]);
    expect(results[0].sectionEnd).toBe(results[3].from);
    expect(results[1].sectionEnd).toBe(results[3].from);
    expect(results[2].lineStart).toBe(11);
    expect(results[2].lineEnd).toBe(14);
  });

  test('counts Chinese, Japanese, and accented French content', async() => {
    editor.setUp('# 多语言\n\n中文内容 日本語の文章 café résumé');
    await sleep(200);
    const [heading] = toc.getTableOfContents();

    expect(heading.sectionWordCount).toBeGreaterThanOrEqual(5);
    expect(heading.documentWordCount).toBeGreaterThan(heading.sectionWordCount);
  });

  test('test Setext heading level 1 (===)', async() => {
    editor.setUp('This is title\n=============');
    await sleep(200);
    const results = toc.getTableOfContents();

    expect(results.length).toBe(1);
    expect(results[0].level).toBe(1);
    expect(results[0].title).toBe('This is title');
  });

  test('test Setext heading level 2 (---)', async() => {
    editor.setUp('This is title\n-------------');
    await sleep(200);
    const results = toc.getTableOfContents();

    expect(results.length).toBe(1);
    expect(results[0].level).toBe(2);
    expect(results[0].title).toBe('This is title');
  });

  test('test mixed ATX and Setext headings', async() => {
    editor.setUp('# ATX Level 1\n\nSetext Level 1\n==============\n\n## ATX Level 2\n\nSetext Level 2\n--------------');
    await sleep(200);
    const results = toc.getTableOfContents();

    expect(results.length).toBe(4);
    expect(results[0].level).toBe(1);
    expect(results[0].title).toBe('ATX Level 1');
    expect(results[1].level).toBe(1);
    expect(results[1].title).toBe('Setext Level 1');
    expect(results[2].level).toBe(2);
    expect(results[2].title).toBe('ATX Level 2');
    expect(results[3].level).toBe(2);
    expect(results[3].title).toBe('Setext Level 2');
  });

  test('test edge case - title with leading/trailing whitespace', async() => {
    editor.setUp('  Title with spaces  \n===================');
    await sleep(200);
    const results = toc.getTableOfContents();

    expect(results.length).toBe(1);
    expect(results[0].level).toBe(1);
    expect(results[0].title).toBe('Title with spaces');
  });
});
