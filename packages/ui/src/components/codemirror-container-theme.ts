import { EditorView } from '@codemirror/view'

/**
 * Shared CodeMirror theme extension that overrides editor chrome
 * (background, borders, selection, tooltips, panels, scrollbars, etc.)
 * to match the OhMyC monochrome dark palette.
 *
 * Place this AFTER `oneDark` in the extensions array so monochrome
 * chrome wins while syntax token colors stay colorful.
 */
export const ohmycContainerTheme = EditorView.theme({
  // Remove default focus outline; editors handle their own border changes
  '&.cm-focused': {
    outline: 'none',
  },

  // Selection — visible but subdued
  '.cm-selectionBackground': {
    background: 'var(--border-hover)',
  },

  // Cursor — white
  '.cm-cursor': {
    borderLeftColor: 'var(--text-primary)',
  },

  // Active line — subtle highlight
  '.cm-activeLine': {
    backgroundColor: 'var(--bg-hover)',
  },

  // Active line gutter
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--bg-hover)',
    color: 'var(--text-tertiary)',
  },

  // Matching bracket — underline instead of color
  '.cm-matchingBracket': {
    background: 'var(--bg-hover)',
    textDecoration: 'underline 1px solid var(--text-secondary)',
  },

  // Non-matching bracket — gray error state
  '.cm-nonmatchingBracket': {
    background: 'var(--bg-hover)',
    textDecoration: 'line-through',
    color: 'var(--text-quaternary)',
  },

  // Search match
  '.cm-searchMatch': {
    background: 'var(--bg-hover)',
  },

  // Selected search match
  '.cm-searchMatch-selected': {
    background: 'var(--border-hover)',
  },

  // Tooltip / autocomplete
  '.cm-tooltip': {
    background: 'var(--surface-raised)',
    border: '1px solid var(--border-standard)',
    borderRadius: '8px',
    boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
  },

  // Autocomplete item hover
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    background: 'var(--bg-hover)',
    color: 'var(--text-primary)',
  },

  // Autocomplete item
  '.cm-tooltip-autocomplete > ul > li': {
    color: 'var(--text-secondary)',
  },

  // Completion icon
  '.cm-completionIcon': {
    opacity: '0.7',
  },

  // Completion label
  '.cm-completionLabel': {
    color: 'var(--text-primary)',
  },

  // Completion detail
  '.cm-completionDetail': {
    color: 'var(--text-tertiary)',
    fontSize: '12px',
  },

  // Panel (find/replace)
  '.cm-panel': {
    background: 'var(--bg-panel)',
    borderTop: '1px solid var(--border-standard)',
    color: 'var(--text-secondary)',
  },

  // Panel button
  '.cm-panel button': {
    background: 'var(--surface-raised)',
    border: '1px solid var(--border-standard)',
    color: 'var(--text-secondary)',
    borderRadius: '6px',
  },

  // Panel button hover
  '.cm-panel button:hover': {
    background: 'var(--bg-hover)',
    color: 'var(--text-primary)',
  },

  // Panel input
  '.cm-panel input': {
    background: 'var(--surface-raised)',
    border: '1px solid var(--border-standard)',
    color: 'var(--text-primary)',
    borderRadius: '6px',
  },

  // Placeholder
  '.cm-placeholder': {
    color: 'var(--text-quaternary)',
    fontStyle: 'italic',
  },

  // Gutters — clean, minimal
  '.cm-gutters': {
    background: 'transparent',
    borderRight: 'none',
  },

  // Line number
  '.cm-lineNumbers .cm-gutterElement': {
    color: 'var(--text-quaternary)',
    fontSize: '12px',
    padding: '0 14px 0 14px',
    minWidth: '32px',
  },

  // Scrollbar
  '.cm-scroller::-webkit-scrollbar': {
    width: '8px',
  },

  // Scrollbar thumb
  '.cm-scroller::-webkit-scrollbar-thumb': {
    background: 'var(--border-standard)',
    borderRadius: '9999px',
  },

  // Scrollbar thumb hover
  '.cm-scroller::-webkit-scrollbar-thumb:hover': {
    background: 'var(--border-primary)',
  },
})
