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