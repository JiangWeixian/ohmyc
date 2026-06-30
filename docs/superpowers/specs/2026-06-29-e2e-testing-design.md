# E2E Testing Design

**Date:** 2026-06-29
**Status:** Approved
**Branch:** `hotfix/geek-design`

## Context

OhMyC has three test layers today: vitest unit tests (jsdom), Storybook
component browser tests (Playwright via `@vitest/browser`), and Rust unit tests
(`cargo test`). There is **no E2E layer** that exercises full user journeys in
a real browser.

The app is a Tauri desktop app with a dual-window architecture (main window +
tray popover). Tauri native window behaviors (tray clicks, popover positioning,
focus-loss hide) are not browser-testable. However, the transport abstraction
layer (`VITE_TRANSPORT`) already supports a mock mode that simulates all Tauri
backend commands, making the **entire React app** testable in a standard browser
via Playwright.

## Decision

Add a standalone Playwright E2E suite inside `packages/ui` that runs the full
React app against a Vite dev server with `VITE_TRANSPORT=mock`. Cover all
user-facing flows: onboarding gate transitions, tab navigation, command palette,
keyboard shortcuts, theme switching, menubar popover, and empty/error states.

Native Tauri window behaviors are **out of scope** — they are covered by Rust
unit tests and cannot be automated via browser E2E.

## Architecture

### Problem: Tauri API dependency

The desktop entry point (`packages/desktop/src/main.tsx`) calls
`getCurrentWebviewWindow().label` from `@tauri-apps/api` to branch between main
window and popover rendering. This API does not exist in a standard browser.

### Solution: Mock bootstrap with two entry points

Create a dedicated E2E harness in `packages/ui/e2e/` with its own Vite config
that aliases `@tauri-apps/api/*` to stubs, identical to the existing vitest
stub strategy.

```
packages/ui/e2e/
├── vite.config.ts           ← VITE_TRANSPORT=mock + Tauri API 别名
├── index.html               ← 主窗口入口
├── menubar.html             ← popover 入口
├── bootstrap.tsx            ← 主窗口：BrowserRouter + QueryClient + <App />
├── menubar-bootstrap.tsx    ← popover：固定 367×340 容器 + <MenubarPage />
├── stubs/
│   └── tauri-api.ts         ← mock invoke/listen/getCurrentWebviewWindow
├── mock-handlers.ts         ← 预设场景 handler 集合
├── test-utils.ts            ← Playwright fixture: mockPage, gotoWithMocks
├── fixtures/                ← E2E 专属 timeline 数据（扩展年份范围）
├── onboarding.spec.ts
├── navigation.spec.ts
├── command-palette.spec.ts
├── keyboard-shortcuts.spec.ts
├── theme.spec.ts
├── menubar.spec.ts
└── empty-states.spec.ts
```

**Main window bootstrap** (`bootstrap.tsx`) replicates `desktop/main.tsx`'s
`label === 'main'` branch:
- `<BrowserRouter>` + `<QueryClientProvider>` + `<App />`
- Seeds initial route to `/explore/timeline`
- `VITE_TRANSPORT=mock` activates mock transport

**Popover bootstrap** (`menubar-bootstrap.tsx`) replicates the popover branch:
- Transparent body, `overflow:hidden`, `100vh`
- Fixed 367×340 container (matches real popover window dimensions)
- Renders `<MenubarPage />` directly (bypasses `<App />` setup gate — popover
  has its own internal gate via `useSetupStatus`)

**Tauri API stub** (`stubs/tauri-api.ts`):
- `invoke(cmd, args)` — records call into a list for assertions; forwards to
  mock transport for registered handlers
- `getCurrentWebviewWindow()` — returns `{ label: 'main' }` or `'popover'`
  depending on entry point
- `listen(event, cb)` — no-op, returns an unsubscribe function

**Playwright config** (`packages/ui/playwright.config.ts`):
- `webServer` runs the E2E Vite dev server
- Main window tests: `page.goto('/')`
- Popover tests: `page.goto('/menubar.html')`

## Mock Data Layer

### Handler presets

`mock-handlers.ts` exports named scenario functions that register mock
transport handlers via `setMockHandler()`:

| Preset | `setup.status` | Entity data |
|--------|----------------|-------------|
| `readyHandlers()` | `{ state: 'ready' }` | Full fixture data |
| `missingStoreHandlers()` | `{ state: 'missing_store' }` | N/A |
| `emptyHandlers()` | `{ state: 'ready' }` | All lists empty |
| `errorHandlers()` | `{ state: 'internal_error' }` | N/A |

Each preset registers handlers for: `setup.status`, `timeline.years`,
`timeline.projects`, `timeline.heatmap`, `timeline.events`, `agents.list`,
`agents.get`, `skills.list`, `skills.get`, `commands.list`, `commands.get`,
`plugins.list`, `marketplaces.list`.

### Playwright fixture

`test-utils.ts` exports a custom Playwright fixture `mockPage`:

- `await mockPage.gotoWithMocks(url, handlers)` — uses
  `page.addInitScript()` to inject handler registration before the page
  loads, ensuring transport calls resolve from first render
- `await mockPage.invokeCalls(cmd)` — returns recorded `invoke()` calls for
  asserting direct Tauri commands (e.g., "Open OhMyC" button)

### Data reuse

Entity fixtures (agents, skills, commands, plugins) are imported directly from
`src/stories/fixtures/`. Timeline data for E2E extends to a full year range in
`e2e/fixtures/` since the main window timeline view spans wider ranges than the
menubar's 16-week window.

## Test Flow Batches

### Batch 1 — Core smoke (onboarding + navigation)

**`onboarding.spec.ts`**
- `missing_store` → OnboardingGate renders → click retry → `ready` → auto
  redirect to `/explore/timeline`
- `unreadable_store` → corresponding error UI
- `internal_error` → corresponding error UI

**`navigation.spec.ts`**
- Default landing at `/explore/timeline`
- Click NavigationIsland to switch to monitor/agents/skills/commands/plugins
- URL updates correctly for each route
- Content area renders the expected page component

### Batch 2 — Command palette, keyboard shortcuts, theme

**`command-palette.spec.ts`**
- `⌘K` opens palette → type to filter → select navigation item → route changes
- `Escape` closes palette

**`keyboard-shortcuts.spec.ts`**
- `g` then `m/t/a/s/c/p` switches through six tabs
- Typing in an input field does not trigger navigation shortcuts

**`theme.spec.ts`**
- Open ⌘K → select "Amber CRT" → `data-theme` attribute on `<html>` changes to
  `amber`
- `localStorage` persists the theme
- Page reload preserves the theme
- Switch intensity (calm/expressive) — `data-intensity` attribute updates
- All 5 themes (monitor/phosphor/amber/retro/cyberpunk) and 2 intensities
  covered

### Batch 3 — Menubar popover

**`menubar.spec.ts`**
- `page.goto('/menubar.html')` with ready state → activity view renders
- Line/heatmap view switch toggles chart display
- "Open OhMyC" button triggers `invoke('open_main_window')` — assert via
  `mockPage.invokeCalls()`
- `missing_store` state → MenubarOnboard renders (regression guard for the
  duplicate-monitor-image bug fixed in `1de9392`)

### Batch 4 — Boundary states

**`empty-states.spec.ts`**
- Ready state with no data → agents/skills/commands lists show empty state
- Timeline shows no activity
- Menubar shows NoActivity state

### Implementation order

Batch 1 → 2 → 3 → 4. Each batch is an independently committable unit.

## CI Integration

Add a single step to the existing `test` job (Ubuntu) in
`.github/workflows/ci.yml`, after the Storybook test step:

```yaml
      - name: Test E2E
        run: pnpm --filter @ohmyc/ui exec playwright test
```

No additional Playwright browser installation needed — CI already runs
`playwright install --with-deps chromium` for the Storybook step. E2E reuses
the same browser binary.

### package.json

```json
"test:e2e": "playwright test"
```

### Local development

- `pnpm --filter @ohmyc/ui test:e2e` — headless, all specs
- `pnpm --filter @ohmyc/ui exec playwright test --ui` — interactive debugger
- `pnpm --filter @ohmyc/ui exec playwright test --headed` — headed mode

### Trace artifacts

Failed tests auto-generate `test-results/` (Playwright default). Already covered
by `.gitignore`.

## Out of Scope

- **Tauri native window behaviors** — tray click toggle, popover positioning,
  focus-loss auto-hide, vibrancy blur. These are OS-level interactions
  untestable via browser automation. Rust unit tests cover the logic
  (positioning math, click classification, popover state machine).
- **Real Rust backend** — `invoke` round-trips against actual Tauri commands,
  `fs:changed` event-driven UI updates. These require the full Tauri binary
  running, which is macOS-only and not feasible in CI.
- **`tauri-driver` / WebDriverIO** — considered and rejected. Limited to
  webview content inspection, cannot simulate tray/popover OS events, and
  macOS-only in CI.
