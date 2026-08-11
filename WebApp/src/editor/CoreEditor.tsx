import { createStandaloneMarkdownEditor, type StandaloneEditor } from '@ksamint/core-editor';
import { useEffect, useRef } from 'react';

type CoreEditorProps = {
  value: string;
  readOnly?: boolean;
  onChange: (value: string) => void;
};

export function CoreEditor({ value, readOnly = false, onChange }: CoreEditorProps) {
  const container = useRef<HTMLDivElement>(null);
  const editor = useRef<StandaloneEditor | undefined>(undefined);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!container.current) {
      return undefined;
    }
    editor.current = createStandaloneMarkdownEditor({
      parent: container.current,
      doc: value,
      readOnly,
      onChange: text => onChangeRef.current(text),
    });
    return () => {
      editor.current?.destroy();
      editor.current = undefined;
    };
  }, []);

  useEffect(() => {
    editor.current?.setText(value);
  }, [value]);

  useEffect(() => {
    editor.current?.setReadOnly(readOnly);
  }, [readOnly]);

  return <div className="core-editor" ref={container} />;
}
