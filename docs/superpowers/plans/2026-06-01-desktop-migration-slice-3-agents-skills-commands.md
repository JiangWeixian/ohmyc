# Desktop Migration — Slice 3: Agents + Skills + Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every read in `use-agents.ts`, `use-skills.ts`, `use-commands.ts` off the TS `/api/{agents,skills,commands}*` routes onto native Rust Tauri commands that scan global `~/.claude/{agents,skills,commands}` directories, parse YAML frontmatter + Markdown body, and emit React Query invalidations on file changes via the existing recursive watcher. Lights up the read-only Explorer surfaces inside the desktop main window.

**Architecture:** New `ohmyc-core::components` namespace with three submodules — `agents` (single `.md` files), `skills` (per-skill directories with `SKILL.md`), `commands` (single `.md` files) — each exposing `list()` and `get(name)`. Frontmatter is parsed with the `gray_matter` crate and surfaced as `serde_json::Value` to preserve the open-ended schema. Each entity returns the same shape the TS server returns *minus* enrichments (badges, pluginId, provenance, opencode origin) so the desktop renders a strict subset until later slices fill those in. The transport seam grows by 6 wires; `useFsChanged` extends invalidation to claude-home events. No writes in this slice — Profiles (slice 6) lands the write-endpoint shape.

**Tech Stack:** Rust (`gray_matter` 0.2, `serde_json` for arbitrary-shape frontmatter, `walkdir` for skill-dir scan, `tempfile` + `rstest` for tests), TypeScript (existing transport + React Query infrastructure).

---

## File Structure

**New files:**
- `crates/ohmyc-core/src/components/mod.rs` — namespace + shared types (`SafeName`, `Origin`, `Scope`, `ComponentSource`).
- `crates/ohmyc-core/src/components/agents.rs` — `list()` + `get(name)` over `~/.claude/agents/*.md`.
- `crates/ohmyc-core/src/components/skills.rs` — `list()` + `get(name)` over `~/.claude/skills/<name>/SKILL.md`.
- `crates/ohmyc-core/src/components/commands.rs` — `list()` + `get(name)` over `~/.claude/commands/*.md`.
- `crates/ohmyc-core/src/components/frontmatter.rs` — wrapper around `gray_matter` that returns `(serde_json::Value, String)`.
- `packages/desktop/src-tauri/src/api/agents.rs` — Tauri command wrappers (`agents_list`, `agents_get`).
- `packages/desktop/src-tauri/src/api/skills.rs` — Tauri command wrappers.
- `packages/desktop/src-tauri/src/api/commands.rs` — Tauri command wrappers.

**Modified files:**
- `crates/ohmyc-core/Cargo.toml` — add `gray_matter`, `walkdir`.
- `crates/ohmyc-core/src/lib.rs` — `pub mod components;`.
- `packages/desktop/src-tauri/src/api/mod.rs` — `pub mod agents; pub mod skills; pub mod commands;`.
- `packages/desktop/src-tauri/src/main.rs` — register 6 new commands in `invoke_handler!`.
- `packages/ui/src/lib/transport/fetch.ts` — add 6 entries to the `routes` table.
- `packages/ui/src/hooks/use-agents.ts` — flip to `request('agents.*')`.
- `packages/ui/src/hooks/use-skills.ts` — flip to `request('skills.*')`.
- `packages/ui/src/hooks/use-commands.ts` — flip to `request('commands.*')`.
- `packages/ui/src/hooks/use-agents.test.tsx` — use mock transport, cover origins filter.
- `packages/ui/tests/components/explorer/...` (whatever exists today) — adapt only if mocked `fetch` calls break.
- `packages/ui/src/hooks/use-fs-changed.ts` — invalidate `['agents']`, `['skills']`, `['commands']` on `claude_home` events.

---

## Task 1: Add Rust deps for frontmatter parsing and dir walking

**Files:**
- Modify: `crates/ohmyc-core/Cargo.toml`

- [ ] **Step 1: Add the deps**

Open `crates/ohmyc-core/Cargo.toml`. In the `[dependencies]` section, after the existing `chrono = ...` line, append:

```toml
gray_matter = { version = "0.2", default-features = false, features = ["yaml"] }
walkdir = "2"
```

- [ ] **Step 2: Verify the crate still compiles**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo build -p ohmyc-core 2>&1 | tail -5`
Expected: `Finished` — first build downloads `gray_matter` + `walkdir` (~10 s).

- [ ] **Step 3: Commit**

```bash
git add crates/ohmyc-core/Cargo.toml
git commit -m "chore(core): add gray_matter + walkdir for agent/skill/command parsing"
```

---

## Task 2: Add the `components` namespace skeleton + shared types

**Files:**
- Create: `crates/ohmyc-core/src/components/mod.rs`
- Modify: `crates/ohmyc-core/src/lib.rs`

- [ ] **Step 1: Create the namespace module**

Create `crates/ohmyc-core/src/components/mod.rs`:

```rust
//! Component readers (agents / skills / commands) — port of the TS
//! AgentService / SkillService / CommandService, scoped to the
//! globally-installed components under `~/.claude/<type>/`. Plugin and
//! project-local sources are deferred to slice 5 (Plugins).

pub mod agents;
pub mod commands;
pub mod frontmatter;
pub mod skills;

use serde::Serialize;

/// Matches the TS `SAFE_NAME_PATTERN = /^[\w-]+$/` — alphanumerics, `_`, `-`.
/// Used to validate `get(name)` lookups before touching the filesystem.
pub fn is_safe_name(name: &str) -> bool {
    !name.is_empty()
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

/// Where a component was sourced from. Slice 3 only emits `Local`; later
/// slices add `Plugin`, `Profile`, `Project`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ComponentSource {
    Local,
}

/// Origin of the component (the agent runtime that owns it). Slice 3
/// only emits `Claude`; opencode lands when the provider registry is
/// ported. Must serialize lowercase to match the OriginEnum in
/// `@ohmyc/shared/src/provider.ts`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Origin {
    Claude,
}

/// Scope of the component. Slice 3 only emits `Global`; project-local
/// dirs land with a later slice.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Scope {
    Global,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn is_safe_name_accepts_alphanumeric_with_dash_and_underscore() {
        assert!(is_safe_name("agent-1"));
        assert!(is_safe_name("my_skill"));
        assert!(is_safe_name("X9"));
    }

    #[test]
    fn is_safe_name_rejects_dots_slashes_and_empty() {
        assert!(!is_safe_name(""));
        assert!(!is_safe_name("foo.md"));
        assert!(!is_safe_name("../etc/passwd"));
        assert!(!is_safe_name("a/b"));
        assert!(!is_safe_name("with space"));
    }

    #[test]
    fn enums_serialize_lowercase_to_match_ts_origin_enum() {
        assert_eq!(serde_json::to_value(Origin::Claude).unwrap(), "claude");
        assert_eq!(serde_json::to_value(Scope::Global).unwrap(), "global");
        assert_eq!(serde_json::to_value(ComponentSource::Local).unwrap(), "local");
    }
}
```

- [ ] **Step 2: Export the namespace**

Open `crates/ohmyc-core/src/lib.rs`. Replace its contents with:

```rust
//! Domain logic for the OhMyC desktop app. Owns all `~/.claude` and
//! `$OHMYC_HOME` I/O, parsing, and watchers. No Tauri imports —
//! testable standalone.

pub mod claude_home;
pub mod components;
pub mod error;
pub mod timeline;
pub mod watcher;

pub use error::ApiError;
```

- [ ] **Step 3: Run the new tests (the submodules don't exist yet so compilation will fail at the `pub mod` lines)**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo build -p ohmyc-core 2>&1 | tail -10`
Expected: errors like `file not found for module 'agents'`. Next tasks add them.

- [ ] **Step 4: Commit**

```bash
git add crates/ohmyc-core/src/components/mod.rs crates/ohmyc-core/src/lib.rs
git commit -m "feat(core): components namespace + Origin/Scope/ComponentSource enums"
```

---

## Task 3: Add the `frontmatter` helper

**Files:**
- Create: `crates/ohmyc-core/src/components/frontmatter.rs`

- [ ] **Step 1: Write the failing test + implementation together**

Create `crates/ohmyc-core/src/components/frontmatter.rs`:

```rust
//! Thin wrapper over `gray_matter` that returns the frontmatter as a
//! `serde_json::Value` (preserving the open-ended TS schema) and the
//! Markdown body as a trimmed `String`. Files without frontmatter
//! return an empty object + the full raw text as the body.

use gray_matter::engine::YAML;
use gray_matter::Matter;
use serde_json::Value;

use crate::error::ApiError;

/// Parse a raw `.md` source into `(frontmatter, body)`. Mirrors the TS
/// `matter(raw)` behavior:
/// - delimited by `---` (YAML)
/// - missing frontmatter → empty object
/// - body is trimmed
pub fn parse(raw: &str) -> Result<(Value, String), ApiError> {
    let matter = Matter::<YAML>::new();
    let parsed = matter.parse(raw);
    let frontmatter = match parsed.data {
        Some(pod) => pod
            .deserialize::<Value>()
            .map_err(|e| ApiError::Parse(format!("frontmatter: {e}")))?,
        None => Value::Object(serde_json::Map::new()),
    };
    Ok((frontmatter, parsed.content.trim().to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_yaml_frontmatter_and_body() {
        let raw = "---\nname: my-agent\ndescription: does stuff\n---\n\nBody text here.\n";
        let (front, body) = parse(raw).unwrap();
        assert_eq!(front["name"], "my-agent");
        assert_eq!(front["description"], "does stuff");
        assert_eq!(body, "Body text here.");
    }

    #[test]
    fn returns_empty_object_when_no_frontmatter() {
        let raw = "Just plain markdown.\n";
        let (front, body) = parse(raw).unwrap();
        assert!(front.is_object());
        assert_eq!(front.as_object().unwrap().len(), 0);
        assert_eq!(body, "Just plain markdown.");
    }

    #[test]
    fn preserves_arbitrary_frontmatter_fields() {
        let raw = "---\nname: x\ndescription: y\ncustom: [1, 2, 3]\nnested:\n  a: b\n---\nbody\n";
        let (front, _) = parse(raw).unwrap();
        assert_eq!(front["custom"], serde_json::json!([1, 2, 3]));
        assert_eq!(front["nested"]["a"], "b");
    }

    #[test]
    fn errors_on_malformed_yaml() {
        let raw = "---\nname: [unclosed\n---\nbody\n";
        let err = parse(raw).unwrap_err();
        match err {
            ApiError::Parse(msg) => assert!(msg.contains("frontmatter")),
            other => panic!("expected Parse, got {other:?}"),
        }
    }
}
```

- [ ] **Step 2: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib components::frontmatter 2>&1 | tail -10`
Expected: `test result: ok. 4 passed`.

- [ ] **Step 3: Commit**

```bash
git add crates/ohmyc-core/src/components/frontmatter.rs
git commit -m "feat(core): frontmatter parser (gray_matter wrapper)"
```

---

## Task 4: Implement `components::agents` (TDD)

**Files:**
- Create: `crates/ohmyc-core/src/components/agents.rs`

- [ ] **Step 1: Write the failing tests + implementation together**

Create `crates/ohmyc-core/src/components/agents.rs`:

```rust
//! Read global agents from `<claude_home>/agents/*.md`. Mirrors the TS
//! `AgentService::list()` / `get(name)` behavior with one deviation
//! (documented in module-level doc): files whose YAML frontmatter is
//! missing `name` or `description` are SKIPPED, matching TS.

use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::Value;

use super::frontmatter;
use super::{is_safe_name, ComponentSource, Origin, Scope};
use crate::error::ApiError;

#[derive(Debug, Clone, Serialize)]
pub struct Agent {
    pub id: String,
    pub frontmatter: Value,
    pub content: String,
    pub raw: String,
    pub filename: String,
    pub source: ComponentSource,
    pub scope: Scope,
    pub origins: Vec<Origin>,
    /// Always empty in slice 3 — the provider registry that emits
    /// badges hasn't been ported yet.
    pub badges: Vec<Value>,
}

/// List all global agents (files matching `*.md` in `<dir>/`).
///
/// - Skips files whose frontmatter lacks `name` or `description`
///   (TS parity).
/// - Sorts the result by `id` ascending.
/// - Returns `Ok(vec![])` if the directory does not exist.
pub fn list(dir: &Path) -> Result<Vec<Agent>, ApiError> {
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut out: Vec<Agent> = Vec::new();
    for entry in std::fs::read_dir(dir).map_err(ApiError::from)? {
        let entry = entry.map_err(ApiError::from)?;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("md") {
            continue;
        }
        let filename = match path.file_name().and_then(|s| s.to_str()) {
            Some(f) => f.to_string(),
            None => continue,
        };
        let raw = match std::fs::read_to_string(&path) {
            Ok(s) => s,
            Err(_) => continue,
        };
        if let Some(agent) = parse_agent(&filename, &raw)? {
            out.push(agent);
        }
    }
    out.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(out)
}

/// Fetch a single agent by name. Returns `Ok(None)` for invalid names or
/// missing files, mirroring TS `AgentService::get()`.
pub fn get(dir: &Path, name: &str) -> Result<Option<Agent>, ApiError> {
    if !is_safe_name(name) {
        return Ok(None);
    }
    let filename = format!("{name}.md");
    let path: PathBuf = dir.join(&filename);
    let raw = match std::fs::read_to_string(&path) {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };
    parse_agent(&filename, &raw)
}

fn parse_agent(filename: &str, raw: &str) -> Result<Option<Agent>, ApiError> {
    let (frontmatter, content) = frontmatter::parse(raw)?;
    let has_required = frontmatter.get("name").and_then(|v| v.as_str()).is_some()
        && frontmatter.get("description").and_then(|v| v.as_str()).is_some();
    if !has_required {
        return Ok(None);
    }
    let id = filename.trim_end_matches(".md").to_string();
    Ok(Some(Agent {
        id,
        frontmatter,
        content,
        raw: raw.to_string(),
        filename: filename.to_string(),
        source: ComponentSource::Local,
        scope: Scope::Global,
        origins: vec![Origin::Claude],
        badges: Vec::new(),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seeded_dir() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("alpha.md"),
            "---\nname: alpha\ndescription: first\n---\nalpha body",
        )
        .unwrap();
        std::fs::write(
            dir.path().join("zulu.md"),
            "---\nname: zulu\ndescription: last\nmodel: claude-sonnet-4\n---\nzulu body",
        )
        .unwrap();
        // Missing required fields — must be skipped.
        std::fs::write(
            dir.path().join("orphan.md"),
            "---\nname: orphan\n---\nno description here",
        )
        .unwrap();
        // Non-md file — must be ignored.
        std::fs::write(dir.path().join("README.txt"), "not an agent").unwrap();
        dir
    }

    #[test]
    fn list_returns_sorted_valid_agents_and_skips_invalid() {
        let dir = seeded_dir();
        let agents = list(dir.path()).unwrap();
        let ids: Vec<&str> = agents.iter().map(|a| a.id.as_str()).collect();
        assert_eq!(ids, vec!["alpha", "zulu"]);
    }

    #[test]
    fn list_returns_empty_when_dir_missing() {
        let agents = list(Path::new("/nonexistent/path/agents")).unwrap();
        assert!(agents.is_empty());
    }

    #[test]
    fn list_populates_default_origin_scope_source_badges() {
        let dir = seeded_dir();
        let agents = list(dir.path()).unwrap();
        let alpha = agents.iter().find(|a| a.id == "alpha").unwrap();
        assert_eq!(alpha.origins, vec![Origin::Claude]);
        assert_eq!(alpha.scope, Scope::Global);
        assert_eq!(alpha.source, ComponentSource::Local);
        assert!(alpha.badges.is_empty());
        assert_eq!(alpha.filename, "alpha.md");
    }

    #[test]
    fn get_returns_agent_by_name() {
        let dir = seeded_dir();
        let agent = get(dir.path(), "zulu").unwrap().unwrap();
        assert_eq!(agent.id, "zulu");
        assert_eq!(agent.frontmatter["model"], "claude-sonnet-4");
    }

    #[test]
    fn get_returns_none_when_invalid_name() {
        let dir = seeded_dir();
        assert!(get(dir.path(), "../etc/passwd").unwrap().is_none());
        assert!(get(dir.path(), "with space").unwrap().is_none());
        assert!(get(dir.path(), "").unwrap().is_none());
    }

    #[test]
    fn get_returns_none_when_file_missing() {
        let dir = seeded_dir();
        assert!(get(dir.path(), "nonexistent").unwrap().is_none());
    }

    #[test]
    fn get_returns_none_when_required_fields_missing() {
        let dir = seeded_dir();
        // orphan.md has name but no description
        assert!(get(dir.path(), "orphan").unwrap().is_none());
    }
}
```

- [ ] **Step 2: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib components::agents 2>&1 | tail -15`
Expected: `test result: ok. 7 passed`.

- [ ] **Step 3: Commit**

```bash
git add crates/ohmyc-core/src/components/agents.rs
git commit -m "feat(core): components::agents list + get (global ~/.claude/agents)"
```

---

## Task 5: Implement `components::skills` (TDD)

**Files:**
- Create: `crates/ohmyc-core/src/components/skills.rs`

- [ ] **Step 1: Write the failing tests + implementation together**

Create `crates/ohmyc-core/src/components/skills.rs`:

```rust
//! Read global skills from `<claude_home>/skills/<name>/SKILL.md`. Each
//! skill is a directory; the `SKILL.md` file inside holds the
//! frontmatter and Markdown body.
//!
//! Difference from agents (intentional, matches TS `SkillService`):
//! skills do NOT require `name` or `description` in frontmatter — they
//! fall back to the directory name + empty string respectively.

use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::Value;

use super::frontmatter;
use super::{is_safe_name, ComponentSource, Origin, Scope};
use crate::error::ApiError;

const SKILL_FILE: &str = "SKILL.md";

#[derive(Debug, Clone, Serialize)]
pub struct Skill {
    pub id: String,
    pub frontmatter: Value,
    pub content: String,
    pub raw: String,
    #[serde(rename = "dirName")]
    pub dir_name: String,
    pub source: ComponentSource,
    pub scope: Scope,
    pub origins: Vec<Origin>,
    pub badges: Vec<Value>,
}

pub fn list(dir: &Path) -> Result<Vec<Skill>, ApiError> {
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut out: Vec<Skill> = Vec::new();
    for entry in std::fs::read_dir(dir).map_err(ApiError::from)? {
        let entry = entry.map_err(ApiError::from)?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let dir_name = match path.file_name().and_then(|s| s.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };
        let skill_path = path.join(SKILL_FILE);
        let raw = match std::fs::read_to_string(&skill_path) {
            Ok(s) => s,
            Err(_) => continue, // dir without a SKILL.md — skip
        };
        if let Some(skill) = parse_skill(&dir_name, &raw)? {
            out.push(skill);
        }
    }
    out.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(out)
}

pub fn get(dir: &Path, name: &str) -> Result<Option<Skill>, ApiError> {
    if !is_safe_name(name) {
        return Ok(None);
    }
    let skill_path: PathBuf = dir.join(name).join(SKILL_FILE);
    let raw = match std::fs::read_to_string(&skill_path) {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };
    parse_skill(name, &raw)
}

fn parse_skill(dir_name: &str, raw: &str) -> Result<Option<Skill>, ApiError> {
    let (mut frontmatter, content) = frontmatter::parse(raw)?;
    // Fall back to dir name when frontmatter.name is missing/empty.
    let name = frontmatter
        .get("name")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .unwrap_or(dir_name)
        .to_string();
    let description = frontmatter
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if let Some(obj) = frontmatter.as_object_mut() {
        obj.insert("name".to_string(), Value::String(name));
        obj.insert("description".to_string(), Value::String(description));
    }
    Ok(Some(Skill {
        id: dir_name.to_string(),
        frontmatter,
        content,
        raw: raw.to_string(),
        dir_name: dir_name.to_string(),
        source: ComponentSource::Local,
        scope: Scope::Global,
        origins: vec![Origin::Claude],
        badges: Vec::new(),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seeded_dir() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        // alpha — full frontmatter
        let alpha = dir.path().join("alpha");
        std::fs::create_dir(&alpha).unwrap();
        std::fs::write(
            alpha.join("SKILL.md"),
            "---\nname: alpha\ndescription: first skill\n---\nbody",
        )
        .unwrap();
        // bravo — empty frontmatter; falls back to dir name
        let bravo = dir.path().join("bravo");
        std::fs::create_dir(&bravo).unwrap();
        std::fs::write(bravo.join("SKILL.md"), "no frontmatter, just body").unwrap();
        // empty-dir — has no SKILL.md, must be skipped
        std::fs::create_dir(dir.path().join("empty-dir")).unwrap();
        // not-a-dir — top-level file, must be skipped
        std::fs::write(dir.path().join("loose.md"), "noise").unwrap();
        dir
    }

    #[test]
    fn list_returns_sorted_skills_skipping_dirs_without_skill_md() {
        let dir = seeded_dir();
        let skills = list(dir.path()).unwrap();
        let ids: Vec<&str> = skills.iter().map(|s| s.id.as_str()).collect();
        assert_eq!(ids, vec!["alpha", "bravo"]);
    }

    #[test]
    fn list_falls_back_to_dir_name_when_frontmatter_missing() {
        let dir = seeded_dir();
        let skills = list(dir.path()).unwrap();
        let bravo = skills.iter().find(|s| s.id == "bravo").unwrap();
        assert_eq!(bravo.frontmatter["name"], "bravo");
        assert_eq!(bravo.frontmatter["description"], "");
    }

    #[test]
    fn list_returns_empty_when_dir_missing() {
        assert!(list(Path::new("/nonexistent/skills")).unwrap().is_empty());
    }

    #[test]
    fn get_returns_skill_by_name() {
        let dir = seeded_dir();
        let s = get(dir.path(), "alpha").unwrap().unwrap();
        assert_eq!(s.id, "alpha");
        assert_eq!(s.dir_name, "alpha");
        assert_eq!(s.content, "body");
    }

    #[test]
    fn get_returns_none_when_invalid_name_or_missing_dir() {
        let dir = seeded_dir();
        assert!(get(dir.path(), "../bad").unwrap().is_none());
        assert!(get(dir.path(), "nonexistent").unwrap().is_none());
        // empty-dir exists but has no SKILL.md
        assert!(get(dir.path(), "empty-dir").unwrap().is_none());
    }
}
```

- [ ] **Step 2: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib components::skills 2>&1 | tail -15`
Expected: `test result: ok. 5 passed`.

- [ ] **Step 3: Commit**

```bash
git add crates/ohmyc-core/src/components/skills.rs
git commit -m "feat(core): components::skills list + get (~/.claude/skills/<name>/SKILL.md)"
```

---

## Task 6: Implement `components::commands` (TDD)

**Files:**
- Create: `crates/ohmyc-core/src/components/commands.rs`

- [ ] **Step 1: Write the failing tests + implementation together**

Create `crates/ohmyc-core/src/components/commands.rs`:

```rust
//! Read global commands from `<claude_home>/commands/*.md`. File layout
//! mirrors agents (single `.md` per command), but the parsing rule
//! mirrors skills: frontmatter `name` is optional (falls back to filename).

use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::Value;

use super::frontmatter;
use super::{is_safe_name, ComponentSource, Origin, Scope};
use crate::error::ApiError;

#[derive(Debug, Clone, Serialize)]
pub struct Command {
    pub id: String,
    pub frontmatter: Value,
    pub content: String,
    pub raw: String,
    pub filename: String,
    pub source: ComponentSource,
    pub scope: Scope,
    pub origins: Vec<Origin>,
    pub badges: Vec<Value>,
}

pub fn list(dir: &Path) -> Result<Vec<Command>, ApiError> {
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut out: Vec<Command> = Vec::new();
    for entry in std::fs::read_dir(dir).map_err(ApiError::from)? {
        let entry = entry.map_err(ApiError::from)?;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("md") {
            continue;
        }
        let filename = match path.file_name().and_then(|s| s.to_str()) {
            Some(f) => f.to_string(),
            None => continue,
        };
        let raw = match std::fs::read_to_string(&path) {
            Ok(s) => s,
            Err(_) => continue,
        };
        if let Some(cmd) = parse_command(&filename, &raw)? {
            out.push(cmd);
        }
    }
    out.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(out)
}

pub fn get(dir: &Path, name: &str) -> Result<Option<Command>, ApiError> {
    if !is_safe_name(name) {
        return Ok(None);
    }
    let filename = format!("{name}.md");
    let path: PathBuf = dir.join(&filename);
    let raw = match std::fs::read_to_string(&path) {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };
    parse_command(&filename, &raw)
}

fn parse_command(filename: &str, raw: &str) -> Result<Option<Command>, ApiError> {
    let (mut frontmatter, content) = frontmatter::parse(raw)?;
    let id = filename.trim_end_matches(".md").to_string();
    // Fall back to filename-derived id when frontmatter.name is absent.
    let name = frontmatter
        .get("name")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .unwrap_or(&id)
        .to_string();
    if let Some(obj) = frontmatter.as_object_mut() {
        obj.insert("name".to_string(), Value::String(name));
    }
    Ok(Some(Command {
        id,
        frontmatter,
        content,
        raw: raw.to_string(),
        filename: filename.to_string(),
        source: ComponentSource::Local,
        scope: Scope::Global,
        origins: vec![Origin::Claude],
        badges: Vec::new(),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seeded_dir() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("ship.md"),
            "---\nname: ship\ndescription: ship it\n---\nbody",
        )
        .unwrap();
        // No frontmatter — name falls back to filename id.
        std::fs::write(dir.path().join("no-front.md"), "just body").unwrap();
        std::fs::write(dir.path().join("README.txt"), "noise").unwrap();
        dir
    }

    #[test]
    fn list_returns_sorted_commands_including_those_without_frontmatter() {
        let dir = seeded_dir();
        let cmds = list(dir.path()).unwrap();
        let ids: Vec<&str> = cmds.iter().map(|c| c.id.as_str()).collect();
        assert_eq!(ids, vec!["no-front", "ship"]);
    }

    #[test]
    fn list_falls_back_to_id_when_frontmatter_name_missing() {
        let dir = seeded_dir();
        let cmds = list(dir.path()).unwrap();
        let nf = cmds.iter().find(|c| c.id == "no-front").unwrap();
        assert_eq!(nf.frontmatter["name"], "no-front");
    }

    #[test]
    fn get_returns_command_by_name() {
        let dir = seeded_dir();
        let cmd = get(dir.path(), "ship").unwrap().unwrap();
        assert_eq!(cmd.id, "ship");
        assert_eq!(cmd.frontmatter["description"], "ship it");
    }

    #[test]
    fn get_returns_none_for_invalid_or_missing() {
        let dir = seeded_dir();
        assert!(get(dir.path(), "../bad").unwrap().is_none());
        assert!(get(dir.path(), "nonexistent").unwrap().is_none());
    }
}
```

- [ ] **Step 2: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib components::commands 2>&1 | tail -10`
Expected: `test result: ok. 4 passed`.

- [ ] **Step 3: Confirm the full crate test suite is green**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core 2>&1 | tail -10`
Expected: all tests pass (previous Rust tests + components: frontmatter 4 + agents 7 + skills 5 + commands 4 + mod 3 = 23 new in this slice).

- [ ] **Step 4: Commit**

```bash
git add crates/ohmyc-core/src/components/commands.rs
git commit -m "feat(core): components::commands list + get (~/.claude/commands/*.md)"
```

---

## Task 7: Add helper to resolve the global component dir

**Files:**
- Modify: `crates/ohmyc-core/src/components/mod.rs`

The Tauri commands need to know the on-disk path for each component type. Centralize the path-resolution logic so individual modules don't all reach into `claude_home`.

- [ ] **Step 1: Append the helpers to `components/mod.rs`**

Open `crates/ohmyc-core/src/components/mod.rs`. After the `enum Scope { ... }` block but before the `#[cfg(test)]` block, add:

```rust
use std::path::PathBuf;

use crate::claude_home;
use crate::error::ApiError;

/// Resolves the global agents directory: `<claude_home>/agents`.
pub fn agents_dir() -> Result<PathBuf, ApiError> {
    Ok(claude_home::resolve()?.join("agents"))
}

/// Resolves the global skills directory: `<claude_home>/skills`.
pub fn skills_dir() -> Result<PathBuf, ApiError> {
    Ok(claude_home::resolve()?.join("skills"))
}

/// Resolves the global commands directory: `<claude_home>/commands`.
pub fn commands_dir() -> Result<PathBuf, ApiError> {
    Ok(claude_home::resolve()?.join("commands"))
}
```

- [ ] **Step 2: Add a test for the helpers**

In the existing `#[cfg(test)] mod tests` block in `components/mod.rs`, append:

```rust
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn component_dirs_compose_under_claude_home() {
        let _lock = ENV_LOCK.lock().unwrap();
        let prev = std::env::var("OHMYC_CLAUDE_HOME").ok();
        std::env::set_var("OHMYC_CLAUDE_HOME", "/tmp/fake-home");
        assert_eq!(agents_dir().unwrap(), PathBuf::from("/tmp/fake-home/agents"));
        assert_eq!(skills_dir().unwrap(), PathBuf::from("/tmp/fake-home/skills"));
        assert_eq!(commands_dir().unwrap(), PathBuf::from("/tmp/fake-home/commands"));
        match prev {
            Some(v) => std::env::set_var("OHMYC_CLAUDE_HOME", v),
            None => std::env::remove_var("OHMYC_CLAUDE_HOME"),
        }
    }
```

- [ ] **Step 3: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib components::tests 2>&1 | tail -10`
Expected: 4 tests pass (3 previous + 1 new).

- [ ] **Step 4: Commit**

```bash
git add crates/ohmyc-core/src/components/mod.rs
git commit -m "feat(core): components::{agents,skills,commands}_dir path helpers"
```

---

## Task 8: Add Tauri command wrappers for agents

**Files:**
- Create: `packages/desktop/src-tauri/src/api/agents.rs`
- Modify: `packages/desktop/src-tauri/src/api/mod.rs`

- [ ] **Step 1: Create the agents command file**

Create `packages/desktop/src-tauri/src/api/agents.rs`:

```rust
//! Tauri command wrappers for ohmyc-core::components::agents.

use ohmyc_core::components::agents::{self, Agent};
use ohmyc_core::components::agents_dir;
use ohmyc_core::error::ApiError;
use serde::Serialize;

#[derive(Serialize)]
pub struct AgentsResponse {
    pub agents: Vec<Agent>,
}

#[derive(Serialize)]
pub struct AgentResponse {
    pub agent: Option<Agent>,
}

/// The frontend Source Switcher may pass `origins` as either a comma-separated
/// string (e.g. `"claude,opencode"`, matching the legacy fetch URL shape) or
/// as an array of strings. `None` means "all sources" — return everything.
fn include_claude(filter: &Option<serde_json::Value>) -> bool {
    let Some(v) = filter.as_ref() else {
        return true;
    };
    match v {
        serde_json::Value::String(s) => s.split(',').any(|p| p.trim() == "claude"),
        serde_json::Value::Array(items) => items.iter().any(|i| i.as_str() == Some("claude")),
        _ => true,
    }
}

#[tauri::command]
pub fn agents_list(
    origins: Option<serde_json::Value>,
) -> Result<AgentsResponse, ApiError> {
    if !include_claude(&origins) {
        return Ok(AgentsResponse { agents: Vec::new() });
    }
    let dir = agents_dir()?;
    let agents = agents::list(&dir)?;
    Ok(AgentsResponse { agents })
}

#[tauri::command]
pub fn agents_get(name: String) -> Result<AgentResponse, ApiError> {
    let dir = agents_dir()?;
    let agent = agents::get(&dir, &name)?;
    Ok(AgentResponse { agent })
}
```

- [ ] **Step 2: Re-export from `api/mod.rs`**

Open `packages/desktop/src-tauri/src/api/mod.rs`. After the existing `pub mod timeline;`, append:

```rust
pub mod agents;
```

- [ ] **Step 3: Confirm the crate builds**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo build -p ohmyc-desktop 2>&1 | tail -5`
Expected: `Finished` cleanly.

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/src-tauri/src/api/agents.rs packages/desktop/src-tauri/src/api/mod.rs
git commit -m "feat(desktop): agents Tauri commands (list+get with origins filter)"
```

---

## Task 9: Add Tauri command wrappers for skills

**Files:**
- Create: `packages/desktop/src-tauri/src/api/skills.rs`
- Modify: `packages/desktop/src-tauri/src/api/mod.rs`

- [ ] **Step 1: Create the skills command file**

Create `packages/desktop/src-tauri/src/api/skills.rs`:

```rust
//! Tauri command wrappers for ohmyc-core::components::skills.

use ohmyc_core::components::skills::{self, Skill};
use ohmyc_core::components::skills_dir;
use ohmyc_core::error::ApiError;
use serde::Serialize;

#[derive(Serialize)]
pub struct SkillsResponse {
    pub skills: Vec<Skill>,
}

#[derive(Serialize)]
pub struct SkillResponse {
    pub skill: Option<Skill>,
}

/// See api/agents.rs::include_claude for the shape rationale.
fn include_claude(filter: &Option<serde_json::Value>) -> bool {
    let Some(v) = filter.as_ref() else {
        return true;
    };
    match v {
        serde_json::Value::String(s) => s.split(',').any(|p| p.trim() == "claude"),
        serde_json::Value::Array(items) => items.iter().any(|i| i.as_str() == Some("claude")),
        _ => true,
    }
}

#[tauri::command]
pub fn skills_list(
    origins: Option<serde_json::Value>,
) -> Result<SkillsResponse, ApiError> {
    if !include_claude(&origins) {
        return Ok(SkillsResponse { skills: Vec::new() });
    }
    let dir = skills_dir()?;
    let skills = skills::list(&dir)?;
    Ok(SkillsResponse { skills })
}

#[tauri::command]
pub fn skills_get(name: String) -> Result<SkillResponse, ApiError> {
    let dir = skills_dir()?;
    let skill = skills::get(&dir, &name)?;
    Ok(SkillResponse { skill })
}
```

- [ ] **Step 2: Re-export from `api/mod.rs`**

Open `packages/desktop/src-tauri/src/api/mod.rs`. Append:

```rust
pub mod skills;
```

- [ ] **Step 3: Confirm the crate builds**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo build -p ohmyc-desktop 2>&1 | tail -5`
Expected: `Finished` cleanly.

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/src-tauri/src/api/skills.rs packages/desktop/src-tauri/src/api/mod.rs
git commit -m "feat(desktop): skills Tauri commands (list+get with origins filter)"
```

---

## Task 10: Add Tauri command wrappers for commands

**Files:**
- Create: `packages/desktop/src-tauri/src/api/commands.rs`
- Modify: `packages/desktop/src-tauri/src/api/mod.rs`

- [ ] **Step 1: Create the commands command file**

Create `packages/desktop/src-tauri/src/api/commands.rs`:

```rust
//! Tauri command wrappers for ohmyc-core::components::commands.

use ohmyc_core::components::commands::{self, Command};
use ohmyc_core::components::commands_dir;
use ohmyc_core::error::ApiError;
use serde::Serialize;

#[derive(Serialize)]
pub struct CommandsResponse {
    pub commands: Vec<Command>,
}

#[derive(Serialize)]
pub struct CommandResponse {
    pub command: Option<Command>,
}

/// See api/agents.rs::include_claude for the shape rationale.
fn include_claude(filter: &Option<serde_json::Value>) -> bool {
    let Some(v) = filter.as_ref() else {
        return true;
    };
    match v {
        serde_json::Value::String(s) => s.split(',').any(|p| p.trim() == "claude"),
        serde_json::Value::Array(items) => items.iter().any(|i| i.as_str() == Some("claude")),
        _ => true,
    }
}

#[tauri::command]
pub fn commands_list(
    origins: Option<serde_json::Value>,
) -> Result<CommandsResponse, ApiError> {
    if !include_claude(&origins) {
        return Ok(CommandsResponse { commands: Vec::new() });
    }
    let dir = commands_dir()?;
    let commands = commands::list(&dir)?;
    Ok(CommandsResponse { commands })
}

#[tauri::command]
pub fn commands_get(name: String) -> Result<CommandResponse, ApiError> {
    let dir = commands_dir()?;
    let command = commands::get(&dir, &name)?;
    Ok(CommandResponse { command })
}
```

- [ ] **Step 2: Re-export from `api/mod.rs`**

Open `packages/desktop/src-tauri/src/api/mod.rs`. Append:

```rust
pub mod commands;
```

- [ ] **Step 3: Confirm the crate builds**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo build -p ohmyc-desktop 2>&1 | tail -5`
Expected: `Finished` cleanly.

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/src-tauri/src/api/commands.rs packages/desktop/src-tauri/src/api/mod.rs
git commit -m "feat(desktop): commands Tauri commands (list+get with origins filter)"
```

---

## Task 11: Register the 6 new commands in main.rs

**Files:**
- Modify: `packages/desktop/src-tauri/src/main.rs`

- [ ] **Step 1: Read the current invoke_handler block**

Open `packages/desktop/src-tauri/src/main.rs`. Find the `.invoke_handler(tauri::generate_handler![ ... ])` block — slice 2 added the timeline commands here.

- [ ] **Step 2: Add the 6 new commands**

Inside the `generate_handler![ ... ]` macro, after the last `timeline_status` line, add:

```rust
            ohmyc_desktop_lib::api::agents::agents_list,
            ohmyc_desktop_lib::api::agents::agents_get,
            ohmyc_desktop_lib::api::skills::skills_list,
            ohmyc_desktop_lib::api::skills::skills_get,
            ohmyc_desktop_lib::api::commands::commands_list,
            ohmyc_desktop_lib::api::commands::commands_get,
```

- [ ] **Step 3: Build the workspace and run all tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test --workspace 2>&1 | tail -15`
Expected: all tests pass. The commands themselves aren't tested in cargo (they're invoked from JS), but the build verifies registration.

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/src-tauri/src/main.rs
git commit -m "feat(desktop): register agents/skills/commands Tauri commands"
```

---

## Task 12: Extend `transport/fetch.ts` URL table with the 6 new wires

**Files:**
- Modify: `packages/ui/src/lib/transport/fetch.ts`
- Modify: `packages/ui/src/lib/transport/transport.test.ts`

The legacy web dev loop still consumes the TS server. Add per-wire routes so the new dot-style names map back to the right HTTP path.

- [ ] **Step 1: Add the failing tests**

Open `packages/ui/src/lib/transport/transport.test.ts`. At the bottom of the existing `describe('transport seam', () => { ... })` block (before the closing `})`), append:

```ts
  it('fetch transport routes agents.list with origins query', async () => {
    const calls: string[] = []
    const orig = globalThis.fetch
    globalThis.fetch = (async (url: string) => {
      calls.push(url)
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
    }) as typeof fetch
    try {
      const { fetchTransport } = await import('./fetch')
      await fetchTransport('agents.list', { origins: 'claude,opencode' })
      expect(calls).toEqual(['/api/agents?origins=claude%2Copencode'])
    }
    finally {
      globalThis.fetch = orig
    }
  })

  it('fetch transport routes agents.get with locator path + query', async () => {
    const calls: string[] = []
    const orig = globalThis.fetch
    globalThis.fetch = (async (url: string) => {
      calls.push(url)
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
    }) as typeof fetch
    try {
      const { fetchTransport } = await import('./fetch')
      await fetchTransport('agents.get', { name: 'my agent', source: 'plugin', pluginId: 'p1' })
      expect(calls).toEqual([
        '/api/agents/my%20agent?source=plugin&pluginId=p1',
      ])
    }
    finally {
      globalThis.fetch = orig
    }
  })
```

- [ ] **Step 2: Run the tests to confirm both fail**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm test -- transport.test.ts 2>&1 | tail -10`
Expected: failures — the wire names go through the naive fallback (`/api/agents/list`).

- [ ] **Step 3: Add the routes**

Open `packages/ui/src/lib/transport/fetch.ts`. Find the `routes: Record<string, (args) => string>` object. Add these entries (alongside the existing `timeline.*` entries):

```ts
  'agents.list': (a) => `/api/agents${a.origins ? `?${qs({ origins: a.origins })}` : ''}`,
  'agents.get': (a) => `/api/agents/${encodeURIComponent(String(a.name ?? ''))}${detailQs(a)}`,
  'skills.list': (a) => `/api/skills${a.origins ? `?${qs({ origins: a.origins })}` : ''}`,
  'skills.get': (a) => `/api/skills/${encodeURIComponent(String(a.name ?? ''))}${detailQs(a)}`,
  'commands.list': (a) => `/api/commands${a.origins ? `?${qs({ origins: a.origins })}` : ''}`,
  'commands.get': (a) => `/api/commands/${encodeURIComponent(String(a.name ?? ''))}${detailQs(a)}`,
```

Then add the `detailQs` helper just below the `qs` helper:

```ts
// Locator query string for agents/skills/commands GET-by-name.
// Skips `name` (path param) and `origins` (list, not a locator).
function detailQs(args: Record<string, unknown>): string {
  const subset: Record<string, unknown> = {}
  for (const k of ['source', 'pluginId', 'scope']) {
    if (args[k] !== undefined && args[k] !== null) {
      subset[k] = args[k]
    }
  }
  const out = qs(subset)
  return out ? `?${out}` : ''
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm test -- transport.test.ts 2>&1 | tail -10`
Expected: all transport tests pass (now 8 instead of 6).

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/lib/transport/fetch.ts packages/ui/src/lib/transport/transport.test.ts
git commit -m "feat(ui): per-wire routes for agents/skills/commands in fetch transport"
```

---

## Task 13: Migrate `use-agents.ts` to the transport seam

**Files:**
- Modify: `packages/ui/src/hooks/use-agents.ts`

- [ ] **Step 1: Read the current file**

Open `packages/ui/src/hooks/use-agents.ts`. Note the two `fetch()` call sites (`fetchAgents` and `fetchAgent`).

- [ ] **Step 2: Replace with `request()` calls**

Replace the entire contents of `packages/ui/src/hooks/use-agents.ts` with:

```ts
// React Query hooks for agent inventory listing and detail queries.
// Backend transport is selected at build time via packages/ui/src/lib/transport.ts.
import { useQuery } from '@tanstack/react-query'

import { request } from '@/lib/transport'
import { REGISTERED_ORIGINS, useSources } from '../state/sources'

import type { Agent, Origin } from '@ohmyc/shared'

interface AgentsListResponse {
  agents: Agent[]
}

interface AgentDetailResponse {
  agent: Agent
}

function buildOriginsParam(selected: Set<Origin>): string | null {
  if (selected.size === REGISTERED_ORIGINS.length) {
    return null
  }
  return [...selected].toSorted().join(',')
}

/** Identifies a specific agent, including optional source/plugin/scope for disambiguation. */
export interface ItemLocator {
  name: string
  source?: string
  pluginId?: string
  scope?: 'global' | 'project'
}

export function useAgents() {
  const selected = useSources(state => state.selected)
  const originsKey = buildOriginsParam(selected)
  return useQuery({
    queryKey: ['agents', originsKey ?? 'all'],
    queryFn: async () => {
      const args: Record<string, unknown> = {}
      if (originsKey) {
        args.origins = originsKey
      }
      const r = await request<AgentsListResponse>('agents.list', args)
      return r.agents
    },
  })
}

export function useAgent(locator: ItemLocator | null) {
  return useQuery({
    queryKey: ['agents', locator?.name, locator?.source, locator?.pluginId, locator?.scope],
    queryFn: async () => {
      const args: Record<string, unknown> = { name: locator!.name }
      if (locator!.source) {
        args.source = locator!.source
      }
      if (locator!.pluginId) {
        args.pluginId = locator!.pluginId
      }
      if (locator!.scope) {
        args.scope = locator!.scope
      }
      const r = await request<AgentDetailResponse>('agents.get', args)
      return r.agent
    },
    enabled: !!locator,
  })
}
```

- [ ] **Step 3: Run the existing tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm test -- use-agents.test 2>&1 | tail -10`
Expected: existing tests likely fail because they mock `fetch()` directly. Task 14 fixes them.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/hooks/use-agents.ts
git commit -m "feat(ui): use-agents routes through transport seam"
```

---

## Task 14: Update `use-agents.test.tsx` to use the mock transport

**Files:**
- Modify: `packages/ui/src/hooks/use-agents.test.tsx`

- [ ] **Step 1: Read the current test file**

Open `packages/ui/src/hooks/use-agents.test.tsx`. Note the existing setup (likely mocks `fetch` via `globalThis.fetch = ...`).

- [ ] **Step 2: Replace the file contents**

Replace the entire contents of `packages/ui/src/hooks/use-agents.test.tsx` with:

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

import { useAgent, useAgents } from './use-agents'
import {
  __setTransportForTests,
  resetTransportForTests,
} from '@/lib/transport'
import { resetMock, setMockHandler } from '@/lib/transport/mock'
import { useSources } from '@/state/sources'

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
  // Reset SourceSwitcher state to "all selected" so the origins param
  // is null (matches default behavior).
  useSources.setState({ selected: new Set(['claude', 'opencode', 'agents']) })
})

afterEach(() => {
  resetMock()
  resetTransportForTests()
})

describe('useAgents', () => {
  it('returns the agents array unwrapped from the response envelope', async () => {
    setMockHandler('agents.list', async () => ({
      agents: [{ id: 'a1', frontmatter: { name: 'a1', description: 'd' }, content: '', raw: '', filename: 'a1.md', source: 'local' }],
    }))
    const { result } = renderHook(() => useAgents(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].id).toBe('a1')
  })

  it('does not pass origins when all sources are selected', async () => {
    let captured: unknown = null
    setMockHandler('agents.list', async (args) => {
      captured = args
      return { agents: [] }
    })
    renderHook(() => useAgents(), { wrapper: wrapper() })
    await waitFor(() => {
      expect(captured).not.toBeNull()
    })
    expect((captured as Record<string, unknown>).origins).toBeUndefined()
  })

  it('passes origins=claude when only claude is selected', async () => {
    useSources.setState({ selected: new Set(['claude']) })
    let captured: unknown = null
    setMockHandler('agents.list', async (args) => {
      captured = args
      return { agents: [] }
    })
    renderHook(() => useAgents(), { wrapper: wrapper() })
    await waitFor(() => {
      expect(captured).not.toBeNull()
    })
    expect((captured as { origins?: string }).origins).toBe('claude')
  })
})

describe('useAgent', () => {
  it('returns the agent unwrapped from the response envelope', async () => {
    setMockHandler('agents.get', async () => ({
      agent: { id: 'x', frontmatter: { name: 'x', description: 'd' }, content: '', raw: '', filename: 'x.md', source: 'local' },
    }))
    const { result } = renderHook(
      () => useAgent({ name: 'x' }),
      { wrapper: wrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.id).toBe('x')
  })

  it('forwards locator fields (source, pluginId, scope) as args', async () => {
    let captured: unknown = null
    setMockHandler('agents.get', async (args) => {
      captured = args
      return { agent: { id: 'x', frontmatter: { name: 'x', description: 'd' }, content: '', raw: '', filename: 'x.md', source: 'local' } }
    })
    renderHook(
      () => useAgent({ name: 'x', source: 'plugin', pluginId: 'p1', scope: 'global' }),
      { wrapper: wrapper() },
    )
    await waitFor(() => expect(captured).not.toBeNull())
    expect(captured).toEqual({ name: 'x', source: 'plugin', pluginId: 'p1', scope: 'global' })
  })

  it('is disabled when no locator is provided', async () => {
    const { result } = renderHook(() => useAgent(null), { wrapper: wrapper() })
    // No request fires; isSuccess stays false.
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isFetched).toBe(false)
  })
})
```

- [ ] **Step 3: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm test -- use-agents.test 2>&1 | tail -10`
Expected: 6 tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/hooks/use-agents.test.tsx
git commit -m "test(ui): use-agents tests use mock transport + origins coverage"
```

---

## Task 15: Migrate `use-skills.ts` to the transport seam (TDD)

**Files:**
- Modify: `packages/ui/src/hooks/use-skills.ts`

- [ ] **Step 1: Replace the file contents**

Open `packages/ui/src/hooks/use-skills.ts`. Replace the entire contents with:

```ts
// React Query hooks for skill inventory listing and detail queries.
import { useQuery } from '@tanstack/react-query'

import { request } from '@/lib/transport'
import { REGISTERED_ORIGINS, useSources } from '../state/sources'

import type { Origin, Skill } from '@ohmyc/shared'
import type { ItemLocator } from './use-agents'

interface SkillsListResponse {
  skills: Skill[]
}

interface SkillDetailResponse {
  skill: Skill
}

function buildOriginsParam(selected: Set<Origin>): string | null {
  if (selected.size === REGISTERED_ORIGINS.length) {
    return null
  }
  return [...selected].toSorted().join(',')
}

export function useSkills() {
  const selected = useSources(state => state.selected)
  const originsKey = buildOriginsParam(selected)
  return useQuery({
    queryKey: ['skills', originsKey ?? 'all'],
    queryFn: async () => {
      const args: Record<string, unknown> = {}
      if (originsKey) {
        args.origins = originsKey
      }
      const r = await request<SkillsListResponse>('skills.list', args)
      return r.skills
    },
  })
}

export function useSkill(locator: ItemLocator | null) {
  return useQuery({
    queryKey: ['skills', locator?.name, locator?.source, locator?.pluginId, locator?.scope],
    queryFn: async () => {
      const args: Record<string, unknown> = { name: locator!.name }
      if (locator!.source) {
        args.source = locator!.source
      }
      if (locator!.pluginId) {
        args.pluginId = locator!.pluginId
      }
      if (locator!.scope) {
        args.scope = locator!.scope
      }
      const r = await request<SkillDetailResponse>('skills.get', args)
      return r.skill
    },
    enabled: !!locator,
  })
}
```

- [ ] **Step 2: Find and update any existing skills tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && find . -name "use-skills.test*" -not -path "*/node_modules/*" 2>/dev/null`
Expected: zero or one file.

If a file exists, replace it with a test file modeled exactly on `use-agents.test.tsx` from Task 14, swapping `useAgents` → `useSkills`, `agents.list` → `skills.list`, `agents.get` → `skills.get`, the `agents:` response key → `skills:`, and `useAgent` → `useSkill`.

- [ ] **Step 3: Run the suite**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm test -- use-skills 2>&1 | tail -10`
Expected: green. (If no test file exists, this exits cleanly with no tests found.)

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/hooks/use-skills.ts packages/ui/src/hooks/use-skills.test.tsx 2>/dev/null || git add packages/ui/src/hooks/use-skills.ts
git commit -m "feat(ui): use-skills routes through transport seam"
```

---

## Task 16: Migrate `use-commands.ts` to the transport seam

**Files:**
- Modify: `packages/ui/src/hooks/use-commands.ts`

- [ ] **Step 1: Replace the file contents**

Open `packages/ui/src/hooks/use-commands.ts`. Replace the entire contents with:

```ts
// React Query hooks for command inventory listing and detail queries.
import { useQuery } from '@tanstack/react-query'

import { request } from '@/lib/transport'
import { REGISTERED_ORIGINS, useSources } from '../state/sources'

import type { Command, Origin } from '@ohmyc/shared'
import type { ItemLocator } from './use-agents'

interface CommandsListResponse {
  commands: Command[]
}

interface CommandDetailResponse {
  command: Command
}

function buildOriginsParam(selected: Set<Origin>): string | null {
  if (selected.size === REGISTERED_ORIGINS.length) {
    return null
  }
  return [...selected].toSorted().join(',')
}

export function useCommands() {
  const selected = useSources(state => state.selected)
  const originsKey = buildOriginsParam(selected)
  return useQuery({
    queryKey: ['commands', originsKey ?? 'all'],
    queryFn: async () => {
      const args: Record<string, unknown> = {}
      if (originsKey) {
        args.origins = originsKey
      }
      const r = await request<CommandsListResponse>('commands.list', args)
      return r.commands
    },
  })
}

export function useCommand(locator: ItemLocator | null) {
  return useQuery({
    queryKey: ['commands', locator?.name, locator?.source, locator?.pluginId, locator?.scope],
    queryFn: async () => {
      const args: Record<string, unknown> = { name: locator!.name }
      if (locator!.source) {
        args.source = locator!.source
      }
      if (locator!.pluginId) {
        args.pluginId = locator!.pluginId
      }
      if (locator!.scope) {
        args.scope = locator!.scope
      }
      const r = await request<CommandDetailResponse>('commands.get', args)
      return r.command
    },
    enabled: !!locator,
  })
}
```

- [ ] **Step 2: Update tests (if any exist)**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && find . -name "use-commands.test*" -not -path "*/node_modules/*" 2>/dev/null`

If a file exists, replace it with a test file modeled on `use-agents.test.tsx`, swapping the identifiers similarly (`useAgents` → `useCommands`, `agents.*` → `commands.*`, response key `agents` → `commands`, `useAgent` → `useCommand`).

- [ ] **Step 3: Run the full UI test suite**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm test 2>&1 | tail -10`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/hooks/use-commands.ts packages/ui/src/hooks/use-commands.test.tsx 2>/dev/null || git add packages/ui/src/hooks/use-commands.ts
git commit -m "feat(ui): use-commands routes through transport seam"
```

---

## Task 17: Extend `useFsChanged` to invalidate components on claude_home events

**Files:**
- Modify: `packages/ui/src/hooks/use-fs-changed.ts`

The watcher already fires `FsEvent::ClaudeHome` for nested writes (slice 2 review fix). Wire that into React Query so the Explorer auto-refreshes when files land or change under `~/.claude/{agents,skills,commands}`.

- [ ] **Step 1: Read the current file**

Open `packages/ui/src/hooks/use-fs-changed.ts`.

- [ ] **Step 2: Add claude_home invalidation paths**

Find this block:

```ts
const off = await subscribe<FsEvent>('fs:changed', (payload) => {
  if (payload.kind === 'timeline_db') {
    void qc.invalidateQueries({ queryKey: ['timeline'] })
  }
})
```

Replace with:

```ts
const off = await subscribe<FsEvent>('fs:changed', (payload) => {
  if (payload.kind === 'timeline_db') {
    void qc.invalidateQueries({ queryKey: ['timeline'] })
    return
  }
  if (payload.kind === 'claude_home') {
    // Coarse invalidation: any write under ~/.claude potentially
    // changes one of the component lists. React Query's stale-while-
    // revalidate keeps the UI flicker-free.
    const path = payload.path
    if (path.includes('/agents/')) {
      void qc.invalidateQueries({ queryKey: ['agents'] })
    }
    if (path.includes('/skills/')) {
      void qc.invalidateQueries({ queryKey: ['skills'] })
    }
    if (path.includes('/commands/')) {
      void qc.invalidateQueries({ queryKey: ['commands'] })
    }
  }
})
```

- [ ] **Step 3: Run the existing tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm test 2>&1 | tail -10`
Expected: all tests still pass (no `useFsChanged` tests; the existing menubar-page tests don't depend on its behavior).

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/hooks/use-fs-changed.ts
git commit -m "feat(ui): useFsChanged invalidates agents/skills/commands on claude_home events"
```

---

## Task 18: Manual smoke test

**Files:** none

- [ ] **Step 1: Start the desktop app**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm --filter @ohmyc/desktop tauri dev`

- [ ] **Step 2: Verify Explorer routes load real data**

Click the tray icon → `Open OhMyC →`. The main window opens on `/timeline` (slice-2 default). Navigate to `/explore/agents`, then `/explore/skills`, then `/explore/commands`.

Expected:
- Each list shows real items from your `~/.claude/{agents,skills,commands}` directories.
- Items use `local` source, `global` scope, `claude` origin (per slice-3 hardcoding).
- No console errors about failed `/api/*` calls.
- Items from plugins or opencode are NOT listed (intentional — slice 5+).

- [ ] **Step 3: Click into an agent / skill / command to load detail**

Click any list row. The detail pane should open showing the frontmatter + Markdown body.

Expected: detail loads via `invoke('agents.get', { name })` (not `fetch`). For skills, the route uses the dirName; for agents/commands, the filename minus `.md`.

- [ ] **Step 4: Verify the Source Switcher filter is honored**

In the header, deselect `claude` in the Source Switcher (leave only `opencode` selected if present). The lists should go empty.

Expected: slice 3 only emits `claude`-origin items; deselecting it returns empty lists. Re-select `claude` and items come back.

- [ ] **Step 5: Verify live updates via the watcher**

From a terminal, create a new agent:

```bash
cat > ~/.claude/agents/_smoke-test.md <<'EOF'
---
name: _smoke-test
description: temporary smoke test agent
---
hello
EOF
```

Within ~1 second, the Explorer agents list should refresh and the new agent should appear.

Expected: React Query invalidation fires because the watcher emitted `FsEvent::ClaudeHome` for the nested path. Delete the file after testing:

```bash
rm ~/.claude/agents/_smoke-test.md
```

The list should refresh again, removing the entry.

- [ ] **Step 6: Verify web dev still works**

In a separate terminal: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/cli && pnpm dev` (legacy server). Then in another: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm dev`.

Open `http://localhost:5173/explore/agents` — should show ALL agents (including plugin/opencode if present), via the fetch transport against the TS server.

Expected: web shows more items than desktop (because TS server has plugin scan, registry, etc.). That's expected during the migration.

- [ ] **Step 7: Report**

If any step failed, note which one. Do not mark this task complete until steps 1-5 pass; step 6 is informational.

---

## Done criteria for Slice 3

- `cargo test --workspace` green.
- `pnpm -r test` green.
- `pnpm --filter @ohmyc/desktop tauri build --target aarch64-apple-darwin` produces a binary.
- Manual smoke (Task 18) steps 1-5 pass.
- The TS server's `/api/{agents,skills,commands}*` routes are still alive and still serve the web dev loop.
- `packages/ui/src/hooks/use-agents.ts`, `use-skills.ts`, `use-commands.ts` contain zero `fetch(` calls (verify with grep).
- The Explorer routes `/explore/agents`, `/explore/skills`, `/explore/commands` render real data inside the desktop main window without HTTP.

---

## What this slice does NOT do (intentional)

- Does not port the provider registry or the `opencode` origin. The Source Switcher's `opencode` and `agents` filters return empty results on desktop until later slices.
- Does not port plugin discovery (`pluginsDir`, `PluginResolver`). Plugin-provided components don't appear on desktop until **slice 5 (Plugins)**.
- Does not port project-local component dirs (`~/.claude/projects/<name>/{agents,skills,commands}`). Project scope is desktop-empty until a future slice adds it.
- Does not port badges (`provider.agentBadges(...)`) — the field is emitted as an empty array.
- Does not port provenance (store imports). Field is omitted.
- Does not handle writes (create/update/delete) — those land in slice 6 (Profiles) where the transport seam grows method/body support.
- Does not delete the TS routes or services. Slice 7 (Cleanup) does that.
