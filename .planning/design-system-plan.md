# ClaudeUI Design System Plan

## Current State Audit

### Problems Found

**1. Spacing Chaos**
- Magic numbers everywhere: `text-[16px]`, `w-44`, `gap-5`
- No consistent scale: cards use 20px, 24px, 32px randomly
- Page padding varies: `px-6`, `px-8`, `px-10` across views

**2. Card Component Issues**
- `py-0 p-6` — inconsistent vertical/horizontal padding
- Icon box `size-11` feels cramped
- Hover state only changes border — no lift, no depth

**3. Sidebar Navigation**
- "Explore" label at 11px looks disabled
- Active state uses animated overlay — hard to see at a glance
- Flat list, no section grouping

**4. Component Size**
- Explorer.tsx: 536 lines handling everything
- Changing card style requires reading routing logic

**5. Search Input**
- `w-44` (176px) — too narrow for real search queries

---

## Proposed Design System

### Spacing Scale (4px base)

```
xs  : 4px   — icon gaps, tight padding
sm  : 8px   — element gaps, small padding
md  : 12px  — section gaps
lg  : 16px  — card padding, comfortable gaps
xl  : 20px  — section padding
2xl : 24px  — page padding
3xl : 32px  — major section separation
4xl : 48px  — hero spacing
```

### Border Radius Scale

```
sm  : 6px  — buttons, small elements
md  : 8px  — cards, panels
lg  : 10px — modals, large panels
xl  : 14px — hero sections
```

### Card Design Spec

```
Padding: 20px all sides (xl)
Border: 1px solid var(--border-default)
Border-radius: 8px (md)
Background: var(--surface-raised)

Hover state:
- Border brightens to var(--border-hover)
- Transform: translateY(-2px)
- Box-shadow: var(--shadow-sm)
- Transition: 150ms ease-out

Icon box:
- Size: 40px (10 × 4px grid)
- Border-radius: 8px
- Background: var(--surface-panel)
```

### Sidebar Design Spec

```
Width: 240px
Background: var(--surface-panel)
Border-right: 1px solid var(--border-default)

Section headers:
- Font: 11px uppercase
- Letter-spacing: 0.05em
- Color: var(--text-tertiary)
- Padding: 12px 16px 8px

Nav items:
- Padding: 8px 12px
- Border-radius: 6px
- Gap: 10px (icon + label)

Active state:
- Background: var(--accent-blue) at 12% opacity
- Text: var(--accent-blue)
- Border: 1px solid var(--accent-blue) at 30% opacity
- NO animation — instant, clear

Hover state:
- Background: white at 3% opacity
```

### Header Design Spec

```
Height: 56px
Background: var(--surface-base)
Border-bottom: 1px solid var(--border-default)

Breadcrumb:
- Font: 13px
- Inactive: var(--text-tertiary)
- Active: var(--text-primary) with font-weight 500

Search input:
- Width: 240px minimum
- Height: 32px
- Border-radius: 6px
- Background: var(--surface-panel)
```

---

## Component Restructure Plan

### Explorer.tsx Split

```
Explorer/
├── index.tsx          — Routing + layout (100 lines)
├── Sidebar.tsx        — Navigation (80 lines)
├── ContentArea.tsx    — Header + content wrapper (60 lines)
├── EntityList.tsx     — Grid of cards (80 lines)
├── EntityDetail.tsx   — Detail view (100 lines)
├── EnvironmentSummary.tsx — Stats row (60 lines)
└── ConfigSection.tsx  — MCP/hooks/LSP config (60 lines)
```

### New Components

```
components/
├── ui/
│   ├── Card.tsx       — Standardized card with hover
│   ├── SidebarNav.tsx — Navigation with active states
│   └── SearchInput.tsx — Consistent search field
```

---

## Timeline Component Design

### Layout

```
+------------------+
| Contribution Graph|  ← Top: 7-column grid, 12 weeks
| (GitHub-style)    |     Color intensity by event count
+------------------+
| Filter bar        |  ← "All events | Activations | Edits"
+------------------+
| Event List        |  ← Bottom: chronological list
| - timestamp       |     Grouped by day
| - event type      |
| - entity name     |
+------------------+
```

### Contribution Graph Spec

```
Grid: 7 columns (days) × 12 rows (weeks)
Cell size: 10px × 10px
Cell gap: 3px
Border-radius: 2px

Colors (based on event count):
- 0: var(--surface-panel)
- 1-2: var(--accent-blue) at 30%
- 3-5: var(--accent-blue) at 50%
- 6-9: var(--accent-blue) at 70%
- 10+: var(--accent-blue) at 100%

Tooltip on hover: "5 events on Apr 15, 2026"
Click: Filter event list to that day
```

### Event List Item Spec

```
Height: 48px
Padding: 12px 16px
Border-bottom: 1px solid var(--border-default)

Left: Icon (16px) + Event type badge
Center: Entity name + action description
Right: Timestamp (relative: "2h ago")

Hover: Background var(--surface-overlay)
```

---

## Migration Order

### Phase 1: Design Tokens (1 hour)
1. Add spacing variables to globals.css
2. Update border-radius to use scale
3. Verify all existing colors still work

### Phase 2: Card Component (2 hours)
1. Create standardized Card component
2. Update EntityCard to use new Card
3. Update all card instances in Explorer

### Phase 3: Sidebar (2 hours)
1. Redesign Sidebar with clear active states
2. Add section grouping (Explore, Manage)
3. Remove animation, use instant state change

### Phase 4: Header + Search (1 hour)
1. Widen search input
2. Clean up breadcrumb styling
3. Consistent header height

### Phase 5: Component Split (3 hours)
1. Split Explorer.tsx into sub-components
2. Move each section to its own file
3. Verify no functionality lost

### Phase 6: Timeline (4 hours)
1. Create TimelineEvent interface
2. Build contribution graph component
3. Build event list component
4. Add route and sidebar entry
5. Connect to mock data

---

## Success Metrics

After implementation, verify:
- [ ] All spacing uses 4px scale (no magic numbers)
- [ ] Cards have consistent 20px padding + hover lift
- [ ] Sidebar active state is instantly recognizable
- [ ] Search input is ≥240px wide
- [ ] Explorer split into files <150 lines each
- [ ] Timeline renders with mock data
- [ ] All tests pass (`pnpm test`)

---

## Open Questions

1. Should we use CSS variables or Tailwind classes for spacing?
2. Do you want the timeline sidebar icon to show a mini graph preview?
3. Should cards have a "featured" variant (larger, spanning 2 columns)?
