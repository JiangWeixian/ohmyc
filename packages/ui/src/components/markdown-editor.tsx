import { defaultKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { yaml } from '@codemirror/lang-yaml'
import { EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import {
  EditorView,
  keymap,
  lineNumbers,
  placeholder as cmPlaceholder,
} from '@codemirror/view'
import { useEffect, useRef } from 'react'

interface MarkdownEditorProperties {
  value: string
  onChange: (value: string) => void
  onSaveShortcut?: () => void
  placeholder?: string
  minHeight?: string
}

const theme = EditorView.theme({
  '&': {
    fontSize: '15px',
    backgroundColor: '#08090a',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    fontFamily: '"Berkeley Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
    lineHeight: '1.6',
  },
  '.cm-content': {
    padding: '18px 0',
    caretColor: 'var(--text-primary)',
    color: 'var(--text-primary)',
  },
  '.cm-gutters': {
    backgroundColor: '#08090a',
    border: 'none',
    color: 'var(--text-quaternary)',
    fontSize: '12px',
    paddingRight: '14px',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    minWidth: '32px',
    padding: '0 0 0 14px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(255,255,255,0.04)',
    color: 'var(--text-tertiary)',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
})

export function MarkdownEditor({
  value,
  onChange,
  onSaveShortcut,
  placeholder,
  minHeight = '480px',
}: MarkdownEditorProperties) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onSaveRef = useRef(onSaveShortcut)

  useEffect(() => {
    onChangeRef.current = onChange
    onSaveRef.current = onSaveShortcut
  })

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const saveKeymap = keymap.of([
      {
        key: 'Mod-s',
        run: () => {
          onSaveRef.current?.()
          return true
        },
      },
    ])

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        keymap.of(defaultKeymap),
        saveKeymap,
        markdown({ addKeymap: false }),
        // Lightweight YAML highlight inside frontmatter — markdown lang already
        // detects fenced frontmatter; we attach a base yaml() pass for keys/values.
        yaml(),
        oneDark,
        theme,
        EditorView.lineWrapping,
        ...(placeholder ? [cmPlaceholder(placeholder)] : []),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString())
          }
        }),
        EditorView.theme({
          '.cm-scroller': { minHeight },
        }),
      ],
    })

    const view = new EditorView({
      state,
      parent: containerRef.current,
    })

    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) {
      return
    }
    const currentValue = view.state.doc.toString()
    if (currentValue !== value) {
      view.dispatch({
        changes: { from: 0, to: currentValue.length, insert: value },
      })
    }
  }, [value])

  return <div ref={containerRef} data-testid="markdown-editor" />
}
