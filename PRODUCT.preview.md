# Product

## Register

product

## Product Intent

OhMyC is a **local-first personal Coding Monitor** for developers who use Claude Code, opencode, and shared `.agents` resources. It helps a developer see the shape of their own AI-assisted coding work: sessions, turns, token spend, project density, and the agents, commands, skills, and plugins that drive that work.

OhMyC should be remembered as "my AI coding activity cockpit," not as a generic `.claude` configuration editor. Configuration management stays available, but it supports the activity monitor instead of becoming the product's main identity.

## Users and Jobs

Primary users are developers working with local coding-agent tools:

- Claude Code users with `.claude` agents, commands, settings, and skills.
- opencode users with global or project-level opencode config.
- Developers who share or reuse resources through `.agents` namespaces.

Their main job is to answer: **what have I been doing with AI coding agents, and what does my current tool setup look like?**

On activity surfaces, the user should absorb signal quickly: recent sessions, turns, token patterns, project activity, and momentum. On library surfaces, the user should find and inspect resources fast: Agents, Commands, Skills, and Plugins.

## Experience Principles

1. **The monitor, not the manager.** Lead with activity and identity. Resource editing and inventory are secondary surfaces.
2. **Signal before chrome.** Telemetry should read as meaningful signal, not boxed dashboard widgets.
3. **Local facts over cloud assumptions.** The product reads local config and session data. Do not imply cloud sync, team analytics, or hosted monitoring unless the repository adds that capability.
4. **Personality is user-selectable.** The dark monitor foundation stays stable while themes change color, typography, and decoration.
5. **Expert density with humane feedback.** Dense screens are acceptable when hierarchy, contrast, keyboard navigation, and empty states make them readable.

## Scope

| Status | Item | Evidence |
| --- | --- | --- |
| Current | Tauri desktop shell and local web UI | `package.json`, `Cargo.toml`, `packages/desktop/`, `packages/ui/` |
| Current | Timeline and Monitor activity surfaces | `packages/ui/src/app.tsx`, `packages/ui/src/explorer.tsx`, `packages/ui/src/components/monitor/`, `packages/ui/src/components/timeline/` |
| Current | Core resource library: Agents, Commands, Skills, Plugins | `packages/ui/src/explorer.tsx`, `packages/ui/src/components/sidebar.tsx`, desktop API modules |
| Current | Claude, opencode, and shared `.agents` discovery | `README.md`, `crates/ohmyc-core/src/`, `packages/shared/src/` schemas |
| Specified | Five dark theme personalities with calm/expressive intensity | `docs/superpowers/specs/2026-06-23-theme-system-design.md` |
| Excluded | Generic SaaS dashboard positioning | Existing `PRODUCT.md` anti-references and theme-system spec |
| Excluded | Hooks, MCP Servers, and LSP Servers as visible top-level Explorer tabs | `docs/superpowers/specs/2026-06-16-sidebar-core-tabs-design.md` |
| Excluded | Cloud-hosted team analytics | No verified repository source supports this capability |
| Open | Full Monitor WebGL fallback behavior after theme work lands | Existing accessibility requirement, implementation needs verification |
| Open | Route-level theme polish beyond base tokens/components | Theme-system spec lists full-route theming as follow-up |

## Structure

The product has two major areas:

1. **Activity**
   - Timeline is the default activity route.
   - Monitor is the identity surface for a more memorable personal-cockpit view.
   - Menubar gives a compact glanceable activity surface.

2. **Explore**
   - Agents
   - Commands
   - Skills
   - Plugins

Activity and Explore should stay mentally separate. Timeline and Monitor explain what happened. Explore explains what resources the user has and lets them inspect those resources.

## Key Flows

### Activity First

1. The user opens OhMyC.
2. The app routes them to the activity experience rather than a settings table.
3. The user reads recent sessions, turns, token signal, and project activity.
4. If something needs explanation, the user moves from activity into the relevant resource library.

### Resource Inspection

1. The user opens Agents, Commands, Skills, or Plugins from the sidebar or command palette.
2. The list shows resources from local config sources.
3. The user searches or selects a resource.
4. The detail panel shows frontmatter, source, scope, and editable content when supported.

### Fast Navigation

1. The user opens the command palette with `Cmd+K`.
2. The user jumps to Monitor, Agents, Skills, Commands, or Timeline.
3. Keyboard shortcuts `g m`, `g a`, `g s`, `g c`, and `g t` provide direct navigation.

## Interface Model

OhMyC behaves like a local instrument panel:

- The sidebar separates **Activity** from **Explore**.
- Timeline remains visible as the activity entry.
- Explore contains only the four core resource tabs: Agents, Commands, Skills, Plugins.
- Legacy config categories can remain in lower-level APIs, but they should not dominate the top-level product model.
- Empty states should name the local path or source being inspected.
- Errors should say which local source failed and whether the rest of the app remains usable.
- The command palette is both navigation and search, not a marketing shortcut layer.

## Surface and Voice

OhMyC should sound like a serious personal monitor: precise, adaptive, signal-first.

The product can have expressive themes, but each theme must preserve expert readability. Visual personality comes from theme tokens, type, and controlled decoration, not from changing the product's structure.

Theme personalities specified for v1:

| Theme | Product role |
| --- | --- |
| Monitor | Clean monochrome precision. The calm baseline. |
| Phosphor Mono | Textured late-night terminal feel. Specified as first-run default. |
| Amber CRT | Warm IBM 3270-style single-hue monitor. |
| Retro Wave | Synthwave personality with controlled chromatic accents. |
| Cyberpunk | Game-HUD personality with notched panels and hazard accents. |

Anti-references are execution failures, not blanket aesthetic bans:

- No generic SaaS hero-metric dashboard.
- No heavy configuration-admin feel.
- No low-contrast AI-cliche purple/blue orb visuals.
- No unreadable type or fatiguing flicker.
- No route-wide decorative choreography that competes with signal.

## Accessibility and Resilience

- Target WCAG 2.1 AA for body text and controls.
- Reduced motion must disable ambient decoration, count-up effects, parallax, particles, and nonessential transitions.
- Heatmap intensity, status, and active states must not depend on hue alone.
- WebGL Monitor views are enhancements. Core stats and navigation need DOM-accessible fallbacks.
- Keyboard parity is required across routes, resource lists, command palette, and in-page controls.

## Open Questions

- The repository currently has both old README positioning ("visualizing and editing `.claude` configuration files") and newer product positioning ("personal Coding Monitor"). README should be updated after `PRODUCT.md` is finalized.
- Theme personalities are specified in design docs, but route-level theme polish is not fully proven in source yet.
- WebGL fallback requirements are stated, but the exact non-Canvas fallback behavior should be verified against implementation.
- Cloud sync, collaboration, team analytics, and hosted dashboards have no verified repository source and should remain out of product copy.
