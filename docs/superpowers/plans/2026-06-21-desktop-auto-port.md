# Desktop Auto Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `pnpm desktop` automatically select an available desktop dev-server port when the default `1420` is occupied.

**Architecture:** Add a small Node wrapper in `packages/desktop/scripts/dev.mjs`. The wrapper finds an available port, then starts `tauri dev` with a temporary config override so Tauri `build.devUrl` and the Vite `beforeDevCommand` use the same selected port.

**Tech Stack:** Node.js `net` and `child_process`, pnpm scripts, Tauri CLI `--config`, Vite CLI flags.

---

## File Structure

- Create `packages/desktop/scripts/dev.mjs`
  - Finds an available port, honors `OHMYC_DESKTOP_PORT`, and spawns `pnpm tauri dev --config ...`.
- Modify `packages/desktop/package.json`
  - Add `dev:tauri` for the wrapper while keeping existing `dev`, `tauri:dev`, and `tauri:build` scripts.
- Modify `package.json`
  - Point root `pnpm desktop` at the wrapper.

## Task 1: Add The Auto-Port Wrapper

**Files:**
- Create: `packages/desktop/scripts/dev.mjs`

- [ ] **Step 1: Create a port probe helper**

Use `node:net` to attempt a listen on `127.0.0.1`. Treat `EADDRINUSE` and `EACCES` as unavailable.

- [ ] **Step 2: Create port selection**

Start at `Number(process.env.OHMYC_DESKTOP_PORT ?? 1420)`. If `OHMYC_DESKTOP_PORT` is set, try only that port and fail with a clear message if it is busy. Otherwise scan 20 ports upward.

- [ ] **Step 3: Spawn Tauri with synchronized config**

Run:

```bash
pnpm tauri dev --config '{"build":{"devUrl":"http://127.0.0.1:<port>","beforeDevCommand":"pnpm exec vite --host 127.0.0.1 --port <port> --strictPort"}}'
```

Forward any wrapper arguments after the config.

## Task 2: Wire Scripts

**Files:**
- Modify: `packages/desktop/package.json`
- Modify: `package.json`

- [ ] **Step 1: Add `dev:tauri`**

Add:

```json
"dev:tauri": "node scripts/dev.mjs"
```

- [ ] **Step 2: Update root `desktop`**

Change the root script to:

```json
"desktop": "pnpm --filter @ohmyc/timeline build && pnpm --filter @ohmyc/desktop dev:tauri"
```

## Task 3: Verify

**Files:**
- Test by command only.

- [ ] **Step 1: Run desktop build**

Run:

```bash
pnpm --filter @ohmyc/desktop build
```

Expected: TypeScript and Vite build pass.

- [ ] **Step 2: Test occupied default port**

Start a temporary listener on `127.0.0.1:1420`, then run:

```bash
pnpm desktop
```

Expected: wrapper prints it selected `1421` and Tauri starts without the Vite `Port 1420 is already in use` error.

- [ ] **Step 3: Commit**

```bash
git add package.json packages/desktop/package.json packages/desktop/scripts/dev.mjs docs/superpowers/plans/2026-06-21-desktop-auto-port.md
git commit -m "fix(dev): auto-select desktop dev port"
```
