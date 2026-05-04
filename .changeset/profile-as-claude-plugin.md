---
"@ohmyc/cli": patch
---

Profile activation now registers the profile as a real Claude Code plugin so it's actually loaded:

- Generates `~/.cui/.claude-plugin/marketplace.json` (id `ohmyc-profiles`) listing every profile as a plugin entry pointing at `./profiles/<name>`.
- Registers `ohmyc-profiles` in `~/.claude/plugins/known_marketplaces.json` (directory source pointing at `~/.cui`) so Claude Code can resolve the marketplace by id.
- Writes an install record to `~/.claude/plugins/installed_plugins.json` under qualified id `profile-<name>@ohmyc-profiles`.
- `enabledPlugins` now uses the qualified id `profile-<name>@ohmyc-profiles` (was unqualified `profile-<name>`, which Claude Code couldn't resolve).
- Deactivation removes the install entry; rollback restores the previous `installed_plugins.json` snapshot.
