import { defaultKeymap } from '@codemirror/commands'
import { json } from '@codemirror/lang-json'
import { EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import {
  EditorView,
  keymap,
  placeholder as cmPlaceholder,
} from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { useEffect, useRef } from 'react'

import { claudeUIContainerTheme } from './codemirror-container-theme'

interface JsonEditorProperties {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

const jsonEditorOverlay = EditorView.theme({
  '&': {
    fontSize: '13px',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--surface-panel)',
  },
  '&.cm-focused': {
    borderColor: 'rgba(255,255,255,0.12)',
    boxShadow: 'none',
  },
  '.cm-scroller': {
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
    minHeight: '100px',
  },
  '.cm-content': {
    padding: '12px 0',
    caretColor: 'var(--text-primary)',
    backgroundColor: 'transparent',
  },
}, { dark: true })

export function JsonEditor({ value, onChange, placeholder }: JsonEditorProperties) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  })

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        keymap.of(defaultKeymap),
        json(),
        oneDark,
        claudeUIContainerTheme,
        jsonEditorOverlay,
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
    // Only create editor once on mount; value changes synced below
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

  return <div ref={containerRef} />
}
