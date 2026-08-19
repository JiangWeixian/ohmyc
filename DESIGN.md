# Design System — OhMyC

## Product Context
- **What this is:** Personal Coding Monitor with a WebUI for seeing AI-assisted coding activity, momentum, and local agent resources in one profile-like surface.
- **Who it's for:** Developers using Claude Code and related coding agents who want a memorable personal monitor for their own work patterns.
- **Space/industry:** Developer tools / personal AI coding analytics
- **Project type:** Web app (dark-themed dashboard)

## Aesthetic Direction
- **Direction:** Themeable dark — five personalities on a shared dark foundation
- **Decoration level:** Minimal in calm intensity; theme-specific in expressive intensity (scanlines, glow, notched panels, chromatic shadows — all gated and reduced-motion-safe)
- **Mood:** Serious personal monitor whose personality the user chooses. Dense but readable, with one memorable AI-native identity surface.
- **Reference:** Monitor theme → monochrome Linear + GitHub contribution graph; Phosphor Mono → late-night terminal; Amber CRT → IBM 3270; Retro Wave → 80s synthwave arcade; Cyberpunk → CP2077 HUD. All five share the dark foundation; React Bits interaction craft applies throughout.

## Philosophy
Darkness is the native medium. Content emerges from near-black backgrounds through carefully calibrated luminance steps. The Monitor theme uses zero chromatic color — the only "color" is the gradation from white to black. The other four themes introduce themed accent hues, but always on the same dark foundation.

Personality is expressed through themable color, typography, and decoration layers — never through structural redesign. Switching a theme swaps CSS variable values; it does not re-layout the page. The product should be remembered as a **personal Coding Monitor** that the user has made their own, not a generic configuration manager.

## Typography
- **Per-theme font stacks:** Each theme provides `--font-display`, `--font-body`, `--font-mono`:
  - **Monitor:** Inter Variable (display + body), Berkeley Mono (mono)
  - **Phosphor Mono:** JetBrains Mono (display + mono), Inter (body)
  - **Amber CRT:** VT323 (display), IBM Plex Mono (body + mono)
  - **Retro Wave:** Press Start 2P (display), JetBrains Mono (body + mono), Silkscreen for arcade labels, controls, and heatmap microcopy
  - **Cyberpunk:** Chakra Petch (display), Rajdhani (body), Share Tech Mono (mono)
- **OpenType:** `"cv01", "ss03"` enabled globally on Inter-based themes
- **Fonts are self-hosted** via `@fontsource` packages for offline Tauri support
- **Weights:**
  - 400: Reading/body
  - 510: Emphasis/UI (signature weight — between regular and medium)
  - 590: Strong emphasis
  - 300: De-emphasized only
- **Scale:**
  - Hero/Display: 48px / weight 510 / letter-spacing -0.8px / line-height 1.0
  - H1: 32px / weight 400 / letter-spacing -0.5px / line-height 1.13
  - H2: 24px / weight 400 / letter-spacing -0.2px / line-height 1.33
  - H3: 20px / weight 590 / letter-spacing -0.15px / line-height 1.33
  - Body Large: 18px / weight 400 / letter-spacing -0.1px / line-height 1.60
  - Body: 16px / weight 400 / letter-spacing normal / line-height 1.50
  - Small: 15px / weight 400 / letter-spacing -0.1px / line-height 1.60
  - Caption: 13px / weight 510 / letter-spacing -0.05px / line-height 1.50
  - Label: 12px / weight 510 / letter-spacing normal / line-height 1.40
  - Micro: 11px / weight 510 / letter-spacing normal / line-height 1.40

## Color
- **Approach:** Per-theme color systems. The semantic token names (below) do not change across themes; only their values do. The Monitor theme is pure monochrome; Amber is single-hue; Retro and Cyberpunk are multi-hue. See the Theme System section for per-theme color tables.
- **Token contract (all themes must define these):**
  - Backgrounds: `--bg-deep`, `--bg-marketing`, `--bg-panel`, `--bg-surface`, `--bg-hover`
  - Text: `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-quaternary`
  - Accents: `--accent-primary`, `--accent-secondary`, `--accent-signal`, `--accent-glow`
  - Borders: `--border-subtle`, `--border-standard`, `--border-primary`, `--border-accent`
  - Heatmap: `--heat-0` through `--heat-4`, plus component tokens for graph panel, month/day labels, legend text, and high-intensity glow
- Values below are the Monitor theme. Other themes redefine these tokens in the Theme System section.
- **Backgrounds:**
  - Marketing/Deep: `#08090a` — page background
  - Panel: `#0f1011` — navigation island, panels
  - Surface: `#191a1b` — elevated cards, dropdowns
  - Secondary: `#28282c` — hover states, lightest dark
- **Text:**
  - Primary: `#f7f8f8` — headings, primary content
  - Secondary: `#d0d6e0` — body text, descriptions
  - Tertiary: `#8a8f98` — placeholders, metadata
  - Quaternary: `#62666d` — timestamps, disabled
- **Borders:**
  - Subtle: `rgba(255,255,255,0.05)` — default
  - Standard: `rgba(255,255,255,0.08)` — cards, inputs
  - Primary solid: `#23252a` — prominent separations
  - Secondary solid: `#34343a`
  - Tertiary solid: `#3e3e44`
- **Buttons:**
  - Primary: `#f7f8f8` bg, `#08090a` text (inverted)
  - Ghost: `rgba(255,255,255,0.02)` bg, `#d0d6e0` text, `rgba(255,255,255,0.08)` border
  - Subtle: `rgba(255,255,255,0.04)` bg
- **Semantic (grayscale only):**
  - Success: `rgba(255,255,255,0.7)` — completed states
  - Active: `#f7f8f8` — active/selected
  - Muted: `#62666d` — disabled/inactive
- **Dark mode:** Default. No light mode planned.

## Spacing (TailwindCSS)
- **Base unit:** 4px
- **Density:** Comfortable with breathing room
- **Scale:**
  - `space-1`: 4px (xs)
  - `space-2`: 8px (sm)
  - `space-3`: 12px (md)
  - `space-4`: 16px (lg)
  - `space-5`: 20px (xl)
  - `space-6`: 24px (2xl)
  - `space-8`: 32px (3xl)
  - `space-10`: 40px (4xl)
  - `space-12`: 48px (5xl)
  - `space-16`: 64px (6xl)
  - `space-20`: 80px (7xl)
  - `space-24`: 96px (8xl)

## Layout
- **Approach:** Grid-disciplined
- **Grid:** 12-column on desktop, 6 on tablet, 1 on mobile
- **Max content width:** 1200px (max-w-6xl)
- **Section padding:** 80px–100px vertical
- **Border radius:**
  - `rounded-sm`: 2px — badges, toolbar buttons
  - `rounded-md`: 6px — buttons, inputs
  - `rounded-lg`: 8px — cards, dropdowns
  - `rounded-xl`: 12px — large panels, major surfaces
  - `rounded-full`: 9999px — pills, chips

## Depth & Elevation
On dark surfaces, elevation is communicated through background luminance steps, not shadows:
- **Level 0 (Flat):** No shadow, `#08090a` bg
- **Level 1 (Surface):** `rgba(255,255,255,0.02)` bg + `rgba(255,255,255,0.08)` border
- **Level 2 (Elevated):** `rgba(255,255,255,0.04)` bg + `rgba(255,255,255,0.08)` border
- **Level 3 (Panel):** `#191a1b` bg + `rgba(255,255,255,0.08)` border
- **Level 4 (Dialog):** `#191a1b` bg + multi-layer shadow stack

## Motion
- **Approach:** Minimal-functional by default; intentional monitor motion for identity surfaces
- **Easing:**
  - Enter: ease-out (150ms)
  - Exit: ease-in (200ms)
  - Move: ease-in-out (200ms)
- **Duration:**
  - Micro: 100ms — focus rings
  - Short: 150ms — hover states
  - Medium: 200ms — page transitions
  - Long: 300ms — modals
- **Reusable motion tokens:** use `--motion-ease-out: cubic-bezier(0.23, 1, 0.32, 1)` for entering/exiting UI, `--motion-ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)` for on-screen movement, `--motion-fast: 120ms`, `--motion-short: 160ms`, and `--motion-medium: 200ms`.
- **Do not use `transition-all` for reusable UI primitives.** Specify exact properties: `color`, `background-color`, `border-color`, `opacity`, and `transform`. Avoid animating `box-shadow`, `width`, `height`, `padding`, `margin`, `top`, or `left`.
- **Command palette open/close is instant or opacity-only.** `⌘K` / Ctrl+K is a high-frequency keyboard surface; it must not scale, slide, blur, or wait behind dialog choreography.
- **Reduced motion removes transform, slide, blur, count-up, parallax, and smooth-scroll movement.** Keep opacity/color transitions only when they help comprehension.
- **Framer Motion scope:** `framer-motion` is allowed for DOM/UI state transitions: navigation island expand/collapse, command palette and dialog entrance, route opacity handoff, entity detail open/close, and DOM count-up numbers when stats render outside Canvas. Do not use Framer for WebGL scene physics.
- **Navigation island motion:** expanded/collapsed state uses a shared-layout morph over 180-220ms with opacity and a bounded blur/focus pull. Expanded content may fade/slide in by 4-6px after the shell begins moving. The collapsed icon badge can use a subtle hover/focus fade or scale up to `1.02`; avoid bounce, springy overshoot, list choreography, or a collapsed mini rail. Reduced motion disables the slide/blur and keeps the state change immediate.
- **No broad layout choreography:** existing Timeline/Library internals should not animate lists, heatmap cells, card grids, or route layout as decoration. State changes stay instant or short-fade for clarity.
- **React Bits / WebGL exception:** The Monitor page may use a single interactive 3D object or shader-like background layer when it reinforces personal identity. R3F/Drei owns Lanyard motion, 3D text, particles, orbital traces, bloom/depth effects, and in-Canvas numeric animation. Keep the rest of the chrome calm, monochrome, and data-first.
- **Reduced motion:** honor `prefers-reduced-motion`; disable count-up, parallax, particles, and nonessential transitions.
- **Per-theme decoration in expressive mode:** Each theme defines a decoration stack that activates only under `[data-intensity="expressive"]`:
  - **Phosphor Mono:** scanline overlay, vignette, phosphor text-glow, blinking cursor.
  - **Amber CRT:** amber scanlines, CRT flicker (≤3 Hz), vignette, amber text-glow.
  - **Retro Wave:** chromatic-offset title shadows (magenta + cyan), neon glow, top-edge gradient stripes on cards.
  - **Cyberpunk:** grid backdrop, notched panel corners (clip-path), hazard-stripe sidebar header, yellow text-glow.
  - **Monitor:** none — Monitor has no expressive decoration; it is calm by definition.
- **Calm intensity disables all of the above** via a single `[data-intensity="calm"]` override block that zeroes every decoration variable. `prefers-reduced-motion: reduce` triggers the same override regardless of the user's intensity choice.
- **Decoration utilities** (`.deco-scanlines`, `.deco-glow-text`, `.deco-notch`, `.deco-vignette`) are registered as Tailwind utilities via a plugin and consume theme CSS variables, so they collapse automatically under calm/reduced-motion without conditional classNames.

## Theme System

The theme system is the source of truth for how the five personalities are implemented. The architecture is CSS-variable-driven with `[data-theme]` and `[data-intensity]` attributes on `<html>`.

### Semantic Token Vocabulary (the contract)
Every theme must provide values for: backgrounds (`--bg-deep/marketing/panel/surface/hover`), text (`--text-primary/secondary/tertiary/quaternary`), accents (`--accent-primary/secondary/signal/glow`), fonts (`--font-display/body/mono`), borders (`--border-subtle/standard/primary/accent`), Timeline page chrome (`--timeline-*` title, lede, controls, select, and stats tokens), heatmap (`--heat-0`–`--heat-4`, `--heat-glow-2`–`--heat-glow-4`, `--heatmap-panel-bg`, `--heatmap-panel-border`, `--heatmap-panel-radius`, `--heatmap-panel-shadow`, `--heatmap-panel-clip`, month/day/legend typography tokens, `--heatmap-cell-radius`, `--heatmap-cell-clip`, `--heatmap-corner-size`, `--heatmap-corner-a-color`, `--heatmap-corner-b-color`, `--heatmap-corner-a-shadow`, `--heatmap-corner-b-shadow`), Menubar popover chrome (`--menubar-*` popover, title, view switch, chart, KPI, label, footer, and open-link tokens), and decoration (`--scanline-color/opacity`, `--vignette-strength`, `--title-shadow`, `--text-glow`, `--card-clip`, `--panel-notch-size`). Motion tokens (`--motion-*`) are shared across all themes and do not vary.

A new theme works with zero component code changes as long as it provides values for every token above.

### Theme Registry
| ID | Name | Display font | Swatch |
|---|---|---|---|
| `monitor` | Monitor | Inter | `#f7f8f8` |
| `phosphor` | Phosphor Mono (default) | JetBrains Mono | `#f7f8f8` |
| `amber` | Amber CRT | VT323 | `#ffb000` |
| `retro` | Retro Wave | Press Start 2P | `#00f0ff` |
| `cyberpunk` | Cyberpunk | Chakra Petch | `#fcee0a` |

### Switching
Themes and intensity are switched via the ⌘K command palette only — no new persistent chrome. A custom React `ThemeProvider` (~60 lines) mounts `data-theme` and `data-intensity` on `<html>` and persists `{ theme, intensity }` to `localStorage['ohmyc-theme']`. Theme switches are pure CSS variable swaps (instant); `setTheme` awaits font loading before flipping the attribute.

### Fonts
Fonts are self-hosted via `@fontsource` packages and dynamically imported per theme (Vite code-splits them). The default theme's fonts preload with the main bundle; the other four load on first switch then cache. Berkeley Mono (Monitor theme, commercial) is declared via a local `@font-face` and shipped under `packages/ui/public/fonts/`.

### Per-theme color tables
Refer to `assets/pixel-variants-20260622/variant-{a,b,c,d}-*.html` `:root` blocks for the authoritative per-theme color values. The implementation ports those values into `[data-theme="…"]` blocks in `globals.css`.

## Component Specs

### Card
- Padding: `p-7` (28px)
- Border: `1px solid rgba(255,255,255,0.08)`
- Border-radius: `rounded-lg` (8px)
- Background: `rgba(255,255,255,0.02)`
- Hover:
  - Background: `rgba(255,255,255,0.04)`
  - Border: `rgba(255,255,255,0.12)`
  - Transition: `background-color, border-color 160ms var(--motion-ease-out)`
- Icon box:
  - Size: `w-10 h-10` (40px)
  - Border-radius: `rounded-lg` (10px)
  - Background: `#f7f8f8` or `#d0d6e0` (inverted text)

### Navigation Island
- **Shell:** floating, borderless island on the left edge. No panel background, no border, no backdrop-filter. Nav items float directly on the page; the page blur creates visual separation when expanded.
- **Interaction:** hover-to-expand. Mouse enter triggers expansion; mouse leave collapses. Touch devices: tap keycap to toggle. Keyboard: focus to expand, blur to collapse.
- **Collapsed state:** 56px wide. First-letter keycaps (M T A S C P) in `var(--font-mono)` 14px. Active item has a 3px phosphor dot on the left edge.
- **Expanded state:** 220px wide. Full nav with icons, grouped Signal (Monitor, Timeline) and Explore (Agents, Commands, Skills, Plugins). Command palette trigger at bottom.
- **Stage Manager effect:** on hover, island rotates `rotateY(18deg)` with `transform-origin: left center`. Page content blurs (`blur(8px)`), dims (`brightness(0.5)`), scales down (`scale(0.96)`). A `rgba(0,0,0,0.3)` dim overlay sits between island and content. All effects animate 420ms ease-out.
- **State management:** zustand store holds `isHovered` (boolean, discrete) + `hoverProgress` (Framer Motion `MotionValue<number>`, continuous 0→1). `setHovered` updates both. `useTransform` derives all visual values from `hoverProgress` without React re-renders.
- **Reduced motion:** disables rotation, blur, scale. Only opacity crossfade remains.
- **No chevron button** — hover-to-expand eliminates manual collapse.

### Header
The standard top header is retired. Do not render a global 64px header on Monitor, Timeline, Agents, Commands, Skills, or Plugins.

- Command palette remains available through `⌘K` / Ctrl+K and may also appear as a compact island action.
- Route-specific controls live in the page body near the content they affect.
- Source filtering, when needed, moves into the relevant page's controls instead of occupying persistent chrome.

### Button
- **Primary:**
  - Background: `#f7f8f8`
  - Text: `#08090a`
  - Padding: `10px 20px`
  - Border-radius: `rounded-md` (6px)
  - Hover: `#d0d6e0`
- **Ghost:**
  - Background: `rgba(255,255,255,0.02)`
  - Text: `#d0d6e0`
  - Border: `1px solid rgba(255,255,255,0.08)`
  - Hover: `rgba(255,255,255,0.04)` text `#f7f8f8`
- **Icon:**
  - Size: `40px × 40px`
  - Border-radius: `rounded-full`
  - Background: `rgba(255,255,255,0.03)`
  - Border: `1px solid rgba(255,255,255,0.08)`

### Pill / Badge
- Background: transparent
- Text: `#d0d6e0`
- Border: `1px solid #23252a`
- Border-radius: `rounded-full` (9999px)
- Padding: `4px 12px`
- Font: `12px weight 510`
- **Success variant:**
  - Background: `#f7f8f8`
  - Text: `#08090a`
  - Border: none

### Timeline
Timeline entry sits in the navigation island under the `Signal` group. Timeline is the default route at `/explore/timeline`.

- **Page layout (top to bottom):**
  - Controls bar: metric toggle (`Activity | Tokens`), Project filter, Year picker, right-aligned summary meta (`N sessions · N turns · N tokens` in Berkeley Mono `text-quaternary`).
  - Heatmap inside a Level-1 surface card (`rgba(255,255,255,0.02)` bg, `border-default`, `rounded-lg`, `padding 20px 22px 18px`).
  - Event list: chronological, newest first, grouped by day → project → expanded sessions.

- **Heatmap (contribution graph):**
  - Grid: 53 weeks × 7 days, scoped to the selected calendar year (Jan 1 → Dec 31). Future cells render as bucket 0.
  - Cell size is responsive to the card's available width: distribute 53 week columns across the content area after the day-label column, clamped to compact readable squares. Default desktop target is roughly 10-18px cells with a 3-4px gap; cells remain square with `border-radius: 2px`.
  - Day-of-week labels (M / W / F) in `text-quaternary` Berkeley Mono `9px` — present, not loud.
  - Month strip on top in `text-quaternary` Berkeley Mono `10px`, `letter-spacing 0.04em`, uppercase.
  - 5-bucket grayscale luminance, scaled relative to selected metric's distribution:
    - 0: `rgba(255,255,255,0.04)`
    - 1: `rgba(255,255,255,0.15)`
    - 2: `rgba(255,255,255,0.30)`
    - 3: `rgba(255,255,255,0.50)`
    - 4: `rgba(255,255,255,0.78)`
  - Tooltip (Berkeley Mono, `surface-overlay` bg, `border-default`, `shadow-md`):
    - `Activity` mode → `<N> sessions · <N> turns` headline + `<date>` subline.
    - `Tokens` mode → `<N> tokens` headline + `<date>` subline.
  - Footer below grid: window caption (`Jan 1 → Dec 31, YYYY`) on the left, `Less … More` legend with 5-cell gradient on the right.
  - Click cell → scrolls event list to that day's heading.

- **Metric toggle (Radix Tabs):**
  - Two options: `Activity` (default, composite of `sessions + turns`) and `Tokens`.
  - Implement with the shared shadcn/Radix Tabs primitive so the control exposes `tablist`/`tab` semantics and `aria-selected` state.
  - Use the shared Tabs default sizing directly, but map the Timeline instance to OhMyC surface colors: `border-default`, `rgba(255,255,255,0.02)` list background, `rgba(255,255,255,0.08)` active tab background, `text-primary` active text. Do not add Timeline-local `h-auto` or `py-*` overrides.
  - Align height with the Project and Year Select triggers in the same row by using the shared default Select size, not `size="sm"`.

- **Year picker (dropdown):**
  - Lists only years with ≥1 session (no empty years).
  - Same chrome as the Project filter (`rounded-md`, `border-default`, `padding 7px 10px 7px 12px`).

- **Day heading:**
  - Berkeley Mono `13px / 510 / text-primary`, sticky, `padding 12px 8px 6px`.
  - Trailing summary in Berkeley Mono `text-quaternary` (`5 sessions · 142 turns · 410k tokens`).
  - Sticky background uses `linear-gradient(to bottom, var(--bg-marketing) 70%, transparent)` so content slides under cleanly.

- **Project rollup row:**
  - Collapsed: `padding 7px 14px`, `margin-bottom 1px`, `rounded-md`. Open: `padding 10px 14px` for breathing room above expanded sessions.
  - Hover bg `rgba(255,255,255,0.02)`.
  - Anatomy: `[caret] [project name in Inter 13/510] [counts in Berkeley Mono 12 text-tertiary] [right: time-range Berkeley Mono 11 text-quaternary]`.
  - Counts: `N sessions · N turns · Nk tokens · N tools · N skills`. **Counts only — no names.**
  - Caret: lucide ChevronRight, rotates 90° on open, `text-tertiary` → `text-primary` when open.

- **Expanded session rows:**
  - Indented 28px under rollup, with a 1px `border-subtle` left rail (no vertical connector lines).
  - Two lines per row:
    - Line 1: `[8px grayscale dot] [summary 14/510 text-primary, ellipsis] [right: HH:MM · <duration> Berkeley Mono 11 text-tertiary]`.
    - Line 2 (Berkeley Mono 11 text-tertiary, indented 20px): `<turns> · <tokens> · <N> tools · <N> skills`.
  - Dot intensity matches the day's heatmap bucket (l1/l2/l3 grayscale variants).
  - Summary rendering rule:
    - `summary_source = 'auto'` → render plain (curated title).
    - `summary_source = 'first_message'` → wrap in typographic quotes (`""`) — quote marks are the trust signal for raw user input.

- **States:**
  - First-load (no DB): centered card, "Setting up your timeline. This runs once and indexes your past Claude Code sessions." No skeleton.
  - Empty (no sessions ever, `timeline.status.sessionCount === 0`): centered card, "No sessions recorded yet. Run a session with Claude Code, Codex, or OpenCode and it shows up here." This state takes priority over the filter-empty row — a user who has never recorded anything has no filter to reset.
  - Filter empty (sessions exist, none match): inline `text-tertiary` Berkeley Mono row with `border-subtle` top and bottom — `No sessions match the current filters. [Reset filters]`.

### Menubar Popover
The desktop menubar popover is a compact monitor surface, not a miniature full page. It should feel like the same activity instrument as Timeline, compressed into a Tauri popover window.

- **Container:** Fill the available popover window with a responsive `w-full max-w-sm` content box rather than hard-coding the pixel width from the reference HTML. Height is content-driven. The Tauri window supplies transparent desktop blur; UI chrome supplies the themed tint, border, clipping, and overlays.
- **Token contract:** Components consume `--menubar-*` tokens for popover background/border/shadow/optional clip/stripe, title prefix/type/glow, view-switch states, chart stroke/fill/peak, KPI typography/color, label type, footer meta, and Open action. `:root` provides reusable defaults; themes override only their visible differences.
- **Header:** `Activity` stays a compact uppercase signal label. Prefix is themeable (`//`, `>`, `▌`, `▸`) through CSS, not duplicated in JSX.
- **View switch:** Icon-only line/heatmap buttons. Active/hover states are tokenized. No segmented pill or explanatory copy.
- **Line chart:** A clean sparkline/area chart with hidden axes. Use theme stroke/fill/peak-marker tokens, but do not add visible grid lines, tick labels, or chart furniture in the popover.
- **Heatmap:** 16 weeks × 7 days, same five-bucket activity model as Timeline. Keep the grid readable inside the popover width; do not force reference-image dimensions if they clip the grid.
- **KPI/footer:** Three compact KPI cells (`Tokens`, `Sessions`, `Peak`) plus peak-day meta and Open action. Numeric treatment is themeable: monochrome/CRT/arcade/HUD variants should come from tokens, not component branches. Cyberpunk may keep interior HUD typography/color, but the macOS menubar popover should not use a hard HUD outer frame.

### Monitor
Monitor entry sits in the navigation island under the `Signal` group above Timeline. Monitor is available at `/explore/monitor`; Timeline remains the default route at `/explore/timeline`.

- **Purpose:** Make OhMyC memorable as the user's personal Coding Monitor. The page should feel closer to a GitHub profile for AI coding activity than to a configuration dashboard.
- **Composition:** Lanyard-left, stats-right signal surface inside the headerless island shell:
  - Do not render any standard app header above the WebGL stage.
  - The navigation island floats over the stage and may collapse to a single icon badge to give the WebGL scene more room.
  - Left/center-left: React Bits Lanyard/WebGL identity object as the page's primary subject, large enough to define the route.
  - Right: display-scale animated stats stack, not cards. Use big numeric type with small labels (`842 / sessions`, `18.4M / tokens`, `2.3k / turns`).
  - Background: orbital traces and faint activity signal support the Lanyard/stats relationship, but should not compete with the numeric stack.
  - Surrounding field: AI-native telemetry should read as signal, not dashboard. Use sparse nodes, orbital traces, terminal fragments, model/session pulses, faint activity particles, and animated numeric readouts.
- **Stats:** Pull from Timeline data first, but expose only 2-3 numbers on this page. The rest belongs on Timeline. Preferred treatment is large typographic stats (`842 sessions`, `18.4M tokens`, `2.3k turns`) with animated number transitions. Project pulse and activity density should be visualized as ambient signal fields, not boxed widgets.
- **Visual rules:** The page theme is the Lanyard stage. Explorer chrome stays monochrome; the central WebGL stage may use a very deep black-violet/graphite tone when it matches the React Bits Lanyard component, but avoid bright purple/blue AI cliches, orbs, bokeh blobs, and marketing hero copy.
- **Implementation posture:** HTML mockups are layout references only. The real visual decision should happen in a small R3F/Drei spike because DOM mockups cannot show 3D text depth, Rapier dragging, Billboard behavior, bloom/depth effects, or Lanyard/stats occlusion.
- **3D scene split:** Put Lanyard, display-scale stats, animated numeric transitions, orbital traces, particles, and signal text inside the React Three Fiber canvas when the spike proves this reads better. Use DOM only for Explorer chrome, command palette, route controls, accessible fallback labels, and stats count-up if Canvas typography creates readability or implementation friction.
- **Interaction:** The Lanyard may be draggable/physics-driven. Stats should animate as kinetic typography in the scene. Data controls should remain conventional and compact; do not replace Timeline's detailed filtering on this page.
- **Monitor navigation island:** The Monitor navigation island should identify `OhMyC` and expose only essential navigation: Monitor, Timeline, Agents, Commands, Skills, Plugins, plus command palette access. Expanded width targets `216-224px`; collapsed state is only a `52-56px` icon badge using a temporary `lucide-react` icon. Use rounded 12px corners, subtle border, translucent panel background, and no full-height page rail or collapsed mini rail. Later brand-icon replacement should touch only the collapsed badge icon and expanded brand mark.

## File Structure

```
packages/ui/src/
├── app.tsx              # Top-level routes
├── explorer.tsx         # Current Explorer route shell + route rendering
├── globals.css          # Design tokens + spacing scale
├── components/
│   ├── sidebar.tsx      # Current navigation component; target is floating island
│   ├── header.tsx       # Retired global header; remove from primary route shell
│   ├── command-palette.tsx
│   ├── command-palette-trigger.tsx # Optional island trigger, not header chrome
│   ├── section-header.tsx
│   ├── entity-card.tsx
│   ├── entity-detail.tsx
│   ├── source-switcher.tsx # Move into page-body controls when used
│   ├── timeline/
│   │   ├── timeline-view.tsx
│   │   ├── contribution-graph.tsx
│   │   └── event-list.tsx
│   └── ui/              # Shared primitives
```

## Layout & Interaction

The visual system above is settled. This section governs **how the app is laid out and operated** — what lives where on the page, what the keyboard does, and which surfaces are the canonical entry points. Visual changes go in the sections above; placement / behavior changes go here.

**Master thesis:** OhMyC uses a headerless personal monitor shell. A floating collapsible navigation island is the only persistent chrome; every primary route renders its own content full-height underneath it. Monitor owns the memorable first impression, Timeline remains the detailed activity surface, and Agents, Commands, Skills, and Plugins remain the resource library. Hooks, MCP, and LSP no longer have top-level UI entries, though lower-level config APIs remain available for configuration flows that need them. Settings UI was removed on 2026-06-16; lower-level settings read/write APIs remain available for configuration flows that need them. Profiles were archived on 2026-06-16 behind the Git tag `archive/profiles-before-removal-20260616` and are no longer part of the active product.

### Default route
- Landing route is `/explore/timeline`.
- The wildcard fallback (`*`) also redirects to `/explore/timeline`.
- Rationale: Timeline gives immediate evidence that OhMyC is connected to the user's local activity. Monitor becomes the memorable identity surface, while Agents, Commands, Skills, and Plugins remain resource library routes.

### Command palette (primary action surface)
- **Placement:** No persistent header pill. The command palette is always available through ⌘K/Ctrl+K. If a visible trigger is needed, render it as a compact action inside the navigation island, not in a global top bar.
- **Visible trigger anatomy (optional):** `[search icon 14] [⌘K]`
  - Height: `32-36px`
  - Border-radius: `8px`
  - Background: `rgba(255,255,255,0.02)`
  - Border: `1px solid rgba(255,255,255,0.08)`
  - Keycap: `11px / weight 510 / text-quaternary`, `1px solid rgba(255,255,255,0.08)` border, `rounded-sm`
- **Open behavior:** ⌘K (or Ctrl+K) anywhere, or click the optional island trigger. Opens a centered dialog at Level 4 elevation (`#191a1b` + dialog shadow stack), 640px wide, max-height 480px, with backdrop dim `rgba(0,0,0,0.6)`.
- **Command groups (in order):**
  1. **Go to** — `Monitor`, `Agents`, `Skills`, `Commands`, `Timeline`
  2. **Search** — typed-in token searches across agents, skills, and commands
- **Keyboard map (inside palette):** ↑/↓ navigate, ↵ run, Esc close.
- **Global keyboard map (when palette is closed):**
  - `g m` — go to Monitor
  - `g a` — go to Agents
  - `g s` — go to Skills
  - `g c` — go to Commands
  - These bindings are silent when focus is in a text input.

### Header chrome
There is no standard header chrome. Breadcrumbs, source switchers, search triggers, and contextual actions must not create a persistent top bar.

- Breadcrumbs are optional page-body metadata, not global chrome.
- Source switchers move into page controls on Library/Timeline surfaces when they are needed.
- Monitor should stay headerless and full-bleed so the R3F/Drei stage owns the first impression.

### Explorer view rules
- **Default shell:** every route uses the navigation island plus route-owned content. Do not wrap all pages in a shared `max-w-6xl p-10` shell.
- **Island-aware content offset:** non-Monitor routes start from the workspace to the right of the expanded navigation island (`~280px` desktop, `~260px` tablet) with normal top/right/bottom page padding. The route content is left-aligned within that workspace; do not use the old header-era `mx-auto` centering shell that recenters content across the whole viewport.
- **Monitor:** full-bleed stage under the floating island.
- **Existing route migration scope:** Timeline, Agents, Commands, Skills, and Plugins keep their existing internal layout and information architecture. The shell migration removes the global header, replaces the docked sidebar with the floating navigation island, and preserves each route's current page body structure.
- **Timeline:** keep the current Timeline internals: title/description, controls bar, heatmap card, recent activity header, and event list. The route itself becomes headerless and the island overlays outside the page body.
- **Library pages:** Agents, Commands, Skills, and Plugins keep their current SectionHeader, two-column EntityCard grid, detail views, empty states, and page-body controls. Do not redesign these pages while migrating the shell.
- **Card grid:** uniform 2-column grid. No `featured` variant — every card has equal weight. Featured-card emphasis was a holdover from a different IA and undermines scanability.
- **Plugins page:** starts directly with the Plugins section header and inventory cards. The former Environment summary was removed because workspace-level Hooks/MCP/LSP counts are no longer part of the top-level Explorer IA.
- **Skeletons:** removed for first paint. The Explorer reads from local config files — load is fast enough that skeletons flash and create perceived jank. Show content directly; if a future async source is added, reintroduce a single subtle pulse, not the multi-row skeleton.

### Wireframe reference
- **Layout & Interaction wireframe index:** `~/.gstack/projects/JiangWeixian-claudeui/designs/layout-interaction-20260426/index.html` — historical per-screen files. Profiles-related screens are archived references only after the 2026-06-16 removal.
- **Coding Monitor mockup:** `~/.gstack/projects/JiangWeixian-claudeui/designs/coding-monitor-20260617/index.html` — active design direction for `/explore/monitor`: headerless full-bleed WebGL stage, floating collapsible navigation island, left/center-left React Bits Lanyard, right-side display-scale animated stats, sparse orbital signal field, and compact activity strip.
- **Timeline wireframe:** `~/.gstack/projects/JiangWeixian-claudeui/designs/timeline-20260430/wireframe.html` — single Timeline screen: navigation entry, controls bar, 53×7 heatmap, day/project/session event list.
- Open the relevant wireframe before changing the surfaces it covers — placement is settled there, not in this doc.

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-25 | Spacing: Tailwind classes | User prefers Tailwind over CSS variables for spacing |
| 2026-04-25 | Timeline icon: Mini graph | Superseded by 2026-06-17 navigation island grouping. Timeline still needs a recognizable activity icon, but the old sidebar-specific preview treatment is retired |
| 2026-04-25 | Cards: Featured variant | Superseded by 2026-04-26 uniform-grid decision. Featured-card emphasis was an IA holdover and is no longer active |
| 2026-04-25 | Dark theme only | App is developer tool, dark is standard |
| 2026-04-25 | No sidebar animation | Superseded by 2026-06-17 navigation island shell. The active-state principle remains: use instant or short fades, no sliding nav animation |
| 2026-04-25 | Monochrome palette | User requested dark + gray only, no accent colors |
| 2026-04-25 | Primary button: white | Inverted style for maximum contrast |
| 2026-04-25 | Relaxed letter-spacing | User found aggressive tracking too tight |
| 2026-04-26 | ⌘K is the primary action surface | Superseded by 2026-06-17 headerless island shell for visible placement. The CommandPaletteProvider remains the primary action surface, but any visible trigger belongs inside the navigation island |
| 2026-04-26 | Drop Explorer `featured` card variant | Equal-weight 2-col grid scans faster; emphasis was IA holdover |
| 2026-04-26 | Environment Summary on Plugins tab only | Superseded by 2026-06-16 Plugins Environment summary removal. Plugin pages now start directly with the section header and inventory cards |
| 2026-04-26 | Remove first-paint skeletons in Explorer | Local config reads are fast; skeleton flash creates perceived jank |
| 2026-04-26 | Reverse earlier "Featured variant" decision | Superseded by 2026-04-26 uniform-grid decision above |
| 2026-05-01 | Timeline lives under new sidebar group `Activity` | Superseded by 2026-06-17 `Signal` group in the navigation island. The activity-first rationale still holds, but the old Explorer sidebar grouping is retired |
| 2026-05-01 | Heatmap metric toggle = `Activity \| Tokens` (not Sessions/Turns/Tokens) | Activity is composite (sessions + turns); turns dominate naturally and that's the better intensity signal. Tooltip surfaces both numbers |
| 2026-05-01 | Heatmap range filter is a Year picker, not date-range presets | 53×7 grid is fundamentally a calendar year; arbitrary windows break the shape. Picker only lists years with activity |
| 2026-05-01 | Rollup and session meta lines show counts only (`N tools · N skills`), no names | Comma-separated names blow up row width and force truncation; counts give the same signal at a fraction of the visual cost. Names belong in a future hover/detail surface |
| 2026-05-01 | Expanded sessions use 28px indent + 1px `border-subtle` left rail, no connector lines | Vertical connectors read as gantt-energy; the rail is enough to communicate child-of-rollup |
| 2026-05-01 | Day headings sticky with fade-to-bg gradient under them | Content slides under the heading without a hard rule; matches the "no decoration" rule for chrome separations |
| 2026-05-01 | first_message summaries wrap in typographic quotes; auto summaries render plain | The quote marks are the trust signal — readers know unquoted text is a generated title and quoted text is what the user actually typed |
| 2026-05-13 | Header gains Explorer-only Source switcher next to the ⌘K pill | Superseded by 2026-06-17 headerless island shell. Source filters now belong in page-body controls, not persistent chrome |
| 2026-05-13 | EntityCard takes provider-supplied `badges`; per-entity-type switch removed | Schema branching belonged in the provider, not the card. Origin chip on the card header is `entity.origins.join(' · ')` so shared skills (claude · opencode · agents) read at a glance |
| 2026-06-16 | Profiles archived and removed from product/backend surfaces | The restore point is Git tag `archive/profiles-before-removal-20260616`; user `$OHMYC_HOME/profiles` data is left untouched but no longer read or maintained |
| 2026-06-16 | Settings UI removed from Explorer and ⌘K surfaces | Settings page entry points and components were deleted; `g s` now maps only to Skills. Lower-level settings APIs remain for non-page configuration flows |
| 2026-06-16 | Explorer resource tabs reduced to Agents, Commands, Skills, Plugins; Plugins Environment summary removed | The resource library now centers on the four core inventories while Timeline remains an activity route. Hooks/MCP/LSP remain lower-level config capabilities without top-level UI chrome |
| 2026-06-17 | Product positioning shifts to personal Coding Monitor | OhMyC should be remembered as an AI coding activity/profile surface first; resource management remains available but is no longer the product's primary mental model |
| 2026-06-17 | Add `/explore/monitor` as the memorable Activity entry | Monitor can use a React Bits Lanyard/WebGL identity object plus compact stats. Timeline remains the default detailed route at `/explore/timeline` |
| 2026-06-17 | Monitor route is headerless with a collapsible navigation island | Removing the header gives the WebGL stage room to own first impression; the floating island keeps navigation available without making the page feel like an Explorer dashboard |
| 2026-06-17 | All primary routes use the headerless navigation island shell | The app should feel like a personal monitor workspace, not an Explorer dashboard. Timeline and Library pages keep readable content constraints inside their page body, but no route gets the old global header |
| 2026-06-17 | Existing non-Monitor routes keep their internal layout | Headerless island is a shell migration for Timeline, Agents, Commands, Skills, and Plugins. Their controls, grids, cards, detail panels, and timeline structure should not be redesigned in the same change |
| 2026-06-17 | Collapsed navigation island is a single icon badge | A collapsed mini rail still feels like product chrome. One lucide-react placeholder icon keeps the page quiet now and can be swapped for the brand icon later |
| 2026-06-17 | Use Framer Motion for DOM chrome, not WebGL scene motion | The AI monitor needs motion to feel alive, but the boundary matters: Framer handles island/dialog/route/count-up UI, while R3F/Drei handles Lanyard, particles, 3D text, and scene physics |
| 2026-06-19 | Tighten UI motion policy around high-frequency surfaces | Command palette and repeated library interactions should feel immediate; reusable primitives specify exact animated properties, and reduced motion removes transform/scroll/count-up movement |
| 2026-06-20 | Monitor stats use sessions, tokens, and turns | Turns are first-class coding activity signal from Timeline event data. They are more directly useful on the identity surface than last-sync metadata, which may be absent or stale |
| 2026-06-20 | Move navigation island below native macOS traffic lights | The Tauri window now uses native traffic-light controls. A `top: 18px` island collides with that chrome, so desktop expanded/collapsed island states start around 48px and keep content-aligned rhythm |
| 2026-06-20 | Timeline metric toggle uses Radix Tabs semantics | The visual treatment stays compact, but Activity/Tokens now exposes native `tablist`/`tab` semantics and selected state through the shared shadcn/Radix primitive |
| 2026-06-20 | Timeline heatmap fills widened content | The 53-week graph should distribute columns across its card instead of keeping fixed 10px cells centered in a widened layout |
| 2026-06-23 | Introduce five-theme + calm/expressive system; default changes from Monitor to Phosphor Mono | PRODUCT.md anti-references reframed from aesthetic bans to execution failures so the chromatic themes (Amber/Retro/Cyberpunk) can ship. Theme system is CSS-variable-driven with `[data-theme]`/`[data-intensity]` on `<html>`; components already consume shadcn semantic tokens and need zero code changes for color. Fonts self-hosted via `@fontsource` for offline Tauri support |
| 2026-06-23 | Timeline heatmap gets component-level theme tokens | The pixel variants define more than cell colors: panel background/border/radius/shadow, month and day-label color/glow, legend type, cell radius, and Retro corner marks are part of the component grammar. These belong in theme tokens/utilities, not inline React styles |
| 2026-06-23 | Timeline page chrome uses theme-level tokens | The variant screenshots give each theme a distinct page title, controls, select, and stats grammar. Timeline should map those through component-scoped tokens instead of inheriting generic shadcn rounded controls. Retro body copy uses JetBrains Mono from the reference, with Silkscreen reserved for arcade labels and heatmap microcopy |
| 2026-06-23 | Menubar popover gets reusable `--menubar-*` theme tokens | The menubar variants differ in popover tint, title prefix/type, view-switch states, chart glow, KPI typography/color, and footer action. These are reusable theme grammar, not per-component conditionals. Width/height should follow the actual popover container rather than hard-coding the reference HTML's 340px width; the line chart remains a clean sparkline with no visible tick/grid furniture. Cyberpunk keeps interior HUD color/type but drops the hard outer HUD frame because macOS menubar popovers should rely on native popover material |
| 2026-06-24 | Navigation Island: hover-to-expand Stage Manager replaces click-to-expand | Hover is more natural for a floating island. zustand + MotionValue: zustand manages discrete `isHovered`, MotionValue drives continuous animation via `useTransform` (no re-renders). Borderless — page blur creates visual separation. Collapsed state shows first-letter keycaps (M T A S C P) instead of a single icon badge |
| 2026-08-19 | Onboarding gate installs by driving each agent's own CLI, and never-recorded is its own Timeline state | The gate used to hand the user off to a GitHub README, then drop them into a Timeline that said "No sessions match the current filters" — misleading, since a new user has no filters. The gate now detects which agents are on the machine and installs for them. It shells out to `claude plugin install` / `codex plugin add` rather than writing the agents' registries: a hand-written `installed_plugins.json` was compared against what Claude actually produces and every field was wrong (key `timeline@ohmyc` not `ohmyc-timeline`, schema v2, `installPath` inside Claude's own cache after it clones the repo, plus `settings.json`'s `enabledPlugins` and `known_marketplaces.json`) — forging private state fails silently the moment it moves. OpenCode stays a native `opencode.json` edit because that file is documented user-facing config. Because a successful install does not create the monitor store — the plugin does that when the next session ends — the gate holds its own "Plugin installed, recording starts next session" state instead of letting `setup.status` stay `missing_store` and read as failure. Timeline's never-recorded copy drops the Claude-only wording now that three agents are supported |
| 2026-06-25 | Missing monitor store uses a hidden `/onboard` setup route | When the local monitor store is unavailable, the main app should route to a headerless setup gate instead of rendering a broken or empty Timeline. A `SetupGate` at the app root checks `useSetupStatus` and renders only `OnboardingGate` (no Navigation Island, no command palette) when not ready; `/onboard` is hidden and is not regular navigation chrome. Retry refetches only (installs nothing); no database path is shown. The desktop menubar popover runs its own internal gate (`MenubarOnboard`, a shrunk mini-computer) since the full gate is too large for the 360px popover; "Open OhMyC" opens the main window which runs the full gate. The visual subject uses the `frosted-ivory-lamplit-screen-baked` Atropos computer (screen baked into the shell image, real layered shell/keyboard depth, reduced-motion fallback, low-contrast Letter Glitch ambience) |

## Do's and Don'ts

### Do
- Use Inter Variable with `"cv01", "ss03"` on all text
- Use weight 510 as default emphasis weight
- Build on near-black backgrounds: `#08090a` for pages, `#0f1011` for panels
- Use semi-transparent white borders (`rgba(255,255,255,0.05)` to `rgba(255,255,255,0.08)`)
- Keep button backgrounds nearly transparent: `rgba(255,255,255,0.02)` to `rgba(255,255,255,0.05)`
- Use `#f7f8f8` for primary text — not pure white
- Apply the luminance stacking model: deeper = darker bg, elevated = slightly lighter bg

### Don't
- Don't use pure white (`#ffffff`) as primary text
- Don't use solid colored backgrounds for buttons
- Don't apply chromatic colors in the Monitor theme — it stays pure monochrome. Other themes define their own accent hues via the token contract
- Don't use positive letter-spacing on display text
- Don't use visible/opaque borders on dark backgrounds
- Don't skip the OpenType features (`"cv01", "ss03"`)
- Don't use weight 700 (bold) — maximum is 590
- Don't ship any theme (in either intensity) that fails WCAG AA contrast — chromatic accents must be tuned to pass
- Don't use drop shadows for elevation on dark surfaces
