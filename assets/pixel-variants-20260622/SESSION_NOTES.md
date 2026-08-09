# Session Notes — Pixel UI Variants (2026-06-22/23)

> Working notes for remote continuation. Last updated 2026-06-23.

## TL;DR

Explored **4 pixel/geek design directions** (A/B/C/D) across **4 page types** (dashboard / timeline / library / menubar), plus **3 sidebar UX experiments** (drawer, floating, floating+collapse). All work is HTML preview files only — **no source code touched**. Nothing decided yet — waiting on user to pick a direction.

## Where things live

```
assets/pixel-variants-20260622/
├── index.html                              ← landing board, open this first
│
│  Dashboard variants (hero + stat cards + heatmap):
├── variant-a-phosphor-mono.html            ← white-on-black, respects rules
├── variant-b-amber-crt.html                ← IBM 3270 amber phosphor
├── variant-c-retro-wave.html               ← cyan/magenta synthwave
├── variant-d-cyberpunk.html                ← yellow + cyan HUD, notched panels
├── variant-e-low-poly.html                 ← (pre-existing, light theme, not from this session)
│
│  Timeline variants (53-week heatmap + event list):
├── timeline-a-phosphor-mono.html
├── timeline-b-amber-crt.html
├── timeline-c-retro-wave.html
├── timeline-d-cyberpunk.html
│
│  Library variants (agents / skills / commands / plugins + detail view):
├── agents-a-phosphor-mono.html             ← sidebar switches between pages, click agent → detail
├── agents-b-amber-crt.html
├── agents-c-retro-wave.html
├── agents-d-cyberpunk.html
│
│  Menubar popover variants (340px wide, line/heatmap toggle):
├── menubar-a-phosphor-mono.html
├── menubar-b-amber-crt.html
├── menubar-c-retro-wave.html
├── menubar-d-cyberpunk.html
│
│  Sidebar UX experiments (only variant A so far):
├── drawer-a-phosphor-mono.html             ← slide-in drawer with backdrop
├── floating-a-phosphor-mono.html           ← no border, no background panel
└── floating-collapse-a-phosphor-mono.html  ← latest: collapse to 56px icon rail
```

## The four directions

| Variant | Aesthetic | Color | PRODUCT.md impact | Verdict so far |
|---|---|---|---|---|
| **A · Phosphor Mono** | PixelSnow + FaultyTerminal textures in white-on-black | Pure monochrome | None — ships inside existing rules | Safe baseline; "geek" mostly reads via typography |
| **B · Amber CRT** | VT323 + IBM Plex Mono, scanlines + flicker | Single warm hue `#ffb000` | One-line relaxation needed | Strong identity, still disciplined |
| **C · Retro Wave** | Press Start 2P + Silkscreen, neon glow, chromatic offset | Cyan + magenta + amber | Hard break with anti-references | Most "geek pixel" energy |
| **D · Cyberpunk 2077** | Chakra Petch + Rajdhani, notched corner panels, hazard stripes | Yellow `#fcee0a` + cyan + red | Hard break + repositions voice | Most game-HUD; very loud |

## Strategic conflict flagged

- `PRODUCT.md` line 36 (anti-references): bans "Gamer / RGB / 'hacker' terminal chrome. No neon, no rainbow gradients, no aggressive terminal cosplay."
- `DESIGN.md`: "No chromatic accents of any kind. The only 'color' is the gradation from white to black."
- **A** stays inside these rules. **B** bends them. **C** and **D** break them hard.
- Whichever direction we commit to, `PRODUCT.md` and `DESIGN.md` need to be updated to match before implementation.

## Sidebar UX experiments (variant A only)

User iterated through three sidebar patterns over the session:

1. **`drawer-a-*.html`** — Slide-in drawer. Default hidden. `≡` trigger button top-left slides sidebar in from `translateX(-100%)` over 320ms. Backdrop blur. Hamburger morphs to X. Keyboard: `[` toggle, `Esc` close.
2. **`floating-a-*.html`** — Persistent sidebar with `background: transparent` and `border: 0`. Nav items float directly on the page bg. No chrome anywhere. Page-load slide-in cascade animation.
3. **`floating-collapse-a-*.html`** — **Latest, most promising.** Floating (no bg/border) PLUS collapse toggle. Expanded 220px / collapsed 56px (just keycaps `M T A S C P`). Hover a collapsed keycap → tooltip with full name. Chevron toggle rides the sidebar's right edge. Keyboard: `[` collapse, `]` expand.

**Open question:** apply collapse pattern to B/C/D? User hasn't said yet.

## Faithfulness to real components

All variants mirror actual component structure from `packages/ui/src/`:

- `SectionHeader` — Overview overline + title + description
- `EntityCard` — 40×40 icon chip + title + origin badge + render badge + 3-line description
- `EntityDetail` — back button + frontmatter card + prose card
- `TimelineView` — page header + control bar (tabs/selects/stats) + contribution graph + event list
- `EventList` — day → project rollup → session item hierarchy with sticky day headers
- `ContributionGraph` — 53×7 grid with month strip + DOW labels + legend
- `MenubarPage` — translucent popover, header + view switch + chart + 3-cell KPI row + footer
- `Sidebar` — vertical tabs with `[M]`-style keycaps

Real components live in `packages/ui/src/components/{entity-card,entity-detail,section-header,sidebar,menubar,timeline}/`.

## What's NOT done yet

- [ ] Decide on a direction (A / B / C / D — or remix)
- [ ] Apply `floating-collapse` pattern to B/C/D (only A has it)
- [ ] Apply chosen pattern to `timeline-*.html` and `agents-*.html` (only `variant-*.html` dashboards have it)
- [ ] Update `PRODUCT.md` if not picking A
- [ ] Update `DESIGN.md` with new system (color, typography, motion, decoration, Decisions Log row)
- [ ] Implement chosen variant in real React components

## How to continue

1. **Open `index.html`** in the assets folder — it's the landing board linking all variants with pros/cons.
2. Compare variants side-by-side (open one of each in tabs).
3. Tell the assistant:
   - "Picking variant X" → we update docs and start implementing
   - "Apply collapse to B/C/D" → mirror `floating-collapse-a-*.html` into the other variants
   - "Adjust [specific thing]" → tighter iteration on a single file

## Commits on this branch

- `5bbc9d3` — `:art: chore(design): add pixel-style UI exploration variants` (the 21 preview files)
- Earlier commits on `hotfix/geek-design` are unrelated polish work.

## Repo note

GitHub redirected the push: repo was renamed from `JiangWeixian/claudeui` to `JiangWeixian/ohmyc`. Push still works via redirect. Optional cleanup:
```bash
git remote set-url origin git@github.com:JiangWeixian/ohmyc.git
```

## Reference: react-bits components studied

Located in `vendor/react-bits/src/ts-default/`:
- `Backgrounds/PixelSnow/` — Three.js raymarched snow field (white default, monochrome-friendly)
- `Backgrounds/FaultyTerminal/` — OGL CRT shader with scanlines/glitch/curvature (white tint default)
- `Backgrounds/LetterGlitch/` — Canvas character grid with color interpolation
- `Components/PixelCard/` — Canvas pixel particles that shimmer on hover (default white variant)
- `Animations/PixelTrail/`, `PixelTransition/` — pixel motion patterns

All four variants A/B/C/D re-implement these effects via Canvas 2D approximations (no three.js/ogl dependency) so the previews render instantly.
