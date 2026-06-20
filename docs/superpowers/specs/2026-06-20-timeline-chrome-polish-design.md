# Timeline Chrome Polish Design

## Goal

Polish the Timeline desktop chrome in one focused pass:

- Replace the Timeline `Activity | Tokens` hand-rolled segmented control with the existing Radix/shadcn-style `Tabs` primitive.
- Move the navigation island away from the macOS traffic-light controls.
- Make the collapsed island badge smaller and aligned with the main content rhythm.
- Let the Timeline contribution graph use the wider content area instead of leaving a large empty gutter inside the heatmap card.

This is a layout and implementation alignment pass, not a visual redesign.

## Non-Goals

- Do not redesign the Timeline information architecture.
- Do not change the `Activity` metric semantics. `Activity` still maps to the turns-based heatmap signal while the UI surfaces session and turn context.
- Do not replace or broadly restyle `packages/ui/src/components/ui/tabs.tsx`.
- Do not change Monitor, Agents, Commands, Skills, or Plugins content layouts beyond shared navigation-island positioning.
- Do not introduce a browser companion or separate HTML preview artifact.

## Design Source Updates

Because the current `DESIGN.md` navigation-island spec says the island sits at `top: 18px`, implementation must update `DESIGN.md` before code changes:

- Add a Decisions Log row for desktop window traffic-light clearance.
- Amend the Navigation Island section so desktop expanded and collapsed states sit below native macOS controls, around `top: 48px`, while preserving the 18px left edge and bottom breathing room.
- Clarify that the collapsed badge aligns visually with route content top rhythm and uses a quieter 44-48px control with a 16px icon.

The existing Timeline metric-toggle visual spec remains valid. The implementation changes the underlying primitive, not the intended look.

## Components

### Timeline Metric Tabs

`TimelineView` should import `Tabs`, `TabsList`, and `TabsTrigger` from `@/components/ui/tabs` and use them as a controlled root:

- `value={metric}`
- `onValueChange={(value) => setMetric(value as 'activity' | 'tokens')}`
- triggers: `activity` / `tokens`

The styling should stay local to the Timeline control:

- list: rounded md, `border-default`, `rgba(255,255,255,0.02)` background, `p-[3px]`
- active trigger: `rgba(255,255,255,0.08)`, `text-primary`, rounded small
- inactive trigger: transparent, `text-tertiary`, hover to secondary

Do not add `TabsContent`. This is a metric switch for one chart/list surface, not separate tab panels.

### Navigation Island

Expanded desktop island:

- left stays `18px`
- top moves to about `48px`
- height becomes `calc(100dvh - 66px)` so the bottom keeps roughly 18px breathing room
- visual treatment remains the existing translucent monochrome island

Collapsed desktop badge:

- top matches the expanded island top, about `48px`
- size becomes 44-48px
- icon becomes 16px
- the badge aligns with route content rhythm instead of the macOS traffic-light row

Small-screen behavior can keep the existing compact values unless the same overlap appears there.

### Timeline Graph Width

`ContributionGraph` currently uses fixed 10px cells and 4px gaps. After the content width grew, the card expands but the grid remains narrow. The graph should become responsive while preserving the contribution-graph feel:

- Measure the available grid width inside the card.
- Compute a cell size and gap that fill the row across 53 weeks on desktop.
- Keep a minimum cell size of 10px and gap of 4px.
- Cap growth so cells do not become chunky; prefer modest cell growth and stable month spacing.
- On narrow screens, preserve usability with the current fixed sizing and horizontal overflow if needed.

Footer caption and legend should remain aligned to the card edges.

## Data Flow

No backend or data-hook changes are required.

- Timeline metric state remains local to `TimelineView`.
- `activity` still maps to `TimelineMetric = 'turns'`.
- `tokens` still maps to `TimelineMetric = 'tokens'`.
- Project/year filters remain unchanged.

## Accessibility

- Radix Tabs should provide keyboard navigation for the metric switch.
- Each trigger keeps readable text labels.
- Focus states must remain visible against the dark surface.
- Reduced motion behavior is unchanged; no new layout animation is required.

## Testing Plan

Verify:

- `pnpm --filter @ohmyc/ui build`
- `pnpm --filter @ohmyc/ui test -- --run`
- If practical, run the local UI and inspect Timeline at desktop width:
  - expanded island does not overlap macOS traffic lights
  - collapsed badge does not overlap macOS traffic lights
  - collapsed badge and Timeline content feel vertically aligned
  - metric switch still matches the previous visual style
  - heatmap grid fills the widened card without losing the GitHub-style rhythm

