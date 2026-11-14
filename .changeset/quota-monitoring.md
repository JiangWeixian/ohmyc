---
"@ohmyc/ui": minor
"@ohmyc/desktop": minor
---

Add subscription quota monitoring: a new Quota page (`/explore/quota`) and a
menubar popover section that show remaining usage and reset times for Claude,
Codex, Cursor, Grok, Gemini, Kimi, OpenCode Go, and GLM Coding Plan.

- Quota page renders every window a provider actually has (5h / weekly /
  monthly), heat-ladder bars with a pace tick, credit meters, and honest
  state cards for not-logged-in / expired / rate-limited providers.
- Menubar popover lists the three most-constrained providers as two-line
  blocks with per-window bars.
- Desktop gains `quota_list` / `quota_refresh` commands and a 5-minute
  poller thread emitting `quota:changed`; credentials are read-only and
  Claude polling is opt-in (`OHMYC_QUOTA_CLAUDE_ENABLED=1`).
