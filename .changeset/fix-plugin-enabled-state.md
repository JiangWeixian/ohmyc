---
"@ohmyc/cli": patch
---

Read `enabledPlugins` from `~/.claude/settings.json`, project `.claude/settings.json`, and `.claude/settings.local.json` (in that precedence order) instead of `~/.cui/settings.json`. Fixes `/api/plugins` showing every plugin as disabled because Claude Code stores plugin enable state in its own settings file.
