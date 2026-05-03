---
"@ohmyc/timeline-plugin": patch
"@ohmyc/shared": patch
---

Fix Claude Code plugin manifest: rename marketplace to `ohmyc`, set plugin name to `timeline`, correct source path, and use `$CLAUDE_PLUGIN_ROOT` in the Stop hook command. Also adds proper `dist`-based entry points and `exports` to `@ohmyc/shared`.
