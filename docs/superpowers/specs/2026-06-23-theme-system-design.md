# Theme System Design — OhMyC

> **Status:** Approved design, pending implementation plan.
> **Date:** 2026-06-23
> **Branch:** `hotfix/geek-design`
> **Source explorations:** `assets/pixel-variants-20260622/` (variants A/B/C/D across dashboard, timeline, library, menubar)

## Context

The `assets/pixel-variants-20260622/` directory contains HTML previews of four pixel/geek design directions (A Phosphor Mono, B Amber CRT, C Retro Wave, D Cyberpunk) applied across OhMyC's real component surfaces. The current production app ships a single monochrome "calm precision instrument" aesthetic locked in by `PRODUCT.md` anti-references (which ban "hacker terminal cosplay", neon, chromatic accents) and `DESIGN.md` ("No chromatic accents of any kind").

This design introduces a **themeable monitor**: five dark personalities the user switches between, each with a calm/expressive intensity toggle. The theme system must let these personalities coexist without rewriting every component per theme.

## Goals

1. Ship five switchable dark themes: **Monitor** (today's clean monochrome), **Phosphor Mono** (textured monochrome, default first-run), **Amber CRT**, **Retro Wave**, **Cyberpunk**.
2. Each theme exposes a **calm** (color + typography only) and **expressive** (full decoration: scanlines, glow, notched panels, chromatic shadows) intensity.
3. Theme switching via the existing **⌘K command palette** only — no new persistent chrome.
4. Reframe `PRODUCT.md` and `DESIGN.md` so the chromatic/geek personalities are first-class rather than banned.
5. Refactor the **token layer** (`globals.css`) and make all **nine base UI components** theme-aware, verified through **Storybook** across every theme × intensity combination.
6. Switching a theme is instant (pure CSS variable swap) and offline-capable (self-hosted fonts) for the Tauri desktop shell.

## Non-Goals

- **Variant E (Low Poly Harbor)** is explicitly out of scope. It is a light-theme, soft-3D direction that would require light-mode token parity across every component and roughly double the work. The app stays dark-only.
- **PixelSnow / FaultyTerminal / Canvas/WebGL backgrounds** are not part of the theme system. They were onboarding/hero references only and remain available as standalone optional components, decoupled from themes.
- **Applying themes to full routes** (Timeline, Library, Monitor, Menubar) is a follow-up phase, not part of this spec. This spec covers documentation, tokens, base components, and Storybook only.
- **A light mode** is not introduced. All five themes are dark.

## Theme Inventory

An open set. **As of v1, five themes ship.** The architecture is additive — adding a sixth theme is one CSS block plus one registry entry, with zero component code changes. The contract every theme must fulfill is the semantic token vocabulary in §"Token Architecture".

| ID | Name | Default? | Personality | Display font | Body font | Mono font |
|---|---|---|---|---|---|---|
| `monitor` | Monitor | | Today's clean monochrome, no decoration | Inter | Inter | Berkeley Mono |
| `phosphor` | Phosphor Mono | **first-run** | Textured monochrome, scanlines, phosphor glow, blinking cursor | JetBrains Mono | Inter | JetBrains Mono |
| `amber` | Amber CRT | | IBM 3270 amber phosphor, warm single hue | VT323 | IBM Plex Mono | IBM Plex Mono |
| `retro` | Retro Wave | | Synthwave cyan + magenta + amber, chromatic offset shadows, neon glow | Press Start 2P | Silkscreen | Silkscreen |
| `cyberpunk` | Cyberpunk | | CP2077 HUD, yellow + cyan + red, notched panels, hazard stripes, grid backdrop | Chakra Petch | Rajdhani | Share Tech Mono |

**Phosphor Mono is the default first-run theme.** The current production monochrome aesthetic survives as the **Monitor** theme — it is not deleted, it becomes a switchable personality.

### Intensity (calm / expressive)

Every theme has two intensity modes, switchable independently of the theme:

- **calm** — color + typography only. All ambient decoration (scanlines, vignette, glow, chromatic shadows, notched corners, flicker animations) is disabled. The theme still reads through its color palette and font stack.
- **expressive** — the full decoration stack from each theme's variant HTML is active.

`prefers-reduced-motion: reduce` forces calm-equivalent decoration (all ambient effects off) regardless of the user's intensity choice, per the existing accessibility commitment.

## Documentation Changes

Step 1 of implementation. Both docs change before any code, because the current constraints actively forbid shipping B/C/D.

### PRODUCT.md

**Kept unchanged:**
- `## Register` → `product`
- `## Users` (developers using Claude Code and coding agents)
- `## Product Purpose` (personal Coding Monitor, activity-first profile surface)
- `## Design Principles` items 1 (monitor not manager) and 4 (signal over dashboard)
- `## Accessibility & Inclusion` in full (WCAG AA, reduced-motion, keyboard parity, color-blind resilience, WebGL/DOM fallback)

**Rewritten:**
- `## Brand Personality` — from "precise, calm, signal-first" to "**precise, adaptive, signal-first**". "calm" is no longer the sole canonical voice; it becomes one personality (the Monitor theme). "adaptive" reflects the themeable surface.
- `## Anti-references` — reframed from **banning whole aesthetic directions** to **banning execution failures**:
  - Kept: "generic SaaS dashboard", "heavy config-admin UI", "over-animated/busy".
  - Rewritten: the "AI-cliche visuals" ban becomes "expressive intensity permits chromatic themes, but low-contrast purple/blue orb cliches remain banned in every theme".
  - Retired: the "gamer / RGB / hacker terminal cosplay" ban is removed. Replaced with execution criteria: "no theme, in expressive mode, may ship WCAG-non-compliant contrast, unreadable font sizes (<11px), or fatiguing flicker (>3Hz)".
- `## Design Principles` item 2 — "Darkness is the native medium" becomes "**Darkness is the native medium; personality is the user's choice.**" All five themes remain dark; the personality is the user's selection.
- `## Design Principles` item 3 — "One memorable identity surface" is retained but generalized: the Monitor route's WebGL budget rule applies per active theme, not only to the monochrome default.

**Added:**
- `## Theme Personalities` — new section enumerating the five themes, the calm/expressive concept, and the default first-run = Phosphor Mono. Framed as an open set: "The theme system supports an open set of personalities. As of v1, five ship: …".

### DESIGN.md

- `## Aesthetic Direction` — from "Monochrome dark — precision engineering" to "**Themeable dark — five personalities on a shared dark foundation**".
- `## Philosophy` — keep "darkness as native medium"; add "personality is expressed through themable color, typography, and decoration layers".
- `## Color` — from "Pure monochrome — zero chromatic" to "**Per-theme color systems**". Retain the Monitor theme's monochrome token table as the base theme. Add four more per-theme color tables (Amber, Retro, Cyberpunk, Phosphor). The semantic token names do not change; only their values do.
- `## Typography` — from a single Inter/Berkeley Mono stack to "**Per-theme font stacks**". Each theme provides its own `--font-display`, `--font-body`, `--font-mono`. Document all five.
- `## Motion` — keep existing motion tokens and reduced-motion rules. Add "**Per-theme decoration in expressive mode**": scanlines, vignette, CRT flicker, chromatic offset shadows, notched corners, hazard stripes, grid backdrops — all gated by `[data-intensity="expressive"]` and disabled under calm or `prefers-reduced-motion`.
- `## Decisions Log` — add a 2026-06-23 row: introduced five-theme + calm/expressive system; default changed from Monitor to Phosphor Mono; anti-references reframed as execution guidelines.
- `## Theme System` — new section: the unified semantic token vocabulary, per-theme color/font/decoration specs, and the calm/expressive switching rules.

## Token Architecture

The contract every theme must fulfill. A new theme works with zero component changes as long as it provides values for every token below.

### Semantic Token Vocabulary

Five categories. All consumed by Tailwind utilities (via shadcn variable mappings) or by decoration utilities.

**Backgrounds:** `--bg-deep`, `--bg-marketing`, `--bg-panel`, `--bg-surface`, `--bg-hover`

**Text:** `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-quaternary`

**Accents (the core extension — current production only has monochrome aliases):**
- `--accent-primary` — lead hue (amber / cyan / yellow / white)
- `--accent-secondary` — second hue (magenta / cyan / none for single-hue themes)
- `--accent-signal` — signal/alert hue (amber / red / white)
- `--accent-glow` — rgba glow color, typically derived from `--accent-primary`

**Fonts:** `--font-display`, `--font-body`, `--font-mono`

**Borders:** `--border-subtle`, `--border-standard`, `--border-primary`, `--border-accent`

**Heatmap buckets:** `--heat-0` through `--heat-4` — each theme redefines its five luminance/intensity steps

**Decoration (expressive-only; calm zeroes all of these):**
- `--scanline-color`, `--scanline-opacity`
- `--vignette-strength`
- `--title-shadow` (chromatic offset / phosphor glow)
- `--text-glow`
- `--card-clip` (none or a `polygon()` clip-path)
- `--panel-notch-size`

**Motion (shared across all themes, does not vary):** `--motion-fast`, `--motion-short`, `--motion-medium`, `--motion-long`, `--motion-ease-out`, `--motion-ease-in-out`, `--motion-ease-drawer`

The existing `--accent-blue/green/amber/cyan/purple/red` monochrome aliases in `globals.css` are replaced by this semantic accent set. The existing shadcn tokens (`--background`, `--foreground`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`) are retained and **derived from** the semantic tokens above, so the shadcn-consuming components pick up theme changes automatically.

### Theme Definition Structure

Each theme is one `[data-theme="…"]` block in `globals.css` plus one entry in the JS theme registry. Example (Amber CRT):

```css
[data-theme="amber"] {
  --bg-deep: #060400;  --bg-marketing: #0a0700;
  --bg-panel: #110b00; --bg-surface: #1a1300;
  --text-primary: #ffb000; --text-secondary: #d49500;
  --text-tertiary: #8a5f00; --text-quaternary: #5c4000;

  --accent-primary: #ffb000;  --accent-secondary: #ffb000;
  --accent-signal: #ffb000;   --accent-glow: rgba(255,176,0,0.4);

  --font-display: 'VT323', monospace;
  --font-body: 'IBM Plex Mono', monospace;
  --font-mono: 'IBM Plex Mono', monospace;

  --border-accent: rgba(255,176,0,0.22);
  --heat-0: rgba(255,176,0,0.05);  --heat-4: rgba(255,176,0,0.92);

  /* expressive-mode decoration full values */
  --scanline-color: rgba(255,176,0,0.06);  --scanline-opacity: 1;
  --vignette-strength: 0.7;
  --text-glow: 0 0 8px rgba(255,176,0,0.6);
}
```

Monitor, Phosphor, Retro, Cyberpunk each get an equivalent block. The **Monitor** block takes today's `:root` values verbatim — it is the no-decoration monochrome base.

### Calm / Expressive Layering

A single override block handles calm for every theme — calm zeroes all decoration variables regardless of which theme is active:

```css
[data-intensity="calm"] {
  --scanline-opacity: 0;
  --vignette-strength: 0;
  --title-shadow: none;
  --text-glow: none;
  --card-clip: none;
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --scanline-opacity: 0;
    --vignette-strength: 0;
    --title-shadow: none;
    --text-glow: none;
    --card-clip: none;
  }
}
```

No `[data-intensity="expressive"]` rule block is needed — the theme blocks already define the full decoration values, and expressive simply means "do not override them". CSS cascade: theme block applies first, the calm override wins when active because it is more specific.

### Global Decoration Layers (`body::before` / `body::after`)

The pseudo-elements are always declared and controlled by variables, never conditionally created:

```css
body::before {
  content: ""; position: fixed; inset: 0;
  background: repeating-linear-gradient(to bottom,
    var(--scanline-color) 0, var(--scanline-color) 1px,
    transparent 1px, transparent 3px);
  opacity: var(--scanline-opacity, 0);
  pointer-events: none; z-index: 9999;
}
```

Calm sets `--scanline-opacity: 0` and the overlay disappears automatically. Theme-specific overlays whose `background-image` differs structurally (Cyberpunk's grid backdrop, hazard stripes) use scoped `[data-theme]` blocks, which is cleaner than over-variable-izing:

```css
[data-theme="cyberpunk"][data-intensity="expressive"] body::before {
  background-image:
    linear-gradient(to right, rgba(252,238,10,0.03) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(0,240,255,0.03) 1px, transparent 1px);
  background-size: 32px 32px;
}
```

## Decoration Utilities — Tailwind Plugin

Decoration helpers are registered as real Tailwind utilities via a plugin in `tailwind.config.ts`, not orphaned `@layer` CSS classes. This gives them IDE autocomplete, variant support (`hover:deco-glow-text`, `md:deco-notch`), and consistency with the existing className style.

```ts
import plugin from 'tailwindcss/plugin'

export default {
  plugins: [
    plugin(({ addUtilities }) => addUtilities({
      '.deco-glow-text':  { textShadow: 'var(--text-glow)' },
      '.deco-notch':      { clipPath: 'var(--card-clip)' },
      '.deco-scanlines':  {
        backgroundImage: 'repeating-linear-gradient(to bottom, var(--scanline-color) 0, var(--scanline-color) 1px, transparent 1px, transparent 3px)',
        opacity: 'var(--scanline-opacity)',
      },
      '.deco-vignette':   {
        background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,calc(var(--vignette-strength) * 0.55)))',
      },
    })),
  ],
}
```

Usage is ordinary Tailwind: `<Card className="deco-notch deco-glow-text">`. Under calm intensity, `--card-clip: none` and `--text-glow: none` collapse the effects without conditional classNames.

## ThemeProvider — Custom Dual-Dimension (Option B)

A self-contained ~60-line React context manages both `data-theme` and `data-intensity` on `<html>`. `next-themes` was considered and rejected: it manages only a single attribute, its main selling point (SSR flash prevention via injected script) is irrelevant in this Vite/Tauri app, and a custom provider handles both dimensions symmetrically without an unused dependency.

```ts
// packages/ui/src/theme/theme-provider.tsx
type Theme = 'monitor' | 'phosphor' | 'amber' | 'retro' | 'cyberpunk'
type Intensity = 'calm' | 'expressive'

interface ThemeContextValue {
  theme: Theme
  intensity: Intensity
  setTheme: (t: Theme) => Promise<void>   // async — awaits font load before swap
  setIntensity: (i: Intensity) => void     // sync — pure CSS swap
  themes: typeof themeRegistry
}
```

On mount:
1. Read `localStorage['ohmyc-theme']` → `{ theme: 'phosphor', intensity: 'expressive' }` default.
2. Set `<html data-theme="phosphor" data-intensity="expressive">`.
3. `setTheme` awaits `loadThemeFonts(target)` before flipping `data-theme`, so the new theme's fonts are resolved before paint.
4. Persist `{ theme, intensity }` to `localStorage['ohmyc-theme']`.

The store key holds both dimensions in a single JSON value.

## Font Loading — `@fontsource` Self-Hosted

Fonts ship as npm packages (`@fontsource/*`) and are dynamically imported per theme so Vite code-splits them. This is **critical for Tauri**: the desktop shell may run offline, and the variant HTML's `fonts.googleapis.com` links would fail without network. Self-hosted font files bundle into the app and work offline.

```ts
const fontBundles: Record<Theme, () => Promise<unknown>> = {
  monitor:   () => import('@fontsource/inter'),                     // Berkeley Mono via local @font-face
  phosphor:  () => Promise.all([import('@fontsource/jetbrains-mono'), import('@fontsource/inter')]),
  amber:     () => Promise.all([import('@fontsource/vt323'), import('@fontsource/ibm-plex-mono')]),
  retro:     () => Promise.all([import('@fontsource/press-start-2p'), import('@fontsource/silkscreen')]),
  cyberpunk: () => Promise.all([import('@fontsource/chakra-petch'), import('@fontsource/rajdhani'), import('@fontsource/share-tech-mono')]),
}
```

- The default theme's (Phosphor) fonts preload with the main bundle for instant first paint.
- The other four themes' fonts load on first switch via Vite code-splitting (~150–400 KB each), then are browser-cached for instant subsequent switches.
- **Berkeley Mono** is a commercial font not on fontsource. The Monitor theme declares it via a local `@font-face` and ships the file under `packages/ui/public/fonts/`.

New dependencies (nine packages): `@fontsource/inter`, `@fontsource/jetbrains-mono`, `@fontsource/vt323`, `@fontsource/ibm-plex-mono`, `@fontsource/press-start-2p`, `@fontsource/silkscreen`, `@fontsource/chakra-petch`, `@fontsource/rajdhani`, `@fontsource/share-tech-mono`.

## Base Component Refactoring

**Key finding:** the nine base components in `packages/ui/src/components/ui/` (`button`, `card`, `badge`, `input`, `select`, `dropdown-menu`, `switch`, `label`, `tabs`) already consume shadcn semantic tokens (`bg-primary`, `bg-secondary`, `bg-muted`, `text-foreground`, `border-border`, …) which resolve to the CSS variables in `globals.css`. They are **already theme-aware via token indirection** — swapping `:root` token values automatically retints them with zero className changes.

The refactoring breaks down as:

| Layer | Change | Approx. size |
|---|---|---|
| `globals.css` (the bulk) | Extend shadcn variable set + add accent/font/decoration variables; write five `[data-theme]` blocks, the `[data-intensity="calm"]` override, and scoped `[data-theme="cyberpunk"][data-intensity="expressive"]` decoration blocks; make `body::before`/`::after` variable-driven | ~250 lines CSS |
| `tailwind.config.ts` | Register `.deco-*` utilities via plugin; resolve `darkMode` handling (see below) | ~25 lines |
| `ThemeProvider` (~60 lines) | Custom dual-dimension context mounting `data-theme` + `data-intensity` on `<html>`, persisting to `localStorage['ohmyc-theme']`, exposing `useTheme()` | 1 file |
| Font loader (~40 lines) | `loadThemeFonts(themeId)` using dynamic `import()` of `@fontsource` bundles | 1 file |
| Component tweaks (minority) | `Card` gains an optional `decorated` prop applying `deco-notch` + `deco-glow-text`; the other eight components need zero code changes | 1–2 files |

**darkMode handling:** existing components carry `dark:bg-input/30` style prefixes. OhMyC is dark-only. During implementation, either set `darkMode: ['class', '[data-theme]']` in the Tailwind config or keep a `.dark` class on `<html>` that `ThemeProvider` also maintains. This is a migration detail, not a design-level decision.

## ⌘K Command Palette Integration

The command palette gains a **Theme** group, generated from the theme registry so adding a theme surfaces it automatically:

```
Theme: Monitor
Theme: Phosphor Mono   ✓
Theme: Amber CRT
Theme: Retro Wave
Theme: Cyberpunk
───
Intensity: Calm
Intensity: Expressive   ✓
```

Selecting a theme calls `setTheme` (async, awaits fonts); selecting an intensity calls `setIntensity` (sync). No new persistent chrome is introduced — the palette is already the primary action surface.

## Storybook Setup

A global decorator wraps every story with `data-theme` and `data-intensity` containers, plus two toolbar dropdowns:

- **Theme** dropdown: `monitor` / `phosphor` / `amber` / `retro` / `cyberpunk`
- **Intensity** dropdown: `calm` / `expressive`

```tsx
// .storybook/preview.tsx
const withTheme = (Story, context) => (
  <div data-theme={context.globals.theme} data-intensity={context.globals.intensity}>
    <Story />
  </div>
)

export const globalTypes = {
  theme:     { /* toolbar dropdown */ },
  intensity: { /* toolbar dropdown */ },
}
```

Each component's stories are generated as a matrix (variants × sizes × themes × intensities) via a helper loop, not hand-written per combination.

A dedicated **`ThemesShowcase.stories.tsx`** lays out all nine components plus a heatmap mock and a typography sample on one page — the React equivalent of the variant `index.html`, for at-a-glance comparison across the five themes.

## Accessibility

- **WCAG 2.1 AA contrast** must hold for every theme in both intensities. The chromatic themes (Amber, Retro, Cyberpunk) are the highest-risk: amber-on-dark, cyan/magenta pairs, and yellow-on-dark all need explicit contrast verification during implementation. Any pair failing AA is tuned (luminance shift, not hue change) until it passes.
- **`prefers-reduced-motion: reduce`** forces calm-equivalent decoration regardless of the user's intensity setting — scanlines, glow, flicker, chromatic shadows, and notched-corner animation are all disabled. Color and typography remain.
- **Color-blindness resilience** — meaning is never encoded by hue alone. The heatmap's five buckets must remain distinguishable by luminance/value within each theme (Amber's single-hue ramp does this naturally; Retro's cyan→magenta ramp needs a luminance monotonicity check). Status states (active/disabled) remain distinguishable by value and shape, not just hue.
- **Font readability** — no theme ships body text below 11px. Retro's Press Start 2P is a display-only font (headings, brand); body text in the Retro theme uses Silkscreen at readable sizes. This is an execution criterion enforced in the PRODUCT.md anti-reference rewrite.
- **Flicker ceiling** — no expressive animation exceeds 3 Hz, avoiding photosensitive trigger risk.

## Implementation Phasing

This maps directly to the three steps the user defined.

**Phase 1 — Documentation.** Rewrite `PRODUCT.md` and `DESIGN.md` per §"Documentation Changes". Commit. No code changes.

**Phase 2 — Tokens, base components, Storybook.** Refactor `globals.css` (token vocabulary + five theme blocks + intensity blocks + variable-driven overlays), add the Tailwind decoration plugin, implement the custom `ThemeProvider` and font loader, add the nine `@fontsource` dependencies, tweak `Card` for the `decorated` prop, and stand up the Storybook theme decorator plus the `ThemesShowcase` story. Outcome: every base component renders correctly across all five themes × two intensities in Storybook.

**Phase 3 — Apply to routes (follow-up).** Roll the theme system out across Timeline, Library (Agents/Commands/Skills/Plugins), Monitor, and Menubar. This phase is a separate spec; the current spec ends at Phase 2.

## Open Questions

These are deferred to the implementation plan or to Phase 3, not blockers for this spec:

- **Berkeley Mono licensing** — confirm the project has a valid license to ship the font file, or substitute a libre monospace (e.g. JetBrains Mono) for the Monitor theme's mono stack.
- **Theme transition animation** — whether switching themes animates (crossfade) or is instant. Lean instant for v1; the palette already opens/closes instantly.
- **Per-theme Monitor WebGL tinting** — the Monitor route's R3F scene may want to pick up accent hues from the active theme. Out of scope here; revisit in Phase 3.
