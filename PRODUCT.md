# Product

## Register

product

## Users

Developers using Claude Code and related coding agents (opencode, shared `~/.agents` namespaces) who want a memorable **personal monitor** for their own AI-assisted coding work patterns.

- **Context:** Local-first. The tool reads config and session data off the user's own machine; the UI runs in a Tauri desktop shell or a local web server. Ambient light is whatever the developer's room already is — typically low, late, focused.
- **Job to be done:** Quickly see *what I've been doing with AI coding agents* — activity momentum, token spend, recent sessions — and, secondarily, browse/edit the agents, skills, commands, and plugins that drive those agents.
- **Primary task on any given screen:** On Monitor/Timeline, absorb coding signal at a glance. On Library pages (Agents/Commands/Skills/Plugins), find and inspect a resource fast.

## Product Purpose

OhMyC is a **personal Coding Monitor**: a profile-like surface for AI coding activity first, a configuration library second. It exists so a developer can open one app and immediately feel the shape and momentum of their own AI-assisted work — sessions, turns, tokens, project density — rather than hunting through `.claude` files or guessing at activity.

Success looks like: the first mental image of OhMyC is "my AI coding activity cockpit," not "the thing that edits my `.claude` config." Activity/Monitor is the front door; resource management stays available but is no longer the product's primary mental model.

## Brand Personality

Precision-engineering, adaptive, signal-first. Three words: **precise, adaptive, signal-first.**

- **Voice:** Serious personal monitor. Dense but readable. Expert, not flashy. Personality is the user's choice — five themes ship, each with its own voice, but all stay expert and data-first.
- **Emotional goal:** "This knows me, and it's mine." The interface should feel like a calibrated instrument the user has personalized — their terminal, their cockpit, their HUD — not a generic dashboard handed to anyone.
- **Mood reference:** A themeable personal monitor built on near-black engineering surfaces. The Monitor theme evokes a monochrome Linear + GitHub contribution-graph density; the Phosphor Mono theme evokes a late-night terminal; Amber CRT evokes an IBM 3270 console; Retro Wave evokes an 80s arcade; Cyberpunk evokes a game HUD. All five share the same dark foundation; personality is expressed through themable color, typography, and decoration layers.

## Anti-references

What OhMyC explicitly must NOT do — reframed as **execution failures**, not aesthetic bans. Any theme, in any intensity, that commits one of these failures is a bug:

- **A generic SaaS dashboard.** No hero-metric template (big number + small label + gradient accent), no identical icon-card grids, no tiny uppercase eyebrow above every section. It must not read as another Vercel/Linear clone — regardless of which theme is active.
- **A heavy configuration-admin UI.** Not a dry rows-of-forms settings manager. Even when it manages config, the experience should feel like a monitor, not a control panel.
- **Low-contrast AI-cliche visuals.** Expressive intensity permits chromatic themes, but low-contrast purple/blue orb cliches, bokeh blobs, and marketing hero copy remain banned in every theme. Chromatic accents must pass WCAG AA.
- **Unreadable or fatiguing execution.** No theme ships body text below 11px. No expressive animation exceeds 3 Hz (photosensitive trigger ceiling). No theme in expressive mode may produce fatiguing flicker on long reading sessions — if a user reports fatigue, that theme's expressive decoration is too strong and must be toned down.
- **Over-animated / busy.** Motion is intentional and calm; no decorative list, grid, or route-layout choreography on every surface. Calm intensity and `prefers-reduced-motion` disable all ambient decoration.

## Design Principles

1. **The monitor, not the manager.** Lead with activity and identity. The first screen should make OhMyC memorable as a personal coding monitor; configuration inventory supports that, never competes with it.
2. **Darkness is the native medium; personality is the user's choice.** All five themes build on near-black backgrounds. The Monitor theme communicates hierarchy through monochrome luminance steps; the chromatic themes (Amber, Retro, Cyberpunk) add themed accent hues. Personality is the user's selection — the monitor adapts, it does not impose one voice.
3. **One memorable identity surface.** The Monitor route earns the only WebGL budget, regardless of active theme. Everything else stays data-first. The active theme's personality is carried by color, typography, and (in expressive mode) decoration — not by giving every route its own animation budget.
4. **Signal over dashboard.** Telemetry reads as signal, not boxed widgets. Prefer kinetic typography and ambient fields over gridded stat cards.
5. **Calibrated craft down to the type.** Expert confidence lives in the details — the signature 510 weight, the OpenType features, the relaxed tracking. Precision is the personality.

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

## Accessibility & Inclusion

- **Target:** WCAG 2.1 AA — including ≥4.5:1 body-text contrast against the dark surfaces (watch the muted-gray-on-tinted-dark failure mode) and full keyboard navigation across every route.
- **Reduced motion is mandatory.** Every animation has a `prefers-reduced-motion: reduce` alternative (typically a crossfade or instant transition). Disable count-up numbers, parallax, particles, and nonessential transitions when reduced motion is requested.
- **Color-blindness & monochrome resilience.** The palette is already monochrome; never encode meaning by hue alone. Heatmap intensity, status, and active states must be distinguishable by luminance/value, shape, or text — not by a color only some users see.
- **WebGL accessibility.** The R3F/Drei Monitor scene is an enhancement. It must ship accessible DOM labels and a non-Canvas fallback so the route's core stats and navigation remain usable when WebGL is unavailable, blocked, or reduced.
- **Keyboard parity.** ⌘K command palette, `g m` / `g a` / `g s` / `g c` / `g t` navigation, and all in-page controls must be fully operable without a pointer.
