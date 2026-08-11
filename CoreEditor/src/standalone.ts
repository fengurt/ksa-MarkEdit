import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import {
  bracketMatching,
  defaultHighlightStyle,
  syntaxHighlighting,
} from '@codemirror/language';
import { markdown } from '@codemirror/lang-markdown';
import { Compartment, EditorState } from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';

export type StandaloneEditorOptions = {
  parent: HTMLElement;
  doc: string;
  readOnly?: boolean;
  onChange?: (text: string) => void;
};

export type StandaloneEditor = {
  view: EditorView;
  getText: () => string;
  setText: (text: string) => void;
  setReadOnly: (readOnly: boolean) => void;
  focus: () => void;
  destroy: () => void;
};

export function createStandaloneMarkdownEditor(
  options: StandaloneEditorOptions,
): StandaloneEditor {
  const readOnly = new Compartment();
  const view = new EditorView({
    parent: options.parent,
    state: EditorState.create({
      doc: options.doc,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        history(),
        drawSelection(),
        highlightActiveLine(),
        bracketMatching(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        markdown(),
        EditorView.lineWrapping,
        keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
        readOnly.of(EditorState.readOnly.of(options.readOnly ?? false)),
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            options.onChange?.(update.state.doc.toString());
          }
        }),
      ],
    }),
  });

  return {
    view,
    getText: () => view.state.doc.toString(),
    setText: text => {
      const current = view.state.doc.toString();
      if (current === text) {
        return;
      }
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
      });
    },
    setReadOnly: value => {
      view.dispatch({
        effects: readOnly.reconfigure(EditorState.readOnly.of(value)),
      });
    },
    focus: () => view.focus(),
    destroy: () => view.destroy(),
  };
}
