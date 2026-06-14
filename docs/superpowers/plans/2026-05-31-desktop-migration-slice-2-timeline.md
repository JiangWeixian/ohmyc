# Desktop Migration — Slice 2: Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every timeline read in `packages/ui/src/hooks/use-timeline.ts` off the TypeScript `/api/timeline/*` HTTP routes onto native Rust Tauri commands backed by `rusqlite`, plus add a debounced `notify`-based file watcher that emits `fs:changed` to the frontend so React Query re-fetches when the dashboard plugin writes new sessions.

**Architecture:** A new `timeline` module in `ohmyc-core` mirrors `packages/timeline/src/query.ts` line-for-line in behavior, reading the same SQLite DB (`$OHMYC_HOME/timeline.db`, default `~/.config/ohmyc/timeline.db`). Tauri commands in `packages/desktop/src-tauri/src/api/timeline.rs` are thin serializers around the core. The frontend `transport/fetch.ts` gains a per-wire URL table so the web dev loop keeps working through the migration. The frontend hook file moves every `queryFn` from raw `fetch()` to `request('timeline.<op>', args)`. A frozen SQLite fixture under `tests/fixtures/timeline-contract/` is read by both the TS query layer and the Rust core; both must produce byte-identical JSON.

**Tech Stack:** Rust (`rusqlite` bundled, `notify` 6, `chrono` for UTC date conversion, `tempfile` + `rstest` for tests), TypeScript (`@tauri-apps/api/event::listen` for the watcher subscription), Vitest + the in-memory `mockTransport`.

---

## File Structure

**New files:**
- `crates/ohmyc-core/src/timeline.rs` — DB open, default path, the 6 query functions (`heatmap`, `events`, `session`, `projects`, `years`, `status`), plus type definitions.
- `crates/ohmyc-core/src/watcher.rs` — notify-based debounced watcher emitting `FsEvent { kind, path }`.
- `crates/ohmyc-core/tests/timeline_contract.rs` — Rust side of the contract test against the frozen fixture.
- `tests/fixtures/timeline-contract/seed.sql` — SQL to populate a deterministic SQLite DB.
- `tests/fixtures/timeline-contract/expected/heatmap-tokens.json` — expected JSON output for a known heatmap query.
- `tests/fixtures/timeline-contract/expected/events-page1.json` — expected events JSON.
- `tests/fixtures/timeline-contract/expected/years.json` — expected years JSON.
- `tests/fixtures/timeline-contract/expected/projects.json` — expected projects JSON.
- `tests/fixtures/timeline-contract/expected/status.json` — expected status JSON.
- `tests/fixtures/timeline-contract/README.md` — explains the fixture and how to regenerate.
- `packages/desktop/src-tauri/src/api/mod.rs` — `pub mod timeline;`.
- `packages/desktop/src-tauri/src/api/timeline.rs` — the 6 Tauri command wrappers.
- `packages/desktop/src-tauri/src/events.rs` — spawns the watcher and forwards `FsEvent` → Tauri event `fs:changed`.
- `packages/timeline/tests/contract.test.ts` — TS side of the contract test.

**Modified files:**
- `crates/ohmyc-core/Cargo.toml` — add `rusqlite`, `notify`, `chrono`, `serde_yaml`.
- `crates/ohmyc-core/src/lib.rs` — export `pub mod timeline; pub mod watcher;`.
- `packages/desktop/src-tauri/Cargo.toml` — already has `ohmyc-core`; nothing to add.
- `packages/desktop/src-tauri/src/lib.rs` — add `pub mod api; pub mod events;`.
- `packages/desktop/src-tauri/src/main.rs` — register the 6 timeline commands in `invoke_handler!`; call `events::spawn_watcher` from `setup`.
- `packages/ui/src/lib/transport/fetch.ts` — replace the naive `.replace` with a `wireRoutes` table that has entries for the 6 timeline wires; everything else still falls back to the naive default.
- `packages/ui/src/lib/transport/mock.ts` — no code change; tests will call `setMockHandler('timeline.heatmap', ...)`.
- `packages/ui/src/hooks/use-timeline.ts` — every `queryFn` switches from `fetch()` to `request('timeline.<op>', args)`. Drop the `fetchJson` helper. Drop `isoDateToUtcMs` (Rust accepts ms; keep the JS conversion).
- `packages/ui/src/hooks/use-timeline.test.tsx` — replace `msw` (if used) or the existing fetch mocks with `setMockHandler` + assertions.
- `packages/ui/src/hooks/use-fs-changed.ts` (NEW) — a small hook that wraps `listen('fs:changed', ...)` and invalidates timeline React Query keys; no-ops on the web transport.
- `packages/ui/src/components/menubar/menubar-page.tsx` — call `useFsChanged()` once so the popover refreshes after writes.

---

## Task 1: Add Rust dependencies for SQLite, watcher, and date handling

**Files:**
- Modify: `crates/ohmyc-core/Cargo.toml`

- [ ] **Step 1: Add the deps**

Open `crates/ohmyc-core/Cargo.toml` and replace the `[dependencies]` and `[dev-dependencies]` sections with:

```toml
[dependencies]
serde = { workspace = true }
serde_json = { workspace = true }
thiserror = { workspace = true }
dirs = { workspace = true }
rusqlite = { version = "0.32", features = ["bundled"] }
notify = "6"
notify-debouncer-mini = "0.4"
chrono = { version = "0.4", default-features = false, features = ["clock", "serde"] }

[dev-dependencies]
tempfile = { workspace = true }
rstest = { workspace = true }
```

- [ ] **Step 2: Verify the crate still compiles**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo build -p ohmyc-core 2>&1 | tail -5`
Expected: `Finished` — first build will download crates (1-2 minutes).

- [ ] **Step 3: Commit**

```bash
git add crates/ohmyc-core/Cargo.toml
git commit -m "chore(core): add rusqlite, notify, chrono for timeline + watcher"
```

---

## Task 2: Define timeline types and module skeleton

**Files:**
- Create: `crates/ohmyc-core/src/timeline.rs`
- Modify: `crates/ohmyc-core/src/lib.rs`

- [ ] **Step 1: Create the timeline module**

Create `crates/ohmyc-core/src/timeline.rs`:

```rust
//! Timeline read layer — mirrors packages/timeline/src/query.ts behavior
//! exactly. Reads SQLite at `$OHMYC_HOME/timeline.db` (default
//! `~/.config/ohmyc/timeline.db`) via rusqlite. All date math is UTC.

use std::path::PathBuf;

use serde::Serialize;

use crate::error::ApiError;

const ENV_HOME: &str = "OHMYC_HOME";
const DB_FILENAME: &str = "timeline.db";

/// Returns the SQLite path used by the dashboard plugin and read by this crate.
///
/// Lookup order, matching `packages/timeline/src/db.ts::getDefaultDbPath`:
/// 1. `$OHMYC_HOME/timeline.db` if `OHMYC_HOME` is set and non-empty
/// 2. `$HOME/.config/ohmyc/timeline.db`
pub fn default_db_path() -> Result<PathBuf, ApiError> {
    if let Ok(home) = std::env::var(ENV_HOME) {
        if !home.is_empty() {
            return Ok(PathBuf::from(home).join(DB_FILENAME));
        }
    }
    let user_home = dirs::home_dir()
        .ok_or_else(|| ApiError::Internal("could not determine home dir".to_string()))?;
    Ok(user_home.join(".config").join("ohmyc").join(DB_FILENAME))
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct HeatmapPoint {
    pub date: String,
    pub value: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Metric {
    Sessions,
    Turns,
    Tokens,
}

impl Metric {
    pub fn parse(s: &str) -> Result<Self, ApiError> {
        match s {
            "sessions" => Ok(Self::Sessions),
            "turns" => Ok(Self::Turns),
            "tokens" => Ok(Self::Tokens),
            other => Err(ApiError::InvalidInput(format!(
                "metric must be one of sessions|turns|tokens, got '{other}'"
            ))),
        }
    }
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct SessionRow {
    pub session_id: String,
    pub project: String,
    pub agent_name: Option<String>,
    pub started_at: i64,
    pub ended_at: i64,
    pub duration_ms: i64,
    pub turns: i64,
    pub tokens_input: i64,
    pub tokens_output: i64,
    pub tokens_cached: i64,
    pub summary: Option<String>,
    pub summary_source: String,
    pub transcript_path: String,
    pub last_offset: i64,
    pub ingested_at: i64,
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct SessionTool {
    pub session_id: String,
    pub tool_name: String,
    pub call_count: i64,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct SessionSkill {
    pub session_id: String,
    pub skill_name: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct SessionDetail {
    #[serde(flatten)]
    pub session: SessionRow,
    pub tools: Vec<SessionTool>,
    pub skills: Vec<SessionSkill>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct ProjectGroup {
    pub project: String,
    pub sessions: Vec<SessionRow>,
    pub session_count: i64,
    pub turn_count: i64,
    pub token_count: i64,
    pub tool_count: i64,
    pub skill_count: i64,
    pub agents: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct DayEvents {
    pub day: String,
    pub project_groups: Vec<ProjectGroup>,
    pub session_count: i64,
    pub turn_count: i64,
    pub token_count: i64,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct EventsResult {
    pub days: Vec<DayEvents>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct TimelineStatus {
    pub session_count: i64,
    pub last_sync_at: Option<i64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn metric_parses_known_values() {
        assert_eq!(Metric::parse("sessions").unwrap(), Metric::Sessions);
        assert_eq!(Metric::parse("turns").unwrap(), Metric::Turns);
        assert_eq!(Metric::parse("tokens").unwrap(), Metric::Tokens);
    }

    #[test]
    fn metric_rejects_unknown_value() {
        let err = Metric::parse("bogus").unwrap_err();
        match err {
            ApiError::InvalidInput(msg) => assert!(msg.contains("bogus")),
            other => panic!("expected InvalidInput, got {other:?}"),
        }
    }

    #[test]
    fn default_db_path_honors_ohmyc_home_env() {
        let _lock = ENV_LOCK.lock().unwrap();
        let prev = std::env::var(ENV_HOME).ok();
        std::env::set_var(ENV_HOME, "/tmp/fake-ohmyc");
        let path = default_db_path().unwrap();
        assert_eq!(path, PathBuf::from("/tmp/fake-ohmyc/timeline.db"));
        match prev {
            Some(v) => std::env::set_var(ENV_HOME, v),
            None => std::env::remove_var(ENV_HOME),
        }
    }

    #[test]
    fn default_db_path_falls_back_to_config_dir() {
        let _lock = ENV_LOCK.lock().unwrap();
        let prev = std::env::var(ENV_HOME).ok();
        std::env::remove_var(ENV_HOME);
        let path = default_db_path().unwrap();
        assert!(path.ends_with(".config/ohmyc/timeline.db"));
        match prev {
            Some(v) => std::env::set_var(ENV_HOME, v),
            None => std::env::remove_var(ENV_HOME),
        }
    }

    use std::sync::Mutex;
    static ENV_LOCK: Mutex<()> = Mutex::new(());
}
```

- [ ] **Step 2: Export the module**

Open `crates/ohmyc-core/src/lib.rs`. Replace its contents with:

```rust
//! Domain logic for the OhMyC desktop app. Owns all `~/.claude` and
//! `$OHMYC_HOME` I/O, parsing, and watchers. No Tauri imports —
//! testable standalone.

pub mod claude_home;
pub mod error;
pub mod timeline;

pub use error::ApiError;
```

- [ ] **Step 3: Run the new tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib timeline 2>&1 | tail -10`
Expected: `test result: ok. 4 passed`.

- [ ] **Step 4: Commit**

```bash
git add crates/ohmyc-core/src/timeline.rs crates/ohmyc-core/src/lib.rs
git commit -m "feat(core): timeline module skeleton with types, Metric, default_db_path"
```

---

## Task 3: Add a SQLite test helper for the timeline tests

**Files:**
- Create: `crates/ohmyc-core/src/timeline/test_db.rs` (new submodule, test-only)
- Modify: `crates/ohmyc-core/src/timeline.rs` (add `#[cfg(test)] mod test_db;`)

This helper is shared by every TDD task in Tasks 4-7. Writing it once now avoids duplication.

- [ ] **Step 1: Create the helper**

Create the directory `crates/ohmyc-core/src/timeline/` and inside it create `test_db.rs`:

```rust
//! Test-only helpers — build a SQLite database in-memory and pre-seed
//! it with the schema and rows the timeline tests need.

use rusqlite::{params, Connection};

pub const SCHEMA_SQL: &str = "
CREATE TABLE sessions (
  session_id        TEXT PRIMARY KEY,
  project           TEXT NOT NULL,
  agent_name        TEXT,
  started_at        INTEGER NOT NULL,
  ended_at          INTEGER NOT NULL,
  duration_ms       INTEGER NOT NULL,
  turns             INTEGER NOT NULL,
  tokens_input      INTEGER NOT NULL DEFAULT 0,
  tokens_output     INTEGER NOT NULL DEFAULT 0,
  tokens_cached     INTEGER NOT NULL DEFAULT 0,
  summary           TEXT,
  summary_source    TEXT NOT NULL,
  transcript_path   TEXT NOT NULL,
  last_offset       INTEGER NOT NULL,
  ingested_at       INTEGER NOT NULL,
  model             TEXT
);
CREATE INDEX idx_sessions_started_at ON sessions(started_at DESC);
CREATE INDEX idx_sessions_project    ON sessions(project, started_at DESC);
CREATE TABLE session_tools (
  session_id  TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  tool_name   TEXT NOT NULL,
  call_count  INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (session_id, tool_name)
);
CREATE TABLE session_skills (
  session_id  TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  skill_name  TEXT NOT NULL,
  PRIMARY KEY (session_id, skill_name)
);
CREATE TABLE meta (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
";

/// Open an in-memory DB with the schema applied. Tests fill rows themselves.
pub fn empty_db() -> Connection {
    let conn = Connection::open_in_memory().expect("open in-memory db");
    conn.execute_batch(SCHEMA_SQL).expect("apply schema");
    conn
}

/// Insert one session row. Pass `0` for any field you don't care about.
#[allow(clippy::too_many_arguments)]
pub fn insert_session(
    conn: &Connection,
    session_id: &str,
    project: &str,
    started_at_ms: i64,
    turns: i64,
    tokens_input: i64,
    tokens_output: i64,
    tokens_cached: i64,
) {
    conn.execute(
        "INSERT INTO sessions (
            session_id, project, agent_name, started_at, ended_at, duration_ms,
            turns, tokens_input, tokens_output, tokens_cached,
            summary, summary_source, transcript_path, last_offset, ingested_at, model
        ) VALUES (?1, ?2, NULL, ?3, ?3, 0, ?4, ?5, ?6, ?7, NULL, 'auto', '/tmp/t.jsonl', 0, ?3, NULL)",
        params![session_id, project, started_at_ms, turns, tokens_input, tokens_output, tokens_cached],
    )
    .expect("insert session");
}

/// Insert a (session, tool, count) row.
pub fn insert_tool(conn: &Connection, session_id: &str, tool_name: &str, call_count: i64) {
    conn.execute(
        "INSERT INTO session_tools (session_id, tool_name, call_count) VALUES (?1, ?2, ?3)",
        params![session_id, tool_name, call_count],
    )
    .expect("insert tool");
}

/// Insert a (session, skill) row.
pub fn insert_skill(conn: &Connection, session_id: &str, skill_name: &str) {
    conn.execute(
        "INSERT INTO session_skills (session_id, skill_name) VALUES (?1, ?2)",
        params![session_id, skill_name],
    )
    .expect("insert skill");
}

/// Set a meta key/value pair (used for last_sync_at).
pub fn set_meta(conn: &Connection, key: &str, value: &str) {
    conn.execute(
        "INSERT OR REPLACE INTO meta (key, value) VALUES (?1, ?2)",
        params![key, value],
    )
    .expect("set meta");
}

/// Convert a `YYYY-MM-DD` date string to UTC midnight milliseconds.
/// Mirrors the JS `Date.UTC(...)` calls in `use-timeline.ts`.
pub fn date_ms(date: &str) -> i64 {
    let y: i32 = date[0..4].parse().expect("year");
    let m: u32 = date[5..7].parse().expect("month");
    let d: u32 = date[8..10].parse().expect("day");
    use chrono::{NaiveDate, NaiveDateTime, NaiveTime, TimeZone, Utc};
    let nd = NaiveDate::from_ymd_opt(y, m, d).expect("valid date");
    let ndt = NaiveDateTime::new(nd, NaiveTime::from_hms_opt(0, 0, 0).unwrap());
    Utc.from_utc_datetime(&ndt).timestamp_millis()
}
```

- [ ] **Step 2: Add the submodule declaration**

Open `crates/ohmyc-core/src/timeline.rs`. After the file-level doc comment (the `//!` lines at top) but before the first `use` statement, the file already has the existing `use` statements. Append immediately after the imports and before `const ENV_HOME`:

```rust
#[cfg(test)]
mod test_db;
```

Result: the top of the file should look like:

```rust
//! Timeline read layer — ...

use std::path::PathBuf;

use serde::Serialize;

use crate::error::ApiError;

#[cfg(test)]
mod test_db;

const ENV_HOME: &str = "OHMYC_HOME";
```

- [ ] **Step 3: Verify the helper compiles**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib timeline 2>&1 | tail -10`
Expected: tests still pass; no new errors.

- [ ] **Step 4: Commit**

```bash
git add crates/ohmyc-core/src/timeline.rs crates/ohmyc-core/src/timeline/test_db.rs
git commit -m "test(core): add timeline in-memory SQLite helpers"
```

---

## Task 4: Implement `timeline::heatmap` (TDD)

**Files:**
- Modify: `crates/ohmyc-core/src/timeline.rs`

- [ ] **Step 1: Add the failing tests**

Open `crates/ohmyc-core/src/timeline.rs`. At the bottom of the existing `#[cfg(test)] mod tests { ... }` block (before the closing `}`), add:

```rust
    use super::test_db::{date_ms, empty_db, insert_session};
    use rusqlite::Connection;

    fn seeded_three_days() -> Connection {
        let conn = empty_db();
        // 2026-01-01 — 2 sessions, 10 + 20 turns
        insert_session(&conn, "s1", "proj-a", date_ms("2026-01-01"), 10, 100, 50, 25);
        insert_session(&conn, "s2", "proj-b", date_ms("2026-01-01"), 20, 200, 100, 50);
        // 2026-01-02 — nothing
        // 2026-01-03 — 1 session, 5 turns
        insert_session(&conn, "s3", "proj-a", date_ms("2026-01-03"), 5, 30, 15, 5);
        conn
    }

    #[test]
    fn heatmap_sessions_metric_counts_sessions_per_day() {
        let conn = seeded_three_days();
        let result = heatmap(
            &conn,
            HeatmapQuery {
                from: "2026-01-01".into(),
                to: "2026-01-03".into(),
                metric: Metric::Sessions,
                project: None,
            },
        )
        .unwrap();
        assert_eq!(result.len(), 3);
        assert_eq!(result[0], HeatmapPoint { date: "2026-01-01".into(), value: 2 });
        assert_eq!(result[1], HeatmapPoint { date: "2026-01-02".into(), value: 0 });
        assert_eq!(result[2], HeatmapPoint { date: "2026-01-03".into(), value: 1 });
    }

    #[test]
    fn heatmap_turns_metric_sums_turns_per_day() {
        let conn = seeded_three_days();
        let result = heatmap(
            &conn,
            HeatmapQuery {
                from: "2026-01-01".into(),
                to: "2026-01-03".into(),
                metric: Metric::Turns,
                project: None,
            },
        )
        .unwrap();
        assert_eq!(result[0].value, 30); // 10 + 20
        assert_eq!(result[2].value, 5);
    }

    #[test]
    fn heatmap_tokens_metric_sums_input_output_cached() {
        let conn = seeded_three_days();
        let result = heatmap(
            &conn,
            HeatmapQuery {
                from: "2026-01-01".into(),
                to: "2026-01-03".into(),
                metric: Metric::Tokens,
                project: None,
            },
        )
        .unwrap();
        // Day 1: (100+50+25) + (200+100+50) = 525
        assert_eq!(result[0].value, 525);
        // Day 3: 30+15+5 = 50
        assert_eq!(result[2].value, 50);
    }

    #[test]
    fn heatmap_project_filter_limits_to_one_project() {
        let conn = seeded_three_days();
        let result = heatmap(
            &conn,
            HeatmapQuery {
                from: "2026-01-01".into(),
                to: "2026-01-03".into(),
                metric: Metric::Sessions,
                project: Some("proj-a".into()),
            },
        )
        .unwrap();
        assert_eq!(result[0].value, 1); // only s1 on day 1
        assert_eq!(result[2].value, 1); // s3 on day 3
    }

    #[test]
    fn heatmap_returns_empty_when_from_after_to() {
        let conn = empty_db();
        let result = heatmap(
            &conn,
            HeatmapQuery {
                from: "2026-01-05".into(),
                to: "2026-01-01".into(),
                metric: Metric::Sessions,
                project: None,
            },
        )
        .unwrap();
        assert!(result.is_empty());
    }
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib timeline::tests::heatmap 2>&1 | tail -10`
Expected: compile errors — `heatmap` and `HeatmapQuery` are not yet defined.

- [ ] **Step 3: Implement `heatmap`**

In `crates/ohmyc-core/src/timeline.rs`, after the type definitions (after `pub struct TimelineStatus { ... }` block) and before the `#[cfg(test)]` mod, add:

```rust
// ----------------------------------------------------------------------------
// Queries
// ----------------------------------------------------------------------------

use rusqlite::{params_from_iter, Connection};

const MS_PER_DAY: i64 = 86_400_000;

pub struct HeatmapQuery {
    pub from: String, // YYYY-MM-DD
    pub to: String,
    pub metric: Metric,
    pub project: Option<String>,
}

fn parse_ymd(date: &str) -> Result<chrono::NaiveDate, ApiError> {
    chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .map_err(|e| ApiError::InvalidInput(format!("date '{date}' is not YYYY-MM-DD: {e}")))
}

fn date_to_utc_ms(date: chrono::NaiveDate) -> i64 {
    use chrono::{NaiveDateTime, NaiveTime, TimeZone, Utc};
    let ndt = NaiveDateTime::new(date, NaiveTime::from_hms_opt(0, 0, 0).unwrap());
    Utc.from_utc_datetime(&ndt).timestamp_millis()
}

fn ms_to_date_string(ms: i64) -> String {
    use chrono::{TimeZone, Utc};
    let dt = Utc.timestamp_millis_opt(ms).single().expect("valid ms");
    dt.format("%Y-%m-%d").to_string()
}

fn generate_date_range(from: &str, to: &str) -> Result<Vec<String>, ApiError> {
    let start = parse_ymd(from)?;
    let end = parse_ymd(to)?;
    if start > end {
        return Ok(Vec::new());
    }
    let mut out = Vec::new();
    let mut cur = start;
    while cur <= end {
        out.push(cur.format("%Y-%m-%d").to_string());
        cur = cur.succ_opt().expect("date increment");
    }
    Ok(out)
}

pub fn heatmap(conn: &Connection, q: HeatmapQuery) -> Result<Vec<HeatmapPoint>, ApiError> {
    let dates = generate_date_range(&q.from, &q.to)?;
    if dates.is_empty() {
        return Ok(Vec::new());
    }

    let start_ms = date_to_utc_ms(parse_ymd(&q.from)?);
    let end_ms = date_to_utc_ms(parse_ymd(&q.to)?) + MS_PER_DAY - 1;

    let select_metric = match q.metric {
        Metric::Sessions => "COUNT(*)",
        Metric::Turns => "SUM(turns)",
        Metric::Tokens => "SUM(tokens_input + tokens_output + tokens_cached)",
    };

    let mut sql = format!(
        "SELECT date(started_at / 1000, 'unixepoch') AS day, {select_metric} AS value \
         FROM sessions WHERE started_at >= ? AND started_at <= ?"
    );
    let mut args: Vec<rusqlite::types::Value> = vec![start_ms.into(), end_ms.into()];
    if let Some(p) = q.project.as_ref() {
        sql.push_str(" AND project = ?");
        args.push(p.clone().into());
    }
    sql.push_str(" GROUP BY day");

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| ApiError::Internal(format!("prepare heatmap sql: {e}")))?;
    let rows: Vec<(String, i64)> = stmt
        .query_map(params_from_iter(args), |row| {
            let day: String = row.get(0)?;
            let value: Option<i64> = row.get(1)?;
            Ok((day, value.unwrap_or(0)))
        })
        .map_err(|e| ApiError::Internal(format!("query heatmap: {e}")))?
        .collect::<Result<_, _>>()
        .map_err(|e| ApiError::Internal(format!("collect heatmap: {e}")))?;

    let value_map: std::collections::HashMap<String, i64> = rows.into_iter().collect();
    Ok(dates
        .into_iter()
        .map(|date| HeatmapPoint {
            value: value_map.get(&date).copied().unwrap_or(0),
            date,
        })
        .collect())
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib timeline 2>&1 | tail -15`
Expected: all timeline tests pass (4 existing + 5 new heatmap = 9 total).

- [ ] **Step 5: Commit**

```bash
git add crates/ohmyc-core/src/timeline.rs
git commit -m "feat(core): timeline::heatmap with metric + project filter"
```

---

## Task 5: Implement `timeline::events` (TDD)

**Files:**
- Modify: `crates/ohmyc-core/src/timeline.rs`

- [ ] **Step 1: Add the failing tests**

Open `crates/ohmyc-core/src/timeline.rs`. In the existing `#[cfg(test)] mod tests` block, after the last heatmap test, add:

```rust
    use super::test_db::{insert_skill, insert_tool};

    fn seeded_events_db() -> Connection {
        let conn = empty_db();
        // Day 2026-01-03: proj-a (2 sessions), proj-b (1 session)
        insert_session(&conn, "s1", "proj-a", date_ms("2026-01-03") + 1000, 5, 100, 0, 0);
        insert_session(&conn, "s2", "proj-a", date_ms("2026-01-03") + 2000, 3, 50, 0, 0);
        insert_session(&conn, "s3", "proj-b", date_ms("2026-01-03") + 3000, 7, 200, 0, 0);
        insert_tool(&conn, "s1", "Read", 4);
        insert_tool(&conn, "s2", "Bash", 2);
        insert_skill(&conn, "s1", "investigate");
        insert_skill(&conn, "s3", "qa");
        // Day 2026-01-04: one session in proj-a
        insert_session(&conn, "s4", "proj-a", date_ms("2026-01-04") + 1000, 1, 10, 0, 0);
        conn
    }

    #[test]
    fn events_groups_sessions_by_day_then_project() {
        let conn = seeded_events_db();
        let res = events(
            &conn,
            EventsQuery { from: None, to: None, project: None, limit: None, cursor: None },
        )
        .unwrap();
        assert_eq!(res.days.len(), 2);
        // Days newest first
        assert_eq!(res.days[0].day, "2026-01-04");
        assert_eq!(res.days[1].day, "2026-01-03");
        // 01-03 has two project groups
        let day3 = &res.days[1];
        assert_eq!(day3.project_groups.len(), 2);
        // proj-b's first session started at +3000ms, proj-a's first started at +2000ms
        // (sessions ordered DESC); proj-b sorts first.
        assert_eq!(day3.project_groups[0].project, "proj-b");
        assert_eq!(day3.project_groups[1].project, "proj-a");
        // proj-a aggregates
        let proj_a = &day3.project_groups[1];
        assert_eq!(proj_a.session_count, 2);
        assert_eq!(proj_a.turn_count, 8); // 5 + 3
        assert_eq!(proj_a.token_count, 150);
        assert_eq!(proj_a.tool_count, 6); // 4 (s1 Read) + 2 (s2 Bash)
        assert_eq!(proj_a.skill_count, 1); // s1 investigate
    }

    #[test]
    fn events_project_filter_excludes_other_projects() {
        let conn = seeded_events_db();
        let res = events(
            &conn,
            EventsQuery {
                from: None,
                to: None,
                project: Some("proj-b".into()),
                limit: None,
                cursor: None,
            },
        )
        .unwrap();
        // Only proj-b sessions exist on 2026-01-03; nothing on 01-04.
        assert_eq!(res.days.len(), 1);
        assert_eq!(res.days[0].day, "2026-01-03");
        assert_eq!(res.days[0].project_groups.len(), 1);
        assert_eq!(res.days[0].project_groups[0].project, "proj-b");
    }

    #[test]
    fn events_pagination_emits_next_cursor_when_more_days_exist() {
        let conn = seeded_events_db();
        let res = events(
            &conn,
            EventsQuery { from: None, to: None, project: None, limit: Some(1), cursor: None },
        )
        .unwrap();
        assert_eq!(res.days.len(), 1);
        assert_eq!(res.days[0].day, "2026-01-04");
        assert_eq!(res.next_cursor.as_deref(), Some("2026-01-04"));

        let page2 = events(
            &conn,
            EventsQuery {
                from: None,
                to: None,
                project: None,
                limit: Some(1),
                cursor: Some("2026-01-04".into()),
            },
        )
        .unwrap();
        assert_eq!(page2.days.len(), 1);
        assert_eq!(page2.days[0].day, "2026-01-03");
        assert_eq!(page2.next_cursor, None);
    }

    #[test]
    fn events_returns_empty_when_no_sessions_match() {
        let conn = empty_db();
        let res = events(
            &conn,
            EventsQuery { from: None, to: None, project: None, limit: None, cursor: None },
        )
        .unwrap();
        assert!(res.days.is_empty());
        assert!(res.next_cursor.is_none());
    }
```

- [ ] **Step 2: Run the tests to confirm they fail (compile error)**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib timeline::tests::events 2>&1 | tail -10`
Expected: `EventsQuery` / `events` undefined.

- [ ] **Step 3: Implement `events`**

In `crates/ohmyc-core/src/timeline.rs`, after the `heatmap` function and before the `#[cfg(test)]` block, add:

```rust
pub struct EventsQuery {
    pub from: Option<String>,   // YYYY-MM-DD
    pub to: Option<String>,
    pub project: Option<String>,
    pub limit: Option<i64>,
    pub cursor: Option<String>,
}

pub fn events(conn: &Connection, q: EventsQuery) -> Result<EventsResult, ApiError> {
    let limit = q.limit.unwrap_or(30);
    if limit <= 0 {
        return Err(ApiError::InvalidInput("limit must be > 0".into()));
    }

    // Build WHERE clause for the day-discovery query
    let mut conditions: Vec<String> = Vec::new();
    let mut args: Vec<rusqlite::types::Value> = Vec::new();
    if let Some(from) = q.from.as_ref() {
        conditions.push("started_at >= ?".into());
        args.push(date_to_utc_ms(parse_ymd(from)?).into());
    }
    if let Some(to) = q.to.as_ref() {
        conditions.push("started_at <= ?".into());
        args.push((date_to_utc_ms(parse_ymd(to)?) + MS_PER_DAY - 1).into());
    }
    if let Some(p) = q.project.as_ref() {
        conditions.push("project = ?".into());
        args.push(p.clone().into());
    }
    if let Some(c) = q.cursor.as_ref() {
        conditions.push("date(started_at / 1000, 'unixepoch') < ?".into());
        args.push(c.clone().into());
    }
    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    // Discover the page's days (limit + 1 to detect "more")
    let day_sql = format!(
        "SELECT DISTINCT date(started_at / 1000, 'unixepoch') AS day \
         FROM sessions {where_clause} ORDER BY day DESC LIMIT ?"
    );
    let mut day_args = args.clone();
    day_args.push((limit + 1).into());

    let mut day_stmt = conn
        .prepare(&day_sql)
        .map_err(|e| ApiError::Internal(format!("prepare events day sql: {e}")))?;
    let day_rows: Vec<String> = day_stmt
        .query_map(params_from_iter(day_args), |row| row.get::<_, String>(0))
        .map_err(|e| ApiError::Internal(format!("query events days: {e}")))?
        .collect::<Result<_, _>>()
        .map_err(|e| ApiError::Internal(format!("collect events days: {e}")))?;

    let has_more = day_rows.len() as i64 > limit;
    let day_batch: Vec<String> = if has_more {
        day_rows.into_iter().take(limit as usize).collect()
    } else {
        day_rows
    };

    if day_batch.is_empty() {
        return Ok(EventsResult { days: Vec::new(), next_cursor: None });
    }

    // Fetch all sessions for those days
    let placeholders = day_batch.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
    let project_filter = if q.project.is_some() { "AND project = ?" } else { "" };
    let session_sql = format!(
        "SELECT session_id, project, agent_name, started_at, ended_at, duration_ms, \
                turns, tokens_input, tokens_output, tokens_cached, summary, summary_source, \
                transcript_path, last_offset, ingested_at, model \
         FROM sessions \
         WHERE date(started_at / 1000, 'unixepoch') IN ({placeholders}) {project_filter} \
         ORDER BY started_at DESC"
    );
    let mut session_args: Vec<rusqlite::types::Value> =
        day_batch.iter().map(|d| d.clone().into()).collect();
    if let Some(p) = q.project.as_ref() {
        session_args.push(p.clone().into());
    }
    let mut session_stmt = conn
        .prepare(&session_sql)
        .map_err(|e| ApiError::Internal(format!("prepare events session sql: {e}")))?;
    let sessions: Vec<SessionRow> = session_stmt
        .query_map(params_from_iter(session_args), row_to_session)
        .map_err(|e| ApiError::Internal(format!("query events sessions: {e}")))?
        .collect::<Result<_, _>>()
        .map_err(|e| ApiError::Internal(format!("collect events sessions: {e}")))?;

    // Group by day, then project
    use std::collections::BTreeMap;
    let mut day_map: BTreeMap<String, Vec<ProjectGroup>> = BTreeMap::new();
    for day in &day_batch {
        day_map.insert(day.clone(), Vec::new());
    }
    // Project map per day, preserving first-seen order (matches TS behavior)
    let mut day_project_map: std::collections::HashMap<String, Vec<ProjectGroup>> =
        day_batch.iter().map(|d| (d.clone(), Vec::new())).collect();

    for session in &sessions {
        let day = ms_to_date_string(session.started_at);
        let groups = day_project_map.entry(day.clone()).or_default();
        let pos = groups.iter().position(|g| g.project == session.project);
        let idx = match pos {
            Some(i) => i,
            None => {
                groups.push(ProjectGroup {
                    project: session.project.clone(),
                    sessions: Vec::new(),
                    session_count: 0,
                    turn_count: 0,
                    token_count: 0,
                    tool_count: 0,
                    skill_count: 0,
                    agents: Vec::new(),
                });
                groups.len() - 1
            }
        };
        let group = &mut groups[idx];
        group.sessions.push(session.clone());
        group.session_count += 1;
        group.turn_count += session.turns;
        group.token_count +=
            session.tokens_input + session.tokens_output + session.tokens_cached;
        if let Some(agent) = session.agent_name.as_ref() {
            if !group.agents.contains(agent) {
                group.agents.push(agent.clone());
            }
        }
    }

    // Add tool / skill counts per group
    for (_day, groups) in day_project_map.iter_mut() {
        let session_ids: Vec<String> = groups
            .iter()
            .flat_map(|g| g.sessions.iter().map(|s| s.session_id.clone()))
            .collect();
        if session_ids.is_empty() {
            continue;
        }
        let id_placeholders = session_ids.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
        let tool_sql = format!(
            "SELECT session_id, SUM(call_count) AS cnt FROM session_tools \
             WHERE session_id IN ({id_placeholders}) GROUP BY session_id"
        );
        let mut tool_stmt = conn
            .prepare(&tool_sql)
            .map_err(|e| ApiError::Internal(format!("prepare tool sql: {e}")))?;
        let tool_map: std::collections::HashMap<String, i64> = tool_stmt
            .query_map(
                params_from_iter(session_ids.iter().cloned().map(rusqlite::types::Value::from)),
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)),
            )
            .map_err(|e| ApiError::Internal(format!("query tools: {e}")))?
            .collect::<Result<_, _>>()
            .map_err(|e| ApiError::Internal(format!("collect tools: {e}")))?;

        let skill_sql = format!(
            "SELECT session_id, COUNT(*) AS cnt FROM session_skills \
             WHERE session_id IN ({id_placeholders}) GROUP BY session_id"
        );
        let mut skill_stmt = conn
            .prepare(&skill_sql)
            .map_err(|e| ApiError::Internal(format!("prepare skill sql: {e}")))?;
        let skill_map: std::collections::HashMap<String, i64> = skill_stmt
            .query_map(
                params_from_iter(session_ids.iter().cloned().map(rusqlite::types::Value::from)),
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)),
            )
            .map_err(|e| ApiError::Internal(format!("query skills: {e}")))?
            .collect::<Result<_, _>>()
            .map_err(|e| ApiError::Internal(format!("collect skills: {e}")))?;

        for group in groups.iter_mut() {
            group.tool_count = group
                .sessions
                .iter()
                .map(|s| tool_map.get(&s.session_id).copied().unwrap_or(0))
                .sum();
            group.skill_count = group
                .sessions
                .iter()
                .map(|s| skill_map.get(&s.session_id).copied().unwrap_or(0))
                .sum();
        }
    }

    // Build result in day order (newest first), sorting project groups by
    // the first session's started_at DESC inside each day.
    let mut day_events: Vec<DayEvents> = Vec::new();
    for day in &day_batch {
        let mut groups = day_project_map.remove(day).unwrap_or_default();
        groups.sort_by(|a, b| {
            let a_first = a.sessions.first().map(|s| s.started_at).unwrap_or(0);
            let b_first = b.sessions.first().map(|s| s.started_at).unwrap_or(0);
            b_first.cmp(&a_first)
        });
        let session_count = groups.iter().map(|g| g.session_count).sum();
        let turn_count = groups.iter().map(|g| g.turn_count).sum();
        let token_count = groups.iter().map(|g| g.token_count).sum();
        day_events.push(DayEvents {
            day: day.clone(),
            project_groups: groups,
            session_count,
            turn_count,
            token_count,
        });
    }

    Ok(EventsResult {
        days: day_events,
        next_cursor: if has_more { day_batch.last().cloned() } else { None },
    })
}

fn row_to_session(row: &rusqlite::Row) -> rusqlite::Result<SessionRow> {
    Ok(SessionRow {
        session_id: row.get(0)?,
        project: row.get(1)?,
        agent_name: row.get(2)?,
        started_at: row.get(3)?,
        ended_at: row.get(4)?,
        duration_ms: row.get(5)?,
        turns: row.get(6)?,
        tokens_input: row.get(7)?,
        tokens_output: row.get(8)?,
        tokens_cached: row.get(9)?,
        summary: row.get(10)?,
        summary_source: row.get(11)?,
        transcript_path: row.get(12)?,
        last_offset: row.get(13)?,
        ingested_at: row.get(14)?,
        model: row.get(15)?,
    })
}
```

- [ ] **Step 4: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib timeline 2>&1 | tail -15`
Expected: 13 tests pass (4 + 5 heatmap + 4 events).

- [ ] **Step 5: Commit**

```bash
git add crates/ohmyc-core/src/timeline.rs
git commit -m "feat(core): timeline::events with pagination + project filter"
```

---

## Task 6: Implement `session`, `projects`, `years`, `status` (TDD)

**Files:**
- Modify: `crates/ohmyc-core/src/timeline.rs`

- [ ] **Step 1: Add tests for all four**

In `#[cfg(test)] mod tests`, after the last events test, add:

```rust
    use super::test_db::set_meta;

    #[test]
    fn session_returns_row_with_tools_and_skills() {
        let conn = empty_db();
        insert_session(&conn, "s1", "proj-a", date_ms("2026-01-01"), 5, 100, 50, 25);
        insert_tool(&conn, "s1", "Read", 3);
        insert_tool(&conn, "s1", "Bash", 1);
        insert_skill(&conn, "s1", "investigate");

        let detail = session(&conn, "s1").unwrap().expect("session present");
        assert_eq!(detail.session.session_id, "s1");
        assert_eq!(detail.tools.len(), 2);
        assert!(detail.tools.iter().any(|t| t.tool_name == "Read" && t.call_count == 3));
        assert_eq!(detail.skills.len(), 1);
        assert_eq!(detail.skills[0].skill_name, "investigate");
    }

    #[test]
    fn session_returns_none_when_id_absent() {
        let conn = empty_db();
        assert!(session(&conn, "nope").unwrap().is_none());
    }

    #[test]
    fn projects_returns_distinct_sorted() {
        let conn = empty_db();
        insert_session(&conn, "s1", "z-proj", date_ms("2026-01-01"), 1, 0, 0, 0);
        insert_session(&conn, "s2", "a-proj", date_ms("2026-01-02"), 1, 0, 0, 0);
        insert_session(&conn, "s3", "a-proj", date_ms("2026-01-03"), 1, 0, 0, 0);
        let ps = projects(&conn).unwrap();
        assert_eq!(ps, vec!["a-proj", "z-proj"]);
    }

    #[test]
    fn years_returns_distinct_ascending() {
        let conn = empty_db();
        insert_session(&conn, "s1", "p", date_ms("2024-06-01"), 1, 0, 0, 0);
        insert_session(&conn, "s2", "p", date_ms("2026-01-01"), 1, 0, 0, 0);
        insert_session(&conn, "s3", "p", date_ms("2025-12-31"), 1, 0, 0, 0);
        let ys = years(&conn).unwrap();
        assert_eq!(ys, vec![2024, 2025, 2026]);
    }

    #[test]
    fn status_reports_count_and_meta_last_sync() {
        let conn = empty_db();
        insert_session(&conn, "s1", "p", date_ms("2026-01-01"), 1, 0, 0, 0);
        insert_session(&conn, "s2", "p", date_ms("2026-01-02"), 1, 0, 0, 0);
        set_meta(&conn, "last_sync_at", "1700000000000");
        let s = status(&conn).unwrap();
        assert_eq!(s.session_count, 2);
        assert_eq!(s.last_sync_at, Some(1_700_000_000_000));
    }

    #[test]
    fn status_returns_none_when_meta_missing() {
        let conn = empty_db();
        let s = status(&conn).unwrap();
        assert_eq!(s.session_count, 0);
        assert_eq!(s.last_sync_at, None);
    }
```

- [ ] **Step 2: Implement the four functions**

In `crates/ohmyc-core/src/timeline.rs`, after the `row_to_session` function, add:

```rust
pub fn session(conn: &Connection, session_id: &str) -> Result<Option<SessionDetail>, ApiError> {
    let row = conn
        .query_row(
            "SELECT session_id, project, agent_name, started_at, ended_at, duration_ms, \
                    turns, tokens_input, tokens_output, tokens_cached, summary, summary_source, \
                    transcript_path, last_offset, ingested_at, model \
             FROM sessions WHERE session_id = ?",
            [session_id],
            row_to_session,
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => ApiError::NotFound {
                kind: "session",
                name: session_id.to_string(),
            },
            other => ApiError::Internal(format!("session query: {other}")),
        });

    let session = match row {
        Ok(s) => s,
        Err(ApiError::NotFound { .. }) => return Ok(None),
        Err(e) => return Err(e),
    };

    let mut tool_stmt = conn
        .prepare("SELECT session_id, tool_name, call_count FROM session_tools WHERE session_id = ?")
        .map_err(|e| ApiError::Internal(format!("prepare tools: {e}")))?;
    let tools: Vec<SessionTool> = tool_stmt
        .query_map([session_id], |row| {
            Ok(SessionTool {
                session_id: row.get(0)?,
                tool_name: row.get(1)?,
                call_count: row.get(2)?,
            })
        })
        .map_err(|e| ApiError::Internal(format!("query tools: {e}")))?
        .collect::<Result<_, _>>()
        .map_err(|e| ApiError::Internal(format!("collect tools: {e}")))?;

    let mut skill_stmt = conn
        .prepare("SELECT session_id, skill_name FROM session_skills WHERE session_id = ?")
        .map_err(|e| ApiError::Internal(format!("prepare skills: {e}")))?;
    let skills: Vec<SessionSkill> = skill_stmt
        .query_map([session_id], |row| {
            Ok(SessionSkill {
                session_id: row.get(0)?,
                skill_name: row.get(1)?,
            })
        })
        .map_err(|e| ApiError::Internal(format!("query skills: {e}")))?
        .collect::<Result<_, _>>()
        .map_err(|e| ApiError::Internal(format!("collect skills: {e}")))?;

    Ok(Some(SessionDetail { session, tools, skills }))
}

pub fn projects(conn: &Connection) -> Result<Vec<String>, ApiError> {
    let mut stmt = conn
        .prepare("SELECT DISTINCT project FROM sessions ORDER BY project")
        .map_err(|e| ApiError::Internal(format!("prepare projects: {e}")))?;
    let rows: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| ApiError::Internal(format!("query projects: {e}")))?
        .collect::<Result<_, _>>()
        .map_err(|e| ApiError::Internal(format!("collect projects: {e}")))?;
    Ok(rows)
}

pub fn years(conn: &Connection) -> Result<Vec<i64>, ApiError> {
    let mut stmt = conn
        .prepare(
            "SELECT DISTINCT CAST(strftime('%Y', started_at / 1000, 'unixepoch') AS INTEGER) AS year \
             FROM sessions ORDER BY year",
        )
        .map_err(|e| ApiError::Internal(format!("prepare years: {e}")))?;
    let rows: Vec<i64> = stmt
        .query_map([], |row| row.get::<_, i64>(0))
        .map_err(|e| ApiError::Internal(format!("query years: {e}")))?
        .collect::<Result<_, _>>()
        .map_err(|e| ApiError::Internal(format!("collect years: {e}")))?;
    Ok(rows)
}

pub fn status(conn: &Connection) -> Result<TimelineStatus, ApiError> {
    let session_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM sessions", [], |row| row.get(0))
        .map_err(|e| ApiError::Internal(format!("status count: {e}")))?;

    let last_sync_at: Option<i64> = conn
        .query_row(
            "SELECT value FROM meta WHERE key = 'last_sync_at'",
            [],
            |row| {
                let v: String = row.get(0)?;
                Ok(v.parse::<i64>().ok())
            },
        )
        .optional()
        .map_err(|e| ApiError::Internal(format!("status meta: {e}")))?
        .flatten();

    Ok(TimelineStatus { session_count, last_sync_at })
}

use rusqlite::OptionalExtension;
```

- [ ] **Step 3: Run all timeline tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib timeline 2>&1 | tail -15`
Expected: 19 timeline tests pass.

- [ ] **Step 4: Commit**

```bash
git add crates/ohmyc-core/src/timeline.rs
git commit -m "feat(core): timeline::session/projects/years/status queries"
```

---

## Task 7: Add `timeline::open_db` to load the real on-disk DB

**Files:**
- Modify: `crates/ohmyc-core/src/timeline.rs`

- [ ] **Step 1: Add the failing test**

In `#[cfg(test)] mod tests`, after the existing tests, add:

```rust
    #[test]
    fn open_db_creates_a_readable_connection() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("timeline.db");
        {
            let conn = rusqlite::Connection::open(&db_path).unwrap();
            conn.execute_batch(test_db::SCHEMA_SQL).unwrap();
        }
        let conn = open_db(&db_path).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM sessions", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn open_db_errors_when_path_does_not_exist() {
        let err = open_db(std::path::Path::new("/nonexistent/path/timeline.db")).unwrap_err();
        match err {
            ApiError::Io(_) => {}
            other => panic!("expected Io error, got {other:?}"),
        }
    }
```

- [ ] **Step 2: Run to confirm it fails (compile error)**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib timeline::tests::open_db 2>&1 | tail -10`
Expected: `open_db` undefined.

- [ ] **Step 3: Implement `open_db`**

In `crates/ohmyc-core/src/timeline.rs`, after the `status` function and before the `#[cfg(test)]` block, add:

```rust
/// Open the timeline database at the given path. Returns an `Io` error if the
/// file does not exist (we never create it — the dashboard plugin owns
/// schema + writes; this crate is read-only).
pub fn open_db(path: &std::path::Path) -> Result<Connection, ApiError> {
    if !path.exists() {
        return Err(ApiError::Io(format!(
            "timeline db not found at {}",
            path.display()
        )));
    }
    let conn = Connection::open(path)
        .map_err(|e| ApiError::Internal(format!("open db: {e}")))?;
    conn.pragma_update(None, "journal_mode", "WAL")
        .map_err(|e| ApiError::Internal(format!("set wal: {e}")))?;
    Ok(conn)
}
```

- [ ] **Step 4: Run all timeline tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib timeline 2>&1 | tail -10`
Expected: 21 timeline tests pass.

- [ ] **Step 5: Commit**

```bash
git add crates/ohmyc-core/src/timeline.rs
git commit -m "feat(core): timeline::open_db (read-only, no auto-create)"
```

---

## Task 8: Add the debounced `watcher` module (TDD)

**Files:**
- Create: `crates/ohmyc-core/src/watcher.rs`
- Modify: `crates/ohmyc-core/src/lib.rs`

- [ ] **Step 1: Create the watcher module**

Create `crates/ohmyc-core/src/watcher.rs`:

```rust
//! Filesystem watcher — debounced 250ms; emits a typed `FsEvent` for
//! every change in the watched paths. Used by the Tauri layer to forward
//! to the frontend as `fs:changed`.

use std::path::{Path, PathBuf};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::time::Duration;

use notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, DebouncedEventKind, Debouncer};
use serde::Serialize;

use crate::error::ApiError;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum FsEvent {
    /// A timeline DB write (sessions.db / -wal / -shm changed).
    TimelineDb { path: String },
    /// A claude-home file changed (profiles/agents/skills/commands/settings/plugins).
    ClaudeHome { path: String },
}

/// Builds a debouncer (250ms) that watches the given paths recursively and
/// forwards events to `tx`. The returned `Debouncer` must be kept alive —
/// dropping it stops the watcher.
pub fn spawn(
    paths: Vec<PathBuf>,
    tx: Sender<FsEvent>,
) -> Result<Debouncer<notify::RecommendedWatcher>, ApiError> {
    let mut debouncer = new_debouncer(Duration::from_millis(250), move |res| {
        let Ok(events) = res else { return };
        for ev in events {
            let path = ev.path.to_string_lossy().to_string();
            if !matches!(ev.kind, DebouncedEventKind::Any) {
                continue;
            }
            // Classify by filename. Timeline writes include the WAL/SHM siblings.
            let lower = path.to_lowercase();
            let event = if lower.ends_with("timeline.db")
                || lower.ends_with("timeline.db-wal")
                || lower.ends_with("timeline.db-shm")
            {
                FsEvent::TimelineDb { path }
            } else {
                FsEvent::ClaudeHome { path }
            };
            let _ = tx.send(event);
        }
    })
    .map_err(|e| ApiError::Internal(format!("debouncer init: {e}")))?;

    for path in &paths {
        if !path.exists() {
            continue;
        }
        debouncer
            .watcher()
            .watch(path, RecursiveMode::NonRecursive)
            .map_err(|e| ApiError::Internal(format!("watch {}: {e}", path.display())))?;
    }
    Ok(debouncer)
}

/// Returns the default set of paths to watch:
/// - `$OHMYC_HOME` (parent dir of `timeline.db`)
/// - `~/.claude` (claude home root)
pub fn default_watch_paths() -> Result<Vec<PathBuf>, ApiError> {
    let db = crate::timeline::default_db_path()?;
    let db_dir = db.parent().map(|p| p.to_path_buf()).ok_or_else(|| {
        ApiError::Internal("db path has no parent".to_string())
    })?;
    let claude_home = crate::claude_home::resolve()?;
    Ok(vec![db_dir, claude_home])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fs_event_serializes_with_tag_and_path() {
        let ev = FsEvent::TimelineDb { path: "/tmp/timeline.db".into() };
        let json = serde_json::to_value(&ev).unwrap();
        assert_eq!(json["kind"], "timeline_db");
        assert_eq!(json["path"], "/tmp/timeline.db");
    }

    #[test]
    fn debouncer_emits_event_after_write() {
        let dir = tempfile::tempdir().unwrap();
        let (tx, rx): (Sender<FsEvent>, Receiver<FsEvent>) = channel();
        let _debouncer = spawn(vec![dir.path().to_path_buf()], tx).unwrap();

        // Trigger a write.
        std::thread::sleep(Duration::from_millis(50));
        std::fs::write(dir.path().join("anything.txt"), "hi").unwrap();

        // Allow debounce window + a margin.
        let event = rx.recv_timeout(Duration::from_secs(2)).expect("event received");
        match event {
            FsEvent::ClaudeHome { path } => assert!(path.contains("anything.txt")),
            other => panic!("unexpected event: {other:?}"),
        }
    }

    #[test]
    fn debouncer_classifies_timeline_db_writes() {
        let dir = tempfile::tempdir().unwrap();
        let (tx, rx): (Sender<FsEvent>, Receiver<FsEvent>) = channel();
        let _debouncer = spawn(vec![dir.path().to_path_buf()], tx).unwrap();

        std::thread::sleep(Duration::from_millis(50));
        std::fs::write(dir.path().join("timeline.db"), b"sqlite").unwrap();

        let event = rx.recv_timeout(Duration::from_secs(2)).expect("event received");
        assert!(matches!(event, FsEvent::TimelineDb { .. }));
    }
}
```

- [ ] **Step 2: Export the module**

Open `crates/ohmyc-core/src/lib.rs`. Replace its contents with:

```rust
//! Domain logic for the OhMyC desktop app. Owns all `~/.claude` and
//! `$OHMYC_HOME` I/O, parsing, and watchers. No Tauri imports —
//! testable standalone.

pub mod claude_home;
pub mod error;
pub mod timeline;
pub mod watcher;

pub use error::ApiError;
```

- [ ] **Step 3: Run the watcher tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib watcher 2>&1 | tail -10`
Expected: 3 watcher tests pass. The two debouncer tests may take ~1-2 seconds each due to the debounce window.

- [ ] **Step 4: Commit**

```bash
git add crates/ohmyc-core/src/watcher.rs crates/ohmyc-core/src/lib.rs
git commit -m "feat(core): notify-debouncer watcher with FsEvent classification"
```

---

## Task 9: Add the timeline Tauri command wrappers

**Files:**
- Create: `packages/desktop/src-tauri/src/api/mod.rs`
- Create: `packages/desktop/src-tauri/src/api/timeline.rs`
- Modify: `packages/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Create the api module**

Create `packages/desktop/src-tauri/src/api/mod.rs`:

```rust
pub mod timeline;
```

- [ ] **Step 2: Create the timeline command wrappers**

Create `packages/desktop/src-tauri/src/api/timeline.rs`:

```rust
//! Tauri command wrappers for ohmyc-core::timeline. All commands open and
//! close the SQLite connection per call — keeps state simple and avoids
//! locking the WAL across calls.

use std::path::PathBuf;

use ohmyc_core::error::ApiError;
use ohmyc_core::timeline::{
    self, EventsQuery, EventsResult, HeatmapPoint, HeatmapQuery, Metric, ProjectGroup,
    SessionDetail, TimelineStatus,
};
use serde::{Deserialize, Serialize};

fn db_path() -> Result<PathBuf, ApiError> {
    timeline::default_db_path()
}

#[derive(Deserialize)]
pub struct HeatmapArgs {
    pub from: i64,            // UTC ms (matches JS Date.UTC output)
    pub to: i64,
    pub metric: String,
    pub project: Option<String>,
}

#[derive(Serialize)]
pub struct HeatmapResponse {
    pub data: Vec<HeatmapPoint>,
}

#[tauri::command]
pub fn timeline_heatmap(args: HeatmapArgs) -> Result<HeatmapResponse, ApiError> {
    let conn = timeline::open_db(&db_path()?)?;
    let data = timeline::heatmap(
        &conn,
        HeatmapQuery {
            from: ms_to_date(args.from),
            to: ms_to_date(args.to),
            metric: Metric::parse(&args.metric)?,
            project: args.project,
        },
    )?;
    Ok(HeatmapResponse { data })
}

#[derive(Deserialize)]
pub struct EventsArgs {
    pub from: Option<i64>,
    pub to: Option<i64>,
    pub project: Option<String>,
    pub limit: Option<i64>,
    pub cursor: Option<String>,
}

#[tauri::command]
pub fn timeline_events(args: EventsArgs) -> Result<EventsResult, ApiError> {
    let conn = timeline::open_db(&db_path()?)?;
    timeline::events(
        &conn,
        EventsQuery {
            from: args.from.map(ms_to_date),
            to: args.to.map(ms_to_date),
            project: args.project,
            limit: args.limit,
            cursor: args.cursor,
        },
    )
}

#[derive(Deserialize)]
pub struct SessionArgs {
    pub id: String,
}

#[tauri::command]
pub fn timeline_session(args: SessionArgs) -> Result<Option<SessionDetail>, ApiError> {
    let conn = timeline::open_db(&db_path()?)?;
    timeline::session(&conn, &args.id)
}

#[derive(Serialize)]
pub struct ProjectsResponse {
    pub projects: Vec<String>,
}

#[tauri::command]
pub fn timeline_projects() -> Result<ProjectsResponse, ApiError> {
    let conn = timeline::open_db(&db_path()?)?;
    Ok(ProjectsResponse { projects: timeline::projects(&conn)? })
}

#[derive(Serialize)]
pub struct YearsResponse {
    pub years: Vec<i64>,
}

#[tauri::command]
pub fn timeline_years() -> Result<YearsResponse, ApiError> {
    let conn = timeline::open_db(&db_path()?)?;
    Ok(YearsResponse { years: timeline::years(&conn)? })
}

#[tauri::command]
pub fn timeline_status() -> Result<TimelineStatus, ApiError> {
    let conn = timeline::open_db(&db_path()?)?;
    timeline::status(&conn)
}

// Suppress an unused-import warning on non-test builds.
#[allow(dead_code)]
fn _project_group_used(_: ProjectGroup) {}

fn ms_to_date(ms: i64) -> String {
    use chrono::{TimeZone, Utc};
    let dt = Utc.timestamp_millis_opt(ms).single().expect("valid ms");
    dt.format("%Y-%m-%d").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ms_to_date_converts_utc_midnight() {
        // 2026-01-01 00:00:00 UTC
        assert_eq!(ms_to_date(1_767_225_600_000), "2026-01-01");
    }
}
```

- [ ] **Step 3: Add `chrono` to the desktop crate's deps**

Open `packages/desktop/src-tauri/Cargo.toml`. In the `[dependencies]` section, after `ohmyc-core = ...`, add:

```toml
chrono = { version = "0.4", default-features = false, features = ["clock"] }
```

- [ ] **Step 4: Re-export api from lib.rs**

Open `packages/desktop/src-tauri/src/lib.rs`. Replace contents with:

```rust
pub mod api;
pub mod events;
pub mod popover;
pub mod tray;
pub mod windows;
```

(We declare `events` here even though the file doesn't exist yet — Task 10 creates it. Don't run a build between now and Task 10.)

- [ ] **Step 5: Commit (no build verification yet — Task 10 finishes the wiring)**

```bash
git add packages/desktop/src-tauri/src/api/ packages/desktop/src-tauri/src/lib.rs packages/desktop/src-tauri/Cargo.toml
git commit -m "feat(desktop): timeline Tauri commands (open conn per call)"
```

---

## Task 10: Spawn the watcher + forward events to the frontend

**Files:**
- Create: `packages/desktop/src-tauri/src/events.rs`
- Modify: `packages/desktop/src-tauri/src/main.rs`

- [ ] **Step 1: Create the events forwarder**

Create `packages/desktop/src-tauri/src/events.rs`:

```rust
//! Spawns the ohmyc-core watcher on app setup and forwards every FsEvent
//! as a Tauri event named `fs:changed`. The watcher is stored on the
//! Tauri state so dropping it (and stopping the thread) only happens at
//! app shutdown.

use std::sync::mpsc::{channel, Receiver, Sender};
use std::thread;

use ohmyc_core::watcher::{self, FsEvent};
use tauri::{AppHandle, Emitter, Manager};

pub const FS_CHANGED_EVENT: &str = "fs:changed";

/// Keeps the debouncer alive for the lifetime of the app.
pub struct WatcherGuard {
    _debouncer: notify_debouncer_mini::Debouncer<notify::RecommendedWatcher>,
}

/// Set up the watcher and the forwarder thread. Stores the debouncer in
/// Tauri state. Returns Ok even if the watcher fails to spawn — the rest
/// of the app stays functional, and the user will see stale data instead
/// of a crash.
pub fn spawn_watcher(app: &AppHandle) {
    let paths = match watcher::default_watch_paths() {
        Ok(p) => p,
        Err(e) => {
            eprintln!("watcher: default_watch_paths failed: {e}");
            return;
        }
    };

    let (tx, rx): (Sender<FsEvent>, Receiver<FsEvent>) = channel();
    let debouncer = match watcher::spawn(paths, tx) {
        Ok(d) => d,
        Err(e) => {
            eprintln!("watcher: spawn failed: {e}");
            return;
        }
    };
    app.manage(WatcherGuard { _debouncer: debouncer });

    let app_for_thread = app.clone();
    thread::spawn(move || {
        while let Ok(event) = rx.recv() {
            let _ = app_for_thread.emit(FS_CHANGED_EVENT, &event);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fs_changed_event_name_is_stable() {
        // Frontend listens by this exact string; changing it is a breaking change.
        assert_eq!(FS_CHANGED_EVENT, "fs:changed");
    }
}
```

- [ ] **Step 2: Add `notify-debouncer-mini` and `notify` to desktop deps**

Open `packages/desktop/src-tauri/Cargo.toml`. In `[dependencies]`, after `chrono = ...`, add:

```toml
notify = "6"
notify-debouncer-mini = "0.4"
```

- [ ] **Step 3: Register the timeline commands + spawn the watcher**

Open `packages/desktop/src-tauri/src/main.rs`. Find the `invoke_handler!` block and replace it with:

```rust
        .invoke_handler(tauri::generate_handler![
            hide_popover,
            ohmyc_desktop_lib::windows::open_main_window,
            ohmyc_desktop_lib::api::timeline::timeline_heatmap,
            ohmyc_desktop_lib::api::timeline::timeline_events,
            ohmyc_desktop_lib::api::timeline::timeline_session,
            ohmyc_desktop_lib::api::timeline::timeline_projects,
            ohmyc_desktop_lib::api::timeline::timeline_years,
            ohmyc_desktop_lib::api::timeline::timeline_status,
        ])
```

Then, inside the `.setup(|app| { ... })` closure, after the existing tray + popover wiring but before the final `Ok(())`, add:

```rust
            // Filesystem watcher → frontend "fs:changed" events.
            ohmyc_desktop_lib::events::spawn_watcher(&app.handle().clone());
```

- [ ] **Step 4: Build and run all Rust tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test --workspace 2>&1 | tail -15`
Expected: all tests pass (`cargo build` succeeds first, then 28+ tests run green).

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src-tauri/src/events.rs packages/desktop/src-tauri/src/main.rs packages/desktop/src-tauri/Cargo.toml
git commit -m "feat(desktop): register timeline commands + spawn fs watcher"
```

---

## Task 11: Add per-wire URL routing to the fetch transport

**Files:**
- Modify: `packages/ui/src/lib/transport/fetch.ts`

The current naive `.replace('.', '/')` breaks for `timeline.session` (path param `:id`), so we introduce a per-wire route table that each slice extends.

- [ ] **Step 1: Add the failing test**

Open `packages/ui/src/lib/transport/transport.test.ts`. At the bottom of the file, before the closing `})` of the `describe`, add:

```ts
  it('fetch transport routes timeline.session via the path-param table', async () => {
    const calls: string[] = []
    const orig = globalThis.fetch
    globalThis.fetch = (async (url: string) => {
      calls.push(url)
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch
    try {
      const { fetchTransport } = await import('./fetch')
      await fetchTransport('timeline.session', { id: 'abc-123' })
      expect(calls).toEqual(['/api/timeline/sessions/abc-123'])
    }
    finally {
      globalThis.fetch = orig
    }
  })

  it('fetch transport falls back to naive dotted path when wire has no entry', async () => {
    const calls: string[] = []
    const orig = globalThis.fetch
    globalThis.fetch = (async (url: string) => {
      calls.push(url)
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
    }) as typeof fetch
    try {
      const { fetchTransport } = await import('./fetch')
      await fetchTransport('foo.bar', {})
      expect(calls).toEqual(['/api/foo/bar'])
    }
    finally {
      globalThis.fetch = orig
    }
  })
```

- [ ] **Step 2: Run the tests to confirm both fail**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm test -- transport.test.ts 2>&1 | tail -15`
Expected: the new tests fail — either with URL mismatch or response-shape issues.

- [ ] **Step 3: Rewrite `fetch.ts`**

Replace the entire contents of `packages/ui/src/lib/transport/fetch.ts` with:

```ts
import type { Transport } from '../transport'

// Wire-name → URL builder. Each slice that migrates an endpoint to invoke()
// also adds the slice's wires here so the legacy fetch transport keeps
// working during the migration window (`pnpm dev` against the TS server).
//
// Returns the request URL (always GET for now — write endpoints land in
// later slices and will extend this to { url, method, body }).
const routes: Record<string, (args: Record<string, unknown>) => string> = {
  'timeline.heatmap': (a) => `/api/timeline/heatmap?${qs(a)}`,
  'timeline.events': (a) => `/api/timeline/events?${qs(a)}`,
  'timeline.session': (a) => `/api/timeline/sessions/${encodeURIComponent(String(a.id ?? ''))}`,
  'timeline.projects': () => '/api/timeline/projects',
  'timeline.years': () => '/api/timeline/years',
  'timeline.status': () => '/api/timeline/status',
}

function qs(args: Record<string, unknown>): string {
  const out = new URLSearchParams()
  for (const [k, v] of Object.entries(args)) {
    if (v === undefined || v === null) {
      continue
    }
    out.set(k, String(v))
  }
  return out.toString()
}

export const fetchTransport: Transport = async (wire, args) => {
  const a = (args ?? {}) as Record<string, unknown>
  const url = routes[wire]
    ? routes[wire](a)
    : `/api/${wire.replace(/\./g, '/')}${Object.keys(a).length > 0 ? `?${qs(a)}` : ''}`

  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw { code: res.status === 404 ? 'NotFound' : 'Internal', message: body || res.statusText }
  }
  return res.json()
}
```

- [ ] **Step 4: Run all transport tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm test -- transport.test.ts 2>&1 | tail -15`
Expected: all 6 tests pass (4 original + 2 new).

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/lib/transport/fetch.ts packages/ui/src/lib/transport/transport.test.ts
git commit -m "feat(ui): per-wire URL table in fetch transport (+timeline.* routes)"
```

---

## Task 12: Migrate `use-timeline.ts` hooks to `request()`

**Files:**
- Modify: `packages/ui/src/hooks/use-timeline.ts`

- [ ] **Step 1: Read the current hook file**

Open `packages/ui/src/hooks/use-timeline.ts`. You should see 6 exported hooks each using a `fetchJson` helper.

- [ ] **Step 2: Replace the file contents**

Replace the entire contents with:

```ts
// React Query hooks for timeline analytics — heatmap, events, years, projects, and sync status.
// Backend transport is selected at build time via packages/ui/src/lib/transport.ts.
import { useQuery } from '@tanstack/react-query'

import { request } from '@/lib/transport'

/** Allowed aggregation metrics for the timeline heatmap. */
export type TimelineMetric = 'sessions' | 'tokens' | 'turns'

/** A single data point in the heatmap response. */
export interface HeatmapPoint {
  date: string
  value: number
}

/** A single coding session row from the timeline database. */
export interface SessionRow {
  session_id: string
  project: string
  started_at: number
  ended_at: number
  duration_ms: number
  turns: number
  tokens_input: number
  tokens_output: number
  tokens_cached: number
  summary: string | null
  summary_source: string
  transcript_path: string
  last_offset: number
  ingested_at: number
  model: string | null
  agent_name: string | null
}

/** Sessions grouped by project, with aggregated counts. */
export interface ProjectGroup {
  project: string
  sessions: SessionRow[]
  session_count: number
  turn_count: number
  token_count: number
  tool_count: number
  skill_count: number
  agents: string[]
}

/** All sessions for a single day, grouped by project. */
export interface DayEvents {
  day: string
  projectGroups: ProjectGroup[]
  session_count: number
  turn_count: number
  token_count: number
}

/** Paginated result of day-grouped session events. */
export interface EventsResult {
  days: DayEvents[]
  nextCursor?: string
}

/** Timeline database status — total sessions and last sync timestamp. */
export interface TimelineStatus {
  sessionCount: number
  lastSyncAt: number | null
}

/** Converts an ISO date string (`YYYY-MM-DD`) to UTC midnight milliseconds. */
function isoDateToUtcMs(date: string): number {
  return Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
  )
}

// The Rust backend returns events with `project_groups` (snake_case) but the
// React UI consumes `projectGroups` (camelCase). The TS server already
// returns camelCase. Normalize at the boundary so the rest of the app
// doesn't care which transport served the request.
function normalizeEvents(raw: unknown): EventsResult {
  const r = raw as { days?: unknown[]; nextCursor?: string; next_cursor?: string }
  const days = (r.days ?? []).map((d) => {
    const dd = d as Record<string, unknown>
    const groups = (dd.projectGroups ?? dd.project_groups ?? []) as unknown[]
    return {
      day: dd.day as string,
      projectGroups: groups as ProjectGroup[],
      session_count: dd.session_count as number,
      turn_count: dd.turn_count as number,
      token_count: dd.token_count as number,
    }
  })
  return { days, nextCursor: r.nextCursor ?? r.next_cursor }
}

/** Query hook for the list of years that have timeline data. */
export function useTimelineYears() {
  return useQuery({
    queryKey: ['timeline', 'years'],
    queryFn: async () => {
      const r = await request<{ years: number[] }>('timeline.years', {})
      return r.years
    },
  })
}

/** Query hook for the list of projects with timeline data. */
export function useTimelineProjects() {
  return useQuery({
    queryKey: ['timeline', 'projects'],
    queryFn: async () => {
      const r = await request<{ projects: string[] }>('timeline.projects', {})
      return r.projects
    },
  })
}

/** Query hook for timeline database status (session count and last sync). */
export function useTimelineStatus() {
  return useQuery({
    queryKey: ['timeline', 'status'],
    queryFn: async () => {
      // Rust returns { session_count, last_sync_at }; TS server returns
      // { sessionCount, lastSyncAt }. Normalize.
      const raw = await request<Record<string, unknown>>('timeline.status', {})
      return {
        sessionCount: (raw.sessionCount ?? raw.session_count) as number,
        lastSyncAt: (raw.lastSyncAt ?? raw.last_sync_at ?? null) as number | null,
      } satisfies TimelineStatus
    },
  })
}

/**
 * Query hook for the yearly heatmap data.
 */
export function useTimelineHeatmap(params: {
  year: number
  metric: TimelineMetric
  project?: string
}) {
  const { year, metric, project } = params
  const fromMs = isoDateToUtcMs(`${year}-01-01`)
  const toMs = isoDateToUtcMs(`${year}-12-31`)
  return useQuery({
    queryKey: ['timeline', 'heatmap', year, metric, project ?? null],
    queryFn: async () => {
      const r = await request<{ data: HeatmapPoint[] }>('timeline.heatmap', {
        from: fromMs,
        to: toMs,
        metric,
        ...(project ? { project } : {}),
      })
      return r.data
    },
  })
}

/**
 * Date-range variant of {@link useTimelineHeatmap}.
 */
export function useTimelineHeatmapRange(params: {
  from: string
  to: string
  metric: TimelineMetric
  project?: string
}) {
  const { from, to, metric, project } = params
  const fromMs = isoDateToUtcMs(from)
  const toMs = isoDateToUtcMs(to)
  return useQuery({
    queryKey: ['timeline', 'heatmap-range', from, to, metric, project ?? null],
    queryFn: async () => {
      const r = await request<{ data: HeatmapPoint[] }>('timeline.heatmap', {
        from: fromMs,
        to: toMs,
        metric,
        ...(project ? { project } : {}),
      })
      return r.data
    },
  })
}

/**
 * Query hook for paginated session events grouped by day.
 */
export function useTimelineEvents(params: { project?: string; year?: number }) {
  const { project, year } = params
  const args: Record<string, unknown> = { limit: 60 }
  if (project) {
    args.project = project
  }
  if (year !== undefined) {
    args.from = isoDateToUtcMs(`${year}-01-01`)
    args.to = isoDateToUtcMs(`${year}-12-31`)
  }
  return useQuery({
    queryKey: ['timeline', 'events', project ?? null, year ?? null],
    queryFn: async () => normalizeEvents(await request<unknown>('timeline.events', args)),
  })
}
```

- [ ] **Step 3: Run the existing timeline hook tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm test -- use-timeline.test.tsx 2>&1 | tail -15`
Expected: tests likely fail because they mocked `fetch()` directly. We'll fix them in Task 13.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/hooks/use-timeline.ts
git commit -m "feat(ui): use-timeline routes through transport seam (timeline.* wires)"
```

---

## Task 13: Update `use-timeline.test.tsx` to use the mock transport

**Files:**
- Modify: `packages/ui/src/hooks/use-timeline.test.tsx`

- [ ] **Step 1: Read the current test file**

Open `packages/ui/src/hooks/use-timeline.test.tsx`. Note what it currently mocks (likely `fetch` via `vi.spyOn` or `globalThis.fetch`).

- [ ] **Step 2: Replace the file contents**

Replace the entire contents of `packages/ui/src/hooks/use-timeline.test.tsx` with:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import {
  useTimelineEvents,
  useTimelineHeatmap,
  useTimelineHeatmapRange,
  useTimelineProjects,
  useTimelineStatus,
  useTimelineYears,
} from './use-timeline'
import {
  __setTransportForTests,
  resetTransportForTests,
} from '@/lib/transport'
import { resetMock, setMockHandler } from '@/lib/transport/mock'

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  __setTransportForTests('mock')
})

afterEach(() => {
  resetMock()
  resetTransportForTests()
})

describe('useTimelineYears', () => {
  it('returns the years array unwrapped from the response envelope', async () => {
    setMockHandler('timeline.years', async () => ({ years: [2024, 2025, 2026] }))
    const { result } = renderHook(() => useTimelineYears(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([2024, 2025, 2026])
  })
})

describe('useTimelineProjects', () => {
  it('returns the projects array unwrapped from the response envelope', async () => {
    setMockHandler('timeline.projects', async () => ({ projects: ['a', 'b'] }))
    const { result } = renderHook(() => useTimelineProjects(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(['a', 'b'])
  })
})

describe('useTimelineStatus', () => {
  it('normalizes camelCase keys from the TS server', async () => {
    setMockHandler('timeline.status', async () => ({
      sessionCount: 7,
      lastSyncAt: 1700000000000,
    }))
    const { result } = renderHook(() => useTimelineStatus(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ sessionCount: 7, lastSyncAt: 1700000000000 })
  })

  it('normalizes snake_case keys from the Rust backend', async () => {
    setMockHandler('timeline.status', async () => ({
      session_count: 9,
      last_sync_at: 1700000000001,
    }))
    const { result } = renderHook(() => useTimelineStatus(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ sessionCount: 9, lastSyncAt: 1700000000001 })
  })
})

describe('useTimelineHeatmap', () => {
  it('sends from/to ms for a calendar year and unwraps data', async () => {
    let captured: unknown = null
    setMockHandler('timeline.heatmap', async (args) => {
      captured = args
      return { data: [{ date: '2026-01-01', value: 5 }] }
    })
    const { result } = renderHook(
      () => useTimelineHeatmap({ year: 2026, metric: 'tokens' }),
      { wrapper: wrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([{ date: '2026-01-01', value: 5 }])
    const a = captured as { from: number; to: number; metric: string }
    expect(a.metric).toBe('tokens')
    expect(a.from).toBe(Date.UTC(2026, 0, 1))
    expect(a.to).toBe(Date.UTC(2026, 11, 31))
  })

  it('includes project arg when provided', async () => {
    let captured: unknown = null
    setMockHandler('timeline.heatmap', async (args) => {
      captured = args
      return { data: [] }
    })
    renderHook(
      () => useTimelineHeatmap({ year: 2026, metric: 'sessions', project: 'x' }),
      { wrapper: wrapper() },
    )
    await waitFor(() => {
      expect((captured as { project?: string } | null)?.project).toBe('x')
    })
  })
})

describe('useTimelineHeatmapRange', () => {
  it('sends arbitrary date range as from/to ms', async () => {
    let captured: unknown = null
    setMockHandler('timeline.heatmap', async (args) => {
      captured = args
      return { data: [{ date: '2026-05-01', value: 100 }] }
    })
    const { result } = renderHook(
      () => useTimelineHeatmapRange({
        from: '2026-04-15', to: '2026-05-15', metric: 'tokens',
      }),
      { wrapper: wrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const a = captured as { from: number; to: number }
    expect(a.from).toBe(Date.UTC(2026, 3, 15))
    expect(a.to).toBe(Date.UTC(2026, 4, 15))
  })
})

describe('useTimelineEvents', () => {
  it('normalizes snake_case project_groups from Rust to camelCase', async () => {
    setMockHandler('timeline.events', async () => ({
      days: [
        {
          day: '2026-05-01',
          project_groups: [{
            project: 'a',
            sessions: [],
            session_count: 1,
            turn_count: 2,
            token_count: 3,
            tool_count: 0,
            skill_count: 0,
            agents: [],
          }],
          session_count: 1,
          turn_count: 2,
          token_count: 3,
        },
      ],
      next_cursor: '2026-05-01',
    }))
    const { result } = renderHook(() => useTimelineEvents({}), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.days[0].projectGroups).toHaveLength(1)
    expect(result.current.data?.nextCursor).toBe('2026-05-01')
  })

  it('accepts camelCase from the TS server unchanged', async () => {
    setMockHandler('timeline.events', async () => ({
      days: [
        {
          day: '2026-05-01',
          projectGroups: [],
          session_count: 0,
          turn_count: 0,
          token_count: 0,
        },
      ],
      nextCursor: undefined,
    }))
    const { result } = renderHook(() => useTimelineEvents({}), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.days[0].day).toBe('2026-05-01')
  })
})
```

- [ ] **Step 3: Run the hook tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm test -- use-timeline.test.tsx 2>&1 | tail -15`
Expected: all tests pass.

- [ ] **Step 4: Run the full UI test suite**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm test 2>&1 | tail -10`
Expected: all UI tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/hooks/use-timeline.test.tsx
git commit -m "test(ui): use-timeline tests use mock transport (both casings covered)"
```

---

## Task 14: Add `useFsChanged()` hook and wire it from `MenubarPage`

**Files:**
- Create: `packages/ui/src/hooks/use-fs-changed.ts`
- Modify: `packages/ui/src/components/menubar/menubar-page.tsx`

- [ ] **Step 1: Create the hook**

Create `packages/ui/src/hooks/use-fs-changed.ts`:

```ts
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

interface FsEvent {
  kind: 'timeline_db' | 'claude_home'
  path: string
}

/**
 * Subscribe to backend `fs:changed` events and invalidate related React
 * Query keys so views re-fetch automatically.
 *
 * No-ops when running outside Tauri (web dev loop) — the dynamic import
 * fails gracefully without crashing the hook.
 */
export function useFsChanged(): void {
  const qc = useQueryClient()

  useEffect(() => {
    let unlisten: (() => void) | null = null
    let cancelled = false

    void (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event')
        const off = await listen<FsEvent>('fs:changed', (ev) => {
          if (ev.payload.kind === 'timeline_db') {
            void qc.invalidateQueries({ queryKey: ['timeline'] })
          }
          // claude_home invalidation is wired by later slices that own
          // those query keys (profiles, agents, etc.).
        })
        if (cancelled) {
          off()
        }
        else {
          unlisten = off
        }
      }
      catch {
        // Not running inside Tauri — nothing to subscribe to.
      }
    })()

    return () => {
      cancelled = true
      if (unlisten) {
        unlisten()
      }
    }
  }, [qc])
}
```

- [ ] **Step 2: Use the hook in MenubarPage**

Open `packages/ui/src/components/menubar/menubar-page.tsx`. In the import block at the top, after the existing imports, add:

```tsx
import { useFsChanged } from '@/hooks/use-fs-changed'
```

Inside the `MenubarPage` function, at the very top (right after `export function MenubarPage() {`), add:

```tsx
  useFsChanged()
```

- [ ] **Step 3: Verify the existing menubar test still passes**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm test -- menubar-page.test.tsx 2>&1 | tail -10`
Expected: tests pass. The dynamic `import('@tauri-apps/api/event')` will fail at test time (no such alias) and silently swallow — exactly what we want.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/hooks/use-fs-changed.ts packages/ui/src/components/menubar/menubar-page.tsx
git commit -m "feat(ui): useFsChanged hook + wire from popover for live timeline refresh"
```

---

## Task 15: Add the contract-test fixture (frozen SQLite + expected JSON)

**Files:**
- Create: `tests/fixtures/timeline-contract/seed.sql`
- Create: `tests/fixtures/timeline-contract/expected/heatmap-tokens.json`
- Create: `tests/fixtures/timeline-contract/expected/events-page1.json`
- Create: `tests/fixtures/timeline-contract/expected/years.json`
- Create: `tests/fixtures/timeline-contract/expected/projects.json`
- Create: `tests/fixtures/timeline-contract/expected/status.json`
- Create: `tests/fixtures/timeline-contract/README.md`

- [ ] **Step 1: Write the seed SQL**

Create `tests/fixtures/timeline-contract/seed.sql`:

```sql
-- Frozen timeline DB seed for the slice-2 contract test.
-- Both the TS query layer and the Rust core read this DB and must
-- produce JSON identical to the expected/*.json files alongside it.
-- See README.md for regeneration steps.

CREATE TABLE sessions (
  session_id        TEXT PRIMARY KEY,
  project           TEXT NOT NULL,
  agent_name        TEXT,
  started_at        INTEGER NOT NULL,
  ended_at          INTEGER NOT NULL,
  duration_ms       INTEGER NOT NULL,
  turns             INTEGER NOT NULL,
  tokens_input      INTEGER NOT NULL DEFAULT 0,
  tokens_output     INTEGER NOT NULL DEFAULT 0,
  tokens_cached     INTEGER NOT NULL DEFAULT 0,
  summary           TEXT,
  summary_source    TEXT NOT NULL,
  transcript_path   TEXT NOT NULL,
  last_offset       INTEGER NOT NULL,
  ingested_at       INTEGER NOT NULL,
  model             TEXT
);

CREATE TABLE session_tools (
  session_id  TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  tool_name   TEXT NOT NULL,
  call_count  INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (session_id, tool_name)
);

CREATE TABLE session_skills (
  session_id  TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  skill_name  TEXT NOT NULL,
  PRIMARY KEY (session_id, skill_name)
);

CREATE TABLE meta (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

-- 2026-01-01 00:00:00 UTC = 1767225600000
-- 2026-01-02 00:00:00 UTC = 1767312000000
-- 2026-01-03 00:00:00 UTC = 1767398400000

INSERT INTO sessions VALUES
  ('s1', 'proj-a', 'claude', 1767225601000, 1767225700000, 99000, 10, 100, 50, 25, 'first session', 'auto', '/t/s1.jsonl', 0, 1767225700000, 'claude-sonnet-4'),
  ('s2', 'proj-b', 'claude', 1767225602000, 1767225800000, 198000, 20, 200, 100, 50, 'second', 'first_message', '/t/s2.jsonl', 0, 1767225800000, 'claude-sonnet-4'),
  ('s3', 'proj-a', 'opencode', 1767398401000, 1767398500000, 99000, 5, 30, 15, 5, 'third', 'auto', '/t/s3.jsonl', 0, 1767398500000, 'gpt-4');

INSERT INTO session_tools VALUES
  ('s1', 'Read', 4),
  ('s1', 'Bash', 2),
  ('s2', 'Edit', 7),
  ('s3', 'Read', 1);

INSERT INTO session_skills VALUES
  ('s1', 'investigate'),
  ('s2', 'qa');

INSERT INTO meta VALUES ('last_sync_at', '1767398600000');
```

- [ ] **Step 2: Write the expected JSON outputs**

Create `tests/fixtures/timeline-contract/expected/heatmap-tokens.json`:

```json
{
  "data": [
    { "date": "2026-01-01", "value": 525 },
    { "date": "2026-01-02", "value": 0 },
    { "date": "2026-01-03", "value": 50 }
  ]
}
```

Create `tests/fixtures/timeline-contract/expected/years.json`:

```json
{ "years": [2026] }
```

Create `tests/fixtures/timeline-contract/expected/projects.json`:

```json
{ "projects": ["proj-a", "proj-b"] }
```

Create `tests/fixtures/timeline-contract/expected/status.json`:

```json
{ "sessionCount": 3, "lastSyncAt": 1767398600000 }
```

Create `tests/fixtures/timeline-contract/expected/events-page1.json`:

```json
{
  "days": [
    {
      "day": "2026-01-03",
      "projectGroups": [
        {
          "project": "proj-a",
          "sessionCount": 1,
          "turnCount": 5,
          "tokenCount": 50,
          "toolCount": 1,
          "skillCount": 0,
          "agents": ["opencode"]
        }
      ],
      "sessionCount": 1,
      "turnCount": 5,
      "tokenCount": 50
    },
    {
      "day": "2026-01-01",
      "projectGroups": [
        {
          "project": "proj-b",
          "sessionCount": 1,
          "turnCount": 20,
          "tokenCount": 350,
          "toolCount": 7,
          "skillCount": 1,
          "agents": ["claude"]
        },
        {
          "project": "proj-a",
          "sessionCount": 1,
          "turnCount": 10,
          "tokenCount": 175,
          "toolCount": 6,
          "skillCount": 1,
          "agents": ["claude"]
        }
      ],
      "sessionCount": 2,
      "turnCount": 30,
      "tokenCount": 525
    }
  ]
}
```

Note: the events expected JSON intentionally strips the `sessions[]` arrays (they contain the raw rows and would explode the file). The contract test only compares the aggregated fields per day/project. Both implementations include the rows; the test extracts the aggregated subset before comparing.

- [ ] **Step 3: Write the README**

Create `tests/fixtures/timeline-contract/README.md`:

```markdown
# Timeline Contract Test Fixtures

Frozen inputs + expected outputs for the slice-2 desktop-migration contract test.
The TS `packages/timeline` query layer and the Rust `ohmyc-core::timeline` module
both read `seed.sql` and must produce JSON identical (after the
aggregated-projection step) to the files in `expected/`.

Both test sides:
- Build a fresh in-memory SQLite DB from `seed.sql`.
- Run the same queries (heatmap with `from=2026-01-01, to=2026-01-03, metric=tokens`,
  events with no filters, years, projects, status).
- Project to the comparable shape (strip `sessions[]` from events, normalize
  camelCase vs snake_case keys).
- `assertEqual` against the `expected/*.json` file.

To regenerate the expected outputs after intentional schema changes:
1. Update `seed.sql` and the test query parameters.
2. Run the TS contract test once with a "write expected on mismatch" env flag
   (see `packages/timeline/tests/contract.test.ts`).
3. Manually inspect the diff; commit if intentional.
4. Run the Rust contract test (`cargo test -p ohmyc-core --test timeline_contract`)
   and confirm it agrees.

Drop this directory when slice 7 (Cleanup) deletes `packages/cli/src/server`
and the TS `packages/timeline` query layer is no longer used by any UI.
```

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/timeline-contract/
git commit -m "test: contract fixture (seed.sql + expected JSON) for timeline parity"
```

---

## Task 16: Write the Rust contract test

**Files:**
- Create: `crates/ohmyc-core/tests/timeline_contract.rs`

- [ ] **Step 1: Write the test**

Create `crates/ohmyc-core/tests/timeline_contract.rs`:

```rust
//! Slice-2 contract test: assert ohmyc-core::timeline produces JSON
//! identical (after the comparable-projection step) to the fixtures
//! under tests/fixtures/timeline-contract/expected/.

use std::path::PathBuf;

use ohmyc_core::timeline::{
    self, EventsQuery, HeatmapQuery, Metric,
};
use rusqlite::Connection;
use serde_json::{json, Value};

fn workspace_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf()
}

fn load_seed_db() -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    let sql = std::fs::read_to_string(
        workspace_root().join("tests/fixtures/timeline-contract/seed.sql"),
    )
    .unwrap();
    conn.execute_batch(&sql).unwrap();
    conn
}

fn expected(name: &str) -> Value {
    let path = workspace_root().join(format!("tests/fixtures/timeline-contract/expected/{name}"));
    serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap()
}

#[test]
fn heatmap_tokens_matches_fixture() {
    let conn = load_seed_db();
    let data = timeline::heatmap(
        &conn,
        HeatmapQuery {
            from: "2026-01-01".into(),
            to: "2026-01-03".into(),
            metric: Metric::Tokens,
            project: None,
        },
    )
    .unwrap();
    let actual = json!({ "data": data });
    assert_eq!(actual, expected("heatmap-tokens.json"));
}

#[test]
fn years_matches_fixture() {
    let conn = load_seed_db();
    let years = timeline::years(&conn).unwrap();
    assert_eq!(json!({ "years": years }), expected("years.json"));
}

#[test]
fn projects_matches_fixture() {
    let conn = load_seed_db();
    let projects = timeline::projects(&conn).unwrap();
    assert_eq!(json!({ "projects": projects }), expected("projects.json"));
}

#[test]
fn status_matches_fixture() {
    let conn = load_seed_db();
    let s = timeline::status(&conn).unwrap();
    let actual = json!({
        "sessionCount": s.session_count,
        "lastSyncAt": s.last_sync_at,
    });
    assert_eq!(actual, expected("status.json"));
}

#[test]
fn events_aggregates_match_fixture() {
    let conn = load_seed_db();
    let result = timeline::events(
        &conn,
        EventsQuery { from: None, to: None, project: None, limit: None, cursor: None },
    )
    .unwrap();

    // Project to the comparable shape (drop sessions[], rename to camelCase).
    let days: Vec<Value> = result
        .days
        .into_iter()
        .map(|d| {
            let groups: Vec<Value> = d
                .project_groups
                .into_iter()
                .map(|g| {
                    json!({
                        "project": g.project,
                        "sessionCount": g.session_count,
                        "turnCount": g.turn_count,
                        "tokenCount": g.token_count,
                        "toolCount": g.tool_count,
                        "skillCount": g.skill_count,
                        "agents": g.agents,
                    })
                })
                .collect();
            json!({
                "day": d.day,
                "projectGroups": groups,
                "sessionCount": d.session_count,
                "turnCount": d.turn_count,
                "tokenCount": d.token_count,
            })
        })
        .collect();

    let actual = json!({ "days": days });
    assert_eq!(actual, expected("events-page1.json"));
}
```

- [ ] **Step 2: Run the contract test**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --test timeline_contract 2>&1 | tail -15`
Expected: 5 tests pass.

If a test fails, the diff is the canonical "behavior divergence" signal. Fix the implementation (not the fixture) unless the fixture is provably wrong.

- [ ] **Step 3: Commit**

```bash
git add crates/ohmyc-core/tests/timeline_contract.rs
git commit -m "test(core): Rust contract test against frozen timeline fixture"
```

---

## Task 17: Write the TS contract test (sanity bridge)

**Files:**
- Create: `packages/timeline/tests/contract.test.ts`

- [ ] **Step 1: Write the test**

Create `packages/timeline/tests/contract.test.ts`:

```ts
// Slice-2 contract test (TS side). Mirrors crates/ohmyc-core/tests/timeline_contract.rs:
// both impls must produce identical JSON after the comparable-projection step.
// See tests/fixtures/timeline-contract/README.md.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'

import {
  getEvents,
  getHeatmap,
  getProjects,
  getStatus,
  getYears,
} from '../src/query.js'

const fixturesDir = resolve(import.meta.dirname, '../../../tests/fixtures/timeline-contract')

function loadSeedDb() {
  const db = new Database(':memory:')
  const sql = readFileSync(resolve(fixturesDir, 'seed.sql'), 'utf-8')
  db.exec(sql)
  return db
}

function expected(name: string) {
  return JSON.parse(readFileSync(resolve(fixturesDir, 'expected', name), 'utf-8'))
}

describe('timeline contract (TS side)', () => {
  it('heatmap tokens matches fixture', () => {
    const db = loadSeedDb()
    const data = getHeatmap(db, {
      from: '2026-01-01', to: '2026-01-03', metric: 'tokens',
    })
    expect({ data }).toEqual(expected('heatmap-tokens.json'))
    db.close()
  })

  it('years matches fixture', () => {
    const db = loadSeedDb()
    expect({ years: getYears(db) }).toEqual(expected('years.json'))
    db.close()
  })

  it('projects matches fixture', () => {
    const db = loadSeedDb()
    expect({ projects: getProjects(db) }).toEqual(expected('projects.json'))
    db.close()
  })

  it('status matches fixture', () => {
    const db = loadSeedDb()
    const s = getStatus(db)
    expect({ sessionCount: s.sessionCount, lastSyncAt: s.lastSyncAt }).toEqual(
      expected('status.json'),
    )
    db.close()
  })

  it('events aggregates match fixture', () => {
    const db = loadSeedDb()
    const result = getEvents(db, {})
    const days = result.days.map(d => ({
      day: d.day,
      projectGroups: d.projectGroups.map(g => ({
        project: g.project,
        sessionCount: g.session_count,
        turnCount: g.turn_count,
        tokenCount: g.token_count,
        toolCount: g.tool_count,
        skillCount: g.skill_count,
        agents: g.agents,
      })),
      sessionCount: d.session_count,
      turnCount: d.turn_count,
      tokenCount: d.token_count,
    }))
    expect({ days }).toEqual(expected('events-page1.json'))
    db.close()
  })
})
```

- [ ] **Step 2: Run the TS contract test**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/timeline && pnpm test -- contract.test.ts 2>&1 | tail -15`
Expected: 5 tests pass. If either side fails, the implementations have diverged — investigate immediately.

- [ ] **Step 3: Commit**

```bash
git add packages/timeline/tests/contract.test.ts
git commit -m "test(timeline): TS contract test against the same frozen fixture"
```

---

## Task 18: Render the full app in the main window, default to `/timeline`

Today both windows load `index.html` → `main.tsx` → `<Menubar />`. The main
window therefore renders the popover, not the full app. We branch on the
Tauri window label: popover stays on `<Menubar />`; main window mounts the
full `<App />` from `@ohmyc/ui` with the initial path seeded to `/timeline`.

Default route flips to `/timeline` only for the main window; the underlying
catch-all in `app.tsx` (redirects `*` to `/profiles`) stays untouched so the
web build is unaffected. Reverted in Slice 7 once Profiles is migrated.

**Files:**
- Modify: `packages/desktop/src/main.tsx` — branch by window label; seed initial path.
- Modify: `packages/desktop/index.html` — no functional change, comment noting both windows load it.

- [ ] **Step 1: Replace `packages/desktop/src/main.tsx`**

Replace the entire contents of `packages/desktop/src/main.tsx` with:

```tsx
import '@ohmyc/ui/globals.css'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import { Menubar } from './menubar'
import { App } from '@ohmyc/ui/app'

const docStyle = document.documentElement.style
const bodyStyle = document.body.style

/**
 * Tauri opens the popover and main windows with the same WebviewUrl
 * (`index.html`). We branch on the window label here:
 *  - `popover` → transparent body, rounded-corner mask, render <Menubar />.
 *  - `main`    → opaque body, normal scroll, render full <App /> with
 *                initial route seeded to `/timeline` (slice 2 default;
 *                reverted in slice 7 when Profiles is migrated).
 */
const label = getCurrentWebviewWindow().label

if (label === 'main') {
  bodyStyle.margin = '0'
  bodyStyle.background = 'var(--bg-marketing)'

  // Seed initial route to /timeline before BrowserRouter reads window.location.
  // The catch-all in app.tsx redirects `*` to `/profiles`, so we only override
  // when the navigated path is the root.
  if (globalThis.location.pathname === '/') {
    globalThis.history.replaceState(null, '', '/timeline')
  }

  const queryClient = new QueryClient({
    defaultOptions: { queries: { refetchOnWindowFocus: false } },
  })

  ReactDOM.createRoot(document.querySelector('#root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </BrowserRouter>
    </React.StrictMode>,
  )
}
else {
  // Popover styling — transparent for the macOS vibrancy compositor + rounded
  // corner mask + no scroll bounce.
  docStyle.background = 'transparent'
  bodyStyle.background = 'transparent'
  docStyle.overscrollBehavior = 'none'
  bodyStyle.overscrollBehavior = 'none'
  docStyle.overflow = 'hidden'
  bodyStyle.overflow = 'hidden'
  docStyle.height = '100vh'
  bodyStyle.height = '100vh'
  bodyStyle.margin = '0'

  ReactDOM.createRoot(document.querySelector('#root')!).render(
    <React.StrictMode>
      <Menubar />
    </React.StrictMode>,
  )
}
```

- [ ] **Step 2: Verify the `@ohmyc/ui/app` subpath export exists**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && grep -nE '"./(app|components|hooks|state|lib)' packages/ui/package.json`
Expected: an `exports` map entry for `./components/*`, `./hooks/*`, etc., but probably NOT `./app`.

If `./app` is missing, open `packages/ui/package.json`, find the `"exports"` object, and add:

```json
    "./app": "./src/app.tsx",
```

(insert as a sibling of the existing `./components/*`, `./hooks/*`, etc. entries.)

- [ ] **Step 3: Build desktop and confirm no TypeScript errors**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/desktop && pnpm build 2>&1 | tail -10`
Expected: build succeeds. If it errors on a missing `@ohmyc/ui/app` import, Step 2 didn't add the export — fix and retry.

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/src/main.tsx packages/ui/package.json
git commit -m "feat(desktop): split main.tsx by window label; main window defaults to /timeline"
```

---

## Task 19: Manual smoke test

**Files:** none

- [ ] **Step 1: Start the desktop app**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm --filter @ohmyc/desktop tauri dev`

- [ ] **Step 2: Verify the popover loads real data**

Click the tray icon. The popover renders header + chart + footer with real values (whatever your local `~/.config/ohmyc/timeline.db` contains). If you have no DB yet, run `pnpm cli dashboard --install` first to register the Claude Code plugin and let it generate one.

Expected: numbers in the header match what the chart shows; no console errors about `/api/timeline/...`.

- [ ] **Step 3: Verify the main window opens directly on `/timeline`**

Click `Open OhMyC →`. The main window opens. Expected:
- The window title bar reads `OhMyC` (not the popover's chrome).
- The landing view is the Timeline page — NOT the popover content, NOT a broken Profiles screen.
- The URL bar (if dev tools open) shows `tauri://localhost/timeline` or equivalent.
- Heatmap, year picker, project filter, and event list render — all sourced via `invoke('timeline.*')`, not HTTP.

If the main window shows the popover content, Task 18 Step 1 wasn't applied correctly. If it shows the broken `/profiles` screen, the initial-path seed in Task 18 didn't take — check the `replaceState` line.

Expected: heatmap cells light up correctly; event list shows sessions grouped by day → project.

- [ ] **Step 4: Verify live updates**

Leave the popover open. From a terminal, write to the DB:

```bash
sqlite3 ~/.config/ohmyc/timeline.db "UPDATE meta SET value = strftime('%s', 'now') || '000' WHERE key = 'last_sync_at';"
```

Within ~1 second, the timeline status query should re-fetch (popover chart values may update if you also insert a session).

Expected: no manual refresh required; React Query refetches because `fs:changed` fires.

- [ ] **Step 5: Verify web dev still works**

In a separate terminal: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/cli && pnpm dev` (starts the legacy HTTP server). Then: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm dev` (starts the web UI on 5173).

Open `http://localhost:5173/timeline`. The page should render identically — using the `fetch` transport against `/api/timeline/*` proxied to `127.0.0.1:3000`.

Expected: timeline page works in the browser. If it errors, the per-wire URL table in `fetch.ts` is wrong — fix it.

- [ ] **Step 6: Verify the contract test catches divergence**

(Optional but recommended.) Temporarily change the Rust implementation in a small way — e.g. add `+ 1` to the token sum in `heatmap`. Run `cargo test -p ohmyc-core --test timeline_contract` and confirm the heatmap test fails with a clear diff. Revert.

Expected: the contract test catches the change.

- [ ] **Step 7: Report**

If any step failed, note which one. Do not mark this task complete until all 6 actionable steps pass (step 6 is optional).

---

## Done criteria for Slice 2

- `cargo test --workspace` green (all timeline + watcher + contract tests pass).
- `pnpm -r test` green (UI hook tests use the mock transport; TS contract test passes).
- `pnpm tauri build --target aarch64-apple-darwin` produces a binary.
- Manual smoke (Task 19) steps 1-5 pass.
- Main window opens directly on `/timeline` (not the popover content, not the broken `/profiles` screen).
- The TS server's `/api/timeline/*` routes are still alive and still serve the web dev loop. They will be deleted in Slice 7 (Cleanup).
- The `use-timeline.ts` hook file no longer contains the word `fetch(` (verify: `grep -n 'fetch(' packages/ui/src/hooks/use-timeline.ts` returns nothing).

---

## What this slice does NOT do (intentional)

- Does not migrate any non-timeline hook. `use-profiles.ts`, `use-agents.ts`, etc. still call `fetch()` and rely on the TS server. They flip in Slices 3-6.
- Does not delete the TS timeline route file (`packages/cli/src/server/routes/timeline.ts`) or its tests. They keep `pnpm dev` working until Slice 7.
- Does not handle write endpoints (no timeline writes exist; later slices add the routing table support for POST/PUT/DELETE).
- Does not surface `fs:changed` errors to the UI — the watcher silently no-ops if `default_watch_paths` fails. This is intentional: a missing DB or claude-home should not crash the popover.
- Does not change `app.tsx`'s default catch-all (which still redirects `*` → `/profiles`). The slice-2 `/timeline` landing is a Tauri-only override implemented via `replaceState` in `packages/desktop/src/main.tsx` before BrowserRouter mounts. Reverted in Slice 7 once Profiles is migrated and `/profiles` works inside the desktop.
