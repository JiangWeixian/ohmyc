# Onboarding Setup Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-app onboarding gate that shows a setup screen (retro-computer + LetterGlitch + actions) when the local monitor store is not ready, instead of rendering an empty/broken Timeline.

**Architecture:** A Rust setup probe in `ohmyc-core` resolves the timeline DB path and checks readability, returning a stable `SetupStatus` enum (never the DB path). A Tauri `setup_status` command exposes it. A `useSetupStatus` React Query hook reads it; a `SetupGate` wrapper in the app shell redirects to `/onboard` when not ready. The visual layer (`RetroComputerAtropos` + `LetterGlitch`) already exists from the validated onboarding spike — this plan wires the real readiness path and replaces the spike with a production `OnboardingGate`.

**Tech Stack:** Rust (`ohmyc-core`, rusqlite, serde, tempfile for tests) · Tauri 2 commands · React 19 · React Query · TypeScript · Vitest + Testing Library

**Spec:** `docs/superpowers/specs/2026-06-25-onboarding-setup-gate-design.md`

---

## File Structure

**Create:**
- `crates/ohmyc-core/src/setup.rs` — setup readiness probe + `SetupStatus` enum. Reuses `timeline::default_db_path` / `open_db` / `status` internally. Public API exposes readiness only, never the DB path.
- `packages/desktop/src-tauri/src/api/setup.rs` — `setup_status` Tauri command, thin wrapper over the core probe.
- `packages/ui/src/hooks/use-setup-status.ts` — React Query hook, query key `['setup','status']`, transport call `request('setup.status', {})`. No dependency on `useTimelineStatus`.
- `packages/ui/src/components/onboarding/onboarding-gate.tsx` — production gate. Reuses `RetroComputerAtropos` + `LetterGlitch` + the `Button` primitive. Wires `useSetupStatus` for state-specific copy + Retry refetch.
- `packages/ui/src/app-shell.tsx` — normal ready-state app shell extracted from `app.tsx`: routes, `AppLayout`, and `AppCommandPalette`.
- `packages/ui/src/app-setup-gate.tsx` — setup readiness router wrapper. Missing/unreadable/internal states navigate to hidden `/onboard`; ready state renders the normal shell.
- `packages/ui/src/tests/onboarding/onboarding-gate.test.tsx` — render tests for each setup state.
- `packages/ui/src/tests/hooks/use-setup-status.test.ts` — hook test against the mock transport.
- `packages/ui/src/tests/app/setup-gate.test.tsx` — route-level gate tests.

**Modify:**
- `crates/ohmyc-core/src/lib.rs` — register `pub mod setup;`
- `crates/ohmyc-core/src/timeline.rs` — expose the existing `test_db` fixture as `pub(crate)` under `#[cfg(test)]` so setup tests do not duplicate schema SQL.
- `packages/desktop/src-tauri/src/api/mod.rs` — register `pub mod setup;`
- `packages/desktop/src-tauri/src/main.rs` — add `setup_status` to `generate_handler!`
- `packages/ui/src/app.tsx` — shrink to provider/toaster composition around `SetupGate`; remove route/palette bodies after moving them to `app-shell.tsx`.
- `DESIGN.md` — update the existing 2026-06-25 Decisions Log row if it lacks the final baked-screen detail; do not append a duplicate row.

**Delete (spike cleanup):**
- `packages/ui/src/components/onboarding/onboarding-spike-view.tsx` — superseded by `OnboardingGate`.

**Reuse (already validated in spike, do not recreate):**
- `packages/ui/src/components/onboarding/retro-computer-atropos.tsx`
- `packages/ui/src/components/onboarding/letter-glitch.tsx`
- `packages/ui/src/components/onboarding/assets/computer-shell.png`, `keyboard.png`
- The `.onboarding-spike` / `.retro-computer-atropos` CSS in `packages/ui/src/globals.css` (rename the layout class to a shared name — see Task 5).

---

## Conventions reference (read before starting)

- **Rust command naming:** Tauri commands use `snake_case` (`timeline_status`). The frontend transport converts wire `timeline.status` → `timeline_status` via `wire.replace(/\./g, '_')` (`packages/ui/src/lib/transport/tauri.ts:6`).
- **Command registration:** all commands are listed in `tauri::generate_handler![...]` in `packages/desktop/src-tauri/src/main.rs:22`.
- **Error type:** `ohmyc_core::error::ApiError` (tagged serde enum). The setup probe deliberately does NOT return `ApiError` — every failure maps to a `SetupStatus` variant so the frontend always gets a structured state.
- **Transport mock:** tests use `setMockHandler(wire, handler)` + `__setTransportForTests('mock')` from `packages/ui/src/lib/transport/mock.ts` and `packages/ui/src/lib/transport.ts`.
- **Test layout:** Vitest unit tests live under `packages/ui/src/tests/**` (config in `packages/ui/vite.config.ts`, `name: 'unit'`). Run with `pnpm --filter @ohmyc/ui test`.
- **Rust tests:** `cargo test -p ohmyc-core`. The `tempfile` crate is already a workspace dev-dependency.
- **Commit style:** lowercase conventional commits (`feat:`, `test:`, `chore:`) — see `git log --oneline`.

---

### Task 1: Rust setup probe (`crates/ohmyc-core/src/setup.rs`)

**Files:**
- Create: `crates/ohmyc-core/src/setup.rs`
- Modify: `crates/ohmyc-core/src/lib.rs:1-13` (add module declaration)
- Modify: `crates/ohmyc-core/src/timeline.rs:11-12` (make the existing `#[cfg(test)] test_db` module visible to crate-local tests)

This module owns readiness checking. It reuses the low-level timeline helpers but exposes only a `SetupStatus` — never the DB path.

- [ ] **Step 1: Write the failing tests**

Create `crates/ohmyc-core/src/setup.rs` with the tests first. The implementation functions (`probe`, `probe_path`) won't exist yet, so this won't compile — that's the TDD failure.

```rust
//! Setup readiness probe. Resolves the local monitor store and checks whether
//! the timeline schema can be read. Exposes a stable `SetupStatus` only —
//! the DB path never leaves this module.

use serde::Serialize;
use std::path::Path;

use crate::timeline;

/// Stable setup readiness state serialized to the frontend as a tagged union:
/// `{ state: "ready" }`, `{ state: "missing_store" }`, etc.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case", tag = "state")]
pub enum SetupStatus {
    Ready,
    MissingStore,
    UnreadableStore {
        #[serde(skip_serializing_if = "Option::is_none")]
        reason: Option<String>,
    },
    InternalError {
        #[serde(skip_serializing_if = "Option::is_none")]
        reason: Option<String>,
    },
}

/// Public entry point: resolve the store path via the timeline module and probe it.
/// A failure to even resolve the path is an `InternalError` (never panics).
pub fn probe() -> SetupStatus {
    match timeline::default_db_path() {
        Ok(path) => probe_path(&path),
        Err(_) => SetupStatus::InternalError {
            reason: Some("could not resolve monitor store path".to_string()),
        },
    }
}

/// Path-injected probe — the testable core. No env var mutation required.
pub fn probe_path(path: &Path) -> SetupStatus {
    if !path.exists() {
        return SetupStatus::MissingStore;
    }
    // open_db returns an Io error only when the file is absent (already handled
    // above); any other open failure means unreadable. We deliberately discard
    // the raw error string so the DB path can never leak.
    let conn = match timeline::open_db(path) {
        Ok(conn) => conn,
        Err(_) => {
            return SetupStatus::UnreadableStore {
                reason: Some("monitor store could not be opened".to_string()),
            };
        }
    };
    match timeline::status(&conn) {
        Ok(_) => SetupStatus::Ready,
        Err(_) => SetupStatus::UnreadableStore {
            reason: Some("monitor store schema could not be read".to_string()),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::timeline::test_db;
    use rusqlite::Connection;
    use std::fs;
    use tempfile::TempDir;

    /// Build a valid timeline DB (schema applied, zero sessions) at a temp path.
    fn valid_store() -> (TempDir, std::path::PathBuf) {
        let dir = TempDir::new().expect("temp dir");
        let path = dir.path().join("timeline.db");
        let conn = Connection::open(&path).expect("open db");
        conn.execute_batch(test_db::SCHEMA_SQL).expect("apply schema");
        // Zero sessions is a valid Ready state, not an onboarding condition.
        drop(conn);
        (dir, path)
    }

    #[test]
    fn missing_store_returns_missing() {
        let dir = TempDir::new().expect("temp dir");
        let path = dir.path().join("timeline.db");
        // Path does not exist.
        assert_eq!(probe_path(&path), SetupStatus::MissingStore);
    }

    #[test]
    fn ready_when_store_has_schema_and_zero_sessions() {
        let (_dir, path) = valid_store();
        assert_eq!(probe_path(&path), SetupStatus::Ready);
    }

    #[test]
    fn unreadable_when_store_is_garbage_bytes() {
        let dir = TempDir::new().expect("temp dir");
        let path = dir.path().join("timeline.db");
        fs::write(&path, b"not a sqlite database").expect("write garbage");
        match probe_path(&path) {
            SetupStatus::UnreadableStore { .. } => {}
            other => panic!("expected UnreadableStore, got {other:?}"),
        }
    }

    #[test]
    fn unreadable_when_schema_is_missing_sessions_table() {
        let dir = TempDir::new().expect("temp dir");
        let path = dir.path().join("timeline.db");
        // A valid SQLite file but not the timeline schema.
        let conn = Connection::open(&path).expect("open db");
        conn.execute_batch("CREATE TABLE unrelated (x INTEGER);")
            .expect("apply wrong schema");
        drop(conn);
        assert!(
            matches!(probe_path(&path), SetupStatus::UnreadableStore { .. }),
            "a SQLite file without the sessions table is unreadable"
        );
    }

    #[test]
    fn serialized_status_never_contains_the_db_path() {
        let dir = TempDir::new().expect("temp dir");
        let path = dir.path().join("timeline.db");
        fs::write(&path, b"garbage").expect("write garbage");
        let status = probe_path(&path);
        let json = serde_json::to_string(&status).expect("serialize");
        // The temp path must not appear anywhere in the wire payload.
        assert!(
            !json.contains(&path.display().to_string()),
            "DB path leaked into setup status: {json}"
        );
    }

    #[test]
    fn ready_serializes_to_state_ready_tag() {
        let json = serde_json::to_value(&SetupStatus::Ready).expect("serialize");
        assert_eq!(json["state"], "ready");
    }

    #[test]
    fn missing_serializes_to_state_missing_store_tag() {
        let json = serde_json::to_value(&SetupStatus::MissingStore).expect("serialize");
        assert_eq!(json["state"], "missing_store");
    }
}
```

- [ ] **Step 2: Register the module and expose the shared test fixture**

Edit `crates/ohmyc-core/src/lib.rs`. Add `setup` to the module declarations (after `pub mod timeline;`):

```rust
pub mod setup;
```

Edit `crates/ohmyc-core/src/timeline.rs`. Change the test-only fixture module declaration from private to crate-visible:

```rust
#[cfg(test)]
pub(crate) mod test_db;
```

- [ ] **Step 3: Run the tests to verify they pass**

Run: `cargo test -p ohmyc-core --lib setup::`
Expected: all 7 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add crates/ohmyc-core/src/setup.rs crates/ohmyc-core/src/lib.rs crates/ohmyc-core/src/timeline.rs
git commit -m "feat(core): add setup readiness probe"
```

---

### Task 2: Tauri `setup_status` command

**Files:**
- Create: `packages/desktop/src-tauri/src/api/setup.rs`
- Modify: `packages/desktop/src-tauri/src/api/mod.rs:1-9` (add module)
- Modify: `packages/desktop/src-tauri/src/main.rs:22-53` (register handler)

- [ ] **Step 1: Create the command wrapper**

Create `packages/desktop/src-tauri/src/api/setup.rs`:

```rust
//! Tauri command wrapper for the ohmyc-core setup readiness probe.
//! Infallible on the wire — every failure is encoded as a `SetupStatus` variant,
//! so the frontend always receives a structured state, never an error envelope.

use ohmyc_core::setup::{probe, SetupStatus};

/// Returns the local monitor store readiness. Never returns the DB path.
#[tauri::command]
pub fn setup_status() -> SetupStatus {
    probe()
}
```

- [ ] **Step 2: Register the module in `api/mod.rs`**

Edit `packages/desktop/src-tauri/src/api/mod.rs`. After the existing `pub mod` declarations (lines 1-9), add:

```rust
pub mod setup;
```

- [ ] **Step 3: Register the command in the invoke handler**

Edit `packages/desktop/src-tauri/src/main.rs`. In the `tauri::generate_handler![...]` array (starts at line 22), add the new command. Insert it immediately after the `timeline_status` line (around line 29) so timeline + setup stay grouped:

```rust
            ohmyc_desktop_lib::api::timeline::timeline_status,
            ohmyc_desktop_lib::api::setup::setup_status,
```

- [ ] **Step 4: Verify it compiles**

Run: `cargo build --manifest-path packages/desktop/src-tauri/Cargo.toml`
Expected: builds with no errors. (A full Tauri build is slow; this just confirms the command + registration type-check.)

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src-tauri/src/api/setup.rs packages/desktop/src-tauri/src/api/mod.rs packages/desktop/src-tauri/src/main.rs
git commit -m "feat(desktop): add setup_status tauri command"
```

---

### Task 3: Frontend `useSetupStatus` hook

**Files:**
- Create: `packages/ui/src/hooks/use-setup-status.ts`
- Test: `packages/ui/src/tests/hooks/use-setup-status.test.ts`

- [ ] **Step 1: Write the hook + types**

Create `packages/ui/src/hooks/use-setup-status.ts`:

```ts
// Setup readiness hook. Independent of useTimelineStatus — the onboarding gate
// must not reuse Timeline queries (spec). Retry is driven by explicit user
// action from the gate, so background polling/refetch is disabled.
import { useQuery } from '@tanstack/react-query'

import { request } from '@/lib/transport'

/** Tagged union mirroring `ohmyc_core::setup::SetupStatus` on the wire. */
export type SetupStatus =
  | { state: 'ready' }
  | { state: 'missing_store' }
  | { state: 'unreadable_store'; reason?: string }
  | { state: 'internal_error'; reason?: string }

/** Query hook for monitor store readiness. */
export function useSetupStatus() {
  return useQuery({
    queryKey: ['setup', 'status'],
    queryFn: async () => request<SetupStatus>('setup.status', {}),
    // No aggressive polling or focus refresh. Still re-check on mount so opening
    // the app after installing/removing the plugin cannot use stale readiness.
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
    staleTime: 0,
  })
}
```

- [ ] **Step 2: Write the failing test**

Create `packages/ui/src/tests/hooks/use-setup-status.test.ts`:

```ts
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useSetupStatus } from '@/hooks/use-setup-status'
import { resetMock, setMockHandler } from '@/lib/transport/mock'
import { __setTransportForTests } from '@/lib/transport'

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useSetupStatus', () => {
  beforeEach(() => {
    __setTransportForTests('mock')
  })
  afterEach(() => {
    resetMock()
  })

  it('returns ready state from the setup.status transport call', async () => {
    setMockHandler('setup.status', async () => ({ state: 'ready' }))
    const { result } = renderHook(() => useSetupStatus(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ state: 'ready' })
  })

  it('returns missing_store state', async () => {
    setMockHandler('setup.status', async () => ({ state: 'missing_store' }))
    const { result } = renderHook(() => useSetupStatus(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.state).toBe('missing_store')
  })

  it('returns unreadable_store with reason', async () => {
    setMockHandler('setup.status', async () => ({
      state: 'unreadable_store',
      reason: 'schema could not be read',
    }))
    const { result } = renderHook(() => useSetupStatus(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({
      state: 'unreadable_store',
      reason: 'schema could not be read',
    })
  })

  it('refetches when refetch is called (Retry action)', async () => {
    let calls = 0
    let state = 'missing_store'
    setMockHandler('setup.status', async () => {
      calls += 1
      return { state }
    })
    const { result } = renderHook(() => useSetupStatus(), { wrapper })
    await waitFor(() => expect(result.current.data?.state).toBe('missing_store'))
    // Simulate the user installing the plugin then pressing Retry.
    state = 'ready'
    await act(async () => {
      await result.current.refetch()
    })
    await waitFor(() => expect(result.current.data?.state).toBe('ready'))
    expect(calls).toBe(2)
  })
})
```

- [ ] **Step 3: Run the test**

Run: `pnpm --filter @ohmyc/ui test -- use-setup-status`
Expected: all 4 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/hooks/use-setup-status.ts packages/ui/src/tests/hooks/use-setup-status.test.ts
git commit -m "feat(ui): add useSetupStatus hook"
```

---

### Task 4: `OnboardingGate` component

**Files:**
- Create: `packages/ui/src/components/onboarding/onboarding-gate.tsx`
- Test: `packages/ui/src/tests/onboarding/onboarding-gate.test.tsx`

This is the production version of the validated spike view. It reuses `RetroComputerAtropos` + `LetterGlitch` + the `Button` primitive, and wires `useSetupStatus` for state-specific copy and the Retry action.

- [ ] **Step 1: Write the component**

Create `packages/ui/src/components/onboarding/onboarding-gate.tsx`:

```tsx
// Production onboarding setup gate. Renders when the monitor store is not
// ready. Reuses the spike-validated RetroComputerAtropos + LetterGlitch visuals.
// Copy + actions follow the spec; Retry refetches useSetupStatus (installs nothing).
import { ExternalLink, RotateCw } from 'lucide-react'
import { useSyncExternalStore } from 'react'

import { Button } from '@/components/ui/button'
import { useSetupStatus } from '@/hooks/use-setup-status'
import { cn } from '@/lib/utils'

import { LetterGlitch } from './letter-glitch'
import { RetroComputerAtropos } from './retro-computer-atropos'
import type { SetupStatus } from '@/hooks/use-setup-status'

const PLUGIN_REPO = 'https://github.com/JiangWeixian/ohmyc-plugins'

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'
function subscribePrefersReducedMotion(callback: () => void) {
  if (typeof globalThis.matchMedia !== 'function') {
    return () => {}
  }
  const mq = globalThis.matchMedia(REDUCED_QUERY)
  mq.addEventListener('change', callback)
  return () => mq.removeEventListener('change', callback)
}
function getPrefersReducedMotion() {
  if (typeof globalThis.matchMedia !== 'function') {
    return false
  }
  return globalThis.matchMedia(REDUCED_QUERY).matches
}

/** Extra status line for non-missing states (spec: unreadable / internal_error). */
function statusLine(state: SetupStatus['state']): string | null {
  switch (state) {
    case 'unreadable_store':
      return 'Local monitor store exists but could not be opened.'
    case 'internal_error':
      return 'Setup check failed. Retry after installing the plugin or restarting OhMyC.'
    default:
      return null
  }
}

export function OnboardingGate() {
  const { data, refetch, isFetching } = useSetupStatus()
  const reduced = useSyncExternalStore(
    subscribePrefersReducedMotion,
    getPrefersReducedMotion,
    () => false,
  )
  const state = data?.state ?? 'missing_store'
  const line = statusLine(state)

  return (
    <section
      aria-labelledby="onboard-title"
      aria-describedby="onboard-body"
      className={cn('onboarding-spike')}
    >
      {/* Ambient letter-glitch field — bottom layer, never intercepts pointer. */}
      <div className="onboard-letter-field" aria-hidden>
        <LetterGlitch disabled={reduced} glitchSpeed={140} />
      </div>

      <RetroComputerAtropos className="retro-computer-atropos" inactive={reduced} />

      <div className="onboard-text">
        <div className="onboard-copy">
          <h1 id="onboard-title" className="onboard-title">Monitor not connected</h1>
          <p id="onboard-body" className="onboard-body">
            Install the OhMyC plugin to start collecting local coding activity.
          </p>
          {line ? <p className="onboard-status-line">{line}</p> : null}
        </div>

        <div className="onboard-actions">
          <Button asChild variant="default" size="lg">
            <a href={PLUGIN_REPO} target="_blank" rel="noreferrer">
              <ExternalLink /> Open plugin repo
            </a>
          </Button>
          <Button
            variant="outline"
            size="lg"
            disabled={isFetching}
            onClick={() => {
              void refetch()
            }}
          >
            <RotateCw /> Retry
          </Button>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Add the `.onboard-status-line` style**

In `packages/ui/src/globals.css`, inside the `.onboarding-spike` layout block (next to `.onboard-body`), add:

```css
.onboarding-spike .onboard-status-line {
  font-size: 0.85rem;
  line-height: 1.5;
  opacity: 0.55;
  font-family: var(--font-mono, ui-monospace, monospace);
}
```

- [ ] **Step 3: Write the failing tests**

Create `packages/ui/src/tests/onboarding/onboarding-gate.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { OnboardingGate } from '@/components/onboarding/onboarding-gate'
import { resetMock, setMockHandler } from '@/lib/transport/mock'
import { __setTransportForTests } from '@/lib/transport'

const PLUGIN_REPO = 'https://github.com/JiangWeixian/ohmyc-plugins'

function renderGate() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  return render(
    <QueryClientProvider client={client}>
      <OnboardingGate />
    </QueryClientProvider>,
  )
}

describe('OnboardingGate', () => {
  beforeEach(() => {
    __setTransportForTests('mock')
  })
  afterEach(() => {
    resetMock()
  })

  it('renders the monitor-not-connected copy for missing_store', async () => {
    setMockHandler('setup.status', async () => ({ state: 'missing_store' }))
    renderGate()
    expect(await screen.findByRole('heading', { level: 1, name: 'Monitor not connected' })).toBeTruthy()
    expect(
      screen.getByText('Install the OhMyC plugin to start collecting local coding activity.'),
    ).toBeTruthy()
  })

  it('renders the unreadable-store status line for unreadable_store', async () => {
    setMockHandler('setup.status', async () => ({ state: 'unreadable_store' }))
    renderGate()
    expect(
      await screen.findByText('Local monitor store exists but could not be opened.'),
    ).toBeTruthy()
  })

  it('renders the internal-error status line for internal_error', async () => {
    setMockHandler('setup.status', async () => ({ state: 'internal_error' }))
    renderGate()
    expect(
      await screen.findByText(
        'Setup check failed. Retry after installing the plugin or restarting OhMyC.',
      ),
    ).toBeTruthy()
  })

  it('does not render the status line for missing_store', async () => {
    setMockHandler('setup.status', async () => ({ state: 'missing_store' }))
    renderGate()
    await screen.findByRole('heading', { level: 1, name: 'Monitor not connected' })
    expect(screen.queryByText('Local monitor store exists but could not be opened.')).toBeNull()
  })

  it('links the primary action to the plugin repo', async () => {
    setMockHandler('setup.status', async () => ({ state: 'missing_store' }))
    renderGate()
    const link = await screen.findByRole('link', { name: /open plugin repo/i })
    expect(link.getAttribute('href')).toBe(PLUGIN_REPO)
    expect(link.getAttribute('target')).toBe('_blank')
  })

  it('renders a Retry button', async () => {
    setMockHandler('setup.status', async () => ({ state: 'missing_store' }))
    renderGate()
    expect(await screen.findByRole('button', { name: /retry/i })).toBeTruthy()
  })
})
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @ohmyc/ui test -- onboarding-gate`
Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/onboarding/onboarding-gate.tsx packages/ui/src/tests/onboarding/onboarding-gate.test.tsx packages/ui/src/globals.css
git commit -m "feat(ui): add OnboardingGate component"
```

---

### Task 5: App routing gate + hidden `/onboard` route

**Files:**
- Create: `packages/ui/src/app-shell.tsx`
- Create: `packages/ui/src/app-setup-gate.tsx`
- Create: `packages/ui/src/tests/app/setup-gate.test.tsx`
- Modify: `packages/ui/src/app.tsx`

The gate lives at the main app root so that when the monitor store is not ready, normal main-window routes navigate to hidden `/onboard` and render only `OnboardingGate` (no NavigationIsland, no command palette). `/menubar` keeps its current compact behavior in this plan; a menubar-specific gate/component reuse pass is a follow-up.

- [ ] **Step 1: Read the current `app.tsx`**

Run: `read packages/ui/src/app.tsx`
Note the `App` component (wraps `CommandPaletteProvider` → `AppLayout` + `AppCommandPalette` + `Toaster`) and the `AppLayout` routes (currently includes the spike route `/explore/onboard-spike`).

- [ ] **Step 2: Extract the ready-state shell into `app-shell.tsx`**

Create `packages/ui/src/app-shell.tsx` by moving the current route/palette imports plus the current `AppCommandPalette` and `AppLayout` function bodies out of `app.tsx`.

Apply these exact shell changes while moving:

- Remove the `OnboardingSpikeView` import.
- Remove the spike route line: `<Route path="/explore/onboard-spike" element={<OnboardingSpikeView />} />`.
- Export both functions: `export function AppCommandPalette()` and `export function AppLayout()`.
- Add the hidden ready-state `/onboard` redirect route inside `AppLayout`'s `<Routes>`:

```tsx
        <Route path="/onboard" element={<Navigate to="/explore/timeline" replace />} />
```

Place it next to the other top-level routes, before the wildcard route. Do NOT add `/onboard` to `NavigationIsland` or `AppCommandPalette`'s `goToCommands` — it is not a normal navigation destination.

- [ ] **Step 3: Create `app-setup-gate.tsx`**

Create `packages/ui/src/app-setup-gate.tsx`:

```tsx
// Extracted setup gate so routing logic is unit-testable without mounting
// the full toaster/provider shell from app.tsx.
import { Navigate, useLocation } from 'react-router-dom'

import { AppCommandPalette, AppLayout } from './app-shell'
import { OnboardingGate } from './components/onboarding/onboarding-gate'
import { useSetupStatus } from './hooks/use-setup-status'

const ONBOARD_PATH = '/onboard'
const READY_DEFAULT_PATH = '/explore/timeline'

function ReadyShell() {
  return (
    <>
      <AppLayout />
      <AppCommandPalette />
    </>
  )
}

/** Minimal checking state while setup readiness is loading. */
export function CheckingSetup() {
  return <div className="h-dvh overflow-hidden bg-[var(--surface-base)] text-[var(--text-primary)]" />
}

/**
 * Setup gate. Loading → checking state. Main app not ready → hidden /onboard
 * route. Ready → normal shell. /menubar is intentionally left unchanged for the
 * follow-up menubar pass.
 */
export function SetupGate() {
  const { data, isLoading } = useSetupStatus()
  const location = useLocation()

  if (location.pathname === '/menubar') {
    return <ReadyShell />
  }

  if (isLoading || !data) {
    return <CheckingSetup />
  }
  if (data.state !== 'ready') {
    if (location.pathname !== ONBOARD_PATH) {
      return <Navigate to={ONBOARD_PATH} replace state={{ from: location }} />
    }
    return <OnboardingGate />
  }
  if (location.pathname === ONBOARD_PATH) {
    return <Navigate to={READY_DEFAULT_PATH} replace />
  }
  return <ReadyShell />
}
```

- [ ] **Step 4: Shrink `app.tsx` to provider/toaster composition**

After moving shell code to `app-shell.tsx`, replace `packages/ui/src/app.tsx` with:

```tsx
// Root application component — sets up the command palette provider, setup gate,
// and global toast host. Routing/palette shell lives in app-shell.tsx.
import { Toaster } from 'sonner'

import { SetupGate } from './app-setup-gate'
import { CommandPaletteProvider } from './components/command-palette'

/** Root exported component — wraps the app in the command palette provider and toaster. */
export function App() {
  return (
    <CommandPaletteProvider>
      <SetupGate />
      <Toaster theme="dark" position="bottom-right" toastOptions={{ style: { background: 'var(--surface-overlay)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderRadius: 'var(--radius-lg)' } }} />
    </CommandPaletteProvider>
  )
}
```

- [ ] **Step 5: Write the routing test**

To keep the gate unit-testable, mock `app-shell.tsx`. The test verifies route semantics and shell suppression without mounting Explorer, NavigationIsland, command palette search queries, or the Toaster.

Create `packages/ui/src/tests/app/setup-gate.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SetupGate } from '@/app-setup-gate'
import { resetMock, setMockHandler } from '@/lib/transport/mock'
import { __setTransportForTests } from '@/lib/transport'

vi.mock('@/app-shell', () => ({
  AppLayout: () => <nav aria-label="Primary">Ready shell</nav>,
  AppCommandPalette: () => <div data-testid="command-palette" />,
}))

function LocationProbe() {
  const location = useLocation()
  return <output aria-label="path">{location.pathname}</output>
}

function renderGate(initialEntries = ['/explore/timeline']) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={client}>
        <SetupGate />
        <LocationProbe />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('SetupGate', () => {
  beforeEach(() => {
    __setTransportForTests('mock')
  })
  afterEach(() => {
    resetMock()
  })

  it('renders OnboardingGate (and not the Explorer) when not ready', async () => {
    setMockHandler('setup.status', async () => ({ state: 'missing_store' }))
    renderGate()
    expect(await screen.findByRole('heading', { level: 1, name: 'Monitor not connected' })).toBeTruthy()
    expect(screen.getByLabelText('path').textContent).toBe('/onboard')
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull()
    expect(screen.queryByTestId('command-palette')).toBeNull()
  })

  it('renders the normal shell when ready', async () => {
    setMockHandler('setup.status', async () => ({ state: 'ready' }))
    renderGate(['/explore/timeline'])
    expect(await screen.findByRole('navigation', { name: 'Primary' })).toBeTruthy()
    expect(screen.getByTestId('command-palette')).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 1, name: 'Monitor not connected' })).toBeNull()
  })

  it('redirects a ready direct /onboard visit back to timeline', async () => {
    setMockHandler('setup.status', async () => ({ state: 'ready' }))
    renderGate(['/onboard'])
    await waitFor(() => {
      expect(screen.getByLabelText('path').textContent).toBe('/explore/timeline')
    })
    expect(screen.queryByRole('heading', { level: 1, name: 'Monitor not connected' })).toBeNull()
  })

  it('leaves /menubar unchanged for the follow-up menubar pass', async () => {
    setMockHandler('setup.status', async () => ({ state: 'missing_store' }))
    renderGate(['/menubar'])
    expect(await screen.findByRole('navigation', { name: 'Primary' })).toBeTruthy()
    expect(screen.getByLabelText('path').textContent).toBe('/menubar')
    expect(screen.queryByRole('heading', { level: 1, name: 'Monitor not connected' })).toBeNull()
  })

  it('renders a minimal checking state while loading', () => {
    // No handler registered → query stays pending.
    setMockHandler('setup.status', async () => {
      await new Promise(() => {})
      return { state: 'ready' }
    })
    const { container } = renderGate()
    expect(screen.queryByRole('heading', { level: 1, name: 'Monitor not connected' })).toBeNull()
    expect(container.querySelector('.onboarding-spike')).toBeNull()
  })
})
```

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter @ohmyc/ui test -- setup-gate`
Expected: 5 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/app.tsx packages/ui/src/app-shell.tsx packages/ui/src/app-setup-gate.tsx packages/ui/src/tests/app/setup-gate.test.tsx
git commit -m "feat(ui): gate the app shell on setup readiness"
```

---

### Task 6: Spike cleanup + DESIGN.md decision log

**Files:**
- Delete: `packages/ui/src/components/onboarding/onboarding-spike-view.tsx`
- Modify: `packages/ui/package.json:8` (the `./onboard` export points at the gate now)
- Modify: `DESIGN.md` (Decisions Log)

- [ ] **Step 1: Delete the spike view**

```bash
git rm packages/ui/src/components/onboarding/onboarding-spike-view.tsx
```

- [ ] **Step 2: Point the `./onboard` export at the production gate**

Edit `packages/ui/package.json`. The spike added:

```json
"./onboard": "./src/components/onboarding/onboarding-spike-view.tsx",
```

Change it to:

```json
"./onboard": "./src/components/onboarding/onboarding-gate.tsx",
```

- [ ] **Step 3: Verify nothing still imports the spike view**

Run: `grep -rn "onboarding-spike-view" packages/ui/src`
Expected: no matches.

- [ ] **Step 4: Update the existing DESIGN.md Decisions Log row**

`DESIGN.md` already has a 2026-06-25 row for the hidden `/onboard` setup route. Do not append a duplicate row. Read the Decisions Log table and keep its existing 3-column format (`Date | Decision | Rationale`). If the existing row does not mention the final baked-screen asset detail, replace that row with:

```markdown
| 2026-06-25 | Missing monitor store uses a hidden `/onboard` setup route | When the local monitor store is unavailable, the main app should route to a headerless setup gate instead of rendering a broken or empty Timeline. `/onboard` is not regular navigation chrome: no Navigation Island entry, no command-palette entry, manual plugin repo link plus Retry, and no database path shown. The desktop menubar Open action can trigger the same route through the main window. The visual subject uses the `frosted-ivory-lamplit-screen-baked` Atropos computer with real layered shell/keyboard depth, reduced-motion fallback, and low-contrast Letter Glitch ambience |
```

- [ ] **Step 5: Run the full check suite**

```bash
cargo test -p ohmyc-core --lib setup::
pnpm --filter @ohmyc/ui exec tsc --noEmit
pnpm --filter @ohmyc/ui test
pnpm --filter @ohmyc/ui exec eslint src/components/onboarding src/app.tsx src/app-shell.tsx src/app-setup-gate.tsx src/hooks/use-setup-status.ts --ext ts,tsx
```
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add DESIGN.md packages/ui/package.json packages/ui/src/components/onboarding/onboarding-gate.tsx packages/ui/src/components/onboarding/onboarding-spike-view.tsx packages/ui/src/globals.css
git commit -m "chore: replace onboarding spike with production gate"
```

---

### Task 7: Menubar popover onboarding state

**Files:**
- Modify: `packages/ui/src/components/menubar/menubar-page.tsx` (split into gated `MenubarPage` + `MenubarActivity`)
- Reuse: `packages/ui/src/components/menubar/menubar-onboard.tsx` (spike-validated, production-quality)
- Modify: `packages/ui/src/app.tsx` (remove the `/explore/menubar-onboard-spike` route + `MenubarOnboardSpike` wrapper)
- Test: `packages/ui/src/tests/menubar/menubar-page.test.tsx`

The popover is `/menubar`'s own compact surface (spec: outside the main-window gate). When the store is not ready it shows the shrunk `MenubarOnboard` (mini retro computer, no LetterGlitch, no ambient gradients, `highlight={false}`) instead of the empty activity chart. "Open OhMyC" opens the main window which runs the full `/onboard` gate.

- [ ] **Step 1: Split `MenubarPage` into a gate + activity body**

Edit `packages/ui/src/components/menubar/menubar-page.tsx`. Rename the existing `export function MenubarPage()` to `function MenubarActivity()` (keep its body and hooks intact), then add a new gated `MenubarPage` plus a status-line helper. This keeps hook order stable — `MenubarPage` only calls `useSetupStatus`; the activity hooks only mount when ready.

Add imports at the top:

```tsx
import { MenubarOnboard } from './menubar-onboard'
import { useSetupStatus } from '@/hooks/use-setup-status'
import type { SetupStatus } from '@/hooks/use-setup-status'
```

Add the status-line helper (mirrors the main gate's copy) and the new gate, after the renamed `MenubarActivity`:

```tsx
/** Compact status line for the popover (mirrors the main gate). */
function menubarStatusLine(state: SetupStatus['state']): string | undefined {
  switch (state) {
    case 'unreadable_store':
      return 'Local monitor store exists but could not be opened.'
    case 'internal_error':
      return 'Setup check failed. Retry after installing the plugin.'
    default:
      return undefined
  }
}

/**
 * Menubar popover page. Owns view state, fetches data, switches between
 * dual-line and heatmap views. When the monitor store is not ready it shows
 * the compact MenubarOnboard instead of an empty activity chart. Lives at
 * /menubar — outside the main-window setup gate.
 */
export function MenubarPage() {
  const { data, isLoading } = useSetupStatus()

  // While the readiness check is in flight, render nothing — the popover is
  // transient and a flash of empty space is preferable to a flash of the
  // wrong surface.
  if (isLoading || !data) {
    return null
  }
  if (data.state !== 'ready') {
    return <MenubarOnboard statusLine={menubarStatusLine(data.state)} />
  }
  return <MenubarActivity />
}
```

- [ ] **Step 2: Remove the menubar spike route + wrapper**

Edit `packages/ui/src/app.tsx`. Delete the `MenubarOnboardSpike` function and its route `<Route path="/explore/menubar-onboard-spike" element={<MenubarOnboardSpike />} />`. Remove the now-unused `MenubarOnboard` import from `app.tsx` (it is imported by `menubar-page.tsx` now, not the app shell).

- [ ] **Step 3: Write the failing tests**

Create `packages/ui/src/tests/menubar/menubar-page.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { MenubarPage } from '@/components/menubar/menubar-page'
import { resetMock, setMockHandler } from '@/lib/transport/mock'
import { __setTransportForTests } from '@/lib/transport'

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MenubarPage />
    </QueryClientProvider>,
  )
}

describe('MenubarPage', () => {
  beforeEach(() => {
    __setTransportForTests('mock')
  })
  afterEach(() => {
    resetMock()
  })

  it('renders the compact onboarding state when the store is missing', async () => {
    setMockHandler('setup.status', async () => ({ state: 'missing_store' }))
    renderPage()
    expect(await screen.findByText('Monitor not connected')).toBeTruthy()
  })

  it('renders the unreadable-store status line', async () => {
    setMockHandler('setup.status', async () => ({ state: 'unreadable_store' }))
    renderPage()
    expect(
      await screen.findByText('Local monitor store exists but could not be opened.'),
    ).toBeTruthy()
  })

  it('renders the normal activity surface when ready', async () => {
    setMockHandler('setup.status', async () => ({ state: 'ready' }))
    renderPage()
    // The Activity title is part of the normal menubar header.
    expect(await screen.findByText('Activity')).toBeTruthy()
    expect(screen.queryByText('Monitor not connected')).toBeNull()
  })

  it('renders nothing while readiness is loading', () => {
    // Handler never resolves → query stays pending.
    setMockHandler('setup.status', async () => {
      await new Promise(() => {})
      return { state: 'ready' }
    })
    const { container } = renderPage()
    expect(screen.queryByText('Monitor not connected')).toBeNull()
    expect(screen.queryByText('Activity')).toBeNull()
    expect(container.querySelector('.menubar-popover')).toBeNull()
  })
})
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @ohmyc/ui test -- menubar-page`
Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/menubar/menubar-page.tsx packages/ui/src/app.tsx packages/ui/src/tests/menubar/menubar-page.test.tsx
git commit -m "feat(ui): gate the menubar popover on setup readiness"
```

---

## Self-Review

**1. Spec coverage:**
- Rust/Core setup probe (`crates/ohmyc-core/src/setup.rs`, `Ready`/`MissingStore`/`UnreadableStore`/`InternalError`, resolves path, checks existence + schema, never returns path) → **Task 1**.
- Tauri `setup_status` command registered in invoke handler, sanitized (no path) → **Task 2** + Task 1 test `serialized_status_never_contains_the_db_path`.
- Frontend hook `useSetupStatus` (`['setup','status']`, `request('setup.status', {})`, no `useTimelineStatus` dep, explicit retry) → **Task 3**.
- Atropos + LetterGlitch + retro computer visuals (already built in spike, reused) → referenced in File Structure "Reuse".
- `/onboard` route, hidden (not in NavigationIsland/palette), replace semantics, gate before normal routes, redirect back when ready, no shell on gate → **Task 5**.
- Copy (title/body/actions), `unreadable_store` + `internal_error` status lines, no DB path shown → **Task 4**.
- Reduced motion disables tilt + glitch; static computer remains → handled by existing `inactive`/`disabled` props reused in Task 4.
- Retry refetches only (no install/shell/config) → Task 3/4 (`refetch`).
- Store with zero sessions = Ready → Task 1 test `ready_when_store_has_schema_and_zero_sessions`.
- Tests: Rust (missing/ready/unreadable/no-path), frontend (ready renders shell, missing redirects to `/onboard` and renders gate without shell, unreadable line, ready `/onboard` redirect, `/menubar` unchanged, Retry refetch, repo link) → Tasks 1, 3, 4, 5. Reduced-motion behavior is wired through guarded `useSyncExternalStore` plus `inactive`/`disabled` props; an explicit DOM assertion is optional and omitted to keep the plan focused.
- DESIGN.md Decisions Log → Task 6.
- Menubar popover shows a compact onboarding state when not ready (spec lines 126-132), "Open OhMyC" opens the main window which runs the full gate → **Task 7**.

**Gaps:** None for the main + menubar surfaces. The spec's optional "popover reuses the full OnboardingGate" path is deliberately not taken — the popover uses the shrunk mini-computer instead (validated in the menubar spike: full gate is too large for 360px).

**2. Placeholder scan:** No TBD/TODO/"add error handling" placeholders. Every code step contains full code. Test commands include expected output.

**3. Type consistency:** `SetupStatus` wire tag values (`ready`/`missing_store`/`unreadable_store`/`internal_error`) match across Rust (`#[serde(rename_all = "snake_case", tag = "state")]`), the TS type, the hook, and all tests. `useSetupStatus` returns the same type consumed by `OnboardingGate`. `probe`/`probe_path`/`setup_status` names are consistent across tasks. The `./onboard` export path is consistent (Task 6 repoints it to the gate).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-25-onboarding-setup-gate.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
