# Tauri Desktop App Build Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GitHub Actions workflow that builds the OhMyC Tauri desktop app for macOS and Windows, publishing unsigned artifacts to a GitHub Release.

**Architecture:** Use `tauri-apps/tauri-action@v0` with a platform matrix (macos-14 + windows-latest). The action runs inside the pnpm monorepo, building workspace dependencies first, then invoking `tauri build` which triggers the frontend build chain automatically. A manual `workflow_dispatch` trigger lets the operator specify the release tag.

**Tech Stack:** Tauri v2 (2.11.2), GitHub Actions, `tauri-apps/tauri-action@v0`, pnpm 10, Node 22, Rust stable

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `packages/desktop/src-tauri/icons/` | Add generated icons | Multi-format icons (.icns, .ico, various .png sizes) for macOS + Windows |
| `packages/desktop/src-tauri/tauri.conf.json` | Modify | Change `bundle.targets` from `"dmg"` to `"all"`, expand icon array |
| `.github/workflows/build-desktop.yml` | Create | Manual-trigger workflow that builds and publishes desktop artifacts |

---

## Task 1: Generate Multi-Platform Tauri Icons

The current icon set is only `icon.png`. Tauri v2 needs `.icns` (macOS), `.ico` (Windows), and various PNG sizes for proper bundling. The `tauri icon` command generates all formats from a single source PNG.

**Files:**
- Generate into: `packages/desktop/src-tauri/icons/`
- Source: `packages/desktop/src-tauri/icons/icon.png` (existing 4015-byte PNG)

- [ ] **Step 1: Verify the source icon exists**

```bash
ls -la packages/desktop/src-tauri/icons/icon.png
```

Expected: File exists, ~4KB.

- [ ] **Step 2: Generate full icon set**

```bash
pnpm --filter @ohmyc/desktop tauri icon src-tauri/icons/icon.png
```

This runs `@tauri-apps/cli`'s `icon` command from within `packages/desktop/`, generating into `src-tauri/icons/`. Expected output includes:
- `32x32.png`
- `128x128.png`
- `128x128@2x.png`
- `icon.icns`
- `icon.ico`
- Various `Square*Logo.png` files (Windows Store — harmless extras)

- [ ] **Step 3: Verify generated icons exist**

```bash
ls packages/desktop/src-tauri/icons/icon.icns packages/desktop/src-tauri/icons/icon.ico packages/desktop/src-tauri/icons/128x128.png
```

Expected: All three files listed without error.

- [ ] **Step 4: Commit generated icons**

```bash
git add packages/desktop/src-tauri/icons/
git commit -m "chore: generate multi-platform Tauri icons (icns, ico, png sizes)"
```

---

## Task 2: Update tauri.conf.json for Multi-Platform Bundling

Change `bundle.targets` from macOS-only (`"dmg"`) to `"all"` so each platform builds its native format. Expand the icon array to reference the generated multi-format icons.

**Files:**
- Modify: `packages/desktop/src-tauri/tauri.conf.json:33-40` (the `bundle` section)

- [ ] **Step 1: Update the bundle section**

Replace the entire `bundle` block:

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
    "macOS": {
        "minimumSystemVersion": "11.0"
    }
}
```

Changes:
- `"targets": "dmg"` → `"targets": "all"` — builds platform-appropriate defaults (DMG on macOS, NSIS on Windows)
- `"icon": ["icons/icon.png"]` → expanded array with all five required formats

- [ ] **Step 2: Verify JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('packages/desktop/src-tauri/tauri.conf.json', 'utf8')); console.log('valid JSON')"
```

Expected output: `valid JSON`

- [ ] **Step 3: Verify local Tauri build config parses**

```bash
pnpm --filter @ohmyc/desktop tauri info
```

Expected: Prints app info without config errors. If `tauri info` is unavailable in this version, skip to Step 4.

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/src-tauri/tauri.conf.json
git commit -m "feat: enable multi-platform Tauri bundling (macOS DMG + Windows NSIS)"
```

---

## Task 3: Create the Build Desktop Workflow

Create a new GitHub Actions workflow triggered manually that builds the desktop app on macOS and Windows, then publishes artifacts to a draft GitHub Release.

**Files:**
- Create: `.github/workflows/build-desktop.yml`

- [ ] **Step 1: Write the workflow file**

Create `.github/workflows/build-desktop.yml` with this exact content:

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

Design notes for each section:

- **Trigger:** `workflow_dispatch` with a required `tag` input (e.g., `v0.2.0`). Operator must set the version in `tauri.conf.json` before triggering.
- **Matrix:** `macos-14` (Apple Silicon) + `windows-latest` (x64). Both run in parallel.
- **Permissions:** `contents: write` is required for `GITHUB_TOKEN` to create the GitHub Release.
- **pnpm setup:** `pnpm/action-setup@v4` before `setup-node@v5` — same ordering as `ci.yml`.
- **shell: bash** on the store path step — required for Windows (Git Bash), harmless on macOS.
- **Rust cache:** Keyed to `packages/desktop/src-tauri` workspace, same as the `desktop-test` job in `ci.yml`.
- **Workspace deps:** `pnpm --filter @ohmyc/timeline build` must run before `tauri-action` because the desktop frontend imports `@ohmyc/timeline` and `@ohmyc/ui`.
- **tauri-action:** `projectPath: packages/desktop` tells the action where the Tauri project lives. `tauriScript: pnpm tauri` overrides the default npm-based invocation. `releaseDraft: true` creates a draft release so the operator can review before publishing.

- [ ] **Step 2: Verify YAML syntax**

```bash
node -e "const yaml = require('js-yaml'); const fs = require('fs'); yaml.load(fs.readFileSync('.github/workflows/build-desktop.yml', 'utf8')); console.log('valid YAML')"
```

If `js-yaml` is not installed:

```bash
npx -y js-yaml .github/workflows/build-desktop.yml > /dev/null && echo "valid YAML"
```

Expected output: `valid YAML`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/build-desktop.yml
git commit -m "ci: add Tauri desktop build workflow for macOS + Windows"
```

---

## Task 4: Push and Verify

- [ ] **Step 1: Push the branch**

```bash
git push origin HEAD
```

- [ ] **Step 2: Trigger the workflow manually**

On GitHub, navigate to Actions → "Build Desktop App" → "Run workflow". Enter a tag like `v0.1.0-desktop-test`. Click "Run workflow".

- [ ] **Step 3: Monitor both platform jobs**

Both `macos-14` and `windows-latest` jobs should start in parallel. Check for:
- pnpm install succeeds (workspace deps resolve)
- `@ohmyc/timeline` build succeeds
- Rust compilation succeeds (first run will be slow — no cache hit)
- `tauri build` completes and produces DMG / NSIS
- tauri-action creates a draft Release and uploads artifacts

- [ ] **Step 4: Verify the draft Release**

Navigate to the Releases page on GitHub. A draft release named `OhMyC v0.1.0-desktop-test` should exist with two assets:
- `OhMyC_0.1.0_aarch64.dmg` (macOS)
- `OhMyC_0.1.0_x64-setup.exe` (Windows)

---

## Known Limitations

These are documented in the spec and are NOT bugs:

- **Unsigned macOS DMG:** Users must run `xattr -cr /Applications/OhMyC.app` after dragging to Applications. Gatekeeper will block it by default.
- **Unsigned Windows EXE:** SmartScreen will show "Windows protected your PC". Users click "More info" → "Run anyway".
- **No auto-update:** The Tauri updater plugin is not configured. Users must manually download new releases.
- **No x86_64 macOS build:** Only Apple Silicon (`aarch64`) DMG is produced. Intel Mac users would need Rosetta or a separate `macos-13` runner.

## Future Enhancements (Out of Scope)

- Apple Developer ID signing + notarization (requires `APPLE_CERTIFICATE`, `APPLE_ID`, `APPLE_PASSWORD` secrets)
- Windows code signing (requires `WINDOWS_CERTIFICATE` / Azure Trusted Signing)
- Tauri auto-updater with signature-based update verification
- Integration with Changesets for automated version bumping of `tauri.conf.json`
- Linux builds (AppImage / deb)
