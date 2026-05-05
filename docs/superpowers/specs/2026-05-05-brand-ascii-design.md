# OhMyC Brand ASCII Art — Design Spec

**Date:** 2026-05-05
**Topic:** CLI brand ASCII art display
**Status:** Approved

## Overview

Display a slanted italic ASCII art wordmark of "OhMyC" at the top of every CLI command execution. Reinforces brand identity while maintaining the monochrome minimalism established in DESIGN.md.

## Context

The `@ohmyc/cli` package (`packages/cli/`) provides the `cu` / `ohmyc` CLI tool for managing `.claude` configuration files. The CLI currently has no visual branding on startup — commands execute with plain text output. This spec adds a brand ASCII banner that displays before all command output.

## Design

### Visual

```
   ___   _   _   __  __     ____
  / _ \ | | | |  \ \/ /    / ___|
 | | | || |_| |   \  /    | |    
 | |_| ||  _  |   /  \    | |___ 
  \___/ |_| |_|  /_/\_\    \____|

OhMyC v0.1.0 — CLI for managing .claude configs
```

### Characteristics

- **Style:** Slanted italic wordmark (A5 from iteration)
- **Height:** 5 lines (wordmark) + 1 blank line + 1 tagline = 7 lines total
- **Width:** 47 characters
- **Characters:** Standard ASCII only (`/`, `\`, `_`, `|`, spaces) — no Unicode, no box-drawing characters
- **Color:** None — pure ASCII text, inherits terminal color
- **Tagline:** Dynamic version from `package.json` + static description

## Integration

### Placement

Printed to stdout at the start of **every** CLI invocation, before any command output.

### Implementation Location

`packages/cli/src/index.ts` — before `cli.parse()` or inside a pre-action hook that runs for all commands.

### Conditional Display

- **Show:** When stdout is a TTY (`process.stdout.isTTY === true`)
- **Skip:** When stdout is piped or redirected (scripting/automation contexts)
- No configuration flag needed — TTY detection is sufficient

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Terminal too narrow (< 47 cols) | Banner still prints — terminal handles wrapping |
| Non-TTY stdout (piping) | Banner skipped entirely |
| Windows CMD / PowerShell | Standard ASCII renders correctly |
| Minimal terminals (alpine, docker) | No special characters — works everywhere |

## Testing

- Verify banner appears on `cu start`, `cu dashboard`, `cu --help`, bare `cu`
- Verify banner is suppressed when output is piped (`cu --help | cat`)
- Verify banner renders correctly in common terminals: iTerm2, Terminal.app, VS Code integrated, Windows Terminal, Git Bash

## Dependencies

None. Pure ASCII string — no external libraries required.

## Out of Scope

- Colored output (ANSI escape codes) — stays monochrome per DESIGN.md
- Animated or progressive display
- Configuration to disable banner
- Alternative banners per command

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-05 | Display on all commands | User wants consistent brand presence |
| 2026-05-05 | Slanted italic style (A5) | User selected from 6 variations — adds personality while staying minimal |
| 2026-05-05 | Standard ASCII only | Maximum terminal compatibility — no Unicode or box-drawing chars |
| 2026-05-05 | Skip banner when stdout is not TTY | Prevents polluting piped/scripted output |
| 2026-05-05 | No color / no ANSI codes | Matches DESIGN.md monochrome philosophy |

## Acceptance Criteria

- [ ] ASCII banner displays before output on all CLI commands
- [ ] Banner is suppressed when stdout is piped or redirected
- [ ] Banner uses only standard ASCII characters
- [ ] Version string is dynamically read from package.json
- [ ] No external dependencies added
- [ ] All existing tests continue to pass