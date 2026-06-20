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

Precision-engineering, monochrome, quiet-confidence. Three words: **precise, calm, signal-first.**

- **Voice:** Serious personal monitor. Dense but readable. Expert, not flashy.
- **Emotional goal:** "This knows me." The interface should feel like a calibrated instrument tuned to *my* work, not a generic dashboard handed to anyone.
- **Mood reference:** A monochrome variant of Linear, the density of a GitHub profile contribution graph, the interaction craft of React Bits — all rendered as near-black engineering surfaces where content emerges through luminance steps.

## Anti-references

What OhMyC explicitly must NOT look like:

- **A generic SaaS dashboard.** No hero-metric template (big number + small label + gradient accent), no identical icon-card grids, no tiny uppercase eyebrow above every section. It must not read as another Vercel/Linear clone.
- **A heavy configuration-admin UI.** Not a dry rows-of-forms settings manager. Even when it manages config, the experience should feel like a monitor, not a control panel.
- **AI-cliche visuals (from DESIGN.md).** No bright purple/blue, no orbs, no bokeh blobs, no marketing hero copy, no chromatic accents of any kind. The only "color" is the gradation from white to black.
- **Gamer / RGB / "hacker" terminal chrome.** No neon, no rainbow gradients, no aggressive terminal cosplay. Stays precision-engineering monochrome.
- **Over-animated / busy.** Motion is intentional and calm; no decorative list, grid, or route-layout choreography on every surface.

## Design Principles

1. **The monitor, not the manager.** Lead with activity and identity. The first screen should make OhMyC memorable as a personal coding monitor; configuration inventory supports that, never competes with it.
2. **Darkness is the native medium.** Build on near-black backgrounds; communicate hierarchy through calibrated luminance steps and semi-transparent white, never through chromatic color or drop shadows.
3. **One memorable identity surface.** The Monitor route earns the only motion/WebGL budget. Everything else stays calm, data-first, and quiet so the identity surface can sing.
4. **Signal over dashboard.** Telemetry reads as signal, not boxed widgets. Prefer kinetic typography and ambient fields over gridded stat cards.
5. **Calibrated craft down to the type.** Expert confidence lives in the details — the signature 510 weight, the OpenType features, the relaxed tracking. Precision is the personality.

## Accessibility & Inclusion

- **Target:** WCAG 2.1 AA — including ≥4.5:1 body-text contrast against the dark surfaces (watch the muted-gray-on-tinted-dark failure mode) and full keyboard navigation across every route.
- **Reduced motion is mandatory.** Every animation has a `prefers-reduced-motion: reduce` alternative (typically a crossfade or instant transition). Disable count-up numbers, parallax, particles, and nonessential transitions when reduced motion is requested.
- **Color-blindness & monochrome resilience.** The palette is already monochrome; never encode meaning by hue alone. Heatmap intensity, status, and active states must be distinguishable by luminance/value, shape, or text — not by a color only some users see.
- **WebGL accessibility.** The R3F/Drei Monitor scene is an enhancement. It must ship accessible DOM labels and a non-Canvas fallback so the route's core stats and navigation remain usable when WebGL is unavailable, blocked, or reduced.
- **Keyboard parity.** ⌘K command palette, `g m` / `g a` / `g s` / `g c` / `g t` navigation, and all in-page controls must be fully operable without a pointer.
