---
"@ohmyc/cli": minor
---

Brand ASCII art banner, CLI rename, and logging improvements

- Add slanted italic ASCII art banner displayed on every CLI command
- Rename CLI from `cu` to `ohmyc` for consistency with package name
- Replace console.* with pino logger supporting file rotation via pino-roll
- Logs written to ~/.cui/logs/ohmyc.log with daily rotation
- Console logging disabled by default, enable with OHMYC_LOG_CONSOLE=true
- Fix build script to use rimraf for cross-platform compatibility
- Whitelist plugin assets to avoid copying unnecessary files
- Disable pino-roll symlink in CI/test environments to prevent race conditions
