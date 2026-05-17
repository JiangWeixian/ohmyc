# Design System — OhMyC

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
Sidebar entry sits in **both** Profiles' and Explorer's sidebars under a new `Activity` group (lucide `Activity` icon — heartbeat line). Same `/timeline` route, two doors.

- **Page layout (top to bottom):**
  - Controls bar: metric toggle (`Activity | Tokens`), Project filter, Year picker, right-aligned summary meta (`N sessions · N turns · N tokens` in Berkeley Mono `text-quaternary`).
  - Heatmap inside a Level-1 surface card (`rgba(255,255,255,0.02)` bg, `border-default`, `rounded-lg`, `padding 20px 22px 18px`).
  - Event list: chronological, newest first, grouped by day → project → expanded sessions.

- **Heatmap (contribution graph):**
  - Grid: 53 weeks × 7 days, scoped to the selected calendar year (Jan 1 → Dec 31). Future cells render as bucket 0.
  - Cell size: 10×10, gap: 4. `border-radius: 2px`.
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

- **Metric toggle (segmented control):**
  - Two options: `Activity` (default, composite of `sessions + turns`) and `Tokens`.
  - Background `rgba(255,255,255,0.02)`, `border-default`, `rounded-md`, `padding 3px`.
  - Active button: `rgba(255,255,255,0.08)` bg, `text-primary`, `rounded-sm` (4px), `padding 6px 12px`, `12px / 510`.
  - Inactive: transparent bg, `text-tertiary`.

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
  - Empty (no sessions ever): centered card, "No Claude Code sessions yet. Run a Claude Code session in any project and your activity will show up here."
  - Filter empty: inline `text-tertiary` Berkeley Mono row with `border-subtle` top and bottom — `No sessions match the current filters. [Reset filters]`.

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

### Profiles → Components (store library views)
The Profiles sidebar's `Components` group (Agents / Skills / Commands / Model configs) opens **store-management** views — distinct in job from Explorer's read-only browse. Routes: `/profiles/agents`, `/profiles/skills`, `/profiles/commands`, `/profiles/model-configs`.

- **Header chrome:** same propagation rules. Breadcrumb is `Profiles / <Component>` (e.g. `Profiles / Agents`).
- **Toolbar (top of content):**
  - Left-flex: search input (`bg rgba(255,255,255,0.02)`, `1px border var(--border-default)`, `rounded-md`, placeholder `Search <component> by name…`).
  - Right cluster: ghost `Import` button + primary `New <singular>` button. **No type-filter segmented control** — the sidebar already segments by type; duplicating it adds chrome without affordance.
- **Counter line** (Berkeley Mono, 12px, `text-tertiary`, sits between toolbar and list):
  `<N> <plural> · <M> referenced · <K> unused`. Reads like a status line; frames the screen as inventory.
- **Row anatomy** (dense, 64–72px tall, `rounded-lg`, `bg rgba(255,255,255,0.02)`, hover lifts to `0.04`):
  - `[36px square avatar — initials, rounded-md, bg rgba(255,255,255,0.04), 1px border]`
  - Name: `14px / weight 510 / text-primary`
  - Description: `12px / text-secondary / line-clamp-1`
  - Meta line: Berkeley Mono `11px / text-tertiary` — `source · model · imported from <path>` (omit empty fields)
  - **Right cluster — "Used by" indicator (the killer column):**
    - **0 refs** → italic `Unused` (Berkeley Mono, `text-quaternary`); row name dims to `text-secondary` so deletion candidates are scannable.
    - **1–2 refs** → `Used by` label + profile-name pills (`rounded-full`, `1px border var(--border-default)`, `bg rgba(255,255,255,0.02)`, `11px weight 510`).
    - **3+ refs** → single `Used by N profiles` mono badge with tooltip listing names.
  - **Hover-revealed quick actions** (right-edge cluster, `gap-1`): ghost `Edit` + ghost `Delete` (red-tinted on hover via `text-[var(--accent-red)]` only on the icon hover state — text stays grayscale per monochrome rule).
- **Empty state:** centered card (matches Profiles empty-state pattern) with headline `No <plural> in your store yet`, blurb, primary action `Import components`.
- **Delete confirm:** reuses `DeleteConfirmDialog`. When `Used by N` ≠ 0, dialog lists referencing profile names inline — surfaces the same data the row already showed; no extra fetch.
- **Out of scope here:** in-place add/remove from active profile (composition lives in profile detail, not the store). The store edits the canonical components; profile composition is separate.

### Profile editor (`/profiles/new`, `/profiles/:name/edit`)
The editor replaces the prior wall-of-cards layout. Three structural pieces — sticky save bar, left section nav, sectioned content — and one rule: **section visual treatment matches the data type** (form vs picker vs code).

- **Sticky save bar (top of `main`, replaces the route header):**
  - Left: breadcrumb `Profiles / <name> / Edit` (or `New profile`).
  - Right cluster (right-to-left): primary `Save profile` with `⌘S` keycap, ghost `Cancel`, dirty indicator (`6px white dot + "Unsaved changes"` in Berkeley Mono `text-tertiary`).
  - Save is **disabled** until the form is both dirty and valid (no JSON parse errors). Cancel closes back to the prior route; if dirty, prompt-on-leave.
- **Left section nav (sticky, `w-[200px]`, own scroll container):**
  - `Sections` eyebrow + numbered jump-links: `01 Basics`, `02 Components`, `03 Plugins & model`, `04 Runtime config`, `05 Settings overlay`.
  - Active item: `bg rgba(255,255,255,0.06) / text-primary`. Inactive: `text-secondary`. Number prefix: Berkeley Mono `11px / text-quaternary`, fixed 18px column.
  - **Error propagation:** if any field in a section is invalid, that nav item shows a `6px text-tertiary dot` on the right edge — find errors when scrolled into another section.
  - Active section determined by scroll-spy on the section eyebrows; clicks scroll-to without changing the route.
- **Section heading rhythm** (every section uses the same skeleton):
  - Eyebrow row: `[Berkeley Mono number `01`] [headline 20px/590 -0.15px] [optional right-aligned mono meta — counts/error-summary]`
  - 1-line subtitle below, `13px / text-tertiary`, indented 28px so it visually hangs off the number column.
  - Content area indented 28px so number column reads as a margin.
- **Section visual treatments (the differentiation rule):**
  - **01 Basics — light form**, no card chrome. Stacked full-width fields (Name above Description) — single column matches the rest of the form's vertical rhythm. Name field is `font-mono` (it's an id), disabled in edit mode with a one-line `text-quaternary` caption.
  - **02 Components — picker cards**, one per type (Agents / Skills / Commands), `bg rgba(255,255,255,0.02)` + `border rounded-lg`. Each card: header row `[icon] [type name] [n / total mono badge] [inline search 200px]`; body = chip-cloud of selected items + dashed `+ Add <type>` chip that opens a typeahead. Selected chip = `bg rgba(255,255,255,0.06)` solid + `×` remove handle. Empty types collapse to single-row affordance with the `+ Add` chip on the right of the header.
  - **03 Plugins & model — stacked panels** (full width, top to bottom). Plugins panel = checkbox grid of available plugins with source meta. Model-config panel = dropdown with provider readout below. No side-by-side — keeps a single vertical column through the entire form.
  - **04 Runtime config — code mode** (the gear-shift). Visually **distinct from every other section**: `bg #08090a` deep surface (not `0.02`), Berkeley Mono throughout, line numbers, `{ }` eyebrow icon, header row `[{ } icon] [field name] [optional schema hint] [right: "valid" / mono error summary]`. Each field (hooks / mcpServers / lspServers) is its own panel with the same anatomy.
    - Error rendering: invalid JSON line gets `bg rgba(255,255,255,0.04)`, line-number bumped to `text-primary / 590`, and an inline `← expected ,` annotation in `text-quaternary` to the right of the offending token. Panel border lifts to `rgba(255,255,255,0.18)`.
  - **05 Settings overlay — single code panel** (same anatomy as 04). Lives in its own section because settings is a different conceptual surface (Claude runtime tuning) from the per-tool configs in 04, even though the editor is identical.
- **Layout shell:** 2-pane split inside `main` — `aside` (left nav) + scrolling content. The page-level header row is **replaced** by the save bar; the editor does not render the standard breadcrumb header. Active-profile chip and ⌘K pill **do not** appear on the editor route — modal-like focus on the form is intentional.
- **Empty profile (new):** all chip clouds empty, all JSON editors empty, dirty bit only flips after first edit. Save button reads `Create profile` instead of `Save profile`.

### Wireframe reference
- **Layout & Interaction wireframe index:** `~/.gstack/projects/JiangWeixian-claudeui/designs/layout-interaction-20260426/index.html` — 8 per-screen files: Profiles front door · ⌘K palette open · Compare side panel · Explorer view (chrome propagation + Source dropdown) · Profiles → Agents store · Profile editor · Agent detail · Agent editor.
- **Timeline wireframe:** `~/.gstack/projects/JiangWeixian-claudeui/designs/timeline-20260430/wireframe.html` — single Timeline screen: sidebar entry, controls bar, 53×7 heatmap, day/project/session event list.
- Open the relevant wireframe before changing the surfaces it covers — placement is settled there, not in this doc.

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
| 2026-04-28 | Profiles→Components store uses dense rows, not cards | Job is management (CRUD + reference auditing), not discovery — rows pack 4–5× the density of cards and surface the "Used by" column inline |
| 2026-04-28 | "Used by N" is the killer column on store views | Answers "what breaks if I delete this?" before the delete dialog; 0-ref rows tagged `Unused` to make orphans scannable |
| 2026-04-28 | No type-filter segmented control on store views | Sidebar already segments by type (Agents/Skills/Commands/Model configs); duplicating it adds chrome without affordance |
| 2026-04-29 | Profile editor uses sticky save bar + left section nav | Long form was unscannable; numbered jump-links + scroll-spy + dirty/save bar match Linear/Vercel settings UX |
| 2026-04-29 | Editor sections differ visually by data type, not just by heading | Form (light), picker (chip cards), code (mono dark surface w/ line numbers) — visual gear-shift makes mode obvious before reading |
| 2026-04-29 | Active-profile chip + ⌘K pill hidden on editor route | Editor is modal-like focus; chrome propagation rule has an explicit exception for forms with their own save bar |
| 2026-04-29 | JSON errors propagate to section nav as a dot | Users scrolled past a broken section don't lose track of where the error is |
| 2026-04-29 | Editor uses single-column stacked fields, no in-section 2-col grids | Side-by-side Name/Description and Plugins/Model broke the form's vertical rhythm; stacking improves scanability and works at narrower widths |
| 2026-05-01 | Timeline lives under new sidebar group `Activity`, in both Profiles and Explorer sidebars | Same `/timeline` route, two doors — discoverable from either view without duplicating IA |
| 2026-05-01 | Heatmap metric toggle = `Activity \| Tokens` (not Sessions/Turns/Tokens) | Activity is composite (sessions + turns); turns dominate naturally and that's the better intensity signal. Tooltip surfaces both numbers |
| 2026-05-01 | Heatmap range filter is a Year picker, not date-range presets | 53×7 grid is fundamentally a calendar year; arbitrary windows break the shape. Picker only lists years with activity |
| 2026-05-01 | Rollup and session meta lines show counts only (`N tools · N skills`), no names | Comma-separated names blow up row width and force truncation; counts give the same signal at a fraction of the visual cost. Names belong in a future hover/detail surface |
| 2026-05-01 | Expanded sessions use 28px indent + 1px `border-subtle` left rail, no connector lines | Vertical connectors read as gantt-energy; the rail is enough to communicate child-of-rollup |
| 2026-05-01 | Day headings sticky with fade-to-bg gradient under them | Content slides under the heading without a hard rule; matches the "no decoration" rule for chrome separations |
| 2026-05-01 | first_message summaries wrap in typographic quotes; auto summaries render plain | The quote marks are the trust signal — readers know unquoted text is a generated title and quoted text is what the user actually typed |
| 2026-05-13 | Header gains Explorer-only Source switcher between ⌘K pill and active-profile chip | Default = all sources, persisted to `localStorage` as `ohmyc.sources`. Last-on guard prevents zero-state. Exception to header-chrome-uniformity rule because filter is Explorer-specific |
| 2026-05-13 | EntityCard takes provider-supplied `badges`; per-entity-type switch removed | Schema branching belonged in the provider, not the card. Origin chip on the card header is `entity.origins.join(' · ')` so shared skills (claude · opencode · agents) read at a glance |

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