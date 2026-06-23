# Phase 2 — Theme Tokens, Base Components & Storybook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the five-theme + calm/expressive system as CSS variables, a custom dual-dimension ThemeProvider, self-hosted font loading, Tailwind decoration utilities, a dedicated theme-commands hook for ⌘K, and Storybook coverage — so all nine base components render correctly across every theme × intensity combination.

**Architecture:** `[data-theme]` and `[data-intensity]` attributes on `<html>` drive CSS variable swaps (instant, zero JS re-render). Components already consume shadcn semantic tokens, so most need zero code changes. A custom ~60-line ThemeProvider manages both dimensions + localStorage persistence. Theme commands are extracted into a `useThemeCommands` hook (not inlined in app.tsx). Fonts are self-hosted via `@fontsource` (offline Tauri support) and dynamically imported per theme.

**Tech Stack:** React 19, Vite, Tailwind CSS 3, shadcn/Radix, cmdk, vitest, Storybook 10, `@fontsource/*`.

**Depends on:** Phase 1 (`docs/superpowers/plans/2026-06-23-theme-docs-rewrite.md`) must land first.

**Blocks:** Phase 3 (apply themes to full routes) is a separate future plan.

---

## File Structure

- Modify: `packages/ui/package.json` — add 9 `@fontsource` deps
- Modify: `packages/ui/src/globals.css` — token vocabulary, 5 theme blocks, intensity override, decoration overlays
- Modify: `packages/ui/tailwind.config.mjs` — decoration plugin, darkMode resolution
- Create: `packages/ui/src/theme/registry.ts` — theme ID/type definitions + metadata
- Create: `packages/ui/src/theme/theme-provider.tsx` — dual-dimension context + `useTheme`
- Create: `packages/ui/src/theme/font-loader.ts` — per-theme dynamic `@fontsource` import
- Create: `packages/ui/src/theme/use-theme-commands.tsx` — hook returning theme + intensity `CommandItem[]`
- Create: `packages/ui/src/theme/index.ts` — barrel export
- Modify: `packages/ui/src/main.tsx` — mount `<ThemeProvider>`
- Modify: `packages/ui/src/app.tsx` — spread `useThemeCommands()` into the palette commands
- Modify: `packages/ui/src/components/ui/card.tsx` — add optional `decorated` prop
- Modify: `packages/ui/.storybook/preview.tsx` — theme globalTypes + decorator
- Create: `packages/ui/src/stories/design-system/ThemesShowcase.stories.tsx` — one-page comparison
- Create: `packages/ui/src/tests/theme/theme-provider.test.tsx` — ThemeProvider tests
- Create: `packages/ui/src/tests/theme/font-loader.test.ts` — font loader tests

---

### Task 1: Add @fontsource dependencies

**Files:**
- Modify: `packages/ui/package.json`

- [ ] **Step 1: Install the nine fontsource packages**

```bash
cd packages/ui
pnpm add @fontsource/inter @fontsource/jetbrains-mono @fontsource/vt323 @fontsource/ibm-plex-mono @fontsource/press-start-2p @fontsource/silkscreen @fontsource/chakra-petch @fontsource/rajdhani @fontsource/share-tech-mono
```

- [ ] **Step 2: Verify the packages resolved**

```bash
ls node_modules/@fontsource/ | head -20
```

Expected: all nine package directories present.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/package.json pnpm-lock.yaml
git commit -m ":heavy_plus_sign: build(ui): add @fontsource font packages for theme system

Nine self-hosted font families for the five dark themes. Self-hosted
(not Google Fonts CDN) for offline Tauri desktop support."
```

---

### Task 2: Extend globals.css semantic token vocabulary

**Files:**
- Modify: `packages/ui/src/globals.css:8-122` (the `:root` block)

- [ ] **Step 1: Add Berkeley Mono local @font-face declaration**

At the top of `globals.css` (before `@tailwind base;`), add:

```css
/* Berkeley Mono — commercial font, local file. Monitor theme mono stack. */
@font-face {
  font-family: 'Berkeley Mono';
  src: url('/fonts/BerkeleyMono-Regular.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}
@font-face {
  font-family: 'Berkeley Mono';
  src: url('/fonts/BerkeleyMono-Bold.woff2') format('woff2');
  font-weight: 700;
  font-display: swap;
}
```

> **Note:** The `.woff2` files go in `packages/ui/public/fonts/`. If the project lacks a Berkeley Mono license, substitute `'JetBrains Mono'` in the Monitor theme's `--font-mono`. Confirm licensing before shipping.

- [ ] **Step 2: Add accent, font, and decoration tokens to `:root`**

Inside the existing `:root { ... }` block, after the shadcn token mappings (after `--radius: 0.5rem;`), add:

```css
    /* === Theme System: semantic accent tokens === */
    --accent-primary: #f7f8f8;
    --accent-secondary: #f7f8f8;
    --accent-signal: #f7f8f8;
    --accent-glow: rgba(247, 248, 248, 0.35);

    /* === Theme System: per-theme font stacks === */
    --font-display: 'Inter var', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --font-body: 'Inter var', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --font-mono: 'Berkeley Mono', ui-monospace, SFMono-Regular, Menlo, monospace;

    /* === Theme System: decoration tokens (zero by default = Monitor/calm) === */
    --scanline-color: rgba(255, 255, 255, 0.018);
    --scanline-opacity: 0;
    --vignette-strength: 0;
    --title-shadow: none;
    --text-glow: none;
    --card-clip: none;
    --panel-notch-size: 0px;
```

- [ ] **Step 3: Make body font-family consume the theme token**

In the `body { ... }` rule, change the `font-family` line to `font-family: var(--font-body);`

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/globals.css
git commit -m ":sparkles: feat(ui): add theme token vocabulary to globals.css"
```

---

### Task 3: Add Monitor and Phosphor Mono theme blocks

**Files:**
- Modify: `packages/ui/src/globals.css`

- [ ] **Step 1: Add the Monitor theme block** (append after `:root`)

```css
[data-theme='monitor'] {
  --bg-deep: #050506;
  --bg-marketing: #08090a;
  --bg-panel: #0f1011;
  --bg-surface: #191a1b;
  --bg-hover: #28282c;
  --text-primary: #f7f8f8;
  --text-secondary: #d0d6e0;
  --text-tertiary: #8a8f98;
  --text-quaternary: #62666d;
  --accent-primary: #f7f8f8;
  --accent-secondary: #f7f8f8;
  --accent-signal: #f7f8f8;
  --accent-glow: rgba(247, 248, 248, 0.35);
  --font-display: 'Inter var', 'Inter', -apple-system, sans-serif;
  --font-body: 'Inter var', 'Inter', -apple-system, sans-serif;
  --font-mono: 'Berkeley Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  --border-subtle: rgba(255, 255, 255, 0.05);
  --border-standard: rgba(255, 255, 255, 0.08);
  --border-primary: #23252a;
  --border-accent: rgba(255, 255, 255, 0.08);
  --heat-0: rgba(255, 255, 255, 0.04);
  --heat-1: rgba(255, 255, 255, 0.15);
  --heat-2: rgba(255, 255, 255, 0.30);
  --heat-3: rgba(255, 255, 255, 0.50);
  --heat-4: rgba(255, 255, 255, 0.78);
  --scanline-opacity: 0;
  --vignette-strength: 0;
  --title-shadow: none;
  --text-glow: none;
  --card-clip: none;
}
```

- [ ] **Step 2: Add the Phosphor Mono theme block (default first-run)**

```css
[data-theme='phosphor'] {
  --bg-deep: #050506;
  --bg-marketing: #08090a;
  --bg-panel: #0f1011;
  --bg-surface: #191a1b;
  --bg-hover: #28282c;
  --text-primary: #f7f8f8;
  --text-secondary: #d0d6e0;
  --text-tertiary: #8a8f98;
  --text-quaternary: #62666d;
  --accent-primary: #f7f8f8;
  --accent-secondary: #f7f8f8;
  --accent-signal: #f7f8f8;
  --accent-glow: rgba(247, 248, 248, 0.35);
  --font-display: 'JetBrains Mono', ui-monospace, monospace;
  --font-body: 'Inter', -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-standard: rgba(255, 255, 255, 0.10);
  --border-primary: #2a2c30;
  --border-accent: rgba(247, 248, 248, 0.18);
  --heat-0: rgba(255, 255, 255, 0.04);
  --heat-1: rgba(255, 255, 255, 0.18);
  --heat-2: rgba(255, 255, 255, 0.35);
  --heat-3: rgba(255, 255, 255, 0.58);
  --heat-4: rgba(255, 255, 255, 0.88);
  --scanline-color: rgba(255, 255, 255, 0.018);
  --scanline-opacity: 1;
  --vignette-strength: 0.55;
  --title-shadow: none;
  --text-glow: 0 0 8px rgba(247, 248, 248, 0.35);
  --card-clip: none;
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/globals.css
git commit -m ":sparkles: feat(ui): add Monitor and Phosphor Mono theme blocks"
```

---

### Task 4: Add Amber CRT, Retro Wave, Cyberpunk theme blocks

**Files:**
- Modify: `packages/ui/src/globals.css`

- [ ] **Step 1: Amber CRT**

```css
[data-theme='amber'] {
  --bg-deep: #060400;
  --bg-marketing: #0a0700;
  --bg-panel: #110b00;
  --bg-surface: #1a1300;
  --bg-hover: #241a00;
  --text-primary: #ffb000;
  --text-secondary: #d49500;
  --text-tertiary: #8a5f00;
  --text-quaternary: #5c4000;
  --accent-primary: #ffb000;
  --accent-secondary: #ffb000;
  --accent-signal: #ffb000;
  --accent-glow: rgba(255, 176, 0, 0.4);
  --font-display: 'VT323', monospace;
  --font-body: 'IBM Plex Mono', monospace;
  --font-mono: 'IBM Plex Mono', monospace;
  --border-subtle: rgba(255, 176, 0, 0.08);
  --border-standard: rgba(255, 176, 0, 0.16);
  --border-primary: #3d2a00;
  --border-accent: rgba(255, 176, 0, 0.22);
  --heat-0: rgba(255, 176, 0, 0.05);
  --heat-1: rgba(255, 176, 0, 0.18);
  --heat-2: rgba(255, 176, 0, 0.38);
  --heat-3: rgba(255, 176, 0, 0.65);
  --heat-4: rgba(255, 176, 0, 0.92);
  --scanline-color: rgba(255, 176, 0, 0.06);
  --scanline-opacity: 1;
  --vignette-strength: 0.7;
  --title-shadow: none;
  --text-glow: 0 0 8px rgba(255, 176, 0, 0.6), 0 0 16px rgba(255, 140, 0, 0.25);
  --card-clip: none;
}
```

- [ ] **Step 2: Retro Wave**

```css
[data-theme='retro'] {
  --bg-deep: #0a0118;
  --bg-marketing: #0d0221;
  --bg-panel: #16082e;
  --bg-surface: #1f0f3e;
  --bg-hover: #2a1654;
  --text-primary: #f0e6ff;
  --text-secondary: #c4b0d8;
  --text-tertiary: #8a6fa0;
  --text-quaternary: #5c4570;
  --accent-primary: #00f0ff;
  --accent-secondary: #ff2bd6;
  --accent-signal: #ffb000;
  --accent-glow: rgba(0, 240, 255, 0.4);
  --font-display: 'Press Start 2P', monospace;
  --font-body: 'Silkscreen', monospace;
  --font-mono: 'Silkscreen', monospace;
  --border-subtle: rgba(255, 43, 214, 0.10);
  --border-standard: rgba(0, 240, 255, 0.18);
  --border-primary: #3d1a5c;
  --border-accent: rgba(255, 43, 214, 0.30);
  --heat-0: rgba(255, 43, 214, 0.06);
  --heat-1: rgba(0, 240, 255, 0.20);
  --heat-2: rgba(0, 240, 255, 0.42);
  --heat-3: rgba(255, 43, 214, 0.62);
  --heat-4: rgba(255, 176, 0, 0.90);
  --scanline-color: rgba(255, 43, 214, 0.04);
  --scanline-opacity: 1;
  --vignette-strength: 0.65;
  --title-shadow: 2px 2px 0 #ff2bd6, 4px 4px 0 #00f0ff, 0 0 14px rgba(255, 43, 214, 0.5);
  --text-glow: 0 0 6px rgba(0, 240, 255, 0.5);
  --card-clip: none;
}
```

- [ ] **Step 3: Cyberpunk**

```css
[data-theme='cyberpunk'] {
  --bg-deep: #06060c;
  --bg-marketing: #0a0a14;
  --bg-panel: #11111d;
  --bg-surface: #1a1a2e;
  --bg-hover: #242440;
  --text-primary: #e8e8f0;
  --text-secondary: #b0b0c8;
  --text-tertiary: #8a8aa0;
  --text-quaternary: #5a5a78;
  --accent-primary: #fcee0a;
  --accent-secondary: #00f0ff;
  --accent-signal: #ff003c;
  --accent-glow: rgba(252, 238, 10, 0.45);
  --font-display: 'Chakra Petch', sans-serif;
  --font-body: 'Rajdhani', sans-serif;
  --font-mono: 'Share Tech Mono', ui-monospace, monospace;
  --border-subtle: rgba(252, 238, 10, 0.10);
  --border-standard: rgba(252, 238, 10, 0.22);
  --border-primary: #2a2a40;
  --border-accent: rgba(252, 238, 10, 0.40);
  --heat-0: rgba(252, 238, 10, 0.05);
  --heat-1: rgba(252, 238, 10, 0.18);
  --heat-2: rgba(252, 238, 10, 0.38);
  --heat-3: rgba(252, 238, 10, 0.65);
  --heat-4: rgba(252, 238, 10, 0.92);
  --scanline-color: rgba(0, 0, 0, 0.10);
  --scanline-opacity: 1;
  --vignette-strength: 0.5;
  --title-shadow: none;
  --text-glow: 0 0 6px rgba(252, 238, 10, 0.55), 0 0 14px rgba(252, 238, 10, 0.22);
  --card-clip: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
  --panel-notch-size: 8px;
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/globals.css
git commit -m ":sparkles: feat(ui): add Amber CRT, Retro Wave, Cyberpunk theme blocks"
```

---

### Task 5: Add calm intensity override and reduced-motion guard

**Files:**
- Modify: `packages/ui/src/globals.css`

- [ ] **Step 1: Calm override block** (append after all five theme blocks)

```css
[data-intensity='calm'] {
  --scanline-opacity: 0;
  --vignette-strength: 0;
  --title-shadow: none;
  --text-glow: none;
  --card-clip: none;
}
```

- [ ] **Step 2: Reduced-motion guard**

```css
@media (prefers-reduced-motion: reduce) {
  :root, [data-theme], [data-intensity] {
    --scanline-opacity: 0;
    --vignette-strength: 0;
    --title-shadow: none;
    --text-glow: none;
    --card-clip: none;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/globals.css
git commit -m ":sparkles: feat(ui): add calm intensity override and reduced-motion guard"
```

---

### Task 6: Add variable-driven decoration overlays

**Files:**
- Modify: `packages/ui/src/globals.css` (`@layer base` block)

- [ ] **Step 1: Add body::before and body::after** (after the existing `body { ... }` rule)

```css
  body::before {
    content: '';
    position: fixed; inset: 0;
    background: repeating-linear-gradient(to bottom,
      var(--scanline-color) 0, var(--scanline-color) 1px,
      transparent 1px, transparent 3px);
    opacity: var(--scanline-opacity, 0);
    pointer-events: none; z-index: 9999; mix-blend-mode: screen;
  }
  body::after {
    content: '';
    position: fixed; inset: 0;
    background: radial-gradient(ellipse at center, transparent 55%,
      rgba(0, 0, 0, calc(var(--vignette-strength) * 0.55)));
    opacity: var(--vignette-strength, 0);
    pointer-events: none; z-index: 9998;
  }
```

- [ ] **Step 2: Cyberpunk grid backdrop scope**

```css
[data-theme='cyberpunk'][data-intensity='expressive'] body::before {
  background-image: linear-gradient(to right, rgba(252, 238, 10, 0.03) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(0, 240, 255, 0.03) 1px, transparent 1px);
  background-size: 32px 32px;
  opacity: 1; mix-blend-mode: normal;
}
```

- [ ] **Step 3: Verify no regression** — `pnpm dev`, confirm Monitor page looks normal, stop.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/globals.css
git commit -m ":sparkles: feat(ui): add variable-driven body decoration overlays"
```

---

### Task 7: Add Tailwind decoration plugin and resolve darkMode

**Files:**
- Modify: `packages/ui/tailwind.config.mjs`

- [ ] **Step 1: Add plugin import, darkMode, and decoration utilities**

Add `import plugin from 'tailwindcss/plugin'` at the top. Add `darkMode: ['class', '[data-theme]'],` to the config root. Add the decoration plugin to the `plugins` array:

```javascript
  plugins: [
    tailwindcssAnimate,
    typography,
    plugin(({ addUtilities }) => addUtilities({
      '.deco-glow-text': { textShadow: 'var(--text-glow)' },
      '.deco-notch': { clipPath: 'var(--card-clip)' },
      '.deco-scanlines': {
        backgroundImage: 'repeating-linear-gradient(to bottom, var(--scanline-color) 0, var(--scanline-color) 1px, transparent 1px, transparent 3px)',
        opacity: 'var(--scanline-opacity)',
      },
      '.deco-vignette': {
        background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,calc(var(--vignette-strength) * 0.55)))',
      },
      '.deco-title-shadow': { textShadow: 'var(--title-shadow)' },
    })),
  ],
```

- [ ] **Step 2: Verify Tailwind compiles** — `pnpm dev`, no errors, stop.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/tailwind.config.mjs
git commit -m ":sparkles: feat(ui): add Tailwind decoration plugin and darkMode selector"
```

---

### Task 8: Create the theme registry and types

**Files:**
- Create: `packages/ui/src/theme/registry.ts`
- Create: `packages/ui/src/theme/index.ts`

- [ ] **Step 1: Create registry.ts**

```typescript
// packages/ui/src/theme/registry.ts
export const themes = [
  { id: 'monitor', name: 'Monitor', description: 'Clean monochrome.', swatch: '#f7f8f8', fonts: ['Inter', 'Berkeley Mono'] },
  { id: 'phosphor', name: 'Phosphor Mono', description: 'Textured monochrome.', swatch: '#f7f8f8', fonts: ['JetBrains Mono', 'Inter'] },
  { id: 'amber', name: 'Amber CRT', description: 'IBM 3270 amber phosphor.', swatch: '#ffb000', fonts: ['VT323', 'IBM Plex Mono'] },
  { id: 'retro', name: 'Retro Wave', description: '80s synthwave.', swatch: '#00f0ff', fonts: ['Press Start 2P', 'Silkscreen'] },
  { id: 'cyberpunk', name: 'Cyberpunk', description: 'Game HUD.', swatch: '#fcee0a', fonts: ['Chakra Petch', 'Rajdhani', 'Share Tech Mono'] },
] as const

export type ThemeId = (typeof themes)[number]['id']

export const intensities = ['calm', 'expressive'] as const
export type Intensity = (typeof intensities)[number]

export const DEFAULT_THEME: ThemeId = 'phosphor'
export const DEFAULT_INTENSITY: Intensity = 'expressive'

const STORAGE_KEY = 'ohmyc-theme'

export interface PersistedTheme { theme: ThemeId; intensity: Intensity }

export function loadPersistedTheme(): PersistedTheme {
  if (typeof localStorage === 'undefined') return { theme: DEFAULT_THEME, intensity: DEFAULT_INTENSITY }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { theme: DEFAULT_THEME, intensity: DEFAULT_INTENSITY }
    const parsed = JSON.parse(raw) as Partial<PersistedTheme>
    const validThemes = themes.map((t) => t.id)
    const theme = parsed.theme && validThemes.includes(parsed.theme) ? parsed.theme : DEFAULT_THEME
    const intensity = parsed.intensity && intensities.includes(parsed.intensity) ? parsed.intensity : DEFAULT_INTENSITY
    return { theme, intensity }
  } catch { return { theme: DEFAULT_THEME, intensity: DEFAULT_INTENSITY } }
}

export function persistTheme(value: PersistedTheme): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
}
```

- [ ] **Step 2: Create index.ts barrel**

```typescript
// packages/ui/src/theme/index.ts
export { themes, intensities, DEFAULT_THEME, DEFAULT_INTENSITY, loadPersistedTheme, persistTheme }
export type { ThemeId, Intensity, PersistedTheme }
export { ThemeProvider, useTheme } from './theme-provider'
export { useThemeCommands } from './use-theme-commands'
```

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/theme/registry.ts packages/ui/src/theme/index.ts
git commit -m ":sparkles: feat(ui): add theme registry and types"
```

### Task 9: Write ThemeProvider tests (TDD)

**Files:**
- Create: `packages/ui/src/tests/theme/theme-provider.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// packages/ui/src/tests/theme/theme-provider.test.tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DEFAULT_INTENSITY, DEFAULT_THEME } from '@/theme/registry'
import { ThemeProvider, useTheme } from '@/theme/theme-provider'

function Probe() {
  const { theme, intensity } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="intensity">{intensity}</span>
    </div>
  )
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('data-intensity')
  })
  afterEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('data-intensity')
  })

  it('mounts default theme and intensity on <html>', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>)
    expect(document.documentElement.dataset.theme).toBe(DEFAULT_THEME)
    expect(document.documentElement.dataset.intensity).toBe(DEFAULT_INTENSITY)
    expect(screen.getByTestId('theme').textContent).toBe(DEFAULT_THEME)
  })

  it('reads persisted theme from localStorage on mount', () => {
    localStorage.setItem('ohmyc-theme', JSON.stringify({ theme: 'amber', intensity: 'calm' }))
    render(<ThemeProvider><Probe /></ThemeProvider>)
    expect(document.documentElement.dataset.theme).toBe('amber')
    expect(document.documentElement.dataset.intensity).toBe('calm')
  })

  it('falls back to default on invalid persisted theme', () => {
    localStorage.setItem('ohmyc-theme', JSON.stringify({ theme: 'nonexistent', intensity: 'calm' }))
    render(<ThemeProvider><Probe /></ThemeProvider>)
    expect(document.documentElement.dataset.theme).toBe(DEFAULT_THEME)
  })

  it('setIntensity updates <html> and persists', () => {
    function IntensitySetter() {
      const { intensity, setIntensity } = useTheme()
      return <button onClick={() => setIntensity(intensity === 'calm' ? 'expressive' : 'calm')}>toggle</button>
    }
    render(<ThemeProvider><IntensitySetter /></ThemeProvider>)
    fireEvent.click(screen.getByText('toggle'))
    expect(document.documentElement.dataset.intensity).toBe('calm')
    expect(JSON.parse(localStorage.getItem('ohmyc-theme')!).intensity).toBe('calm')
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd packages/ui && pnpm test -- src/tests/theme/theme-provider.test.tsx
```

Expected: FAIL — `@/theme/theme-provider` does not exist.

- [ ] **Step 3: Commit failing tests**

```bash
git add packages/ui/src/tests/theme/theme-provider.test.tsx
git commit -m ":test_tube: test(ui): add ThemeProvider tests (failing)"
```

---

### Task 10: Implement ThemeProvider

**Files:**
- Create: `packages/ui/src/theme/theme-provider.tsx`

- [ ] **Step 1: Implement the provider**

```tsx
// packages/ui/src/theme/theme-provider.tsx
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

import { loadThemeFonts } from './font-loader'
import {
  DEFAULT_INTENSITY,
  DEFAULT_THEME,
  loadPersistedTheme,
  persistTheme,
  type Intensity,
  type ThemeId,
} from './registry'

interface ThemeContextValue {
  theme: ThemeId
  intensity: Intensity
  setTheme: (theme: ThemeId) => Promise<void>
  setIntensity: (intensity: Intensity) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  intensity: DEFAULT_INTENSITY,
  setTheme: async () => {},
  setIntensity: () => {},
})

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const initial = loadPersistedTheme()
  const [theme, setThemeState] = useState<ThemeId>(initial.theme)
  const [intensity, setIntensityState] = useState<Intensity>(initial.intensity)

  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
  useEffect(() => { document.documentElement.dataset.intensity = intensity }, [intensity])

  const setTheme = useCallback(async (next: ThemeId) => {
    await loadThemeFonts(next)
    setThemeState(next)
    persistTheme({ theme: next, intensity })
  }, [intensity])

  const setIntensity = useCallback((next: Intensity) => {
    setIntensityState(next)
    persistTheme({ theme, intensity: next })
  }, [theme])

  return <ThemeContext.Provider value={{ theme, intensity, setTheme, setIntensity }}>{children}</ThemeContext.Provider>
}
```

- [ ] **Step 2: Run tests** — `pnpm test -- src/tests/theme/theme-provider.test.tsx` — Expected: PASS (4).

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/theme/theme-provider.tsx
git commit -m ":sparkles: feat(ui): implement dual-dimension ThemeProvider"
```

---

### Task 11: Write font loader tests (TDD)

**Files:**
- Create: `packages/ui/src/tests/theme/font-loader.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// packages/ui/src/tests/theme/font-loader.test.ts
import { vi } from 'vitest'

vi.mock('@fontsource/inter', () => ({ default: {} }))
vi.mock('@fontsource/jetbrains-mono', () => ({ default: {} }))

import { describe, expect, it } from 'vitest'

import { loadThemeFonts } from '@/theme/font-loader'

describe('loadThemeFonts', () => {
  it('resolves for monitor and phosphor', async () => {
    await expect(loadThemeFonts('monitor')).resolves.toBeUndefined()
    await expect(loadThemeFonts('phosphor')).resolves.toBeUndefined()
  })

  it('resolves for all five theme ids', async () => {
    for (const id of ['monitor', 'phosphor', 'amber', 'retro', 'cyberpunk'] as const) {
      await expect(loadThemeFonts(id)).resolves.toBeUndefined()
    }
  })
})
```

- [ ] **Step 2: Run to verify failure** — `pnpm test -- src/tests/theme/font-loader.test.ts` — Expected: FAIL.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/tests/theme/font-loader.test.ts
git commit -m ":test_tube: test(ui): add font loader tests (failing)"
```

---

### Task 12: Implement the font loader

**Files:**
- Create: `packages/ui/src/theme/font-loader.ts`

- [ ] **Step 1: Implement loadThemeFonts**

```ts
// packages/ui/src/theme/font-loader.ts
import type { ThemeId } from './registry'

const fontBundles: Record<ThemeId, () => Promise<unknown>> = {
  monitor: () => import('@fontsource/inter'),
  phosphor: () => Promise.all([import('@fontsource/jetbrains-mono'), import('@fontsource/inter')]),
  amber: () => Promise.all([import('@fontsource/vt323'), import('@fontsource/ibm-plex-mono')]),
  retro: () => Promise.all([import('@fontsource/press-start-2p'), import('@fontsource/silkscreen')]),
  cyberpunk: () =>
    Promise.all([import('@fontsource/chakra-petch'), import('@fontsource/rajdhani'), import('@fontsource/share-tech-mono')]),
}

export async function loadThemeFonts(theme: ThemeId): Promise<void> {
  await fontBundles[theme]()
}
```

- [ ] **Step 2: Run tests** — `pnpm test -- src/tests/theme/font-loader.test.ts` — Expected: PASS (2).

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/theme/font-loader.ts
git commit -m ":sparkles: feat(ui): implement per-theme font loader"
```

---

### Task 13: Create the `useThemeCommands` hook

**Files:**
- Create: `packages/ui/src/theme/use-theme-commands.tsx`

This extracts theme/intensity command generation out of `app.tsx` into its own module. The hook returns a `CommandItem[]` that app.tsx spreads into its existing commands array, keeping a single `CommandPalette` instance (no duplicate ⌘K listeners) while keeping app.tsx clean.

The `CommandItem` type is imported from `@/components/command-palette` to match the existing shape.

- [ ] **Step 1: Create the hook**

```tsx
// packages/ui/src/theme/use-theme-commands.tsx
import { Check } from 'lucide-react'
import { useMemo } from 'react'

import type { CommandItem } from '@/components/command-palette'

import { intensities, themes } from './registry'
import { useTheme } from './theme-provider'

/**
 * Returns ⌘K command items for switching theme and intensity.
 * Spread the result into the main palette's commands array — do not
 * render a second CommandPalette (would duplicate the ⌘K listener).
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useThemeCommands(): CommandItem[] {
  const { theme, intensity, setTheme, setIntensity } = useTheme()

  return useMemo<CommandItem[]>(() => {
    const themeCommands: CommandItem[] = themes.map((t) => ({
      id: `theme-${t.id}`,
      label: `Theme: ${t.name}`,
      category: 'Theme',
      icon: theme === t.id ? <Check size={15} /> : undefined,
      action: () => { void setTheme(t.id) },
    }))

    const intensityCommands: CommandItem[] = intensities.map((i) => ({
      id: `intensity-${i}`,
      label: `Intensity: ${i.charAt(0).toUpperCase() + i.slice(1)}`,
      category: 'Intensity',
      icon: intensity === i ? <Check size={15} /> : undefined,
      action: () => setIntensity(i),
    }))

    return [...themeCommands, ...intensityCommands]
  }, [theme, intensity, setTheme, setIntensity])
}
```

- [ ] **Step 2: Verify the module type-checks**

```bash
cd packages/ui && pnpm lint
```

Expected: PASS. If `CommandItem` is not exported from `command-palette.tsx`, add it to that file's exports first — it is currently defined as an interface in `command-palette.tsx:13`.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/theme/use-theme-commands.tsx
git commit -m ":sparkles: feat(ui): add useThemeCommands hook for ⌘K integration

Extracts theme + intensity command generation into its own module.
app.tsx will spread the result into its commands array — single
CommandPalette, no duplicate ⌘K listener, no theme logic inlined."
```

---

### Task 14: Wire useThemeCommands into app.tsx

**Files:**
- Modify: `packages/ui/src/app.tsx` (~line 29, the `AppCommandPalette` function)

- [ ] **Step 1: Import the hook**

Add to app.tsx imports:

```tsx
import { useThemeCommands } from './theme'
```

- [ ] **Step 2: Spread theme commands into the commands array**

Inside `AppCommandPalette`, call the hook and spread its result into the existing `commands` array (do NOT create a second `<CommandPalette>`):

```tsx
function AppCommandPalette() {
  const themeCommands = useThemeCommands()

  const commands: CommandItem[] = [
    // ... ALL existing 'Go to' commands stay here exactly as they are ...
    ...themeCommands,
  ]

  return <CommandPalette commands={commands} />
}
```

Read the current `app.tsx` first to see the exact existing return structure and adapt — the only change is adding `const themeCommands = useThemeCommands()` and `...themeCommands` to the array.

- [ ] **Step 3: Verify the palette shows Theme and Intensity groups**

```bash
cd packages/ui && pnpm dev
```

Press ⌘K. Confirm `Theme` (5 entries) and `Intensity` (2 entries) groups appear. Selecting a theme swaps colors/fonts. `Intensity: Calm` hides decoration. Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/app.tsx
git commit -m ":sparkles: feat(ui): wire useThemeCommands into ⌘K palette"
```

---

### Task 15: Mount ThemeProvider and preload default fonts

**Files:**
- Modify: `packages/ui/src/main.tsx`

- [ ] **Step 1: Wrap the app with ThemeProvider and preload default fonts**

Replace `main.tsx`:

```tsx
import './globals.css'
import '@fontsource/inter'
import '@fontsource/jetbrains-mono'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import { App } from './app'
import { ThemeProvider } from './theme'

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
})

ReactDOM.createRoot(document.querySelector('#root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
)
```

The top-level `@fontsource` imports preload the default theme's fonts into the main bundle for instant first paint.

- [ ] **Step 2: Verify** — `pnpm dev` — `<html>` should have `data-theme="phosphor"` and `data-intensity="expressive"`. Stop.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/main.tsx
git commit -m ":sparkles: feat(ui): mount ThemeProvider and preload default fonts"
```

---

### Task 16: Add Card `decorated` prop

**Files:**
- Modify: `packages/ui/src/components/ui/card.tsx:5-21`

The current `Card` takes `React.ComponentProps<'div'> & { size?: 'default' | 'sm' }`.

- [ ] **Step 1: Add the `decorated` prop**

Replace the `Card` function (lines 5-21) with:

```tsx
function Card({
  className,
  size = 'default',
  decorated = false,
  ...properties
}: React.ComponentProps<'div'> & { size?: 'default' | 'sm'; decorated?: boolean }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        'group/card flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 text-sm text-card-foreground ring-1 ring-foreground/10 has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-3 data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl',
        decorated && 'deco-notch deco-glow-text',
        className,
      )}
      {...properties}
    />
  )
}
```

The existing `overflow-hidden` ensures content respects the clip-path notch. In Cyberpunk expressive, the clip-path replaces the `ring-1` as the visual edge (ring is clipped by the notch — intended CP2077 look).

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/components/ui/card.tsx
git commit -m ":sparkles: feat(ui): add decorated prop to Card"
```

---

### Task 17: Set up Storybook theme globalTypes and decorator

**Files:**
- Modify: `packages/ui/.storybook/preview.tsx`

- [ ] **Step 1: Replace preview.tsx**

```tsx
import '../src/globals.css'

import type { Preview } from '@storybook/react-vite'

const preview: Preview = {
  parameters: {
    backgrounds: { default: 'OhMyC dark', values: [
      { name: 'OhMyC dark', value: '#08090a' },
      { name: 'Panel', value: '#0f1011' },
    ]},
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i }},
    layout: 'centered',
    options: { storySort: { order: ['Design System', 'Product', 'Menubar', 'Test'] }},
  },
  globalTypes: {
    theme: {
      name: 'Theme', defaultValue: 'phosphor',
      toolbar: { icon: 'paintbrush', items: [
        { value: 'monitor', title: 'Monitor' },
        { value: 'phosphor', title: 'Phosphor Mono' },
        { value: 'amber', title: 'Amber CRT' },
        { value: 'retro', title: 'Retro Wave' },
        { value: 'cyberpunk', title: 'Cyberpunk' },
      ]},
    },
    intensity: {
      name: 'Intensity', defaultValue: 'expressive',
      toolbar: { icon: 'photo', items: [
        { value: 'calm', title: 'Calm' },
        { value: 'expressive', title: 'Expressive' },
      ]},
    },
  },
  decorators: [
    (Story, context) => (
      <div
        data-theme={context.globals.theme}
        data-intensity={context.globals.intensity}
        className="min-h-screen bg-[var(--bg-marketing)] p-8 text-[var(--text-primary)]"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        <Story />
      </div>
    ),
  ],
}

export default preview
```

- [ ] **Step 2: Verify** — `pnpm storybook` — confirm both dropdowns work. Stop.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/.storybook/preview.tsx
git commit -m ":sparkles: feat(storybook): add theme and intensity toolbar controls"
```

---

### Task 18: Add the ThemesShowcase story

**Files:**
- Create: `packages/ui/src/stories/design-system/ThemesShowcase.stories.tsx`

- [ ] **Step 1: Create the showcase**

```tsx
// packages/ui/src/stories/design-system/ThemesShowcase.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const meta = { title: 'Design System/ThemesShowcase', parameters: { layout: 'padded' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Showcase: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h1 className="deco-title-shadow text-3xl" style={{ fontFamily: 'var(--font-display)' }}>
          OhMyC Coding Monitor
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Switch Theme and Intensity in the toolbar.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button>Primary</Button><Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button><Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
      </div>
      <div className="flex flex-wrap gap-3">
        <Badge>Default</Badge><Badge variant="secondary">Secondary</Badge><Badge variant="outline">Outline</Badge>
      </div>
      <Card decorated className="p-6">
        <h3 className="mb-2 text-lg" style={{ fontFamily: 'var(--font-display)' }}>Decorated Card</h3>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Expressive Cyberpunk: notched corners + glow. Calm: looks normal.
        </p>
      </Card>
      <div className="flex items-center gap-4">
        <Label htmlFor="si">Input</Label>
        <Input id="si" placeholder="Type here" className="max-w-xs" />
      </div>
      <div className="flex items-center gap-4">
        <Label htmlFor="ss">Switch</Label>
        <Switch id="ss" />
      </div>
      <Tabs defaultValue="activity">
        <TabsList><TabsTrigger value="activity">Activity</TabsTrigger><TabsTrigger value="tokens">Tokens</TabsTrigger></TabsList>
      </Tabs>
      <div>
        <h3 className="mb-3 text-sm" style={{ color: 'var(--text-tertiary)' }}>Heatmap buckets</h3>
        <div className="flex gap-1">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className={`h-3 w-3 rounded-sm heat-l${i % 5}`} />
          ))}
        </div>
      </div>
    </div>
  ),
}
```

- [ ] **Step 2: Verify across all five themes** — `pnpm storybook` — cycle Theme × Intensity. Stop.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/stories/design-system/ThemesShowcase.stories.tsx
git commit -m ":sparkles: feat(storybook): add ThemesShowcase one-page comparison"
```

---

### Task 19: Full verification

- [ ] **Step 1: Lint** — `cd packages/ui && pnpm lint` — Expected: PASS, zero warnings.

- [ ] **Step 2: Unit tests** — `pnpm test` — Expected: PASS (ThemeProvider 4 + font loader 2).

- [ ] **Step 3: Storybook build** — `pnpm build-storybook` — Expected: no errors.

- [ ] **Step 4: Production build** — `pnpm build` — Expected: TypeScript + Vite succeed.

- [ ] **Step 5: Manual smoke test** — `pnpm dev` — for each theme via ⌘K: switch theme, toggle Calm/Expressive, navigate routes. Confirm no console errors. Stop.

- [ ] **Step 6: Final commit if fixes were needed**

```bash
git add -A && git commit -m ":bug: fix(ui): resolve verification issues"
```

If clean, Phase 2 is complete. Phase 3 (full route theming) is a separate future plan.
