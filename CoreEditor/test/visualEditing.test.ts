import { beforeEach, describe, expect, test } from '@jest/globals';
import { EditorSelection } from '@codemirror/state';
import { history, redo, undo } from '../src/@vendor/commands/history';
import { editingState } from '../src/common/store';
import { Config } from '../src/config';
import {
  finishVisualComposition,
  visualEditingExtension,
} from '../src/modules/visualEditing';
import * as editor from './utils/editor';
import { sleep } from './utils/helpers';

describe('visual Markdown editing', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.config = {
      visualEditingMode: true,
    } as Config;
    editingState.compositionEnded = true;
  });

  test('reveals Markdown markers only in the active block without changing source', async () => {
    const source = '# Heading\n\n**bold** and *italic*';
    editor.setUp(source, visualEditingExtension);
    await sleep(50);

    expect(document.body.textContent).toContain('# Heading');
    expect(document.body.textContent).toContain('bold and italic');
    expect(document.body.textContent).not.toContain('**bold**');
    expect(editor.getText()).toBe(source);

    editor.selectRange(source.indexOf('bold'), source.indexOf('bold'));
    await sleep(50);

    expect(document.body.textContent).not.toContain('# Heading');
    expect(document.body.textContent).toContain('**bold** and *italic*');
    expect(editor.getText()).toBe(source);
  });

  test('toggles task widgets with normal undo and redo history', async () => {
    editor.setUp('intro\n\n- [ ] todo', [history(), visualEditingExtension]);
    await sleep(50);

    const checkbox = document.querySelector<HTMLInputElement>('.cm-visual-task');
    expect(checkbox).not.toBeNull();
    checkbox?.click();
    expect(editor.getText()).toBe('intro\n\n- [x] todo');

    undo(window.editor);
    expect(editor.getText()).toBe('intro\n\n- [ ] todo');

    redo(window.editor);
    expect(editor.getText()).toBe('intro\n\n- [x] todo');
  });

  test('renders images and tables as click-to-reveal widgets', async () => {
    const source = [
      'intro',
      '',
      '![alt](image.png)',
      '',
      '| A | B |',
      '|---|---|',
      '| 1 | 2 |',
    ].join('\n');
    editor.setUp(source, visualEditingExtension);
    await sleep(50);

    const image = document.querySelector<HTMLButtonElement>('.cm-visual-image');
    const table = document.querySelector<HTMLElement>('.cm-visual-table');
    expect(image?.querySelector('img')?.src).toContain('image-loader://image.png');
    expect(table?.querySelectorAll('td')).toHaveLength(2);

    image?.click();
    await sleep(50);
    expect(document.body.textContent).toContain('![alt](image.png)');

    document.querySelector<HTMLElement>('.cm-visual-table')?.click();
    await sleep(50);
    expect(document.body.textContent).toContain('| A | B |');
    expect(editor.getText()).toBe(source);
  });

  test('maps decorations without rebuilding during multilingual composition', async () => {
    const source = '# 标题\n\n**texte**';
    editor.setUp(source, visualEditingExtension);
    await sleep(50);
    const insertion = '拼音かなé';
    const position = source.indexOf('texte') + 2;

    expect(document.body.textContent).not.toContain('**texte**');
    editingState.compositionEnded = false;
    window.editor.dispatch({
      changes: {
        from: position,
        insert: insertion,
      },
      selection: EditorSelection.cursor(position + insertion.length),
    });

    expect(document.body.textContent).not.toContain('**te拼音かなéxte**');
    editingState.compositionEnded = true;
    window.config.visualEditingMode = true;
    finishVisualComposition();
    await sleep(50);

    expect(document.body.textContent).toContain('**te拼音かなéxte**');
    expect(editor.getText()).toBe('# 标题\n\n**te拼音かなéxte**');
  });
});
