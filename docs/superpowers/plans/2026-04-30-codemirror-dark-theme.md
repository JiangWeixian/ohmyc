# CodeMirror Dark Theme Adapter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a shared CodeMirror theme extension that overrides editor chrome (background, borders, selection, tooltips, etc.) to match the app's monochrome dark palette while keeping `oneDark` syntax token colors untouched.

**Architecture:** Extract a shared `claudeUIContainerTheme` extension from `codemirror-container-theme.ts` that overrides all editor UI chrome. Both `JsonEditor` and `MarkdownEditor` import this shared extension plus a thin editor-specific overlay for sizing/border differences. Theme layers stack after `oneDark` so monochrome chrome wins while syntax colors stay colorful.

**Tech Stack:** React, CodeMirror 6, `@codemirror/theme-one-dark`, `@codemirror/view`

---

## File Structure

| File | Responsibility |
|------|--------------|
| `packages/ui/src/components/codemirror-container-theme.ts` | **NEW** — Shared `claudeUIContainerTheme` extension covering all editor chrome (selection, cursor, tooltips, panels, scrollbars, etc.) |
| `packages/ui/src/components/json-editor.tsx` | **REFACTOR** — Remove inline theme object; import shared theme + thin overlay for JSON editor sizing/border |
| `packages/ui/src/components/markdown-editor.tsx` | **REFACTOR** — Remove inline theme object; import shared theme + thin overlay for markdown editor sizing |

---

## Self-Review Checklist (run after writing)

- [ ] Spec coverage: every selector in the design spec table has a task
- [ ] Placeholder scan: no "TBD", "TODO", or "implement later"
- [ ] Type consistency: all imports match existing file patterns
- [ ] Exact paths: every file path is complete and correct

---

### Task 1: Create shared `claudeUIContainerTheme` extension

**Files:**
- Create: `packages/ui/src/components/codemirror-container-theme.ts`

**Context:** This file exports a single `EditorView.theme({...})` extension that overrides all CodeMirror chrome elements to use the monochrome dark palette from DESIGN.md. It is imported by both editors. The extension must be placed **after** `oneDark` in the extensions array so our chrome wins while syntax colors stay colorful.

- [ ] **Step 1: Create the file with the shared theme**

Create `packages/ui/src/components/codemirror-container-theme.ts`:

```typescript
import { EditorView } from '@codemirror/view'

/**
 * Shared CodeMirror theme extension that overrides editor chrome
 * (background, borders, selection, tooltips, panels, scrollbars, etc.)
 * to match the ClaudeUI monochrome dark palette.
 *
 * Place this AFTER `oneDark` in the extensions array so monochrome
 * chrome wins while syntax token colors stay colorful.
 */
export const claudeUIContainerTheme = EditorView.theme({
  // Remove default focus outline; editors handle their own border changes
  '&.cm-focused': {
    outline: 'none',
  },

  // Selection — visible but subdued
  '.cm-selectionBackground': {
    background: 'rgba(255,255,255,0.12)',
  },
  '.cm-selectionBackground *': {
    color: 'var(--text-primary)',
  },

  // Cursor — white
  '.cm-cursor': {
    borderLeftColor: 'var(--text-primary)',
  },

  // Active line — subtle highlight
  '.cm-activeLine': {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },

  // Active line gutter
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(255,255,255,0.04)',
    color: 'var(--text-tertiary)',
  },

  // Matching bracket — underline instead of color
  '.cm-matchingBracket': {
    background: 'rgba(255,255,255,0.06)',
    textDecoration: 'underline 1px solid var(--text-secondary)',
  },

  // Non-matching bracket — gray error state
  '.cm-nonmatchingBracket': {
    background: 'rgba(255,255,255,0.04)',
    textDecoration: 'line-through',
    color: 'var(--text-quaternary)',
  },

  // Search match
  '.cm-searchMatch': {
    background: 'rgba(255,255,255,0.08)',
  },

  // Selected search match
  '.cm-searchMatch-selected': {
    background: 'rgba(255,255,255,0.16)',
  },

  // Tooltip / autocomplete
  '.cm-tooltip': {
    background: '#191a1b',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
  },

  // Autocomplete item hover
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    background: 'rgba(255,255,255,0.04)',
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
    background: '#0f1011',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    color: 'var(--text-secondary)',
  },

  // Panel button
  '.cm-panel button': {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: 'var(--text-secondary)',
    borderRadius: '6px',
  },

  // Panel button hover
  '.cm-panel button:hover': {
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text-primary)',
  },

  // Panel input
  '.cm-panel input': {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.08)',
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
cd packages/ui && npx tsc --noEmit src/components/codemirror-container-theme.ts
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/codemirror-container-theme.ts
git commit -m "feat: add shared CodeMirror monochrome chrome theme extension"
```

---

### Task 2: Refactor `JsonEditor` to use shared theme

**Files:**
- Modify: `packages/ui/src/components/json-editor.tsx`

**Context:** The `JsonEditor` currently has an inline `theme` object (lines 20–64) that mixes chrome styling with token color overrides. We need to:
1. Remove the inline `theme` object entirely
2. Import `claudeUIContainerTheme` from the new shared file
3. Create a thin `jsonEditorOverlay` for editor-specific sizing/border only
4. Keep `oneDark` in the extensions array
5. Remove the blue focus shadow (line 29)
6. Remove token color overrides (`.cm-property`, `.cm-string`, `.cm-number`, `.cm-bool`, `.cm-null`) so `oneDark` provides colorful syntax highlighting

- [ ] **Step 1: Replace the entire `json-editor.tsx` file**

```typescript
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
  minHeight?: string
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
  },
})

export function JsonEditor({ value, onChange, placeholder, minHeight = '100px' }: JsonEditorProperties) {
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
    // Only create editor once on mount
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
```

- [ ] **Step 2: Verify no TypeScript errors**

Run:
```bash
cd packages/ui && npx tsc --noEmit src/components/json-editor.tsx
```

Expected: No errors.

- [ ] **Step 3: Verify no ESLint warnings**

Run:
```bash
cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && npx eslint --config ./eslint.config.mjs packages/ui/src/components/json-editor.tsx
```

Expected: No warnings or errors.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/json-editor.tsx
git commit -m "refactor: JsonEditor uses shared monochrome chrome theme"
```

---

### Task 3: Refactor `MarkdownEditor` to use shared theme

**Files:**
- Modify: `packages/ui/src/components/markdown-editor.tsx`

**Context:** The `MarkdownEditor` currently has an inline `theme` object (lines 22–57) that mixes chrome styling with editor-specific sizing. We need to:
1. Remove the inline `theme` object entirely
2. Import `claudeUIContainerTheme` from the new shared file
3. Create a thin `markdownEditorOverlay` for editor-specific sizing only
4. Keep `oneDark` in the extensions array
5. Remove duplicate chrome styles that are now in the shared theme (e.g., `.cm-focused`, `.cm-activeLineGutter`, `.cm-activeLine`)

- [ ] **Step 1: Replace the entire `markdown-editor.tsx` file**

```typescript
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
  minHeight?: string
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
```

- [ ] **Step 2: Verify no TypeScript errors**

Run:
```bash
cd packages/ui && npx tsc --noEmit src/components/markdown-editor.tsx
```

Expected: No errors.

- [ ] **Step 3: Verify no ESLint warnings**

Run:
```bash
cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && npx eslint --config ./eslint.config.mjs packages/ui/src/components/markdown-editor.tsx
```

Expected: No warnings or errors.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/markdown-editor.tsx
git commit -m "refactor: MarkdownEditor uses shared monochrome chrome theme"
```

---

### Task 4: Run full type-check and lint on all changed files

- [ ] **Step 1: Type-check the entire UI package**

Run:
```bash
cd packages/ui && npx tsc --noEmit
```

Expected: No errors across all files.

- [ ] **Step 2: Run ESLint on all changed files**

Run:
```bash
cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && npx eslint --config ./eslint.config.mjs packages/ui/src/components/codemirror-container-theme.ts packages/ui/src/components/json-editor.tsx packages/ui/src/components/markdown-editor.tsx
```

Expected: No warnings or errors.

- [ ] **Step 3: Commit (if any auto-fixes were applied)**

```bash
git add -A
git commit -m "chore: type-check and lint after CodeMirror theme refactor" || echo "Nothing to commit"
```

---

### Task 5: Visual regression test

**Context:** Automated tests for CodeMirror theme styling are impractical. Visual verification is required. The app must be running to test.

- [ ] **Step 1: Start the dev server**

Run:
```bash
cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && npm run dev
```

Wait for both the CLI server and UI to start (you'll see two processes in the output).

- [ ] **Step 2: Open the app in browser**

Navigate to the URL shown in the dev output (typically `http://localhost:5173` or similar).

- [ ] **Step 3: Test JsonEditor**

1. Navigate to a page that shows the JSON editor (e.g., a settings or config page with JSON input)
2. Click into the JSON editor to focus it
3. **Verify:**
   - [ ] No blue focus ring — border should brighten to `rgba(255,255,255,0.12)` instead
   - [ ] Selection background is gray (`rgba(255,255,255,0.12)`) not blue
   - [ ] Cursor is white
   - [ ] Syntax tokens are colorful (not grayscale) — e.g., JSON keys in oneDark's default blue/green
   - [ ] Active line has subtle highlight
   - [ ] Scrollbar matches app scrollbar (thin, gray thumb)
4. Press `Ctrl+F` (or `Cmd+F`) to open find panel
5. **Verify:**
   - [ ] Find/replace panel uses `#0f1011` background
   - [ ] Panel buttons have ghost style (dark bg, subtle border)

- [ ] **Step 4: Test MarkdownEditor**

1. Navigate to a page that shows the Markdown editor (e.g., editing a profile description)
2. Click into the Markdown editor to focus it
3. **Verify:**
   - [ ] Editor background is `#08090a` (flush with parent)
   - [ ] No border or border-radius — flush with parent surface
   - [ ] Font is Berkeley Mono at 15px
   - [ ] Line numbers are compact and gray
   - [ ] Selection is gray, not blue
   - [ ] Syntax highlighting is colorful (headings, code blocks, etc.)
4. Type `[[` or trigger autocomplete in some way
5. **Verify:**
   - [ ] Autocomplete tooltip uses `#191a1b` background with rounded corners and shadow
   - [ ] Selected item has subtle highlight

- [ ] **Step 5: Commit test results note**

```bash
git commit --allow-empty -m "test: visual regression verified for CodeMirror dark theme"
```

---

## Spec Coverage Check

| Design Spec Requirement | Task |
|------------------------|------|
| Create shared `claudeUIContainerTheme` extension | Task 1 |
| Remove blue focus ring from JsonEditor | Task 2 (`.cm-focused` in overlay removes blue shadow) |
| Remove JsonEditor token color overrides | Task 2 (no `.cm-property`, `.cm-string`, etc. in overlay) |
| JsonEditor specific overlay (border, sizing) | Task 2 |
| MarkdownEditor specific overlay (no border, sizing) | Task 3 |
| Selection background `rgba(255,255,255,0.12)` | Task 1 |
| Cursor `border-left-color: var(--text-primary)` | Task 1 |
| Active line gutter styling | Task 1 |
| Matching bracket underline | Task 1 |
| Tooltip `#191a1b` background | Task 1 |
| Panel `#0f1011` background | Task 1 |
| Scrollbar styling | Task 1 |
| `oneDark` placed before shared theme | Task 2 & 3 (extension ordering) |

---

## Placeholder Scan

- [ ] No "TBD", "TODO", or "implement later" found
- [ ] No vague "add error handling" steps
- [ ] Every step has exact code or exact commands
- [ ] No references to undefined types/functions

---

## Type Consistency Check

- [ ] `claudeUIContainerTheme` is imported from `./codemirror-container-theme` in both editors
- [ ] Overlay names: `jsonEditorOverlay`, `markdownEditorOverlay` — consistent pattern
- [ ] Extension ordering: `oneDark` → `claudeUIContainerTheme` → `editorOverlay` in both editors
- [ ] CSS variable names match DESIGN.md (`--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-quaternary`, `--border-default`, `--border-standard`, `--surface-panel`)
