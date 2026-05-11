
## Design system

**Before any visual or UI work, read [DESIGN.md](./DESIGN.md).** It is the source of truth for:

- Visual system (color, typography, spacing, elevation) — *settled, don't redesign*
- **Layout & Interaction** — placement of header chrome, ⌘K palette, Compare panel, default route, Explorer rules
- Decisions Log — every visual/layout decision and its rationale

Companion artifact: pixel-level wireframe index at `~/.gstack/projects/JiangWeixian-claudeui/designs/layout-interaction-20260426/index.html` (8 per-screen files: Profiles, ⌘K palette, Compare, Explorer, Profiles→Agents, Profile editor, Agent detail, Agent editor). Open the index, then jump to the screen you're touching before changing header / palette / compare layout.

When a UI change conflicts with DESIGN.md, update DESIGN.md *first* (add a Decisions Log row + amend the relevant section), then implement. Don't let code drift ahead of the doc.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. The
skill has multi-step workflows, checklists, and quality gates that produce better
results than an ad-hoc answer. When in doubt, invoke the skill. A false positive is
cheaper than a false negative.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke /office-hours
- Strategy, scope, "think bigger", "what should we build" → invoke /plan-ceo-review
- Architecture, "does this design make sense" → invoke /plan-eng-review
- Design system, brand, "how should this look" → invoke /design-consultation
- Design review of a plan → invoke /plan-design-review
- Developer experience of a plan → invoke /plan-devex-review
- "Review everything", full review pipeline → invoke /autoplan
- Bugs, errors, "why is this broken", "wtf", "this doesn't work" → invoke /investigate
- Test the site, find bugs, "does this work" → invoke /qa (or /qa-only for report only)
- Code review, check the diff, "look at my changes" → invoke /review
- Visual polish, design audit, "this looks off" → invoke /design-review
- Developer experience audit, try onboarding → invoke /devex-review
- Ship, deploy, create a PR, "send it" → invoke /ship
- Merge + deploy + verify → invoke /land-and-deploy
- Configure deployment → invoke /setup-deploy
- Post-deploy monitoring → invoke /canary
- Update docs after shipping → invoke /document-release
- Weekly retro, "how'd we do" → invoke /retro
- Second opinion, codex review → invoke /codex
- Safety mode, careful mode, lock it down → invoke /careful or /guard
- Restrict edits to a directory → invoke /freeze or /unfreeze
- Upgrade gstack → invoke /gstack-upgrade
- Save progress, "save my work" → invoke /context-save
- Resume, restore, "where was I" → invoke /context-restore
- Security audit, OWASP, "is this secure" → invoke /cso
- Make a PDF, document, publication → invoke /make-pdf
- Launch real browser for QA → invoke /open-gstack-browser
- Import cookies for authenticated testing → invoke /setup-browser-cookies
- Performance regression, page speed, benchmarks → invoke /benchmark
- Review what gstack has learned → invoke /learn
- Tune question sensitivity → invoke /plan-tune
- Code quality dashboard → invoke /health

## Multi-tool provider discovery

The server enumerates agents/skills/commands via a `ProviderRegistry` that
wraps three `ConfigProvider`s: `ClaudeProvider`, `OpencodeProvider`, and
`AgentsSharedProvider` (skills only). Read-only routes accept `?origins=`
to filter (`claude`, `opencode`, `agents`).
