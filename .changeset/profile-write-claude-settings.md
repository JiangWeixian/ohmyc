---
"@ohmyc/cli": patch
---

Profile activation now reads, writes, and backs up `~/.claude/settings.json` instead of `~/.cui/settings.json`. `enabledPlugins`, env vars, hooks, and merged profile settings land in the file Claude Code actually reads, so an activated profile's plugin selection takes effect. `/api/hooks` reads hooks across the same `.claude` settings paths as `enabledPlugins`.
