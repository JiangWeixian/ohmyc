# Tauri Desktop App Build Pipeline

**Date:** 2026-06-14  
**Status:** Approved

## Summary

Add a GitHub Actions workflow that builds the OhMyC desktop app (Tauri v2) for macOS and Windows, then publishes the artifacts to a GitHub Release. The workflow is triggered manually via `workflow_dispatch`.

## Context

- The project is a pnpm 10 monorepo with a Rust workspace
- The desktop app lives in `packages/desktop/` with Tauri v2 (2.11.2)
- Currently `bundle.targets` is hardcoded to `"dmg"` (macOS only)
- No code signing is configured; all prior design docs explicitly defer signing to later slices
- Existing CI includes `ci.yml` (Node tests), `ci-rust.yml` (Rust lint/test), `release.yml` (npm publish via Changesets), `snapshot-release.yml` (npm snapshots) — none of these build the desktop app

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Platforms | macOS + Windows | Core target platforms for the menu-bar app |
| Code signing | Unsigned | No certs available; defer to later iteration |
| Trigger | Manual `workflow_dispatch` | Early-stage project; flexible control over when builds happen |
| Artifacts | GitHub Releases | Direct download for users |
| Versioning | Manual edit of `tauri.conf.json` | Simple; no coupling to Changesets for now |
| Approach | `tauri-apps/tauri-action@v0` | Minimal code; official action handles multi-platform matrix and release creation |

## Changes

### 1. tauri.conf.json — bundle targets and icons

**Current:**
```json
"bundle": {
  "active": true,
  "targets": "dmg",
  "icon": ["icons/icon.png"],
  "macOS": { "minimumSystemVersion": "11.0" }
}
```

**After:**
```json
"bundle": {
  "active": true,
  "targets": "all",
  "icon": [
    "icons/32x32.png",
    "icons/128x128.png",
    "icons/128x128@2x.png",
    "icons/icon.icns",
    "icons/icon.ico"
  ],
  "macOS": { "minimumSystemVersion": "11.0" }
}
```

- `targets: "all"` makes Tauri build platform-appropriate defaults: DMG on macOS, NSIS on Windows
- The icon array includes all formats needed by both platforms
- Icons must be generated from a 1024x1024 source PNG via `pnpm --filter @ohmyc/desktop tauri icon <source-path>`

### 2. New workflow: `.github/workflows/build-desktop.yml`

```yaml
name: Build Desktop App

on:
  workflow_dispatch:
    inputs:
      tag:
        description: 'Release tag (e.g. v0.2.0)'
        required: true
        type: string

jobs:
  build:
    strategy:
      matrix:
        platform: [macos-14, windows-latest]
    runs-on: ${{ matrix.platform }}
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v5

      - uses: pnpm/action-setup@v4
        with:
          run_install: false

      - uses: actions/setup-node@v5
        with:
          node-version: 22

      - name: Get pnpm store directory
        shell: bash
        run: echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_ENV

      - uses: actions/cache@v4
        with:
          path: ${{ env.STORE_PATH }}
          key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: ${{ runner.os }}-pnpm-store-

      - run: pnpm install --frozen-lockfile=false

      - uses: dtolnay/rust-toolchain@stable

      - uses: Swatinem/rust-cache@v2
        with:
          workspaces: packages/desktop/src-tauri

      - name: Build workspace dependencies
        run: pnpm --filter @ohmyc/timeline build

      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: ${{ inputs.tag }}
          releaseName: 'OhMyC ${{ inputs.tag }}'
          releaseDraft: true
          prerelease: false
          projectPath: packages/desktop
          tauriScript: pnpm tauri
```

### Step-by-step build chain

1. `pnpm install` installs the full workspace (root → `packages/*`, `plugins/timeline`)
2. `pnpm --filter @ohmyc/timeline build` compiles the timeline plugin (a dependency of the desktop frontend)
3. `tauri-action` runs `tauriScript build` inside `projectPath` (`packages/desktop`)
4. Tauri CLI triggers `beforeBuildCommand: "pnpm build"` → `tsc && vite build` → frontend output to `packages/desktop/dist/`
5. Tauri bundles the frontend with the compiled Rust binary → DMG (macOS) or NSIS installer (Windows)
6. tauri-action uploads the artifact to the GitHub Release identified by `tagName`

### Platform-specific behavior

| Platform | Runner | Bundle format | Output filename |
|---|---|---|---|
| macOS | `macos-14` (Apple Silicon) | DMG | `OhMyC_<version>_aarch64.dmg` |
| Windows | `windows-latest` (x64) | NSIS | `OhMyC_<version>_x64-setup.exe` |

### Release lifecycle

1. User triggers workflow with a tag (e.g. `v0.2.0`)
2. Both platform jobs run in parallel
3. First job to finish creates a **draft** GitHub Release with that tag
4. Second job uploads its artifact to the same Release
5. User reviews the draft Release, then publishes it when ready

## Known Limitations (unsigned builds)

- **macOS:** Users must run `xattr -cr /Applications/OhMyC.app` to bypass Gatekeeper quarantine
- **Windows:** SmartScreen will show "unrecognized app" warning; users click "Run anyway"
- These limitations are acceptable for the current stage; code signing is deferred to a future iteration

## Out of Scope

- Code signing (Apple Developer ID + notarization, Windows code signing certificate)
- Auto-update mechanism (Tauri updater plugin)
- Linux builds (AppImage/deb)
- Integration with Changesets versioning
- Universal macOS binary (aarch64 + x86_64 in one DMG)
