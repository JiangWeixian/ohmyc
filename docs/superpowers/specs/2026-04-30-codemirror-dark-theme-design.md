# CodeMirror Dark Theme Adapter — Design Spec

## Context

The project (ClaudeUI) uses a **monochrome dark** design system (see `DESIGN.md`). Two CodeMirror 6 editors are in use:

- `MarkdownEditor` (`packages/ui/src/components/markdown-editor.tsx`) — large editing surface for profile descriptions/settings
- `JsonEditor` (`packages/ui/src/components/json-editor.tsx`) — compact JSON input for runtime config, hooks, MCP/LSP servers

Both currently import `@codemirror/theme-one-dark` for syntax highlighting. The user wants to **keep the colorful syntax highlighting** from `oneDark` but **adapt the editor chrome** (background, borders, selection, tooltips, etc.) to match the app's monochrome dark style.

## Goal

Create a shared, reusable CodeMirror theme extension that overrides all editor UI chrome to use DESIGN.md's monochrome palette, while leaving syntax token colors untouched.

## Non-Goals

- Do NOT create a custom syntax highlighting theme (keep `oneDark` for token colors)
- Do NOT add a light mode toggle (app is dark-only per DESIGN.md)
- Do NOT change editor behavior or keybindings

## Design

### Architecture

```
┌─────────────────────────────────────┐
│  packages/ui/src/components/        │
│  ├── codemirror-container-theme.ts  │  ← NEW: shared chrome theme
│  ├── markdown-editor.tsx            │  ← REFACTOR: import shared theme
│  └── json-editor.tsx                │  ← REFACTOR: import shared theme
└─────────────────────────────────────┘
```

### Shared Extension: `claudeUIContainerTheme`

A single `EditorView.theme({...})` extension exported from `codemirror-container-theme.ts`.

It covers all editor chrome elements that oneDark styles by default, re-mapping them to the monochrome palette:

| Element | Selector | Value | Rationale |
|---------|----------|-------|-----------|
| **Editor background** | `&` | inherited from parent / component overlay | Component-level concern |
| **Focus outline** | `&.cm-focused` | `outline: none` | Remove default blue ring; use border change instead |
| **Selection background** | `.cm-selectionBackground` | `rgba(255,255,255,0.12)` | Visible but subdued |
| **Selection text** | `.cm-selectionBackground *` | `color: var(--text-primary)` | Ensure contrast |
| **Cursor** | `.cm-cursor` | `border-left-color: var(--text-primary)` | White cursor |
| **Active line** | `.cm-activeLine` | `background-color: rgba(255,255,255,0.03)` | Subtle highlight |
| **Active line gutter** | `.cm-activeLineGutter` | `background-color: rgba(255,255,255,0.04); color: var(--text-tertiary)` | Match existing |
| **Matching bracket** | `.cm-matchingBracket` | `background: rgba(255,255,255,0.06); text-decoration: underline 1px solid var(--text-secondary)` | Visible without color |
| **Non-matching bracket** | `.cm-nonmatchingBracket` | `background: rgba(255,255,255,0.04); text-decoration: line-through; color: var(--text-quaternary)` | Gray error state |
| **Search match** | `.cm-searchMatch` | `background: rgba(255,255,255,0.08)` | Subtle highlight |
| **Selected search match** | `.cm-searchMatch-selected` | `background: rgba(255,255,255,0.16)` | Stronger highlight |
| **Tooltip / autocomplete** | `.cm-tooltip` | `background: #191a1b; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; box-shadow: 0 16px 40px rgba(0,0,0,0.4)` | Surface elevation per DESIGN.md |
| **Autocomplete item hover** | `.cm-tooltip-autocomplete > ul > li[aria-selected]` | `background: rgba(255,255,255,0.04); color: var(--text-primary)` | Subtle selection |
| **Autocomplete item** | `.cm-tooltip-autocomplete > ul > li` | `color: var(--text-secondary)` | Match body text |
| **Completion icon** | `.cm-completionIcon` | `opacity: 0.7` | De-emphasize |
| **Completion label** | `.cm-completionLabel` | `color: var(--text-primary)` | Emphasize |
| **Completion detail** | `.cm-completionDetail` | `color: var(--text-tertiary); font-size: 12px` | Metadata style |
| **Panel (find/replace)** | `.cm-panel` | `background: #0f1011; border-top: 1px solid rgba(255,255,255,0.08); color: var(--text-secondary)` | Panel elevation |
| **Panel button** | `.cm-panel button` | `background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); color: var(--text-secondary); border-radius: 6px` | Ghost button style |
| **Panel button hover** | `.cm-panel button:hover` | `background: rgba(255,255,255,0.04); color: var(--text-primary)` | Hover lift |
| **Panel input** | `.cm-panel input` | `background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); color: var(--text-primary); border-radius: 6px` | Match app inputs |
| **Placeholder** | `.cm-placeholder` | `color: var(--text-quaternary); font-style: italic` | Subdued placeholder |
| **Gutters** | `.cm-gutters` | `background: transparent; border-right: none` | Clean, minimal |
| **Line number** | `.cm-lineNumbers .cm-gutterElement` | `color: var(--text-quaternary); font-size: 12px; padding: 0 14px 0 14px; min-width: 32px` | Compact gutter |
| **Scrollbar** | `.cm-scroller::-webkit-scrollbar` | `width: 8px` | Match app scrollbar |
| **Scrollbar thumb** | `.cm-scroller::-webkit-scrollbar-thumb` | `background: var(--border-standard); border-radius: 9999px` | Match app scrollbar |
| **Scrollbar thumb hover** | `.cm-scroller::-webkit-scrollbar-thumb:hover` | `background: var(--border-primary)` | Match app scrollbar |

### Editor-Specific Overlays

Each editor applies the shared theme **plus** its own overlay for container-specific styling:

**MarkdownEditor overlay:**
- `&`: `fontSize: '15px'`
- `.cm-scroller`: `fontFamily: 'Berkeley Mono', ui-monospace, ...`, `lineHeight: '1.6'`, `minHeight: '480px'`
- `.cm-content`: `padding: '18px 0'`
- No border, no border-radius — flush with parent surface

**JsonEditor overlay:**
- `&`: `fontSize: '13px'`, `border: '1px solid var(--border-default)'`, `borderRadius: 'var(--radius-sm)'`, `backgroundColor: 'var(--surface-panel)'`
- `&.cm-focused`: `borderColor: 'rgba(255,255,255,0.12)'`, `boxShadow: 'none'` — **remove existing blue focus ring**
- `.cm-scroller`: `minHeight: '100px'`
- `.cm-content`: `padding: '12px 0'`

### Extension Ordering

In each editor's `EditorState.create({ extensions: [...] })`:

```
[
  // Language + core extensions
  lineNumbers(),        // or basicSetup for JsonEditor
  keymap.of(defaultKeymap),
  json(),               // or markdown(), yaml()
  
  // Theme layers (later layers override earlier)
  oneDark,              // base: colorful syntax tokens
  claudeUIContainerTheme, // override: monochrome chrome
  editorSpecificOverlay,  // override: container sizing/border
  
  // Functional extensions
  EditorView.lineWrapping,
  EditorView.updateListener.of(...),
]
```

Because CodeMirror themes are cumulative and later extensions override earlier ones, placing `claudeUIContainerTheme` **after** `oneDark` ensures our monochrome chrome wins while keeping `oneDark`'s syntax colors.

## Refactoring Plan

### Step 1: Create shared theme

Create `packages/ui/src/components/codemirror-container-theme.ts` with the `claudeUIContainerTheme` extension.

### Step 2: Refactor MarkdownEditor

- Remove inline theme object (lines 22–57)
- Import `claudeUIContainerTheme`
- Replace inline theme with shared extension + thin overlay for MarkdownEditor-specific styles
- Keep `oneDark` in the extensions array

### Step 3: Refactor JsonEditor

- Remove inline theme object (lines 20–64)
- Import `claudeUIContainerTheme`
- Replace inline theme with shared extension + thin overlay for JsonEditor-specific styles
- Keep `oneDark` and `basicSetup`
- **Remove blue focus shadow** (line 29: `boxShadow: '0 0 0 2px rgba(94, 106, 210, 0.18)'`)

## Token Color Audit

The existing `json-editor.tsx` maps some JSON tokens to CSS variables that are already grayscale aliases:

```css
--accent-blue: #f7f8f8;   /* white */
--accent-green: #d0d6e0;  /* light gray */
--accent-amber: #8a8f98;  /* mid gray */
--accent-cyan: #8a8f98;   /* mid gray */
--accent-purple: #8a8f98; /* mid gray */
```

Because the user chose to **keep colorful syntax highlighting**, these grayscale overrides in `json-editor.tsx` are **in conflict** with the goal. After this refactor:

- Remove the `.cm-property`, `.cm-string`, `.cm-number`, `.cm-bool`, `.cm-null` overrides from JsonEditor's overlay
- Let `oneDark` provide its default colors for these tokens
- If the user later wants monochrome JSON tokens, that becomes a separate syntax-theme task

## Testing Strategy

- **Visual regression**: Open both editors in the app and verify:
  - No blue focus ring on JsonEditor
  - Selection is gray, not blue
  - Autocomplete/tooltips use `#191a1b` background
  - Matching brackets show underline, not colored background
  - Scrollbar matches app scrollbar
- **Functional**: Ensure `basicSetup` features (search, bracket matching, etc.) still work
- **Lint**: Run `eslint` and `tsc` after refactoring

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| `basicSetup` in JsonEditor bundles its own theme layers that may conflict | Test thoroughly; `claudeUIContainerTheme` placed after `basicSetup` and `oneDark` should override |
| Removing JsonEditor's token color overrides may surprise user | User explicitly chose to keep colorful highlighting; these overrides were already grayscale anyway |
| Scrollbar pseudo-element styles may not apply inside shadow DOM / CM scroller | Test in browser; fallback to standard scrollbar if needed |

## Decisions

| Decision | Rationale |
|----------|-----------|
| Keep `oneDark` for syntax colors | User explicitly chose this option |
| Extract shared chrome theme | DRY, consistent across editors, easy to extend |
| Remove blue focus ring from JsonEditor | DESIGN.md forbids chromatic colors; use border brightening instead |
| Remove JsonEditor's grayscale token overrides | User wants colorful syntax highlighting; these overrides were neutralizing it |

## Files Changed

- `packages/ui/src/components/codemirror-container-theme.ts` — **new**
- `packages/ui/src/components/markdown-editor.tsx` — **refactor**
- `packages/ui/src/components/json-editor.tsx` — **refactor**
