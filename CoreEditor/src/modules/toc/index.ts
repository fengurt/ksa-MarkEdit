import { KeyBinding } from '@codemirror/view';
import { EditorSelection, Text } from '@codemirror/state';
import { HeadingInfo } from './types';
import { getSyntaxTree } from '../lezer';
import { scrollToSelection } from '../selection';
import { saveGoBackSelection } from '../selection/navigate';
import selectWithRanges from '../selection/selectWithRanges';

// Ctrl-Mod-Arrow to navigate sections, Alt-Mod-Arrow conflicts with adding carets
export const tocKeymap: KeyBinding[] = [
  {
    key: 'Ctrl-Mod-ArrowUp',
    preventDefault: true,
    run: () => {
      selectPreviousSection();
      return true;
    },
  },
  {
    key: 'Ctrl-Mod-ArrowDown',
    preventDefault: true,
    run: () => {
      selectNextSection();
      return true;
    },
  },
];

let cachedWordDocument: Text | undefined;
let cachedWordPositions: number[] = [];

export function getTableOfContents() {
  const editor = window.editor;
  const state = editor.state;
  const results: HeadingInfo[] = [];

  getSyntaxTree(state).iterate({
    from: 0, to: state.doc.length,
    enter: node => {
      // Detect both ATXHeading and SetextHeading
      const match = /^(?:ATX|Setext)Heading(\d)$/.exec(node.name);
      if (match === null) {
        return;
      }

      const title = (() => {
        const isSetext = node.name.startsWith('SetextHeading');
        const text = state.sliceDoc(node.from, node.to);

        if (isSetext) {
          // SetextHeading has a line break
          return text.split(state.lineBreak)[0].trim();
        } else {
          // ATXHeading can have up to 3 leading spaces and arbitrary number of spaces between # and visible characters,
          // example of a valid section header: "   #  Hello"
          return text.replace(/ {0,3}#+ +/, '');
        }
      })();

      results.push({
        title: title.length > 64 ? title.substring(0, 64) + '...' : title,
        level: parseInt(match[1]) as CodeGen_Int,
        from: node.from as CodeGen_Int,
        to: node.to as CodeGen_Int,
        selected: false,
        sectionEnd: state.doc.length as CodeGen_Int,
        sectionWordCount: 0 as CodeGen_Int,
        documentWordCount: 0 as CodeGen_Int,
        lineStart: state.doc.lineAt(node.from).number as CodeGen_Int,
        lineEnd: state.doc.lines as CodeGen_Int,
        directChildCount: 0 as CodeGen_Int,
      });
    },
  });

  for (let index = 0; index < results.length; ++index) {
    const item = results[index];
    const next = results[index + 1] as HeadingInfo | undefined;

    // Mark an item as selected if the main selection is between the current item and the next item
    const selection = state.selection.main.head;
    item.selected = selection >= item.from && selection < (next?.from ?? Number.MAX_SAFE_INTEGER);

  }

  if (results.length === 0) {
    return results;
  }

  const sectionEndIndices = Array.from({ length: results.length }, () => results.length);
  const parentStack: number[] = [];
  for (let index = 0; index < results.length; ++index) {
    while (parentStack.length > 0 && results[parentStack[parentStack.length - 1]].level >= results[index].level) {
      const completedIndex = parentStack.pop() as number;
      results[completedIndex].sectionEnd = results[index].from;
      sectionEndIndices[completedIndex] = index;
    }
    if (parentStack.length > 0) {
      const parentIndex = parentStack[parentStack.length - 1];
      results[parentIndex].directChildCount = (results[parentIndex].directChildCount + 1) as CodeGen_Int;
    }
    parentStack.push(index);
  }

  const wordPositions = getWordPositions(state.doc);
  const headingWordPrefix = [0];
  for (const heading of results) {
    const count = lowerBound(wordPositions, heading.to) - lowerBound(wordPositions, heading.from);
    headingWordPrefix.push(headingWordPrefix[headingWordPrefix.length - 1] + count);
  }
  const documentWordCount = wordPositions.length;

  for (let index = 0; index < results.length; ++index) {
    const item = results[index];
    const rawSectionWords = lowerBound(wordPositions, item.sectionEnd) - lowerBound(wordPositions, item.to);
    const nestedHeadingWords = headingWordPrefix[sectionEndIndices[index]] - headingWordPrefix[index + 1];
    item.documentWordCount = documentWordCount as CodeGen_Int;
    item.sectionWordCount = (rawSectionWords - nestedHeadingWords) as CodeGen_Int;
    item.lineEnd = state.doc.lineAt(Math.max(item.to, item.sectionEnd) - 1).number as CodeGen_Int;
  }

  return results;
}

function getWordPositions(document: Text) {
  if (cachedWordDocument === document) {
    return cachedWordPositions;
  }

  cachedWordDocument = document;
  cachedWordPositions = [];
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });

  for (const segment of segmenter.segment(document.toString())) {
    if (segment.isWordLike === true) {
      cachedWordPositions.push(segment.index);
    }
  }
  return cachedWordPositions;
}

function lowerBound(values: number[], target: number) {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (values[middle] < target) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}

export function getLinkAnchor(title: string) {
  return title
    .normalize('NFKD')
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s\-_]/gu, '')
    .replace(/\s+/g, '-');
}

export function selectPreviousSection() {
  const toc = getTableOfContents();
  const index = Math.max(0, toc.findIndex(info => info.selected) - 1);
  gotoHeader(toc[index]);
}

export function selectNextSection() {
  const toc = getTableOfContents();
  const index = Math.min(toc.length - 1, toc.findIndex(info => info.selected) + 1);
  gotoHeader(toc[index]);
}

export function gotoHeader(headingInfo: HeadingInfo) {
  saveGoBackSelection();
  selectWithRanges([EditorSelection.cursor(headingInfo.from)]);
  scrollToSelection(window.config.typewriterMode ? 'center' : 'start');
}

export type { HeadingInfo };
