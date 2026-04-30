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

import { claudeUIContainerTheme } from './codemirror-container-theme'

interface MarkdownEditorProperties {
  value: string
  onChange: (value: string) => void
  onSaveShortcut?: () => void
  placeholder?: string
}

const markdownEditorOverlay = EditorView.theme({
  '&': {
    fontSize: '15px',
    backgroundColor: '#08090a',
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
  },
})

export function MarkdownEditor({
  value,
  onChange,
  onSaveShortcut,
  placeholder,
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
        claudeUIContainerTheme,
        markdownEditorOverlay,
        EditorView.lineWrapping,
        ...(placeholder ? [cmPlaceholder(placeholder)] : []),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString())
          }
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
    /* eslint-disable react-hooks/exhaustive-deps, react/exhaustive-deps, react-hooks-extra/exhaustive-deps, react-naming-convention/exhaustive-deps */
  }, [])
  /* eslint-enable react-hooks/exhaustive-deps, react/exhaustive-deps, react-hooks-extra/exhaustive-deps, react-naming-convention/exhaustive-deps */

  // Sync external value changes
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
