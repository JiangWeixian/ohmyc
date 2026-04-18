import { useRef, useEffect } from 'react';
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import { basicSetup } from 'codemirror';
import { defaultKeymap } from '@codemirror/commands';

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
}

const theme = EditorView.theme({
  '&': {
    fontSize: '13px',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--surface-panel)',
  },
  '&.cm-focused': {
    borderColor: 'var(--accent-blue)',
    boxShadow: '0 0 0 2px rgba(94, 106, 210, 0.18)',
  },
  '.cm-scroller': {
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
  },
  '.cm-content': {
    padding: '12px 0',
    caretColor: 'var(--text-primary)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--surface-panel)',
    borderRight: '1px solid var(--border-default)',
    color: 'var(--text-tertiary)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  '.cm-property': {
    color: 'var(--accent-cyan)',
  },
  '.cm-string': {
    color: 'var(--accent-green)',
  },
  '.cm-number': {
    color: 'var(--accent-amber)',
  },
  '.cm-bool': {
    color: 'var(--accent-purple)',
  },
  '.cm-null': {
    color: 'var(--text-tertiary)',
  },
});

export function JsonEditor({ value, onChange, placeholder, minHeight = '100px' }: JsonEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        keymap.of(defaultKeymap),
        json(),
        oneDark,
        theme,
        EditorView.lineWrapping,
        ...(placeholder ? [cmPlaceholder(placeholder)] : []),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          '.cm-scroller': { minHeight },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only create editor once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentValue = view.state.doc.toString();
    if (currentValue !== value) {
      view.dispatch({
        changes: { from: 0, to: currentValue.length, insert: value },
      });
    }
  }, [value]);

  return <div ref={containerRef} />;
}
