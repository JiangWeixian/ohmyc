# Design System — ClaudeUI

## Product Context
- **What this is:** CLI tool with WebUI for managing .claude configuration files (agents, skills, commands, profiles)
- **Who it's for:** Developers using Claude Code who want visual management of their agent configs
- **Space/industry:** Developer tools / AI agent management
- **Project type:** Web app (dark-themed dashboard)

## Aesthetic Direction
- **Direction:** Monochrome dark — precision engineering aesthetic
- **Decoration level:** Minimal
- **Mood:** Serious developer tool. Dense but readable. No fluff. No color.
- **Reference:** Linear (monochrome variant), GitHub dark mode, Vercel dashboard

## Philosophy
Darkness as the native medium. Content emerges from near-black backgrounds through carefully calibrated luminance steps. No chromatic accents — the only "color" is the gradation from white to black.

## Typography
- **Primary:** Inter Variable with OpenType features `"cv01", "ss03"` enabled globally
- **Fallbacks:** SF Pro Display, -apple-system, system-ui, Segoe UI, Roboto
- **Monospace:** Berkeley Mono (ui-monospace, SF Mono, Menlo fallback)
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
- **Approach:** Pure monochrome — zero chromatic colors
- **Backgrounds:**
  - Marketing/Deep: `#08090a` — page background
  - Panel: `#0f1011` — sidebar, panels
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
  - `rounded-xl`: 12px — panels, featured cards
  - `rounded-full`: 9999px — pills, chips

## Depth & Elevation
On dark surfaces, elevation is communicated through background luminance steps, not shadows:
- **Level 0 (Flat):** No shadow, `#08090a` bg
- **Level 1 (Surface):** `rgba(255,255,255,0.02)` bg + `rgba(255,255,255,0.08)` border
- **Level 2 (Elevated):** `rgba(255,255,255,0.04)` bg + `rgba(255,255,255,0.08)` border
- **Level 3 (Panel):** `#191a1b` bg + `rgba(255,255,255,0.08)` border
- **Level 4 (Dialog):** `#191a1b` bg + multi-layer shadow stack

## Motion
- **Approach:** Minimal-functional
- **Easing:**
  - Enter: ease-out (150ms)
  - Exit: ease-in (200ms)
  - Move: ease-in-out (200ms)
- **Duration:**
  - Micro: 100ms — focus rings
  - Short: 150ms — hover states
  - Medium: 200ms — page transitions
  - Long: 300ms — modals
- **No layout animations** — instant state changes for clarity

## Component Specs

### Card
- Padding: `p-7` (28px)
- Border: `1px solid rgba(255,255,255,0.08)`
- Border-radius: `rounded-lg` (8px)
- Background: `rgba(255,255,255,0.02)`
- Hover:
  - Background: `rgba(255,255,255,0.04)`
  - Border: `rgba(255,255,255,0.12)`
  - Transition: `transition-all duration-150 ease-out`
- Icon box:
  - Size: `w-10 h-10` (40px)
  - Border-radius: `rounded-lg` (10px)
  - Background: `#f7f8f8` or `#d0d6e0` (inverted text)

### Sidebar
- Width: `w-60` (240px)
- Background: `#0f1011`
- Border: `border-r border-rgba(255,255,255,0.05)`
- Section headers:
  - Text: `text-[13px] font-medium text-[#8a8f98]`
  - Padding: `px-4 pt-3 pb-2`
- Nav items:
  - Padding: `px-3 py-2`
  - Border-radius: `rounded-md` (6px)
  - Gap: `gap-2.5`
- Active state:
  - Background: `rgba(255,255,255,0.08)`
  - Text: `#f7f8f8`
  - Instant — no animation
- Hover state:
  - Background: `rgba(255,255,255,0.03)`

### Header
- Height: `h-16` (64px)
- Background: `#0f1011`
- Border: `border-b border-rgba(255,255,255,0.05)`
- Search input:
  - Width: `w-60` (240px)
  - Height: `h-9` (36px)
  - Border-radius: `rounded-md` (6px)
  - Background: `rgba(255,255,255,0.02)`
  - Border: `1px solid rgba(255,255,255,0.08)`

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
- Layout:
  - Top: Contribution graph (GitHub-style)
  - Bottom: Event list (chronological)
- Contribution graph:
  - Grid: 53 weeks × 7 days
  - Cell size: 10px × 10px
  - Cell gap: 4px
  - Colors (grayscale opacity):
    - 0: `rgba(255,255,255,0.05)`
    - 1–2: `rgba(255,255,255,0.15)`
    - 3–5: `rgba(255,255,255,0.3)`
    - 6–9: `rgba(255,255,255,0.5)`
    - 10+: `rgba(255,255,255,0.7)`
  - Tooltip on hover: "X events on [date]"
  - Click filters event list
- Event list item:
  - Padding: `20px`
  - Gap: `20px`
  - Border-radius: `rounded-lg` (8px)
  - Hover: `rgba(255,255,255,0.02)`
  - Dot: `10px` circle, grayscale gradient

## File Structure

```
packages/ui/src/
├── globals.css          # Design tokens + spacing scale
├── components/
│   ├── ui/
│   │   ├── card.tsx     # Standardized Card
│   │   ├── sidebar-nav.tsx  # Navigation component
│   │   ├── search-input.tsx # Consistent search
│   │   └── pill.tsx     # Badge/pill component
│   ├── Explorer/
│   │   ├── index.tsx    # Main layout + routing
│   │   ├── Sidebar.tsx  # Navigation sidebar
│   │   ├── ContentArea.tsx  # Header + content
│   │   ├── EntityList.tsx   # Grid of cards
│   │   ├── EntityDetail.tsx # Detail view
│   │   ├── EnvironmentSummary.tsx # Stats row
│   │   └── ConfigSection.tsx    # Config views
│   └── Timeline/
│       ├── index.tsx        # Main timeline view
│       ├── ContributionGraph.tsx # GitHub-style grid
│       └── EventList.tsx    # Chronological events
```

## Layout & Interaction

The visual system above is settled. This section governs **how the app is laid out and operated** — what lives where on the page, what the keyboard does, and which surfaces are the canonical entry points. Visual changes go in the sections above; placement / behavior changes go here.

**Master thesis:** Profiles are the killer flow. Activate / compare / swap is the centerpiece — the rest of the app is supporting surface. The layout already supports this; we don't restructure it. We **propagate two pieces of chrome** (active-profile chip + ⌘K pill) and **wire one keyboard surface** (the command palette) so profile actions are reachable from anywhere in two keystrokes.

### Default route
- Landing route is `/profiles`. The wildcard fallback (`*`) also redirects to `/profiles`, not `/explore/agents`.
- Rationale: profiles are the front door. Explorer is a reference surface, not a destination.

### Active-profile chip (header-right, persistent)
- **Placement:** Top-right of the page header, on every route. Mirrors the chip in `ProfilesView` so the active identity travels with the user across Profiles ↔ Explorer ↔ Settings.
- **Anatomy:** `[avatar dot] Active <name> ▾`
  - Avatar dot: 6px circle, `#f7f8f8` fill (active = white)
  - Label: `12px / weight 510 / text-secondary`, "Active" prefix in `text-tertiary`
  - Caret: `lucide ChevronDown size 12`, `text-tertiary`
- **Container:**
  - Height: `h-9` (36px)
  - Padding: `px-3` (12px)
  - Border: `1px solid rgba(255,255,255,0.08)`
  - Background: `rgba(255,255,255,0.02)`
  - Border-radius: `rounded-full`
  - Hover: bg → `rgba(255,255,255,0.04)`, border → `rgba(255,255,255,0.14)`
- **Click:** opens a small dropdown — list of profiles + `Compare…` + `Manage profiles →` (links to `/profiles`).
- **Empty state:** if no active profile, show `No active profile` with `text-tertiary` and no avatar dot. Clicking still opens the dropdown.

### ⌘K command palette (primary action surface)
- **Placement:** A pill button sits **immediately left** of the active-profile chip in the header, on every route. Replaces any inert search input that was previously rendered for cosmetic purposes.
- **Pill anatomy:** `[search icon 14] Search... [⌘K]`
  - Width: `w-60` (240px)
  - Height: `h-9` (36px)
  - Border-radius: `rounded-md` (6px)
  - Background: `rgba(255,255,255,0.02)`
  - Border: `1px solid rgba(255,255,255,0.08)`
  - Right-aligned `⌘K` keycap: `11px / weight 510 / text-quaternary`, `1px solid rgba(255,255,255,0.08)` border, `rounded-sm`
  - **Visually a search input; behaviorally a button** — clicking opens the palette.
- **Open behavior:** ⌘K (or Ctrl+K) anywhere, or click the pill. Opens a centered dialog at Level 4 elevation (`#191a1b` + dialog shadow stack), 640px wide, max-height 480px, with backdrop dim `rgba(0,0,0,0.6)`.
- **Command groups (in order):**
  1. **Profile** — `Activate <name>`, `Compare with…`, `Duplicate active profile`, `Edit active profile`
  2. **Go to** — `Profiles`, `Explorer / Agents`, `Explorer / Skills`, `Explorer / Commands`, `Settings`
  3. **Search** — typed-in token searches across profiles, agents, skills, commands (only appears when query is non-empty)
- **Keyboard map (inside palette):** ↑/↓ navigate, ↵ run, Esc close.
- **Global keyboard map (when palette is closed):**
  - `⌘1 / ⌘2 / ⌘3` — activate the 1st / 2nd / 3rd profile in sidebar order (top three)
  - `g p` — go to Profiles
  - `g e` — go to Explorer
  - `g s` — go to Settings
  - `c` — open Compare panel against active profile
  - These bindings are silent when focus is in a text input.

### Compare side panel
- **Trigger:** Palette command `Compare with…` → pick a target profile → panel slides in.
- **Placement:** Right-edge panel, `w-[480px]`, full viewport height, slides in from the right (200ms ease-in-out) over the current view. The underlying view dims to `rgba(0,0,0,0.4)`.
- **Surface:** `#191a1b` bg, `border-l 1px solid rgba(255,255,255,0.08)`, dialog shadow stack.
- **Header:** `Compare — <active-name> vs <target-name>` (24px / weight 510), close `×` icon-only button top-right.
- **Body:** sectioned diff (Agents / Skills / Commands / Model configs / Settings). Each row uses leading markers in `font-mono`:
  - `+` (`text-primary`) — only in target
  - `−` (`text-tertiary`) — only in active
  - `=` (`text-quaternary`) — same in both
- **Footer:** sticky bar with two buttons. Left: ghost `Close`. Right: primary `Activate <target>` (one-click swap).
- **Built on:** the existing dialog primitive (Base UI / Radix Dialog wrapper). Do not introduce a new modal stack.

### Header chrome propagation
The header on **every** route renders the same three things, in this order from right to left: notifications/secondary actions → ⌘K pill → active-profile chip. Routes are not allowed to render their own header search inputs or ad-hoc identity widgets. If a route needs a contextual action, it goes in the page body, not the header.

### Explorer view rules
- **Card grid:** uniform 2-column grid. No `featured` variant — every card has equal weight. Featured-card emphasis was a holdover from a different IA and undermines scanability.
- **Environment Summary:** rendered **only on the Plugins tab**. It is plugin-specific; on Hooks / MCP / LSP it was decorative noise.
- **Skeletons:** removed for first paint. The Explorer reads from local config files — load is fast enough that skeletons flash and create perceived jank. Show content directly; if a future async source is added, reintroduce a single subtle pulse, not the multi-row skeleton.

### Profile row interactions (sidebar)
- **Default state:** `[icon] <name>` and, if active, an `Active` badge pinned right.
- **Hover:** reveal a `QuickActions` cluster (right-aligned, `gap-1`):
  - `Activate` (ghost, primary if not yet active)
  - `Compare` (ghost) — opens the Compare panel against this row
- These are the only hover-revealed actions. Don't add edit/delete to the row — those live in the profile detail.

### Wireframe reference
- Pixel-level reference: `~/.gstack/projects/JiangWeixian-claudeui/designs/layout-interaction-20260426/wireframe.html`
- Four screens: Profiles front door · ⌘K palette open · Compare side panel · Explorer view (chrome propagation).
- Open it before changing header / palette / compare layout — the placement is settled there, not in this doc.

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-25 | Spacing: Tailwind classes | User prefers Tailwind over CSS variables for spacing |
| 2026-04-25 | Timeline icon: Mini graph | Shows live activity preview in sidebar |
| 2026-04-25 | Cards: Featured variant | Important items span 2 columns for emphasis |
| 2026-04-25 | Dark theme only | App is developer tool, dark is standard |
| 2026-04-25 | No sidebar animation | Instant active state is clearer |
| 2026-04-25 | Monochrome palette | User requested dark + gray only, no accent colors |
| 2026-04-25 | Primary button: white | Inverted style for maximum contrast |
| 2026-04-25 | Relaxed letter-spacing | User found aggressive tracking too tight |
| 2026-04-26 | Default route: `/profiles` | Profiles are the killer flow; Explorer is reference surface, not landing |
| 2026-04-26 | Active-profile chip in every header | Identity must travel with the user; activation is ≤2 clicks from anywhere |
| 2026-04-26 | ⌘K is the primary action surface | Wire the existing CommandPaletteProvider; replace inert header search inputs with the palette pill |
| 2026-04-26 | Compare = right-side panel, not full page | Reuses dialog primitive; keeps active context visible behind the dim |
| 2026-04-26 | Drop Explorer `featured` card variant | Equal-weight 2-col grid scans faster; emphasis was IA holdover |
| 2026-04-26 | Environment Summary on Plugins tab only | Plugin-specific stats; was decorative on Hooks/MCP/LSP |
| 2026-04-26 | Remove first-paint skeletons in Explorer | Local config reads are fast; skeleton flash creates perceived jank |
| 2026-04-26 | Reverse earlier "Featured variant" decision | Superseded by 2026-04-26 uniform-grid decision above |

## Migration Checklist

### Phase 1: Design Tokens
- [ ] Update globals.css with new monochrome palette
- [ ] Add Inter Variable font with cv01, ss03 features
- [ ] Verify all existing colors map to new system

### Phase 2: Card Component
- [ ] Create `components/ui/card.tsx`
- [ ] Update EntityCard with new spacing
- [ ] Update all card instances

### Phase 3: Sidebar
- [ ] Redesign with grayscale active states
- [ ] Add section grouping
- [ ] Remove animation

### Phase 4: Header + Search
- [ ] Widen search to 240px
- [ ] Clean breadcrumb styling
- [ ] Set header height to 64px

### Phase 5: Component Split
- [ ] Split Explorer.tsx
- [ ] Move each section to own file
- [ ] Verify no functionality lost

### Phase 6: Timeline
- [ ] Create TimelineEvent interface
- [ ] Build ContributionGraph (grayscale)
- [ ] Build EventList
- [ ] Add route and sidebar entry
- [ ] Connect to mock data

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
- Don't apply any chromatic colors (blue, purple, cyan, etc.)
- Don't use positive letter-spacing on display text
- Don't use visible/opaque borders on dark backgrounds
- Don't skip the OpenType features (`"cv01", "ss03"`)
- Don't use weight 700 (bold) — maximum is 590
- Don't introduce warm colors into the UI chrome
- Don't use drop shadows for elevation on dark surfaces