# Phase 1 — Theme Documentation Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reframe `PRODUCT.md` and `DESIGN.md` so the five switchable dark themes (Monitor, Phosphor Mono, Amber CRT, Retro Wave, Cyberpunk) and the calm/expressive intensity toggle are first-class, replacing the monochrome-only anti-references that currently forbid them.

**Architecture:** Documentation-only change. No code touched. `PRODUCT.md` keeps the "personal Coding Monitor" concept but drops "calm precision instrument" as the sole canonical voice; anti-references become execution guidelines (banning failures, not aesthetics). `DESIGN.md` gains a Theme System section, per-theme color/font tables, and expressive-decoration rules.

**Tech Stack:** Markdown. Spec source: `docs/superpowers/specs/2026-06-23-theme-system-design.md`.

**Depends on:** Nothing. This is the first phase.

**Blocks:** Phase 2 (token + component implementation) must not start until this lands — the new docs define the constraints Phase 2 codes against.

---

## File Structure

- Modify: `PRODUCT.md` — reframe Brand Personality, Anti-references, Design Principles; add Theme Personalities section
- Modify: `DESIGN.md` — reframe Aesthetic Direction, Philosophy, Color, Typography, Motion; add Theme System section; add Decisions Log row

---

### Task 1: Reframe PRODUCT.md voice and anti-references

**Files:**
- Modify: `PRODUCT.md:22-53` (Brand Personality through Accessibility)

- [ ] **Step 1: Rewrite Brand Personality section**

Replace the entire `## Brand Personality` section (current lines 22-28) with:

```markdown
## Brand Personality

Precision-engineering, adaptive, signal-first. Three words: **precise, adaptive, signal-first.**

- **Voice:** Serious personal monitor. Dense but readable. Expert, not flashy. Personality is the user's choice — five themes ship, each with its own voice, but all stay expert and data-first.
- **Emotional goal:** "This knows me, and it's mine." The interface should feel like a calibrated instrument the user has personalized — their terminal, their cockpit, their HUD — not a generic dashboard handed to anyone.
- **Mood reference:** A themeable personal monitor built on near-black engineering surfaces. The Monitor theme evokes a monochrome Linear + GitHub contribution-graph density; the Phosphor Mono theme evokes a late-night terminal; Amber CRT evokes an IBM 3270 console; Retro Wave evokes an 80s arcade; Cyberpunk evokes a game HUD. All five share the same dark foundation; personality is expressed through themable color, typography, and decoration layers.
```

- [ ] **Step 2: Rewrite Anti-references section**

Replace the entire `## Anti-references` section (current lines 30-38) with:

```markdown
## Anti-references

What OhMyC explicitly must NOT do — reframed as **execution failures**, not aesthetic bans. Any theme, in any intensity, that commits one of these failures is a bug:

- **A generic SaaS dashboard.** No hero-metric template (big number + small label + gradient accent), no identical icon-card grids, no tiny uppercase eyebrow above every section. It must not read as another Vercel/Linear clone — regardless of which theme is active.
- **A heavy configuration-admin UI.** Not a dry rows-of-forms settings manager. Even when it manages config, the experience should feel like a monitor, not a control panel.
- **Low-contrast AI-cliche visuals.** Expressive intensity permits chromatic themes, but low-contrast purple/blue orb cliches, bokeh blobs, and marketing hero copy remain banned in every theme. Chromatic accents must pass WCAG AA.
- **Unreadable or fatiguing execution.** No theme ships body text below 11px. No expressive animation exceeds 3 Hz (photosensitive trigger ceiling). No theme in expressive mode may produce fatiguing flicker on long reading sessions — if a user reports fatigue, that theme's expressive decoration is too strong and must be toned down.
- **Over-animated / busy.** Motion is intentional and calm; no decorative list, grid, or route-layout choreography on every surface. Calm intensity and `prefers-reduced-motion` disable all ambient decoration.
```

- [ ] **Step 3: Update Design Principles**

In `## Design Principles`, update item 2 (current line 42) from:

```markdown
2. **Darkness is the native medium.** Build on near-black backgrounds; communicate hierarchy through calibrated luminance steps and semi-transparent white, never through chromatic color or drop shadows.
```

to:

```markdown
2. **Darkness is the native medium; personality is the user's choice.** All five themes build on near-black backgrounds. The Monitor theme communicates hierarchy through monochrome luminance steps; the chromatic themes (Amber, Retro, Cyberpunk) add themed accent hues. Personality is the user's selection — the monitor adapts, it does not impose one voice.
```

And update item 3 (current line 43) from:

```markdown
3. **One memorable identity surface.** The Monitor route earns the only motion/WebGL budget. Everything else stays calm, data-first, and quiet so the identity surface can sing.
```

to:

```markdown
3. **One memorable identity surface.** The Monitor route earns the only WebGL budget, regardless of active theme. Everything else stays data-first. The active theme's personality is carried by color, typography, and (in expressive mode) decoration — not by giving every route its own animation budget.
```

- [ ] **Step 4: Add Theme Personalities section**

Insert this new section immediately **after** `## Design Principles` (before `## Accessibility & Inclusion`):

```markdown
## Theme Personalities

The theme system supports an open set of personalities. **As of v1, five ship:**

| Theme | Personality | Default? |
|---|---|---|
| **Monitor** | Today's clean monochrome. Inter + Berkeley Mono. No ambient decoration. The "calm precision instrument" voice lives here. | |
| **Phosphor Mono** | Textured monochrome. JetBrains Mono. Scanlines, phosphor glow, blinking cursor in expressive mode. | **first-run** |
| **Amber CRT** | IBM 3270 amber phosphor. VT323 + IBM Plex Mono. Single warm hue. CRT scanlines and flicker in expressive mode. | |
| **Retro Wave** | 80s synthwave. Press Start 2P + Silkscreen. Cyan + magenta + amber. Chromatic offset shadows and neon glow in expressive mode. | |
| **Cyberpunk** | Game HUD. Chakra Petch + Rajdhani. Yellow + cyan + red. Notched panels, hazard stripes, grid backdrop in expressive mode. | |

Each theme has two **intensity** modes:

- **calm** — color and typography only. All ambient decoration disabled. Every theme reads as a serious data surface.
- **expressive** — the full decoration stack for that theme is active.

Phosphor Mono is the default first-run theme at `expressive` intensity. Users switch themes and intensity via the ⌘K command palette. Adding a sixth theme is one CSS block plus one registry entry — the architecture is additive.
```

- [ ] **Step 5: Verify PRODUCT.md reads coherently top to bottom**

Read the full `PRODUCT.md` start to finish. Confirm:
- Register is still `product`
- Users and Product Purpose are unchanged
- Brand Personality now says "adaptive" not "calm"
- Anti-references ban execution failures, not aesthetics
- Theme Personalities section sits between Design Principles and Accessibility
- Accessibility section is unchanged (WCAG AA, reduced-motion, keyboard parity all intact)

- [ ] **Step 6: Commit PRODUCT.md**

```bash
git add PRODUCT.md
git commit -m ":memo: docs(product): reframe voice and anti-references for theme system

Drop 'calm precision instrument' as sole canonical voice → 'precise,
adaptive, signal-first'. Anti-references reframed from aesthetic bans
to execution failures. Add Theme Personalities section (5 themes +
calm/expressive). Prep for Phosphor Mono default first-run."
```

---

### Task 2: Reframe DESIGN.md aesthetic, color, and typography sections

**Files:**
- Modify: `DESIGN.md:9-17` (Aesthetic Direction + Philosophy)
- Modify: `DESIGN.md:41-67` (Color)
- Modify: `DESIGN.md:20-39` (Typography)

- [ ] **Step 1: Rewrite Aesthetic Direction**

Replace the `## Aesthetic Direction` section (current lines 9-14) with:

```markdown
## Aesthetic Direction
- **Direction:** Themeable dark — five personalities on a shared dark foundation
- **Decoration level:** Minimal in calm intensity; theme-specific in expressive intensity (scanlines, glow, notched panels, chromatic shadows — all gated and reduced-motion-safe)
- **Mood:** Serious personal monitor whose personality the user chooses. Dense but readable, with one memorable AI-native identity surface.
- **Reference:** Monitor theme → monochrome Linear + GitHub contribution graph; Phosphor Mono → late-night terminal; Amber CRT → IBM 3270; Retro Wave → 80s synthwave arcade; Cyberpunk → CP2077 HUD. All five share the dark foundation; React Bits interaction craft applies throughout.
```

- [ ] **Step 2: Rewrite Philosophy**

Replace the `## Philosophy` section (current lines 16-18) with:

```markdown
## Philosophy
Darkness is the native medium. Content emerges from near-black backgrounds through carefully calibrated luminance steps. The Monitor theme uses zero chromatic color — the only "color" is the gradation from white to black. The other four themes introduce themed accent hues, but always on the same dark foundation.

Personality is expressed through themable color, typography, and decoration layers — never through structural redesign. Switching a theme swaps CSS variable values; it does not re-layout the page. The product should be remembered as a **personal Coding Monitor** that the user has made their own, not a generic configuration manager.
```

- [ ] **Step 3: Rewrite Color section header and approach**

Replace the `## Color` section opening (current lines 41-42) with:

```markdown
## Color
- **Approach:** Per-theme color systems. The semantic token names (below) do not change across themes; only their values do. The Monitor theme is pure monochrome; Amber is single-hue; Retro and Cyberpunk are multi-hue. See the Theme System section for per-theme color tables.
- **Token contract (all themes must define these):**
  - Backgrounds: `--bg-deep`, `--bg-marketing`, `--bg-panel`, `--bg-surface`, `--bg-hover`
  - Text: `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-quaternary`
  - Accents: `--accent-primary`, `--accent-secondary`, `--accent-signal`, `--accent-glow`
  - Borders: `--border-subtle`, `--border-standard`, `--border-primary`, `--border-accent`
  - Heatmap: `--heat-0` through `--heat-4`
```

Keep the existing Monitor-theme value tables (Backgrounds, Text, Borders, Buttons, Semantic) as the **Monitor theme reference** — add a one-line note: "Values below are the Monitor theme. Other themes redefine these tokens in the Theme System section."

- [ ] **Step 4: Rewrite Typography section to per-theme font stacks**

Replace the `## Typography` primary/monospace/weights block (current lines 21-24) with:

```markdown
- **Per-theme font stacks:** Each theme provides `--font-display`, `--font-body`, `--font-mono`:
  - **Monitor:** Inter Variable (display + body), Berkeley Mono (mono)
  - **Phosphor Mono:** JetBrains Mono (display + mono), Inter (body)
  - **Amber CRT:** VT323 (display), IBM Plex Mono (body + mono)
  - **Retro Wave:** Press Start 2P (display), Silkscreen (body + mono)
  - **Cyberpunk:** Chakra Petch (display), Rajdhani (body), Share Tech Mono (mono)
- **OpenType:** `"cv01", "ss03"` enabled globally on Inter-based themes
- **Fonts are self-hosted** via `@fontsource` packages for offline Tauri support
```

Keep the existing Weights and Scale blocks unchanged — they apply to all themes (weight 510 signature, same scale).

- [ ] **Step 5: Verify DESIGN.md sections read coherently**

Read `DESIGN.md` lines 1-130. Confirm Aesthetic, Philosophy, Color, and Typography now describe a themeable system, and that the Monitor value tables are preserved as the base-theme reference.

- [ ] **Step 6: Commit DESIGN.md partial**

```bash
git add DESIGN.md
git commit -m ":memo: docs(design): reframe aesthetic, color, typography for themes

Aesthetic → 'themeable dark, five personalities'. Color → per-theme
systems with semantic token contract. Typography → per-theme font
stacks. Monitor value tables preserved as base-theme reference."
```

---

### Task 3: Add DESIGN.md Theme System section and Motion update

**Files:**
- Modify: `DESIGN.md:106-125` (Motion)
- Modify: `DESIGN.md` (insert new Theme System section before `## Component Specs`)

- [ ] **Step 1: Add expressive-decoration rules to Motion section**

After the existing `## Motion` content (after the "Reduced motion" line, current line 125), append:

```markdown
- **Per-theme decoration in expressive mode:** Each theme defines a decoration stack that activates only under `[data-intensity="expressive"]`:
  - **Phosphor Mono:** scanline overlay, vignette, phosphor text-glow, blinking cursor.
  - **Amber CRT:** amber scanlines, CRT flicker (≤3 Hz), vignette, amber text-glow.
  - **Retro Wave:** chromatic-offset title shadows (magenta + cyan), neon glow, top-edge gradient stripes on cards.
  - **Cyberpunk:** grid backdrop, notched panel corners (clip-path), hazard-stripe sidebar header, yellow text-glow.
  - **Monitor:** none — Monitor has no expressive decoration; it is calm by definition.
- **Calm intensity disables all of the above** via a single `[data-intensity="calm"]` override block that zeroes every decoration variable. `prefers-reduced-motion: reduce` triggers the same override regardless of the user's intensity choice.
- **Decoration utilities** (`.deco-scanlines`, `.deco-glow-text`, `.deco-notch`, `.deco-vignette`) are registered as Tailwind utilities via a plugin and consume theme CSS variables, so they collapse automatically under calm/reduced-motion without conditional classNames.
```

- [ ] **Step 2: Insert the Theme System section**

Insert this new section immediately **before** `## Component Specs` (current line 127):

```markdown
## Theme System

The theme system is the source of truth for how the five personalities are implemented. The architecture is CSS-variable-driven with `[data-theme]` and `[data-intensity]` attributes on `<html>`.

### Semantic Token Vocabulary (the contract)
Every theme must provide values for: backgrounds (`--bg-deep/marketing/panel/surface/hover`), text (`--text-primary/secondary/tertiary/quaternary`), accents (`--accent-primary/secondary/signal/glow`), fonts (`--font-display/body/mono`), borders (`--border-subtle/standard/primary/accent`), heatmap (`--heat-0`–`--heat-4`), and decoration (`--scanline-color/opacity`, `--vignette-strength`, `--title-shadow`, `--text-glow`, `--card-clip`, `--panel-notch-size`). Motion tokens (`--motion-*`) are shared across all themes and do not vary.

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
```

- [ ] **Step 3: Add Decisions Log row**

In the `## Decisions Log` table, append this row after the last entry (after the 2026-06-20 heatmap row):

```markdown
| 2026-06-23 | Introduce five-theme + calm/expressive system; default changes from Monitor to Phosphor Mono | PRODUCT.md anti-references reframed from aesthetic bans to execution failures so the chromatic themes (Amber/Retro/Cyberpunk) can ship. Theme system is CSS-variable-driven with `[data-theme]`/`[data-intensity]` on `<html>`; components already consume shadcn semantic tokens and need zero code changes for color. Fonts self-hosted via `@fontsource` for offline Tauri support |
```

- [ ] **Step 4: Update DESIGN.md "Don't" list**

In `### Don't` (current lines 421-430), remove these two lines (they are now theme-dependent, not absolute):

```markdown
- Don't apply any chromatic colors (blue, purple, cyan, etc.)
```
```markdown
- Don't introduce warm colors into the UI chrome
```

Replace them with:

```markdown
- Don't apply chromatic colors in the Monitor theme — it stays pure monochrome. Other themes define their own accent hues via the token contract
- Don't ship any theme (in either intensity) that fails WCAG AA contrast — chromatic accents must be tuned to pass
```

- [ ] **Step 5: Verify full DESIGN.md coherence**

Read `DESIGN.md` end to end. Confirm:
- Aesthetic/Philosophy/Color/Typography describe a themeable system
- Motion section includes expressive-decoration rules
- Theme System section sits before Component Specs
- Decisions Log has the 2026-06-23 row
- Don'ts list no longer blanket-bans chromatic color
- Component Specs (Card, Navigation Island, etc.) are unchanged — they apply across themes via tokens

- [ ] **Step 6: Commit DESIGN.md Theme System + Motion**

```bash
git add DESIGN.md
git commit -m ":memo: docs(design): add Theme System section and expressive motion rules

New Theme System section: token contract, registry, switching, fonts.
Motion section gains per-theme expressive decoration rules. Decisions
Log records the five-theme + calm/expressive introduction. Don'ts list
updated: chromatic color is theme-dependent, not blanket-banned."
```

---

### Task 4: Cross-document consistency check

**Files:**
- Read-only: `PRODUCT.md`, `DESIGN.md`

- [ ] **Step 1: Verify the default-theme claim is identical in both docs**

Search both files for the default-theme claim. It must say **Phosphor Mono is the default first-run theme** in:
- `PRODUCT.md` Theme Personalities section ("Phosphor Mono is the default first-run theme at `expressive` intensity")
- `DESIGN.md` Theme Registry table ("`phosphor` | Phosphor Mono (default)")
- `DESIGN.md` Decisions Log ("default changes from Monitor to Phosphor Mono")

If any location disagrees, fix it.

- [ ] **Step 2: Verify the anti-reference posture is identical**

Confirm both docs treat anti-references as **execution failures** (WCAG, readability, flicker), not aesthetic bans:
- `PRODUCT.md` Anti-references section bans "low-contrast", "body text below 11px", "flicker >3 Hz"
- `DESIGN.md` Don'ts list bans "fails WCAG AA"

No doc should still contain the phrase "no chromatic accents of any kind" as an absolute. The only place monochrome-only is asserted is the Monitor theme's own description.

- [ ] **Step 3: Verify accessibility commitments survived**

Confirm both docs still require:
- WCAG 2.1 AA contrast (every theme, both intensities)
- `prefers-reduced-motion: reduce` disables ambient decoration
- Keyboard parity (⌘K, `g m` / `g a` / `g s` / `g c` / `g t`)
- Color-blindness resilience (meaning not by hue alone)

These are in `PRODUCT.md` Accessibility section and `DESIGN.md` Motion section. Neither should have been weakened.

- [ ] **Step 4: Run the markdown lint (if configured)**

```bash
pnpm lint
```

Expected: PASS (markdown files are in the lint-staged glob). If lint flags the new tables or sections, fix the formatting.

- [ ] **Step 5: Final commit if any fixes were made in steps 1-3**

If steps 1-3 required fixes, commit them:

```bash
git add PRODUCT.md DESIGN.md
git commit -m ":memo: docs: fix cross-document consistency for theme system"
```

If no fixes were needed, this step is a no-op — Phase 1 is complete.
