# Desktop UI Migration — Spec

**Date:** 2026-05-30
**Branch (probable):** `feat/desktop-ui-migration`
**Status:** Draft — awaiting user review

## Summary

Move the OhMyC web UI (`packages/ui`) into the Tauri desktop app as its only
shipping surface. Replace the TypeScript HTTP server in `packages/cli/src/server`
with a native Rust backend exposed via Tauri commands. The web build and the
HTTP server are retired at the end of the migration. The `packages/cli` npm
package shrinks to only the `dashboard` subcommand, which installs the Claude
Code plugin that captures session data into `~/.claude/db.sqlite`.

Migration is endpoint-by-endpoint behind a transport seam in the frontend, so
every intermediate commit is green and the dev loop stays usable.

## Goals

1. Single shipping surface: the Tauri desktop app contains the full UI.
2. No Node runtime in the desktop bundle. All backend logic is native Rust.
3. Web UI and HTTP server are deleted at the end of the migration.
4. `cu dashboard` (Claude Code plugin install) survives as the only CLI feature.
5. Every per-slice commit is green: tests pass, web build still works until
   its endpoint is migrated, desktop build works against all migrated endpoints.

## Non-goals

- Auto-update / code signing — out of scope; addressed in a later slice.
- Cross-platform parity beyond macOS — Windows/Linux builds may work but are
  not validated this slice.
- Re-designing any UI surface. Visuals match the current web UI 1:1.
- Replacing the dashboard capture plugin (still TS, still publishes to npm).

## Architecture

### Topology

```
┌─────────────────────────────────────────────────────────────────┐
│  Tauri app (single Rust process)                                │
│                                                                 │
│  ┌──────────────────┐         ┌──────────────────────────────┐  │
│  │ popover window   │         │ main window                  │  │
│  │ 360 × 300        │ Open →  │ 1200 × 800, resizable        │  │
│  │ tray-anchored    │────────►│ standard chrome              │  │
│  │ MenubarPage      │         │ React Router: /profiles,     │  │
│  │ + "Open OhMyC →" │         │  /explore, /timeline, etc.   │  │
│  └──────────────────┘         └──────────────────────────────┘  │
│           │                                  │                  │
│           └──────────────┬───────────────────┘                  │
│                          ▼                                      │
│           @tauri-apps/api/core::invoke('cmd', args)             │
│                          │                                      │
│   ┌──────────────────────▼───────────────────────────────────┐  │
│   │ Rust commands (packages/desktop/src-tauri/src/api/)      │  │
│   │   profiles · agents · skills · commands · configs        │  │
│   │   plugins · settings · timeline · store                  │  │
│   └──────────────────────┬───────────────────────────────────┘  │
│                          ▼                                      │
│           ohmyc-core (new Rust crate, workspace member)         │
│            fs I/O on ~/.claude · YAML/JSON · SQLite             │
│            file watchers (notify crate) → Tauri events          │
└─────────────────────────────────────────────────────────────────┘

External:
  packages/cli (npm) → only `cu dashboard` survives — installs the
    Claude Code plugin that writes to ~/.claude/db.sqlite.
    Desktop reads that DB via ohmyc-core.
```

### Two windows, one process

- **popover** — existing 360×300 tray-anchored window. Unchanged behavior plus
  one new affordance: bottom-right `Open OhMyC →` button calling
  `invoke('open_main_window')` then `invoke('hide_popover')`. Tray right-click
  menu gains `Open OhMyC` above `Quit`.
- **main** — new 1200×800 resizable window with standard chrome. Hosts the
  existing React router (`/profiles`, `/explore`, `/timeline`, `/profiles/:name/edit`,
  etc.). Hidden until first `open_main_window` call. Closing the window hides
  it, does not quit (app activation policy stays `Accessory`).
- Both windows share one Rust process, one ohmyc-core state, one set of
  registered commands. The main window's static config lives in `windows.rs`
  (not `tauri.conf.json`) so it can be built on demand.

### Transport seam (frontend)

A new module `packages/ui/src/lib/transport.ts` is the only place the UI
talks to a backend. Hooks call `request(wireName, args)`. The seam selects an
implementation at build time:

```ts
type Transport = (wire: string, args: unknown) => Promise<unknown>

// transport/tauri.ts — production desktop build
export const tauri: Transport = (wire, args) =>
  invoke(wire.replace(/\./g, '_'), args ?? {})

// transport/fetch.ts — surviving web build during migration
export const fetchTransport: Transport = (wire, args) => /* routes to /api/... */

// transport/mock.ts — vitest
export const mock: Transport = makeFixtureBackend()
```

Selection:
- `VITE_TRANSPORT=tauri` (set by `pnpm tauri dev/build`) → `tauri`
- `VITE_TRANSPORT=fetch` (current web `pnpm dev` default) → `fetchTransport`
- `import.meta.vitest` → `mock`

### Wire names — dot style

Logical names use dot notation in the frontend: `'timeline.heatmap'`,
`'profiles.list'`, `'profiles.activate'`. The Tauri impl maps to snake_case
Rust identifiers via `.replace('.', '_')`. The `fetch` impl maps via a small
table (`'timeline.heatmap' → '/api/timeline/heatmap'`).

The dot style is the canonical name used in tests, logging, and React Query
keys. Rust function names are derived, not the source of truth.

### Error shape

Every Rust command returns `Result<T, ApiError>`:

```rust
#[derive(Serialize)]
#[serde(tag = "code", content = "detail")]
pub enum ApiError {
    NotFound { kind: &'static str, name: String },
    InvalidInput(String),
    Io(String),       // io::Error wrapped, path included
    Parse(String),    // yaml/json with file + line if available
    Conflict(String), // e.g. profile already active
    Internal(String), // catch-all, logged
}
```

Frontend `transport.ts` normalizes both transports into one TS shape:

```ts
type ApiError = { code: string; message: string; detail?: unknown }
```

React Query hooks already throw via `error`; no hook signature changes. A
`QueryClient` `onError` shows a `sonner` toast for `code !== 'NotFound'`.

### Live updates

`ohmyc-core::watcher` uses the `notify` crate to watch:
`~/.claude/{profiles,agents,skills,commands,plugins.json,settings.json}` and
`~/.claude/db.sqlite`. Debounced 250 ms → emits a typed `FsEvent { kind, path }`.
`events.rs` forwards as Tauri event `fs:changed`. React Query hooks subscribe
via `useEffect` + `listen('fs:changed', invalidateRelated)`.

## Components

### New Rust crate: `crates/ohmyc-core`

Workspace member. Owns every `~/.claude` operation. No Tauri imports — testable
without spinning up the app.

```
crates/ohmyc-core/
├── Cargo.toml          # rusqlite, notify, serde_yaml, serde_json, dirs,
│                       # thiserror, tempfile (dev), rstest (dev)
└── src/
    ├── lib.rs
    ├── error.rs        # ApiError enum
    ├── claude_home.rs  # resolves ~/.claude, .ohmyc
    ├── profiles.rs
    ├── agents.rs
    ├── skills.rs
    ├── commands.rs
    ├── configs.rs
    ├── plugins.rs
    ├── settings.rs
    ├── store.rs
    ├── timeline.rs     # SQLite reads
    └── watcher.rs      # notify + debounce → mpsc<FsEvent>
```

### Tauri command layer

```
packages/desktop/src-tauri/
├── Cargo.toml          # add ohmyc-core (path = "../../../crates/ohmyc-core")
└── src/
    ├── main.rs         # existing + register new commands & events
    ├── popover.rs      # unchanged
    ├── tray.rs         # add "Open OhMyC" menu item
    ├── windows.rs      # NEW — open_main_window command, main window config
    ├── events.rs       # NEW — forward FsEvent → Tauri event "fs:changed"
    └── api/            # NEW — one file per resource
        ├── mod.rs
        ├── profiles.rs
        ├── agents.rs · skills.rs · commands.rs · configs.rs
        ├── plugins.rs · settings.rs · store.rs · timeline.rs
```

Each Tauri command is a ~10-line wrapper: parse args, call ohmyc-core,
serialize. All logic + edge-case tests live in ohmyc-core.

### Frontend changes

```
packages/ui/src/lib/
├── transport.ts        # NEW — request(name, args): Promise<T>
└── transport/
    ├── tauri.ts        # invoke(wire.replace('.', '_'), args)
    ├── fetch.ts        # existing fetch behavior, kept until last slice
    └── mock.ts         # fixture-based, used by vitest

packages/ui/src/hooks/  # one slice per file
├── use-timeline.ts     # slice 2
├── use-profiles.ts     # slice 3
├── use-agents.ts       # slice 4
├── use-skills.ts       # slice 4
├── use-commands.ts     # slice 4
├── use-configs.ts      # slice 5
├── use-settings.ts     # slice 5
├── use-store.ts        # slice 5
└── use-plugins.ts      # slice 6
```

## Migration strategy

### Per-endpoint slicing

Each slice migrates one endpoint (or a tight bundle, e.g. agents + skills +
commands which share shape). Slice steps:

1. Implement the resource in `ohmyc-core` with Rust unit tests covering the
   scenarios extracted from the equivalent TS tests (see Testing).
2. Add Tauri command wrappers in `src-tauri/src/api/<resource>.rs`. Register
   in `main.rs::invoke_handler!`.
3. Update `transport/tauri.ts` (no change usually — the `.replace` covers it).
4. Update `transport/fetch.ts` if the wire name is new.
5. Migrate the hook to call `request('<resource>.<op>', args)` instead of
   `fetch()`.
6. Keep the TS server endpoint alive until the last slice — both implementations
   coexist, and `transport.ts` chooses by env.
7. CI gates: `cargo test -p ohmyc-core`, `pnpm -r test`, `pnpm -r build`,
   smoke `pnpm tauri build --target aarch64-apple-darwin`.

### Slice order

1. **Foundations** — `ohmyc-core` skeleton (crate, error, claude_home),
   `transport.ts` seam, main window + `open_main_window` command, tray menu
   item, popover button. Migrates zero endpoints. Wires the empty main window.
2. **Timeline** — heatmap range + list. Proves the SQLite path, dot-style wire
   convention, fs:changed invalidation. Includes the contract-test fixture
   (see Testing).
3. **Agents + Skills + Commands** — bundled (same shape: list, get). Lights up
   the read-only Explorer surfaces (`/explore/agents`, `/explore/skills`,
   `/explore/commands`) inside the desktop main window.
4. **Configs + Settings + Store** — bundled (config-like). Reads + a few writes;
   first slice where the `transport/fetch.ts` URL table needs methods/body so
   the seam shape lands on a smaller, lower-risk surface.
5. **Plugins + Marketplaces** — completes Explorer (`/explore/plugins`). Main
   window is fully read-functional by the end of this slice.
6. **Profiles** — list/get/create/update/delete/activate/deactivate/preflight.
   Largest surface and biggest risk; pulled last so the transport seam (incl.
   write-endpoint patterns from slice 4), the watcher, the error shape, and the
   per-slice migration cadence are all battle-tested before the killer flow
   moves over.
7. **Cleanup** — delete `packages/cli/src/server`, `serve`, `launcher`,
   `migrate-home`; delete `transport/fetch.ts`; trim `packages/cli` to only the
   `dashboard` command; delete `pnpm dev` from `packages/ui` (or repurpose to a
   static fixture dev mode).

## Testing strategy

### Three layers

1. **`ohmyc-core` Rust unit tests** — each module gets `#[cfg(test)] mod tests`
   against `tempfile::tempdir()` `~/.claude` fixtures. Goal: full logic coverage
   in the core.
2. **Tauri command smoke tests** — `cargo test` with `tauri::test::mock_app()`.
   One round-trip test per command verifying serialization. Catches schema drift.
3. **UI tests (vitest)** — unchanged in shape. `transport.ts` ships `mock.ts`
   for tests: `request('profiles.list', args)` returns from an in-memory fixture
   table. Faster than today's MSW-based tests.

### Porting from TS tests

Port **test cases (scenarios), not test code**. Per endpoint:

1. List TS test files for the endpoint.
2. Extract a scenarios list: each `it(...)` becomes one line.
3. Write idiomatic Rust tests in `ohmyc-core/src/<resource>.rs` covering each
   scenario. Same inputs in, same outcomes asserted, expressed in Rust.
4. HTTP-layer scenarios (status codes, headers, URL parsing) without Rust
   analogs are dropped — their intent is preserved by `ApiError` variant
   assertions.
5. Sanity bridge during migration: TS endpoint tests keep running against the
   TS server. Free coverage; divergence between TS and Rust scenarios is a
   flag.
6. After the slice deletes `packages/cli/src/server/<resource>.ts`, delete the
   corresponding TS tests in the same commit.

### Timeline contract test (one-off)

The dashboard capture plugin writes SQLite. The TS server and Rust core read
the same DB and must produce identical JSON. Risk: subtle divergence
(timezone, NULL → 0, ordering).

Mitigation: check a frozen `tests/fixtures/timeline.sqlite` into the repo with
a known session set. A test in `crates/ohmyc-core/tests/timeline_contract.rs`
invokes the Rust reader; a parallel TS test invokes the TS reader; both
expected outputs are JSON files checked alongside the fixture. Both impls must
match the same expected JSON. Delete the contract test after the timeline
slice ships and the TS reader is gone.

## Build pipeline

- `pnpm tauri build` → cargo builds `ohmyc-core` + `ohmyc-desktop` into one
  binary. No sidecar, no Node runtime in the bundle. Target binary size:
  <15 MB universal.
- `packages/cli` publishes to npm with only the `dashboard` command (TS,
  unchanged). Documented as the install path for the Claude Code capture
  plugin.
- CI matrix per PR:
  - `cargo test -p ohmyc-core`
  - `cargo test --manifest-path packages/desktop/src-tauri/Cargo.toml`
  - `pnpm -r test`
  - `pnpm -r build`
  - `pnpm tauri build --target aarch64-apple-darwin` (smoke)
  - `pnpm tauri build --target x86_64-apple-darwin` (smoke)

## Decisions log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Desktop is the only shipping UI | User-confirmed scope: kill web UI, kill HTTP server |
| 2 | Full Rust port (no Node sidecar) | Single binary; no ~40MB Node bundle; consistent with "desktop only" framing |
| 3 | `packages/cli` keeps only `dashboard` | Capture-plugin install must still be a CLI affordance for headless use |
| 4 | Endpoint-by-endpoint behind transport seam | Every commit green; dev loop survives; clean rollback per slice |
| 5 | Two windows, one process | Reuses the menubar chart; standard Tauri pattern; one cache, one watcher |
| 6 | Main window opens from popover, not auto-launch | App is tray-first; main window is on-demand |
| 7 | Dot-style wire names (`'timeline.heatmap'`) | Single canonical name across hooks/tests/logs; transport maps to invoke or fetch |
| 8 | `ohmyc-core` as separate crate, not in `src-tauri` | Testable without Tauri; clear boundary between logic and Tauri glue |
| 9 | Port test scenarios, not test code | TS tests are a behavior contract; Rust tests are fresh, idiomatic |
| 10 | Frozen SQLite contract test for timeline | Highest-risk divergence; cheap mitigation; deleted after timeline slice |
| 11 | `fs:changed` Tauri event + React Query invalidation | Mirrors existing live-update semantics; debounced 250ms |
| 12 | Tray menu gains "Open OhMyC" | Discoverability for users who close the popover |
| 13 | Profiles slice moves to last (slice 6, just before cleanup) | Profiles is the killer flow and the highest-risk surface; pulling it last means the transport seam, write-endpoint shape (from Configs/Settings/Store in slice 4), watcher, error shape, and migration cadence are all battle-tested before the killer flow moves over. Explorer reads light up by slice 3; Settings by slice 4; Plugins by slice 5 — main window is fully read-functional before Profiles even starts |

## Open questions for review

None blocking — all clarifying questions answered during brainstorming. If the
reviewer wants to push back on:
- The two-window topology vs. dropping the popover (decision 5/6)
- The slice order (could timeline come last as it's the lowest-risk read-only path)
- The contract-test investment (could be skipped if you trust the manual smoke)

…that's the place to flag it before the writing-plans pass.
