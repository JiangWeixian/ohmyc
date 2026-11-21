# @ohmyc/desktop

## 0.2.0

### Minor Changes

- bb9e108: Add a real-data menu bar layout gallery with Trend, Bricks, and Quota Focus presets. Persist the selected Popover layout, synchronize it across windows, and remove the temporary chart switch. Add accessible carousel controls and reduced-motion-safe pointer previews.
- bb9e108: Add subscription quota monitoring: a new Quota page (`/explore/quota`) and a
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

- bb9e108: 新增设置页（/explore/settings）：quota 总开关与 8 个 provider 的独立轮询开关、主题选择、菜单栏图标显隐（隐藏前提示找回方式）。设置存于 `~/.config/ohmyc/settings.json`，环境变量优先并在界面标注覆盖；主题从 localStorage 自动迁移，升级不丢选择。macOS 从「应用程序」重新打开现在会回到主窗口。
- a12e63f: Show current calendar-week usage in the macOS menu bar and format token totals consistently without counting Codex cache twice. Add timestamped usage records for activity charts, with historical backfill and a reversible session-based statistics mode that preserves existing data.

### Patch Changes

- efd97e1: Count Sessions independently by creation time and show Tokens by usage-event time, preserving historical totals for sessions without events. Remove the statistics-mode switch, keep chart tooltips event-based, and calculate Timeline header totals across the full selected year and project with automatic refresh.
- f74a577: Replace the desktop app icon with the paper-clay computer logo across macOS, Windows, and PNG bundle assets.
- bb9e108: Fix OpenCode Go quota refreshes on OpenCode v2 by using the active SQLite credential and workspace, while preserving v1 authentication support.
- Updated dependencies [efd97e1]
- Updated dependencies [bb9e108]
- Updated dependencies [bb9e108]
- Updated dependencies [e01ec9c]
- Updated dependencies [bb9e108]
- Updated dependencies [5c5edd7]
- Updated dependencies [94a80a8]
- Updated dependencies [a12e63f]
  - @ohmyc/ui@0.2.0
