# Rust Coverage for ohmyc-core Design

## Goal

Surface code coverage for `crates/ohmyc-core` (the pure-Rust domain logic crate) in CI
after tests run, and give developers a memorable local command to generate the same
coverage. Coverage is for visibility only — it never blocks a PR.

## Current State

- Workspace (`Cargo.toml`) has two members: `crates/ohmyc-core` and
  `packages/desktop/src-tauri`.
- `.github/workflows/ci-rust.yml` runs on Ubuntu: installs libgtk/libwebkit system deps,
  `dtolnay/rust-toolchain@stable` with `components: rustfmt, clippy`, then
  `cargo fmt --check`, `cargo clippy -- -D warnings`, and `cargo test --all`.
- `.github/workflows/ci.yml` has a `desktop-test` job (macOS) that runs Tauri tests, and
  Node `test` jobs that report per-package coverage via
  `davelosert/vitest-coverage-report-action@v2` (posts PR comments).
- Test density: `ohmyc-core` has ~153 `#[test]`/`#[rstest]` functions across domain
  modules (plugins, timeline, agents, store, etc.). `src-tauri` has ~26, mostly platform
  glue (popover/tray/windows).
- No `.cargo/config.toml` exists.

## Scope

In scope:
- `crates/ohmyc-core` only.
- CI artifact + run-summary output.
- A `cargo` alias for local use.

Out of scope:
- `packages/desktop/src-tauri` coverage (desktop shell glue; low value, and Tauri needs
  GUI system deps).
- Inline PR coverage comments.
- Coverage thresholds / PR gating.
- Coverage trend tracking over time.

## Decisions

1. **Cover `ohmyc-core` only.** It holds the dense, pure-Rust domain logic where
   coverage is meaningful. `src-tauri` tests are platform glue; instrumenting the Tauri
   app adds CI cost without insight.

2. **Tool: `cargo-llvm-cov`.** LLVM source-based instrumentation — precise, cross-platform
   (works on the existing Ubuntu runner and locally on macOS), and faster than tarpaulin.
   Installed in CI via `taiki-e/install-action@cargo-llvm-cov` (prebuilt binary).

3. **Keep `cargo test --all`; add a separate coverage step.** `cargo llvm-cov` is itself a
   test runner (it instruments + runs tests), but it only targets `ohmyc-core`. We still
   need the whole workspace (including `src-tauri`) tested, so `cargo test --all` stays as
   the workspace regression guard. `ohmyc-core` tests run twice; the second run is cheap
   because Rust incremental caching avoids a full rebuild — only re-instrumentation.

4. **Output: artifact + GitHub Step Summary, no external service.** The repo is private.
   - Upload `lcov.info` and the HTML report directory as a GitHub artifact (downloadable,
     browsable locally).
   - Append the coverage summary table to `$GITHUB_STEP_SUMMARY` so it renders on the
     Actions run page.
   - No inline PR comment. See "Rejected alternatives" for why.

5. **No threshold gate.** Coverage is informational. We will not add `--fail-under-*`
   flags or block PRs on coverage numbers.

6. **Local aliases via `.cargo/config.toml`.** Native cargo aliases (zero dependencies)
   for the `llvm-cov` subcommand. Note: `cargo-llvm-cov` does not allow `--lcov` together
   with `--html`/`--open` in a single invocation, and a cargo alias maps to exactly one
   subcommand invocation (no shell chaining). So we provide two single-purpose aliases:
   one that writes the lcov file, one that opens the HTML report. Cross-toolchain
   orchestration is not needed, so no `just`/Makefile.

## Rejected Alternatives

- **Codecov (`codecov/codecov-action`).** Officially recommended by `cargo-llvm-cov` and
  gives PR comments + trends + badges. Rejected for now because the repo is private and
  Codecov requires account setup + a `CODECOV_TOKEN` secret (and a suitable plan for
  private repos). Can be revisited if/when the repo goes public or PR comments become a
  priority.
- **`romeovs/lcov-reporter-action`.** Posts a file-level coverage table as a PR comment
  with no external service. Rejected because the repo is flagged
  "This project is not actively maintained" (last release v0.4.0, 2024-05). Long-term risk.
- **Reuse `davelosert/vitest-coverage-report-action`.** Not viable: it parses vitest's
  istanbul-format `coverage-summary.json` / `coverage-final.json` (required input), not
  lcov or llvm-cov JSON. There is no off-the-shelf converter from Rust coverage to the
  istanbul JSON schema.

## Changes

### 1. New file: `.cargo/config.toml`

Native cargo aliases. Only `llvm-cov` (a cargo subcommand once `cargo-llvm-cov` is
installed) is used, so aliases are sufficient. `--lcov` cannot combine with `--html`/`--open`
in one invocation, so the two outputs get separate aliases.

```toml
[alias]
coverage = "llvm-cov -p ohmyc-core --lcov --output-path lcov.info"
cov = "llvm-cov -p ohmyc-core --open"
```

- `cargo coverage` → runs `ohmyc-core` tests with instrumentation and writes `lcov.info`
  at the repo root (machine-readable, for tooling / VS Code Coverage Gutters).
- `cargo cov` → generates the HTML report under `target/llvm-cov/html` and opens it in a
  browser (for browsing uncovered lines interactively).

Requires a one-time local install: `cargo install cargo-llvm-cov` (or
`brew install cargo-llvm-cov`).

### 2. Modify `.github/workflows/ci-rust.yml`

Add coverage steps to the existing `rust-check` job, after `cargo test --all`. No new job,
no permission changes (artifact upload + step summary need only the default `contents: read`).

Additions:
- Append `llvm-tools` to the `dtolnay/rust-toolchain` `components` list (currently
  `rustfmt, clippy`).
- New step installing `cargo-llvm-cov` via `taiki-e/install-action@cargo-llvm-cov`.
- New step running coverage and writing lcov:
  `cargo llvm-cov -p ohmyc-core --lcov --output-path lcov.info`. (This is the only step
  that runs tests; it writes lcov and leaves the profdata in place. Note: a single
  invocation cannot emit both lcov and HTML, so HTML is produced separately below.)
- New step appending a coverage summary table to the Actions run page:
  `cargo llvm-cov report -p ohmyc-core >> $GITHUB_STEP_SUMMARY`. The `report` subcommand
  reuses the profdata from the previous step (no test re-run) and prints a clean per-file
  summary + TOTAL row to stdout.
- New step generating the browsable HTML report without re-running tests:
  `cargo llvm-cov report -p ohmyc-core --html --output-dir cov-html`. The index lands at
  `cov-html/html/index.html` (the tool nests an `html/` subdir under `--output-dir`).
- New step `actions/upload-artifact@v4` uploading `lcov.info` and the `cov-html/html/`
  directory (artifact name `ohmyc-core-coverage`).

The coverage steps use default `if` (run only if `cargo test --all` succeeded). We do not
force coverage on failing test runs — simpler and avoids needing `--ignore-run-fail`.

Existing `cargo fmt --check`, `cargo clippy`, and `cargo test --all` steps are unchanged.

## Verification

Verified baseline locally (2026-06-16, `cargo-llvm-cov` 0.8.7): `ohmyc-core` has **153
tests, all passing**, with **94.50% line coverage / 92.03% region coverage**. The exact
commands in this spec were run end-to-end and produce: a `lcov.info` file, a summary table
from `cargo llvm-cov report`, and an HTML report at `cov-html/html/index.html`.

Post-implementation checks:
- **Local:** run `cargo coverage`; confirm `lcov.info` appears at repo root. Run `cargo cov`;
  confirm HTML opens and percentages match the baseline (~94.5% lines).
- **CI:** on the next push/PR, confirm the `rust-check` job:
  1. installs `cargo-llvm-cov` cleanly,
  2. shows a coverage summary table on the Actions run summary page,
  3. uploads an artifact containing `lcov.info` + `cov-html/html/index.html`.
- Spot-check that `src-tauri` is not included in the report (only `crates/ohmyc-core`
  files appear).

## Future Work (not in this change)

- Add `src-tauri` coverage if desktop-side logic grows meaningful unit tests.
- Move to Codecov (PR comments + trend) if the repo becomes public or PR-comment value
  justifies token setup.
- Add `#[lints.rust] unexpected_cfgs` check-cfg for `coverage`/`coverage_nightly` if we
  start using `cfg(coverage)` attributes. Not needed yet since we use no `cfg(coverage)`.
