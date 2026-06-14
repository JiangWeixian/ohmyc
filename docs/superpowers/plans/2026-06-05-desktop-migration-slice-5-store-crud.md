# Desktop Migration — Slice 5: Store CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate 20 store CRUD hooks across four entity types (agents, skills, commands, model-configs) in `use-store.ts` onto native Rust Tauri commands. Lands the **"Used by N profiles" reference-check** that delete-safety depends on (and that Profiles slice 7 inherits). Exercises the `{ url, method, body }` transport shape at scale.

**Architecture:** Reuse the slice-3 `components::{agents,skills,commands}` modules — same on-disk file layout (`<dir>/<name>.md` for agents/commands, `<dir>/<name>/SKILL.md` for skills) — extending each with `create`/`update`/`delete` parameterized on the directory. Tauri commands pass `store_agents_dir()` etc. (under `$OHMYC_HOME/store/`, distinct from Slice 3's `<claude_home>/agents/`). Model-configs is a new module (JSON file per config, different name regex allowing `./`). Provenance is a read-time enrichment from `<base>/store/.metadata/imports.json`. Reference-check scans `<base>/profiles/*/profile.json` for component-name mentions; gates delete unless `force=true`. Bulk import is **deferred** to a follow-up slice — out of scope here.

**Tech Stack:** Rust (extends slice-3 deps; uses `tempfile::NamedTempFile` already in deps from slice 4 for atomic writes). TypeScript (existing transport seam + React Query infrastructure).

---

## File Structure

**New files:**
- `crates/ohmyc-core/src/store/mod.rs` — namespace + path helpers (`store_dir`, `store_agents_dir`, `store_skills_dir`, `store_commands_dir`, `store_model_configs_dir`, `store_profiles_dir`, `provenance_index_path`).
- `crates/ohmyc-core/src/store/model_configs.rs` — list/get/create/update/delete for JSON-based model configs (different name regex `^[\w./-]+$`, no `..`).
- `crates/ohmyc-core/src/store/provenance.rs` — read provenance index; expose `get(type, id)` for read-time enrichment.
- `crates/ohmyc-core/src/store/references.rs` — `referencing_profiles(type, name) -> Vec<String>` for delete-safety gate.
- `packages/desktop/src-tauri/src/api/store.rs` — 20 Tauri commands (list/get/create/update/delete × 4 types).

**Modified files:**
- `crates/ohmyc-core/src/components/agents.rs` — add `create`, `update`, `delete`.
- `crates/ohmyc-core/src/components/skills.rs` — add `create`, `update`, `delete`.
- `crates/ohmyc-core/src/components/commands.rs` — add `create`, `update`, `delete`.
- `crates/ohmyc-core/src/components/frontmatter.rs` — add `stringify(value, content) -> String` so writers can serialize back to Markdown + YAML.
- `crates/ohmyc-core/src/lib.rs` — `pub mod store;`.
- `packages/desktop/src-tauri/src/api/mod.rs` — `pub mod store;`.
- `packages/desktop/src-tauri/src/main.rs` — register the 20 new commands.
- `packages/ui/src/lib/transport/fetch.ts` — 20 new wire entries with method/body.
- `packages/ui/src/lib/transport/transport.test.ts` — 2 new tests covering DELETE method and `?force=true` query.
- `packages/ui/src/hooks/use-store.ts` — replace `fetchJson`/`mutateJson` with `request()` everywhere; preserve queryKey shapes.
- `packages/ui/src/hooks/use-store.test.tsx` (NEW or replace) — coverage for one CRUD lifecycle per entity type (agents focus, sampled for skills/commands/model-configs).
- `packages/ui/src/hooks/use-fs-changed.ts` — invalidate `['store', '<type>']` on writes under `<base>/store/<type>/`.

---

## Task 1: Add `frontmatter::stringify` helper

**Files:**
- Modify: `crates/ohmyc-core/src/components/frontmatter.rs`

The slice-3 frontmatter module only reads. Store writes need to serialize back to `---\n<yaml>\n---\n<content>\n`. Add it as a paired helper, TDD-driven.

- [ ] **Step 1: Add the failing tests**

Open `crates/ohmyc-core/src/components/frontmatter.rs`. In the `#[cfg(test)] mod tests` block, append:

```rust
    #[test]
    fn stringify_writes_yaml_frontmatter_and_body() {
        let front = serde_json::json!({"name": "a", "description": "d"});
        let raw = stringify(&front, "Hello world").unwrap();
        assert!(raw.starts_with("---\n"));
        assert!(raw.contains("name: a"));
        assert!(raw.contains("description: d"));
        assert!(raw.ends_with("Hello world\n"));
        // Roundtrip
        let (parsed_front, body) = parse(&raw).unwrap();
        assert_eq!(parsed_front["name"], "a");
        assert_eq!(parsed_front["description"], "d");
        assert_eq!(body, "Hello world");
    }

    #[test]
    fn stringify_rejects_non_object_frontmatter() {
        let err = stringify(&serde_json::json!([1, 2]), "x").unwrap_err();
        assert!(matches!(err, ApiError::Validation(_)));
    }

    #[test]
    fn stringify_preserves_arbitrary_yaml_typed_values() {
        let front = serde_json::json!({"name": "x", "description": "y", "tools": ["A", "B"], "maxTurns": 5});
        let raw = stringify(&front, "body").unwrap();
        let (back, _) = parse(&raw).unwrap();
        assert_eq!(back["tools"], serde_json::json!(["A", "B"]));
        assert_eq!(back["maxTurns"], 5);
    }
```

- [ ] **Step 2: Run to confirm they fail**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib components::frontmatter 2>&1 | tail -10`
Expected: compile error — `stringify` not defined.

- [ ] **Step 3: Implement `stringify`**

In the same file, after the existing `parse` function (and before the `#[cfg(test)] mod tests` block), add:

```rust
/// Serialize a JSON-object frontmatter + Markdown body back to the
/// `---\n<yaml>\n---\n<content>\n` form. Mirrors gray-matter's
/// `matter.stringify(content, data)` from the TS side. Rejects
/// non-object frontmatter with `ApiError::Validation`.
pub fn stringify(frontmatter: &Value, content: &str) -> Result<String, ApiError> {
    if !frontmatter.is_object() {
        return Err(ApiError::Validation(
            "frontmatter must be a JSON object".to_string(),
        ));
    }
    let yaml = serde_yaml::to_string(frontmatter)
        .map_err(|e| ApiError::Internal(format!("serialize yaml: {e}")))?;
    // serde_yaml emits a leading `---\n` and trailing newline; trim and rewrap
    // so we always produce a canonical `---\n<body>\n---\n<content>\n`.
    let trimmed = yaml.trim_start_matches("---\n").trim_end();
    let body = content.trim_end();
    Ok(format!("---\n{trimmed}\n---\n{body}\n"))
}
```

- [ ] **Step 4: Add `serde_yaml` to `[dependencies]`**

Open `crates/ohmyc-core/Cargo.toml`. After `gray_matter = ...` add:

```toml
serde_yaml = "0.9"
```

- [ ] **Step 5: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib components::frontmatter 2>&1 | tail -10`
Expected: `test result: ok. 7 passed` (4 existing + 3 new).

- [ ] **Step 6: Commit**

```bash
git add crates/ohmyc-core/src/components/frontmatter.rs crates/ohmyc-core/Cargo.toml
git commit -m "feat(core): frontmatter::stringify (mirror of TS matter.stringify)"
```

---

## Task 2: Extend `components::agents` with `create`/`update`/`delete` (TDD)

**Files:**
- Modify: `crates/ohmyc-core/src/components/agents.rs`

- [ ] **Step 1: Add the failing tests**

Open `crates/ohmyc-core/src/components/agents.rs`. In the `#[cfg(test)] mod tests` block, after the last existing test, append:

```rust
    #[test]
    fn create_writes_new_file_and_returns_agent() {
        let dir = tempfile::tempdir().unwrap();
        let front = serde_json::json!({"name": "alpha", "description": "first"});
        let agent = create(dir.path(), &front, "body").unwrap();
        assert_eq!(agent.id, "alpha");
        assert_eq!(agent.filename, "alpha.md");
        assert!(dir.path().join("alpha.md").exists());
        // Roundtrip
        let r = get(dir.path(), "alpha").unwrap().unwrap();
        assert_eq!(r.frontmatter["description"], "first");
    }

    #[test]
    fn create_rejects_invalid_name() {
        let dir = tempfile::tempdir().unwrap();
        let front = serde_json::json!({"name": "../bad", "description": "d"});
        let err = create(dir.path(), &front, "x").unwrap_err();
        assert!(matches!(err, ApiError::InvalidInput(_)));
    }

    #[test]
    fn create_errors_with_conflict_when_exists() {
        let dir = tempfile::tempdir().unwrap();
        let front = serde_json::json!({"name": "dup", "description": "d"});
        create(dir.path(), &front, "x").unwrap();
        let err = create(dir.path(), &front, "y").unwrap_err();
        assert!(matches!(err, ApiError::Conflict(_)));
    }

    #[test]
    fn create_creates_parent_directory_if_missing() {
        let dir = tempfile::tempdir().unwrap();
        let nested = dir.path().join("does-not-exist-yet");
        let front = serde_json::json!({"name": "x", "description": "d"});
        create(&nested, &front, "body").unwrap();
        assert!(nested.join("x.md").exists());
    }

    #[test]
    fn update_merges_frontmatter_and_replaces_content() {
        let dir = tempfile::tempdir().unwrap();
        let front = serde_json::json!({"name": "a", "description": "old", "model": "sonnet"});
        create(dir.path(), &front, "old body").unwrap();

        let partial = Some(serde_json::json!({"description": "new"}));
        let new_content = Some("new body".to_string());
        let updated = update(dir.path(), "a", partial.as_ref(), new_content.as_deref())
            .unwrap()
            .expect("agent updated");
        // description overwritten, model preserved
        assert_eq!(updated.frontmatter["description"], "new");
        assert_eq!(updated.frontmatter["model"], "sonnet");
        assert_eq!(updated.content, "new body");
    }

    #[test]
    fn update_returns_none_when_missing() {
        let dir = tempfile::tempdir().unwrap();
        let r = update(dir.path(), "missing", None, None).unwrap();
        assert!(r.is_none());
    }

    #[test]
    fn update_rejects_invalid_name() {
        let dir = tempfile::tempdir().unwrap();
        let r = update(dir.path(), "../bad", None, None).unwrap();
        assert!(r.is_none());
    }

    #[test]
    fn delete_removes_file_and_returns_true() {
        let dir = tempfile::tempdir().unwrap();
        let front = serde_json::json!({"name": "x", "description": "d"});
        create(dir.path(), &front, "body").unwrap();
        assert!(delete(dir.path(), "x").unwrap());
        assert!(!dir.path().join("x.md").exists());
    }

    #[test]
    fn delete_returns_false_when_missing_or_invalid_name() {
        let dir = tempfile::tempdir().unwrap();
        assert!(!delete(dir.path(), "missing").unwrap());
        assert!(!delete(dir.path(), "../bad").unwrap());
    }
```

- [ ] **Step 2: Run to confirm they fail**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib components::agents 2>&1 | tail -10`
Expected: compile errors — `create`/`update`/`delete` not defined.

- [ ] **Step 3: Implement the three functions**

In `crates/ohmyc-core/src/components/agents.rs`, after the existing `parse_agent` function (and before `#[cfg(test)]`), add:

```rust
/// Create a new agent file. Validates that `frontmatter.name` matches the
/// safe-name pattern; refuses to overwrite an existing file (returns
/// `ApiError::Conflict`); creates the parent directory if missing.
pub fn create(dir: &Path, frontmatter: &Value, content: &str) -> Result<Agent, ApiError> {
    let name = frontmatter
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ApiError::InvalidInput("frontmatter.name is required".to_string()))?;
    if !is_safe_name(name) {
        return Err(ApiError::InvalidInput(format!(
            "agent name '{name}' must match [a-zA-Z0-9_-]"
        )));
    }
    std::fs::create_dir_all(dir).map_err(|e| ApiError::Io(format!("mkdir {}: {e}", dir.display())))?;
    let filename = format!("{name}.md");
    let path: PathBuf = dir.join(&filename);
    if path.exists() {
        return Err(ApiError::Conflict(format!("agent '{name}' already exists")));
    }
    let raw = frontmatter::stringify(frontmatter, content)?;
    std::fs::write(&path, &raw).map_err(|e| ApiError::Io(format!("write {}: {e}", path.display())))?;
    Ok(Agent {
        id: name.to_string(),
        frontmatter: frontmatter.clone(),
        content: content.trim().to_string(),
        raw,
        filename,
        source: ComponentSource::Local,
        scope: Scope::Global,
        origins: vec![Origin::Claude],
        badges: Vec::new(),
    })
}

/// Merge partial frontmatter changes and/or replace content. Returns
/// `Ok(None)` when name is invalid or the file doesn't exist (matches
/// TS `update -> Agent | null`).
pub fn update(
    dir: &Path,
    name: &str,
    frontmatter_changes: Option<&Value>,
    new_content: Option<&str>,
) -> Result<Option<Agent>, ApiError> {
    if !is_safe_name(name) {
        return Ok(None);
    }
    let Some(existing) = get(dir, name)? else {
        return Ok(None);
    };
    let mut merged = existing.frontmatter.clone();
    if let Some(changes) = frontmatter_changes {
        if let (Some(merged_obj), Some(changes_obj)) = (merged.as_object_mut(), changes.as_object())
        {
            for (k, v) in changes_obj {
                merged_obj.insert(k.clone(), v.clone());
            }
        }
    }
    let body = new_content.unwrap_or(&existing.content);
    let raw = frontmatter::stringify(&merged, body)?;
    let path = dir.join(format!("{name}.md"));
    std::fs::write(&path, &raw).map_err(|e| ApiError::Io(format!("write {}: {e}", path.display())))?;
    Ok(Some(Agent {
        id: name.to_string(),
        frontmatter: merged,
        content: body.trim().to_string(),
        raw,
        filename: format!("{name}.md"),
        source: ComponentSource::Local,
        scope: Scope::Global,
        origins: vec![Origin::Claude],
        badges: Vec::new(),
    }))
}

/// Delete an agent file. Returns `Ok(false)` for invalid names or
/// missing files (mirrors TS `delete -> boolean`).
pub fn delete(dir: &Path, name: &str) -> Result<bool, ApiError> {
    if !is_safe_name(name) {
        return Ok(false);
    }
    let path = dir.join(format!("{name}.md"));
    match std::fs::remove_file(&path) {
        Ok(()) => Ok(true),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(e) => Err(ApiError::Io(format!("remove {}: {e}", path.display()))),
    }
}
```

- [ ] **Step 4: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib components::agents 2>&1 | tail -15`
Expected: 16 tests pass (7 existing read tests + 9 new write tests).

- [ ] **Step 5: Commit**

```bash
git add crates/ohmyc-core/src/components/agents.rs
git commit -m "feat(core): components::agents create/update/delete (TS parity)"
```

---

## Task 3: Extend `components::commands` with `create`/`update`/`delete` (TDD)

**Files:**
- Modify: `crates/ohmyc-core/src/components/commands.rs`

Commands share the same single-`.md` shape as agents. The write functions mirror Task 2 with the only behavioral difference being the parse function used (`parse_command` vs `parse_agent`).

- [ ] **Step 1: Add the failing tests**

Open `crates/ohmyc-core/src/components/commands.rs`. In the `#[cfg(test)] mod tests` block, append:

```rust
    #[test]
    fn create_writes_new_file_and_returns_command() {
        let dir = tempfile::tempdir().unwrap();
        let front = serde_json::json!({"name": "ship", "description": "ship it"});
        let cmd = create(dir.path(), &front, "body").unwrap();
        assert_eq!(cmd.id, "ship");
        assert!(dir.path().join("ship.md").exists());
        let r = get(dir.path(), "ship").unwrap().unwrap();
        assert_eq!(r.frontmatter["description"], "ship it");
    }

    #[test]
    fn create_errors_with_conflict_when_exists() {
        let dir = tempfile::tempdir().unwrap();
        let front = serde_json::json!({"name": "dup", "description": "d"});
        create(dir.path(), &front, "x").unwrap();
        let err = create(dir.path(), &front, "y").unwrap_err();
        assert!(matches!(err, ApiError::Conflict(_)));
    }

    #[test]
    fn create_rejects_invalid_name() {
        let dir = tempfile::tempdir().unwrap();
        let front = serde_json::json!({"name": "../bad", "description": "d"});
        let err = create(dir.path(), &front, "x").unwrap_err();
        assert!(matches!(err, ApiError::InvalidInput(_)));
    }

    #[test]
    fn update_merges_and_writes() {
        let dir = tempfile::tempdir().unwrap();
        let front = serde_json::json!({"name": "a", "description": "old"});
        create(dir.path(), &front, "old body").unwrap();
        let partial = serde_json::json!({"description": "new"});
        let updated = update(dir.path(), "a", Some(&partial), Some("new body"))
            .unwrap()
            .expect("command updated");
        assert_eq!(updated.frontmatter["description"], "new");
        assert_eq!(updated.content, "new body");
    }

    #[test]
    fn update_returns_none_when_missing() {
        let dir = tempfile::tempdir().unwrap();
        assert!(update(dir.path(), "missing", None, None).unwrap().is_none());
    }

    #[test]
    fn delete_removes_file_and_returns_true() {
        let dir = tempfile::tempdir().unwrap();
        let front = serde_json::json!({"name": "x", "description": "d"});
        create(dir.path(), &front, "body").unwrap();
        assert!(delete(dir.path(), "x").unwrap());
        assert!(!dir.path().join("x.md").exists());
    }

    #[test]
    fn delete_returns_false_when_missing_or_invalid_name() {
        let dir = tempfile::tempdir().unwrap();
        assert!(!delete(dir.path(), "missing").unwrap());
        assert!(!delete(dir.path(), "../bad").unwrap());
    }
```

- [ ] **Step 2: Run to confirm they fail**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib components::commands 2>&1 | tail -10`
Expected: compile errors.

- [ ] **Step 3: Implement the three functions**

In `crates/ohmyc-core/src/components/commands.rs`, after `parse_command` (and before `#[cfg(test)]`), add:

```rust
pub fn create(dir: &Path, frontmatter: &Value, content: &str) -> Result<Command, ApiError> {
    let name = frontmatter
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ApiError::InvalidInput("frontmatter.name is required".to_string()))?;
    if !is_safe_name(name) {
        return Err(ApiError::InvalidInput(format!(
            "command name '{name}' must match [a-zA-Z0-9_-]"
        )));
    }
    std::fs::create_dir_all(dir).map_err(|e| ApiError::Io(format!("mkdir {}: {e}", dir.display())))?;
    let filename = format!("{name}.md");
    let path: PathBuf = dir.join(&filename);
    if path.exists() {
        return Err(ApiError::Conflict(format!("command '{name}' already exists")));
    }
    let raw = frontmatter::stringify(frontmatter, content)?;
    std::fs::write(&path, &raw).map_err(|e| ApiError::Io(format!("write {}: {e}", path.display())))?;
    // Re-parse so we get the canonical id+name-fallback handling.
    parse_command(&filename, &raw)?
        .ok_or_else(|| ApiError::Internal("parse_command returned None after create".to_string()))
}

pub fn update(
    dir: &Path,
    name: &str,
    frontmatter_changes: Option<&Value>,
    new_content: Option<&str>,
) -> Result<Option<Command>, ApiError> {
    if !is_safe_name(name) {
        return Ok(None);
    }
    let Some(existing) = get(dir, name)? else {
        return Ok(None);
    };
    let mut merged = existing.frontmatter.clone();
    if let Some(changes) = frontmatter_changes {
        if let (Some(merged_obj), Some(changes_obj)) = (merged.as_object_mut(), changes.as_object())
        {
            for (k, v) in changes_obj {
                merged_obj.insert(k.clone(), v.clone());
            }
        }
    }
    let body = new_content.unwrap_or(&existing.content);
    let raw = frontmatter::stringify(&merged, body)?;
    let path = dir.join(format!("{name}.md"));
    std::fs::write(&path, &raw).map_err(|e| ApiError::Io(format!("write {}: {e}", path.display())))?;
    parse_command(&format!("{name}.md"), &raw)
}

pub fn delete(dir: &Path, name: &str) -> Result<bool, ApiError> {
    if !is_safe_name(name) {
        return Ok(false);
    }
    let path = dir.join(format!("{name}.md"));
    match std::fs::remove_file(&path) {
        Ok(()) => Ok(true),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(e) => Err(ApiError::Io(format!("remove {}: {e}", path.display()))),
    }
}
```

- [ ] **Step 4: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib components::commands 2>&1 | tail -15`
Expected: 11 tests pass (4 existing + 7 new).

- [ ] **Step 5: Commit**

```bash
git add crates/ohmyc-core/src/components/commands.rs
git commit -m "feat(core): components::commands create/update/delete"
```

---

## Task 4: Extend `components::skills` with `create`/`update`/`delete` (TDD)

**Files:**
- Modify: `crates/ohmyc-core/src/components/skills.rs`

Skills are directory-based (each skill is `<dir>/<name>/SKILL.md`). Writes create/remove the *directory*, not just a file.

- [ ] **Step 1: Add the failing tests**

Open `crates/ohmyc-core/src/components/skills.rs`. In the `#[cfg(test)] mod tests` block, append:

```rust
    #[test]
    fn create_creates_skill_dir_with_skill_md() {
        let dir = tempfile::tempdir().unwrap();
        let front = serde_json::json!({"name": "alpha", "description": "first"});
        let skill = create(dir.path(), &front, "body").unwrap();
        assert_eq!(skill.id, "alpha");
        assert_eq!(skill.dir_name, "alpha");
        assert!(dir.path().join("alpha").join("SKILL.md").exists());
    }

    #[test]
    fn create_errors_with_conflict_when_dir_exists() {
        let dir = tempfile::tempdir().unwrap();
        let front = serde_json::json!({"name": "dup", "description": "d"});
        create(dir.path(), &front, "x").unwrap();
        let err = create(dir.path(), &front, "y").unwrap_err();
        assert!(matches!(err, ApiError::Conflict(_)));
    }

    #[test]
    fn create_rejects_invalid_name() {
        let dir = tempfile::tempdir().unwrap();
        let front = serde_json::json!({"name": "../bad", "description": "d"});
        let err = create(dir.path(), &front, "x").unwrap_err();
        assert!(matches!(err, ApiError::InvalidInput(_)));
    }

    #[test]
    fn update_writes_new_skill_md_preserving_dir() {
        let dir = tempfile::tempdir().unwrap();
        let front = serde_json::json!({"name": "a", "description": "old"});
        create(dir.path(), &front, "old body").unwrap();
        let partial = serde_json::json!({"description": "new"});
        let updated = update(dir.path(), "a", Some(&partial), Some("new body"))
            .unwrap()
            .expect("skill updated");
        assert_eq!(updated.frontmatter["description"], "new");
        assert_eq!(updated.content, "new body");
        assert!(dir.path().join("a").join("SKILL.md").exists());
    }

    #[test]
    fn update_returns_none_when_dir_missing() {
        let dir = tempfile::tempdir().unwrap();
        assert!(update(dir.path(), "missing", None, None).unwrap().is_none());
    }

    #[test]
    fn delete_removes_entire_skill_dir() {
        let dir = tempfile::tempdir().unwrap();
        let front = serde_json::json!({"name": "x", "description": "d"});
        create(dir.path(), &front, "body").unwrap();
        // Add an extra file inside the skill dir; delete should still wipe everything.
        std::fs::write(dir.path().join("x").join("extra.txt"), "noise").unwrap();
        assert!(delete(dir.path(), "x").unwrap());
        assert!(!dir.path().join("x").exists());
    }

    #[test]
    fn delete_returns_false_when_missing_or_invalid_name() {
        let dir = tempfile::tempdir().unwrap();
        assert!(!delete(dir.path(), "missing").unwrap());
        assert!(!delete(dir.path(), "../bad").unwrap());
    }
```

- [ ] **Step 2: Run to confirm they fail**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib components::skills 2>&1 | tail -10`
Expected: compile errors.

- [ ] **Step 3: Implement the three functions**

In `crates/ohmyc-core/src/components/skills.rs`, after `parse_skill` (and before `#[cfg(test)]`), add:

```rust
pub fn create(dir: &Path, frontmatter: &Value, content: &str) -> Result<Skill, ApiError> {
    let name = frontmatter
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ApiError::InvalidInput("frontmatter.name is required".to_string()))?;
    if !is_safe_name(name) {
        return Err(ApiError::InvalidInput(format!(
            "skill name '{name}' must match [a-zA-Z0-9_-]"
        )));
    }
    let skill_dir = dir.join(name);
    if skill_dir.exists() {
        return Err(ApiError::Conflict(format!("skill '{name}' already exists")));
    }
    std::fs::create_dir_all(&skill_dir)
        .map_err(|e| ApiError::Io(format!("mkdir {}: {e}", skill_dir.display())))?;
    let raw = frontmatter::stringify(frontmatter, content)?;
    let file_path = skill_dir.join(SKILL_FILE);
    std::fs::write(&file_path, &raw)
        .map_err(|e| ApiError::Io(format!("write {}: {e}", file_path.display())))?;
    parse_skill(name, &raw)?
        .ok_or_else(|| ApiError::Internal("parse_skill returned None after create".to_string()))
}

pub fn update(
    dir: &Path,
    name: &str,
    frontmatter_changes: Option<&Value>,
    new_content: Option<&str>,
) -> Result<Option<Skill>, ApiError> {
    if !is_safe_name(name) {
        return Ok(None);
    }
    let Some(existing) = get(dir, name)? else {
        return Ok(None);
    };
    let mut merged = existing.frontmatter.clone();
    if let Some(changes) = frontmatter_changes {
        if let (Some(merged_obj), Some(changes_obj)) = (merged.as_object_mut(), changes.as_object())
        {
            for (k, v) in changes_obj {
                merged_obj.insert(k.clone(), v.clone());
            }
        }
    }
    let body = new_content.unwrap_or(&existing.content);
    let raw = frontmatter::stringify(&merged, body)?;
    let file_path = dir.join(name).join(SKILL_FILE);
    std::fs::write(&file_path, &raw)
        .map_err(|e| ApiError::Io(format!("write {}: {e}", file_path.display())))?;
    parse_skill(name, &raw)
}

pub fn delete(dir: &Path, name: &str) -> Result<bool, ApiError> {
    if !is_safe_name(name) {
        return Ok(false);
    }
    let skill_dir = dir.join(name);
    match std::fs::remove_dir_all(&skill_dir) {
        Ok(()) => Ok(true),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(e) => Err(ApiError::Io(format!(
            "remove {}: {e}",
            skill_dir.display()
        ))),
    }
}
```

- [ ] **Step 4: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib components::skills 2>&1 | tail -15`
Expected: 12 tests pass (5 existing + 7 new).

- [ ] **Step 5: Commit**

```bash
git add crates/ohmyc-core/src/components/skills.rs
git commit -m "feat(core): components::skills create/update/delete (dir-based)"
```

---

## Task 5: Scaffold the `store` namespace + path helpers

**Files:**
- Create: `crates/ohmyc-core/src/store/mod.rs`
- Modify: `crates/ohmyc-core/src/lib.rs`

Store data lives under `$OHMYC_HOME/store/` (a separate root from `<claude_home>` used by Slice 3). The helpers here centralize that path math.

- [ ] **Step 1: Create the namespace module**

Create `crates/ohmyc-core/src/store/mod.rs`:

```rust
//! Store CRUD — agents/skills/commands/model-configs managed by OhMyC.
//! Lives under `$OHMYC_HOME/store/`, separate from `<claude_home>/` which
//! holds the user's Claude Code config. This namespace also owns
//! provenance metadata (where each component was imported from) and the
//! reference-check that gates delete-safety against active profiles.

pub mod model_configs;
pub mod provenance;
pub mod references;

use std::path::PathBuf;

use crate::error::ApiError;

const ENV_HOME: &str = "OHMYC_HOME";

/// Resolve `$OHMYC_HOME` (default `~/.config/ohmyc/`). Mirrors
/// `packages/cli/src/server/services/config-locator.ts::writeBaseDir`.
pub fn base_dir() -> Result<PathBuf, ApiError> {
    if let Ok(home) = std::env::var(ENV_HOME) {
        if !home.is_empty() {
            return Ok(PathBuf::from(home));
        }
    }
    let user_home = dirs::home_dir()
        .ok_or_else(|| ApiError::Internal("could not determine home dir".to_string()))?;
    Ok(user_home.join(".config").join("ohmyc"))
}

pub fn store_dir() -> Result<PathBuf, ApiError> {
    Ok(base_dir()?.join("store"))
}

pub fn store_agents_dir() -> Result<PathBuf, ApiError> {
    Ok(store_dir()?.join("agents"))
}

pub fn store_skills_dir() -> Result<PathBuf, ApiError> {
    Ok(store_dir()?.join("skills"))
}

pub fn store_commands_dir() -> Result<PathBuf, ApiError> {
    Ok(store_dir()?.join("commands"))
}

pub fn store_model_configs_dir() -> Result<PathBuf, ApiError> {
    Ok(store_dir()?.join("model-configs"))
}

pub fn store_profiles_dir() -> Result<PathBuf, ApiError> {
    Ok(base_dir()?.join("profiles"))
}

pub fn provenance_index_path() -> Result<PathBuf, ApiError> {
    Ok(store_dir()?.join(".metadata").join("imports.json"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn base_dir_honors_ohmyc_home_env() {
        let _lock = ENV_LOCK.lock().unwrap();
        let prev = std::env::var(ENV_HOME).ok();
        std::env::set_var(ENV_HOME, "/tmp/fake-ohmyc");
        assert_eq!(base_dir().unwrap(), PathBuf::from("/tmp/fake-ohmyc"));
        match prev {
            Some(v) => std::env::set_var(ENV_HOME, v),
            None => std::env::remove_var(ENV_HOME),
        }
    }

    #[test]
    fn store_paths_compose_under_base() {
        let _lock = ENV_LOCK.lock().unwrap();
        let prev = std::env::var(ENV_HOME).ok();
        std::env::set_var(ENV_HOME, "/tmp/fake-ohmyc");
        assert_eq!(store_agents_dir().unwrap(), PathBuf::from("/tmp/fake-ohmyc/store/agents"));
        assert_eq!(store_skills_dir().unwrap(), PathBuf::from("/tmp/fake-ohmyc/store/skills"));
        assert_eq!(store_commands_dir().unwrap(), PathBuf::from("/tmp/fake-ohmyc/store/commands"));
        assert_eq!(
            store_model_configs_dir().unwrap(),
            PathBuf::from("/tmp/fake-ohmyc/store/model-configs"),
        );
        assert_eq!(store_profiles_dir().unwrap(), PathBuf::from("/tmp/fake-ohmyc/profiles"));
        assert_eq!(
            provenance_index_path().unwrap(),
            PathBuf::from("/tmp/fake-ohmyc/store/.metadata/imports.json"),
        );
        match prev {
            Some(v) => std::env::set_var(ENV_HOME, v),
            None => std::env::remove_var(ENV_HOME),
        }
    }
}
```

- [ ] **Step 2: Export from lib.rs**

Open `crates/ohmyc-core/src/lib.rs`. Add `pub mod store;`. Final state:

```rust
pub mod claude_home;
pub mod components;
pub mod configs;
pub mod error;
pub mod settings;
pub mod store;
pub mod timeline;
pub mod watcher;

pub use error::ApiError;
```

- [ ] **Step 3: Run tests (submodules don't exist yet — compile will fail at the `pub mod` lines)**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo build -p ohmyc-core 2>&1 | tail -10`
Expected: errors about missing `model_configs`, `provenance`, `references` modules. Next tasks add them.

- [ ] **Step 4: Commit (deferred — bundle with Task 6 since the build is broken until then)**

Skip the commit here; we'll bundle it with the next task whose tests pass cleanly.

---

## Task 6: Implement `store::model_configs` (TDD)

**Files:**
- Create: `crates/ohmyc-core/src/store/model_configs.rs`

Model configs are pure JSON (no frontmatter). Name regex allows `./` (e.g. `anthropic/sonnet-4`), with explicit `..` rejection.

- [ ] **Step 1: Create the module + tests + implementation**

Create `crates/ohmyc-core/src/store/model_configs.rs`:

```rust
//! Read/write JSON-based model configs. Each config is one
//! `<dir>/<name>.json` file. Name regex `[a-zA-Z0-9_./-]+` allows
//! provider-prefixed names like `anthropic/sonnet-4`, but `..` is
//! rejected to prevent directory traversal.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::ApiError;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ModelConfig {
    pub name: String,
    #[serde(default)]
    pub api_key: String,
    #[serde(default)]
    pub base_url: String,
    #[serde(default)]
    pub model_name: String,
    #[serde(default)]
    pub provider: String,
}

pub fn is_safe_model_config_name(name: &str) -> bool {
    if name.is_empty() || name.contains("..") {
        return false;
    }
    name.chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.' | '/'))
}

pub fn list(dir: &Path) -> Result<Vec<ModelConfig>, ApiError> {
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut out: Vec<ModelConfig> = Vec::new();
    walk_collect(dir, &mut out)?;
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

fn walk_collect(dir: &Path, out: &mut Vec<ModelConfig>) -> Result<(), ApiError> {
    for entry in std::fs::read_dir(dir).map_err(ApiError::from)? {
        let entry = entry.map_err(ApiError::from)?;
        let p = entry.path();
        if p.is_dir() {
            walk_collect(&p, out)?;
            continue;
        }
        if p.extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }
        let raw = match std::fs::read_to_string(&p) {
            Ok(s) => s,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => continue,
            Err(e) => return Err(ApiError::Io(format!("read {}: {e}", p.display()))),
        };
        if let Ok(c) = serde_json::from_str::<ModelConfig>(&raw) {
            out.push(c);
        }
    }
    Ok(())
}

pub fn get(dir: &Path, name: &str) -> Result<Option<ModelConfig>, ApiError> {
    if !is_safe_model_config_name(name) {
        return Ok(None);
    }
    let path = dir.join(format!("{name}.json"));
    match std::fs::read_to_string(&path) {
        Ok(raw) => {
            let c: ModelConfig = serde_json::from_str(&raw)
                .map_err(|e| ApiError::Parse(format!("{}: {e}", path.display())))?;
            Ok(Some(c))
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(ApiError::Io(format!("read {}: {e}", path.display()))),
    }
}

pub fn create(dir: &Path, config: &ModelConfig) -> Result<ModelConfig, ApiError> {
    if !is_safe_model_config_name(&config.name) {
        return Err(ApiError::InvalidInput(format!(
            "model-config name '{}' must match [a-zA-Z0-9_./-] and not contain '..'",
            config.name
        )));
    }
    let path: PathBuf = dir.join(format!("{}.json", config.name));
    if path.exists() {
        return Err(ApiError::Conflict(format!(
            "model-config '{}' already exists",
            config.name
        )));
    }
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| ApiError::Io(format!("mkdir {}: {e}", parent.display())))?;
    }
    let raw = serde_json::to_string_pretty(config)
        .map_err(|e| ApiError::Internal(format!("serialize model config: {e}")))?;
    std::fs::write(&path, raw).map_err(|e| ApiError::Io(format!("write {}: {e}", path.display())))?;
    Ok(config.clone())
}

pub fn update(
    dir: &Path,
    name: &str,
    changes: &serde_json::Value,
) -> Result<Option<ModelConfig>, ApiError> {
    if !is_safe_model_config_name(name) {
        return Ok(None);
    }
    let Some(existing) = get(dir, name)? else {
        return Ok(None);
    };
    let mut merged = serde_json::to_value(&existing)
        .map_err(|e| ApiError::Internal(format!("to_value: {e}")))?;
    if let (Some(merged_obj), Some(changes_obj)) = (merged.as_object_mut(), changes.as_object()) {
        for (k, v) in changes_obj {
            merged_obj.insert(k.clone(), v.clone());
        }
    }
    let next: ModelConfig = serde_json::from_value(merged)
        .map_err(|e| ApiError::Validation(format!("merged model-config invalid: {e}")))?;
    let path = dir.join(format!("{name}.json"));
    let raw = serde_json::to_string_pretty(&next)
        .map_err(|e| ApiError::Internal(format!("serialize: {e}")))?;
    std::fs::write(&path, raw).map_err(|e| ApiError::Io(format!("write {}: {e}", path.display())))?;
    Ok(Some(next))
}

pub fn delete(dir: &Path, name: &str) -> Result<bool, ApiError> {
    if !is_safe_model_config_name(name) {
        return Ok(false);
    }
    let path = dir.join(format!("{name}.json"));
    match std::fs::remove_file(&path) {
        Ok(()) => Ok(true),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(e) => Err(ApiError::Io(format!("remove {}: {e}", path.display()))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> ModelConfig {
        ModelConfig {
            name: "anthropic/sonnet-4".to_string(),
            api_key: "sk-test".to_string(),
            base_url: "https://api.anthropic.com".to_string(),
            model_name: "claude-sonnet-4".to_string(),
            provider: "anthropic".to_string(),
        }
    }

    #[test]
    fn is_safe_accepts_provider_prefixed_names() {
        assert!(is_safe_model_config_name("anthropic/sonnet-4"));
        assert!(is_safe_model_config_name("openai/gpt-4o"));
        assert!(is_safe_model_config_name("local"));
        assert!(is_safe_model_config_name("v1.0.0"));
    }

    #[test]
    fn is_safe_rejects_traversal_and_empty() {
        assert!(!is_safe_model_config_name(""));
        assert!(!is_safe_model_config_name(".."));
        assert!(!is_safe_model_config_name("../etc"));
        assert!(!is_safe_model_config_name("a/../b"));
        assert!(!is_safe_model_config_name("with space"));
    }

    #[test]
    fn create_then_list_returns_config() {
        let dir = tempfile::tempdir().unwrap();
        create(dir.path(), &fixture()).unwrap();
        let all = list(dir.path()).unwrap();
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].name, "anthropic/sonnet-4");
    }

    #[test]
    fn list_walks_nested_provider_dirs() {
        let dir = tempfile::tempdir().unwrap();
        create(dir.path(), &fixture()).unwrap();
        let mut c2 = fixture();
        c2.name = "openai/gpt-4o".to_string();
        create(dir.path(), &c2).unwrap();
        let all = list(dir.path()).unwrap();
        assert_eq!(all.len(), 2);
        // sorted
        assert_eq!(all[0].name, "anthropic/sonnet-4");
        assert_eq!(all[1].name, "openai/gpt-4o");
    }

    #[test]
    fn get_returns_config_or_none() {
        let dir = tempfile::tempdir().unwrap();
        create(dir.path(), &fixture()).unwrap();
        let c = get(dir.path(), "anthropic/sonnet-4").unwrap().unwrap();
        assert_eq!(c.provider, "anthropic");
        assert!(get(dir.path(), "missing").unwrap().is_none());
        assert!(get(dir.path(), "../bad").unwrap().is_none());
    }

    #[test]
    fn create_errors_with_conflict_when_exists() {
        let dir = tempfile::tempdir().unwrap();
        create(dir.path(), &fixture()).unwrap();
        let err = create(dir.path(), &fixture()).unwrap_err();
        assert!(matches!(err, ApiError::Conflict(_)));
    }

    #[test]
    fn create_rejects_invalid_name() {
        let dir = tempfile::tempdir().unwrap();
        let mut bad = fixture();
        bad.name = "../bad".to_string();
        let err = create(dir.path(), &bad).unwrap_err();
        assert!(matches!(err, ApiError::InvalidInput(_)));
    }

    #[test]
    fn update_merges_partial_changes() {
        let dir = tempfile::tempdir().unwrap();
        create(dir.path(), &fixture()).unwrap();
        let changes = serde_json::json!({"apiKey": "sk-new", "provider": "anthropic"});
        let updated = update(dir.path(), "anthropic/sonnet-4", &changes)
            .unwrap()
            .expect("updated");
        assert_eq!(updated.api_key, "sk-new");
        // baseUrl preserved
        assert_eq!(updated.base_url, "https://api.anthropic.com");
    }

    #[test]
    fn update_returns_none_when_missing() {
        let dir = tempfile::tempdir().unwrap();
        assert!(update(dir.path(), "missing", &serde_json::json!({})).unwrap().is_none());
    }

    #[test]
    fn delete_removes_file_and_returns_true() {
        let dir = tempfile::tempdir().unwrap();
        create(dir.path(), &fixture()).unwrap();
        assert!(delete(dir.path(), "anthropic/sonnet-4").unwrap());
        assert!(get(dir.path(), "anthropic/sonnet-4").unwrap().is_none());
    }

    #[test]
    fn delete_returns_false_when_missing_or_invalid() {
        let dir = tempfile::tempdir().unwrap();
        assert!(!delete(dir.path(), "missing").unwrap());
        assert!(!delete(dir.path(), "../bad").unwrap());
    }
}
```

- [ ] **Step 2: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib store::model_configs 2>&1 | tail -15`
Expected: failures at first — module not exported. Will pass once the `pub mod model_configs;` line in store/mod.rs already exists from Task 5. Re-run:

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib store::model_configs 2>&1 | tail -15`
Expected: 11 tests pass.

- [ ] **Step 3: Commit (bundled with Task 5 scaffold since Task 5's build was broken)**

```bash
git add crates/ohmyc-core/src/store/mod.rs crates/ohmyc-core/src/store/model_configs.rs crates/ohmyc-core/src/lib.rs
git commit -m "feat(core): store::{mod,model_configs} — path helpers + JSON CRUD"
```

(The `provenance` and `references` modules referenced by `mod.rs` don't exist yet. Comment those out in `mod.rs` first, then commit, then uncomment as Tasks 7-8 add them. OR add the empty stubs in Task 5's commit. Choose stubs to keep history linear:)

If you prefer not to comment-out: before running Step 2 above, create empty stub files:

```bash
cat > crates/ohmyc-core/src/store/provenance.rs <<'EOF'
//! Provenance attachment — implemented in Task 7.
EOF
cat > crates/ohmyc-core/src/store/references.rs <<'EOF'
//! Profile reference scan — implemented in Task 8.
EOF
```

Then the bundled commit includes those stubs too.

---

## Task 7: Implement `store::provenance` (TDD)

**Files:**
- Modify (replace stub): `crates/ohmyc-core/src/store/provenance.rs`

Provenance is a read-only enrichment: the index lives at `<store>/.metadata/imports.json` and maps `{ agents: { id: { importPath, importedAt } }, ... }`.

- [ ] **Step 1: Replace the stub**

Replace `crates/ohmyc-core/src/store/provenance.rs` with:

```rust
//! Read provenance metadata from `<store>/.metadata/imports.json`.
//! Provenance is a read-time enrichment — when present, attach
//! `{ importPath, importedAt }` to a store component on `get`/`list`.

use std::collections::HashMap;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::error::ApiError;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Provenance {
    pub import_path: String,
    pub imported_at: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ComponentKind {
    Agents,
    Skills,
    Commands,
    ModelConfigs,
}

impl ComponentKind {
    fn as_index_key(&self) -> &'static str {
        match self {
            Self::Agents => "agents",
            Self::Skills => "skills",
            Self::Commands => "commands",
            Self::ModelConfigs => "model-configs",
        }
    }
}

type Index = HashMap<String, HashMap<String, Provenance>>;

/// Read the index file. Returns an empty map when missing or malformed
/// (matches the TS server's defensive read).
pub fn read_index(index_path: &Path) -> Result<Index, ApiError> {
    let raw = match std::fs::read_to_string(index_path) {
        Ok(s) => s,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Index::new()),
        Err(e) => return Err(ApiError::Io(format!("read {}: {e}", index_path.display()))),
    };
    match serde_json::from_str::<Index>(&raw) {
        Ok(idx) => Ok(idx),
        Err(_) => Ok(Index::new()),
    }
}

pub fn get(index_path: &Path, kind: ComponentKind, id: &str) -> Result<Option<Provenance>, ApiError> {
    let idx = read_index(index_path)?;
    Ok(idx.get(kind.as_index_key()).and_then(|m| m.get(id)).cloned())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seeded_index(dir: &Path) -> std::path::PathBuf {
        let path = dir.join("imports.json");
        let content = r#"{
            "agents": { "alpha": { "importPath": "/src/alpha.md", "importedAt": "2026-01-01T00:00:00Z" } },
            "skills": {},
            "commands": {},
            "model-configs": { "anthropic/sonnet-4": { "importPath": "/src/m.json", "importedAt": "2026-02-01T00:00:00Z" } }
        }"#;
        std::fs::write(&path, content).unwrap();
        path
    }

    #[test]
    fn get_returns_provenance_when_present() {
        let dir = tempfile::tempdir().unwrap();
        let path = seeded_index(dir.path());
        let p = get(&path, ComponentKind::Agents, "alpha").unwrap().unwrap();
        assert_eq!(p.import_path, "/src/alpha.md");
    }

    #[test]
    fn get_returns_none_when_id_missing() {
        let dir = tempfile::tempdir().unwrap();
        let path = seeded_index(dir.path());
        assert!(get(&path, ComponentKind::Agents, "nope").unwrap().is_none());
    }

    #[test]
    fn get_handles_model_configs_kind_with_hyphenated_key() {
        let dir = tempfile::tempdir().unwrap();
        let path = seeded_index(dir.path());
        let p = get(&path, ComponentKind::ModelConfigs, "anthropic/sonnet-4")
            .unwrap()
            .unwrap();
        assert_eq!(p.import_path, "/src/m.json");
    }

    #[test]
    fn returns_empty_when_index_missing() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("nonexistent.json");
        assert!(get(&path, ComponentKind::Agents, "x").unwrap().is_none());
    }

    #[test]
    fn returns_empty_when_index_malformed() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("imports.json");
        std::fs::write(&path, "{ not valid json").unwrap();
        assert!(get(&path, ComponentKind::Agents, "x").unwrap().is_none());
    }
}
```

- [ ] **Step 2: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib store::provenance 2>&1 | tail -10`
Expected: 5 tests pass.

- [ ] **Step 3: Commit**

```bash
git add crates/ohmyc-core/src/store/provenance.rs
git commit -m "feat(core): store::provenance — read-time enrichment from imports.json"
```

---

## Task 8: Implement `store::references` (TDD)

**Files:**
- Modify (replace stub): `crates/ohmyc-core/src/store/references.rs`

This is the "Used by N profiles" killer column. Scans `<base>/profiles/<name>/profile.json` files; returns the names of profiles that reference the given component.

- [ ] **Step 1: Replace the stub**

Replace `crates/ohmyc-core/src/store/references.rs` with:

```rust
//! Reference-check across profiles — which profiles list a given
//! component as a dependency? Used both for the "Used by N profiles"
//! display column and to gate `delete` unless `force=true`.

use std::path::Path;

use serde_json::Value;

use crate::error::ApiError;
use crate::store::provenance::ComponentKind;

/// Scan every `<profiles_dir>/<name>/profile.json` for references to
/// `(kind, name)`. Returns the matching profile names (alphabetically
/// sorted).
///
/// Profile shape (minimal contract): a JSON object with
/// `name: string`, plus the kind-specific reference field:
/// - agents/skills/commands → array of strings under the matching key
/// - model-configs → string under `modelConfig`
pub fn referencing_profiles(
    profiles_dir: &Path,
    kind: ComponentKind,
    component_name: &str,
) -> Result<Vec<String>, ApiError> {
    if !profiles_dir.exists() {
        return Ok(Vec::new());
    }
    let mut out: Vec<String> = Vec::new();
    for entry in std::fs::read_dir(profiles_dir).map_err(ApiError::from)? {
        let entry = entry.map_err(ApiError::from)?;
        let p = entry.path();
        if !p.is_dir() {
            continue;
        }
        let dir_name = match p.file_name().and_then(|s| s.to_str()) {
            Some(s) if !s.starts_with('.') => s.to_string(),
            _ => continue,
        };
        let profile_path = p.join("profile.json");
        let raw = match std::fs::read_to_string(&profile_path) {
            Ok(s) => s,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => continue,
            Err(_) => continue,
        };
        let profile: Value = match serde_json::from_str(&raw) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let name = profile
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or(&dir_name)
            .to_string();
        if matches(&profile, kind, component_name) {
            out.push(name);
        }
    }
    out.sort();
    Ok(out)
}

fn matches(profile: &Value, kind: ComponentKind, name: &str) -> bool {
    match kind {
        ComponentKind::ModelConfigs => profile
            .get("modelConfig")
            .and_then(|v| v.as_str())
            .map(|s| s == name)
            .unwrap_or(false),
        other => {
            let key = match other {
                ComponentKind::Agents => "agents",
                ComponentKind::Skills => "skills",
                ComponentKind::Commands => "commands",
                _ => unreachable!(),
            };
            profile
                .get(key)
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().any(|x| x.as_str() == Some(name)))
                .unwrap_or(false)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_profile(dir: &Path, name: &str, body: &str) {
        let p = dir.join(name);
        std::fs::create_dir_all(&p).unwrap();
        std::fs::write(p.join("profile.json"), body).unwrap();
    }

    #[test]
    fn returns_empty_when_profiles_dir_missing() {
        let r = referencing_profiles(
            Path::new("/nonexistent"),
            ComponentKind::Agents,
            "alpha",
        )
        .unwrap();
        assert!(r.is_empty());
    }

    #[test]
    fn finds_profiles_listing_the_agent() {
        let dir = tempfile::tempdir().unwrap();
        make_profile(dir.path(), "dev", r#"{"name":"dev","agents":["alpha","beta"],"skills":[],"commands":[]}"#);
        make_profile(dir.path(), "prod", r#"{"name":"prod","agents":["beta"],"skills":[],"commands":[]}"#);
        make_profile(dir.path(), "empty", r#"{"name":"empty","agents":[],"skills":[],"commands":[]}"#);
        let r = referencing_profiles(dir.path(), ComponentKind::Agents, "alpha").unwrap();
        assert_eq!(r, vec!["dev"]);
    }

    #[test]
    fn finds_profiles_referencing_model_config_by_string_field() {
        let dir = tempfile::tempdir().unwrap();
        make_profile(dir.path(), "p1", r#"{"name":"p1","modelConfig":"anthropic/sonnet-4"}"#);
        make_profile(dir.path(), "p2", r#"{"name":"p2","modelConfig":"openai/gpt-4o"}"#);
        let r = referencing_profiles(dir.path(), ComponentKind::ModelConfigs, "anthropic/sonnet-4")
            .unwrap();
        assert_eq!(r, vec!["p1"]);
    }

    #[test]
    fn returns_sorted_alphabetically() {
        let dir = tempfile::tempdir().unwrap();
        make_profile(dir.path(), "zeta", r#"{"name":"zeta","agents":["x"]}"#);
        make_profile(dir.path(), "alpha", r#"{"name":"alpha","agents":["x"]}"#);
        let r = referencing_profiles(dir.path(), ComponentKind::Agents, "x").unwrap();
        assert_eq!(r, vec!["alpha", "zeta"]);
    }

    #[test]
    fn skips_dot_prefixed_dirs_and_malformed_profiles() {
        let dir = tempfile::tempdir().unwrap();
        make_profile(dir.path(), ".hidden", r#"{"name":".hidden","agents":["x"]}"#);
        // Malformed JSON
        let bad = dir.path().join("broken");
        std::fs::create_dir_all(&bad).unwrap();
        std::fs::write(bad.join("profile.json"), "{ not json").unwrap();
        // Valid match
        make_profile(dir.path(), "ok", r#"{"name":"ok","agents":["x"]}"#);
        let r = referencing_profiles(dir.path(), ComponentKind::Agents, "x").unwrap();
        assert_eq!(r, vec!["ok"]);
    }

    #[test]
    fn falls_back_to_dir_name_when_profile_name_missing() {
        let dir = tempfile::tempdir().unwrap();
        make_profile(dir.path(), "no-name-field", r#"{"agents":["x"]}"#);
        let r = referencing_profiles(dir.path(), ComponentKind::Agents, "x").unwrap();
        assert_eq!(r, vec!["no-name-field"]);
    }
}
```

- [ ] **Step 2: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core --lib store::references 2>&1 | tail -10`
Expected: 6 tests pass.

- [ ] **Step 3: Confirm the full core suite is green**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test -p ohmyc-core 2>&1 | grep "test result"`
Expected: all green; total ~110 tests (71 from slice 4 + ~40 new).

- [ ] **Step 4: Commit**

```bash
git add crates/ohmyc-core/src/store/references.rs
git commit -m "feat(core): store::references — Used-by-N-profiles scan"
```

---

## Task 9: Tauri command wrappers — store CRUD (20 commands in one file)

**Files:**
- Create: `packages/desktop/src-tauri/src/api/store.rs`
- Modify: `packages/desktop/src-tauri/src/api/mod.rs`

20 commands all live in one file for ergonomics — each is a 3-5 line passthrough.

- [ ] **Step 1: Create the store commands file**

Create `packages/desktop/src-tauri/src/api/store.rs`:

```rust
//! Tauri command wrappers for ohmyc-core::store CRUD. 4 entity types ×
//! 5 ops (list/get/create/update/delete). Delete commands honor a
//! `force` flag — when false, refuse if any profile references the
//! component and return Conflict with the referencing profile names.

use ohmyc_core::components::{agents, commands, skills};
use ohmyc_core::components::agents::Agent;
use ohmyc_core::components::commands::Command;
use ohmyc_core::components::skills::Skill;
use ohmyc_core::error::ApiError;
use ohmyc_core::store::{
    self,
    model_configs::{self, ModelConfig},
    provenance::{self, ComponentKind, Provenance},
    references,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Serialize)]
pub struct AgentDto {
    #[serde(flatten)]
    pub agent: Agent,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provenance: Option<Provenance>,
}

#[derive(Serialize)]
pub struct SkillDto {
    #[serde(flatten)]
    pub skill: Skill,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provenance: Option<Provenance>,
}

#[derive(Serialize)]
pub struct CommandDto {
    #[serde(flatten)]
    pub command: Command,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provenance: Option<Provenance>,
}

#[derive(Serialize)]
pub struct ModelConfigDto {
    #[serde(flatten)]
    pub config: ModelConfig,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provenance: Option<Provenance>,
}

#[derive(Serialize)]
pub struct ListAgents { pub agents: Vec<AgentDto> }
#[derive(Serialize)]
pub struct GetAgent { pub agent: AgentDto }
#[derive(Serialize)]
pub struct ListSkills { pub skills: Vec<SkillDto> }
#[derive(Serialize)]
pub struct GetSkill { pub skill: SkillDto }
#[derive(Serialize)]
pub struct ListCommands { pub commands: Vec<CommandDto> }
#[derive(Serialize)]
pub struct GetCommand { pub command: CommandDto }
#[derive(Serialize)]
pub struct ListModelConfigs {
    #[serde(rename = "modelConfigs")]
    pub model_configs: Vec<ModelConfigDto>,
}
#[derive(Serialize)]
pub struct GetModelConfig {
    #[serde(rename = "modelConfig")]
    pub config: ModelConfigDto,
}
#[derive(Serialize)]
pub struct DeleteOk { pub success: bool }

fn attach_provenance<T>(kind: ComponentKind, id: &str, item: T) -> Result<(T, Option<Provenance>), ApiError> {
    let idx_path = store::provenance_index_path()?;
    let p = provenance::get(&idx_path, kind, id)?;
    Ok((item, p))
}

// --- Agents ---

#[tauri::command]
pub fn store_agents_list() -> Result<ListAgents, ApiError> {
    let dir = store::store_agents_dir()?;
    let raw = agents::list(&dir)?;
    let mut out: Vec<AgentDto> = Vec::with_capacity(raw.len());
    for a in raw {
        let id = a.id.clone();
        let (agent, provenance) = attach_provenance(ComponentKind::Agents, &id, a)?;
        out.push(AgentDto { agent, provenance });
    }
    Ok(ListAgents { agents: out })
}

#[tauri::command]
pub fn store_agents_get(name: String) -> Result<GetAgent, ApiError> {
    let dir = store::store_agents_dir()?;
    let a = agents::get(&dir, &name)?
        .ok_or_else(|| ApiError::NotFound { kind: "agent", name: name.clone() })?;
    let (agent, provenance) = attach_provenance(ComponentKind::Agents, &name, a)?;
    Ok(GetAgent { agent: AgentDto { agent, provenance } })
}

#[derive(Deserialize)]
pub struct CreateAgentBody { pub frontmatter: Value, pub content: String }

#[tauri::command]
pub fn store_agents_create(body: CreateAgentBody) -> Result<GetAgent, ApiError> {
    let dir = store::store_agents_dir()?;
    let a = agents::create(&dir, &body.frontmatter, &body.content)?;
    Ok(GetAgent { agent: AgentDto { agent: a, provenance: None } })
}

#[derive(Deserialize)]
pub struct UpdateAgentBody {
    pub frontmatter: Option<Value>,
    pub content: Option<String>,
}

#[tauri::command]
pub fn store_agents_update(name: String, body: UpdateAgentBody) -> Result<GetAgent, ApiError> {
    let dir = store::store_agents_dir()?;
    let updated = agents::update(&dir, &name, body.frontmatter.as_ref(), body.content.as_deref())?
        .ok_or_else(|| ApiError::NotFound { kind: "agent", name: name.clone() })?;
    Ok(GetAgent { agent: AgentDto { agent: updated, provenance: None } })
}

#[tauri::command]
pub fn store_agents_delete(name: String, force: Option<bool>) -> Result<DeleteOk, ApiError> {
    if !force.unwrap_or(false) {
        let profiles_dir = store::store_profiles_dir()?;
        let refs = references::referencing_profiles(&profiles_dir, ComponentKind::Agents, &name)?;
        if !refs.is_empty() {
            return Err(ApiError::Conflict(format!(
                "agent '{name}' is referenced by profiles: {}",
                refs.join(", ")
            )));
        }
    }
    let dir = store::store_agents_dir()?;
    let removed = agents::delete(&dir, &name)?;
    if !removed {
        return Err(ApiError::NotFound { kind: "agent", name });
    }
    Ok(DeleteOk { success: true })
}

// --- Skills ---

#[tauri::command]
pub fn store_skills_list() -> Result<ListSkills, ApiError> {
    let dir = store::store_skills_dir()?;
    let raw = skills::list(&dir)?;
    let mut out: Vec<SkillDto> = Vec::with_capacity(raw.len());
    for s in raw {
        let id = s.id.clone();
        let (skill, provenance) = attach_provenance(ComponentKind::Skills, &id, s)?;
        out.push(SkillDto { skill, provenance });
    }
    Ok(ListSkills { skills: out })
}

#[tauri::command]
pub fn store_skills_get(name: String) -> Result<GetSkill, ApiError> {
    let dir = store::store_skills_dir()?;
    let s = skills::get(&dir, &name)?
        .ok_or_else(|| ApiError::NotFound { kind: "skill", name: name.clone() })?;
    let (skill, provenance) = attach_provenance(ComponentKind::Skills, &name, s)?;
    Ok(GetSkill { skill: SkillDto { skill, provenance } })
}

#[derive(Deserialize)]
pub struct CreateSkillBody { pub frontmatter: Value, pub content: String }

#[tauri::command]
pub fn store_skills_create(body: CreateSkillBody) -> Result<GetSkill, ApiError> {
    let dir = store::store_skills_dir()?;
    let s = skills::create(&dir, &body.frontmatter, &body.content)?;
    Ok(GetSkill { skill: SkillDto { skill: s, provenance: None } })
}

#[derive(Deserialize)]
pub struct UpdateSkillBody { pub frontmatter: Option<Value>, pub content: Option<String> }

#[tauri::command]
pub fn store_skills_update(name: String, body: UpdateSkillBody) -> Result<GetSkill, ApiError> {
    let dir = store::store_skills_dir()?;
    let updated = skills::update(&dir, &name, body.frontmatter.as_ref(), body.content.as_deref())?
        .ok_or_else(|| ApiError::NotFound { kind: "skill", name: name.clone() })?;
    Ok(GetSkill { skill: SkillDto { skill: updated, provenance: None } })
}

#[tauri::command]
pub fn store_skills_delete(name: String, force: Option<bool>) -> Result<DeleteOk, ApiError> {
    if !force.unwrap_or(false) {
        let profiles_dir = store::store_profiles_dir()?;
        let refs = references::referencing_profiles(&profiles_dir, ComponentKind::Skills, &name)?;
        if !refs.is_empty() {
            return Err(ApiError::Conflict(format!(
                "skill '{name}' is referenced by profiles: {}",
                refs.join(", ")
            )));
        }
    }
    let dir = store::store_skills_dir()?;
    let removed = skills::delete(&dir, &name)?;
    if !removed {
        return Err(ApiError::NotFound { kind: "skill", name });
    }
    Ok(DeleteOk { success: true })
}

// --- Commands ---

#[tauri::command]
pub fn store_commands_list() -> Result<ListCommands, ApiError> {
    let dir = store::store_commands_dir()?;
    let raw = commands::list(&dir)?;
    let mut out: Vec<CommandDto> = Vec::with_capacity(raw.len());
    for c in raw {
        let id = c.id.clone();
        let (command, provenance) = attach_provenance(ComponentKind::Commands, &id, c)?;
        out.push(CommandDto { command, provenance });
    }
    Ok(ListCommands { commands: out })
}

#[tauri::command]
pub fn store_commands_get(name: String) -> Result<GetCommand, ApiError> {
    let dir = store::store_commands_dir()?;
    let c = commands::get(&dir, &name)?
        .ok_or_else(|| ApiError::NotFound { kind: "command", name: name.clone() })?;
    let (command, provenance) = attach_provenance(ComponentKind::Commands, &name, c)?;
    Ok(GetCommand { command: CommandDto { command, provenance } })
}

#[derive(Deserialize)]
pub struct CreateCommandBody { pub frontmatter: Value, pub content: String }

#[tauri::command]
pub fn store_commands_create(body: CreateCommandBody) -> Result<GetCommand, ApiError> {
    let dir = store::store_commands_dir()?;
    let c = commands::create(&dir, &body.frontmatter, &body.content)?;
    Ok(GetCommand { command: CommandDto { command: c, provenance: None } })
}

#[derive(Deserialize)]
pub struct UpdateCommandBody { pub frontmatter: Option<Value>, pub content: Option<String> }

#[tauri::command]
pub fn store_commands_update(name: String, body: UpdateCommandBody) -> Result<GetCommand, ApiError> {
    let dir = store::store_commands_dir()?;
    let updated = commands::update(&dir, &name, body.frontmatter.as_ref(), body.content.as_deref())?
        .ok_or_else(|| ApiError::NotFound { kind: "command", name: name.clone() })?;
    Ok(GetCommand { command: CommandDto { command: updated, provenance: None } })
}

#[tauri::command]
pub fn store_commands_delete(name: String, force: Option<bool>) -> Result<DeleteOk, ApiError> {
    if !force.unwrap_or(false) {
        let profiles_dir = store::store_profiles_dir()?;
        let refs = references::referencing_profiles(&profiles_dir, ComponentKind::Commands, &name)?;
        if !refs.is_empty() {
            return Err(ApiError::Conflict(format!(
                "command '{name}' is referenced by profiles: {}",
                refs.join(", ")
            )));
        }
    }
    let dir = store::store_commands_dir()?;
    let removed = commands::delete(&dir, &name)?;
    if !removed {
        return Err(ApiError::NotFound { kind: "command", name });
    }
    Ok(DeleteOk { success: true })
}

// --- Model configs ---

#[tauri::command]
pub fn store_model_configs_list() -> Result<ListModelConfigs, ApiError> {
    let dir = store::store_model_configs_dir()?;
    let raw = model_configs::list(&dir)?;
    let mut out: Vec<ModelConfigDto> = Vec::with_capacity(raw.len());
    for c in raw {
        let id = c.name.clone();
        let (config, provenance) = attach_provenance(ComponentKind::ModelConfigs, &id, c)?;
        out.push(ModelConfigDto { config, provenance });
    }
    Ok(ListModelConfigs { model_configs: out })
}

#[tauri::command]
pub fn store_model_configs_get(name: String) -> Result<GetModelConfig, ApiError> {
    let dir = store::store_model_configs_dir()?;
    let c = model_configs::get(&dir, &name)?
        .ok_or_else(|| ApiError::NotFound { kind: "model-config", name: name.clone() })?;
    let (config, provenance) = attach_provenance(ComponentKind::ModelConfigs, &name, c)?;
    Ok(GetModelConfig { config: ModelConfigDto { config, provenance } })
}

#[tauri::command]
pub fn store_model_configs_create(body: ModelConfig) -> Result<GetModelConfig, ApiError> {
    let dir = store::store_model_configs_dir()?;
    let c = model_configs::create(&dir, &body)?;
    Ok(GetModelConfig { config: ModelConfigDto { config: c, provenance: None } })
}

#[tauri::command]
pub fn store_model_configs_update(
    name: String,
    body: Value,
) -> Result<GetModelConfig, ApiError> {
    let dir = store::store_model_configs_dir()?;
    let updated = model_configs::update(&dir, &name, &body)?
        .ok_or_else(|| ApiError::NotFound { kind: "model-config", name: name.clone() })?;
    Ok(GetModelConfig { config: ModelConfigDto { config: updated, provenance: None } })
}

#[tauri::command]
pub fn store_model_configs_delete(name: String, force: Option<bool>) -> Result<DeleteOk, ApiError> {
    if !force.unwrap_or(false) {
        let profiles_dir = store::store_profiles_dir()?;
        let refs = references::referencing_profiles(&profiles_dir, ComponentKind::ModelConfigs, &name)?;
        if !refs.is_empty() {
            return Err(ApiError::Conflict(format!(
                "model-config '{name}' is referenced by profiles: {}",
                refs.join(", ")
            )));
        }
    }
    let dir = store::store_model_configs_dir()?;
    let removed = model_configs::delete(&dir, &name)?;
    if !removed {
        return Err(ApiError::NotFound { kind: "model-config", name });
    }
    Ok(DeleteOk { success: true })
}
```

- [ ] **Step 2: Re-export from api/mod.rs**

Open `packages/desktop/src-tauri/src/api/mod.rs`. After the existing module declarations, add `pub mod store;`. Final:

```rust
pub mod agents;
pub mod commands;
pub mod configs;
pub mod settings;
pub mod skills;
pub mod store;
pub mod timeline;
```

(Leave the existing `include_origin` helper untouched.)

- [ ] **Step 3: Verify the crate builds**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo build -p ohmyc-desktop 2>&1 | tail -5`
Expected: `Finished`.

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/src-tauri/src/api/store.rs packages/desktop/src-tauri/src/api/mod.rs
git commit -m "feat(desktop): 20 store CRUD Tauri commands"
```

---

## Task 10: Register the 20 store commands in main.rs

**Files:**
- Modify: `packages/desktop/src-tauri/src/main.rs`

- [ ] **Step 1: Add the 20 commands to `invoke_handler!`**

Open `packages/desktop/src-tauri/src/main.rs`. Find the `.invoke_handler(tauri::generate_handler![...])` block. After the last existing command (likely `configs_lsp`), add:

```rust
            ohmyc_desktop_lib::api::store::store_agents_list,
            ohmyc_desktop_lib::api::store::store_agents_get,
            ohmyc_desktop_lib::api::store::store_agents_create,
            ohmyc_desktop_lib::api::store::store_agents_update,
            ohmyc_desktop_lib::api::store::store_agents_delete,
            ohmyc_desktop_lib::api::store::store_skills_list,
            ohmyc_desktop_lib::api::store::store_skills_get,
            ohmyc_desktop_lib::api::store::store_skills_create,
            ohmyc_desktop_lib::api::store::store_skills_update,
            ohmyc_desktop_lib::api::store::store_skills_delete,
            ohmyc_desktop_lib::api::store::store_commands_list,
            ohmyc_desktop_lib::api::store::store_commands_get,
            ohmyc_desktop_lib::api::store::store_commands_create,
            ohmyc_desktop_lib::api::store::store_commands_update,
            ohmyc_desktop_lib::api::store::store_commands_delete,
            ohmyc_desktop_lib::api::store::store_model_configs_list,
            ohmyc_desktop_lib::api::store::store_model_configs_get,
            ohmyc_desktop_lib::api::store::store_model_configs_create,
            ohmyc_desktop_lib::api::store::store_model_configs_update,
            ohmyc_desktop_lib::api::store::store_model_configs_delete,
```

- [ ] **Step 2: Build + run full workspace tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && cargo test --workspace 2>&1 | grep "test result"`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/src-tauri/src/main.rs
git commit -m "feat(desktop): register 20 store CRUD Tauri commands"
```

---

## Task 11: Extend `transport/fetch.ts` with 20 store wire entries

**Files:**
- Modify: `packages/ui/src/lib/transport/fetch.ts`
- Modify: `packages/ui/src/lib/transport/transport.test.ts`

- [ ] **Step 1: Add the failing tests**

Open `packages/ui/src/lib/transport/transport.test.ts`. At the bottom of the existing `describe('transport seam', () => { ... })`, before the closing `})`, append:

```ts
  it('fetch transport sends DELETE for store.agents.delete', async () => {
    const seen: Array<{ url: string; init?: RequestInit }> = []
    const orig = globalThis.fetch
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      seen.push({ url, init })
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    }) as typeof fetch
    try {
      const { fetchTransport } = await import('./fetch')
      await fetchTransport('store.agents.delete', { name: 'alpha' })
      expect(seen).toHaveLength(1)
      expect(seen[0].url).toBe('/api/store/agents/alpha')
      expect(seen[0].init?.method).toBe('DELETE')
    }
    finally {
      globalThis.fetch = orig
    }
  })

  it('fetch transport appends ?force=true on store.agents.delete with force', async () => {
    const seen: string[] = []
    const orig = globalThis.fetch
    globalThis.fetch = (async (url: string) => {
      seen.push(url)
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    }) as typeof fetch
    try {
      const { fetchTransport } = await import('./fetch')
      await fetchTransport('store.agents.delete', { name: 'alpha', force: true })
      expect(seen[0]).toBe('/api/store/agents/alpha?force=true')
    }
    finally {
      globalThis.fetch = orig
    }
  })

  it('fetch transport sends PUT with body for store.agents.update', async () => {
    const seen: Array<{ url: string; init?: RequestInit }> = []
    const orig = globalThis.fetch
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      seen.push({ url, init })
      return new Response(JSON.stringify({ agent: { id: 'a' } }), { status: 200 })
    }) as typeof fetch
    try {
      const { fetchTransport } = await import('./fetch')
      await fetchTransport('store.agents.update', {
        name: 'alpha',
        body: { frontmatter: { description: 'new' } },
      })
      expect(seen[0].url).toBe('/api/store/agents/alpha')
      expect(seen[0].init?.method).toBe('PUT')
      const body = JSON.parse(String(seen[0].init?.body ?? ''))
      expect(body).toEqual({ frontmatter: { description: 'new' } })
    }
    finally {
      globalThis.fetch = orig
    }
  })
```

- [ ] **Step 2: Run to confirm new tests fail**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm test -- transport.test.ts 2>&1 | tail -15`
Expected: 3 failures (new wires not in the routes table).

- [ ] **Step 3: Add the 20 store route entries**

Open `packages/ui/src/lib/transport/fetch.ts`. Inside the `routes` object literal, after the existing `'configs.lsp': () => '/api/lsp',` line, add:

```ts
  // ---- Slice 5: store CRUD ----
  'store.agents.list': () => '/api/store/agents',
  'store.agents.get': a => `/api/store/agents/${encodeURIComponent(String(a.name ?? ''))}`,
  'store.agents.create': a => ({ url: '/api/store/agents', method: 'POST', body: a.body }),
  'store.agents.update': a => ({
    url: `/api/store/agents/${encodeURIComponent(String(a.name ?? ''))}`,
    method: 'PUT',
    body: a.body,
  }),
  'store.agents.delete': a => ({
    url: `/api/store/agents/${encodeURIComponent(String(a.name ?? ''))}${a.force ? '?force=true' : ''}`,
    method: 'DELETE',
  }),
  'store.skills.list': () => '/api/store/skills',
  'store.skills.get': a => `/api/store/skills/${encodeURIComponent(String(a.name ?? ''))}`,
  'store.skills.create': a => ({ url: '/api/store/skills', method: 'POST', body: a.body }),
  'store.skills.update': a => ({
    url: `/api/store/skills/${encodeURIComponent(String(a.name ?? ''))}`,
    method: 'PUT',
    body: a.body,
  }),
  'store.skills.delete': a => ({
    url: `/api/store/skills/${encodeURIComponent(String(a.name ?? ''))}${a.force ? '?force=true' : ''}`,
    method: 'DELETE',
  }),
  'store.commands.list': () => '/api/store/commands',
  'store.commands.get': a => `/api/store/commands/${encodeURIComponent(String(a.name ?? ''))}`,
  'store.commands.create': a => ({ url: '/api/store/commands', method: 'POST', body: a.body }),
  'store.commands.update': a => ({
    url: `/api/store/commands/${encodeURIComponent(String(a.name ?? ''))}`,
    method: 'PUT',
    body: a.body,
  }),
  'store.commands.delete': a => ({
    url: `/api/store/commands/${encodeURIComponent(String(a.name ?? ''))}${a.force ? '?force=true' : ''}`,
    method: 'DELETE',
  }),
  'store.modelConfigs.list': () => '/api/store/model-configs',
  'store.modelConfigs.get': a => `/api/store/model-configs/${encodeURIComponent(String(a.name ?? ''))}`,
  'store.modelConfigs.create': a => ({ url: '/api/store/model-configs', method: 'POST', body: a.body }),
  'store.modelConfigs.update': a => ({
    url: `/api/store/model-configs/${encodeURIComponent(String(a.name ?? ''))}`,
    method: 'PUT',
    body: a.body,
  }),
  'store.modelConfigs.delete': a => ({
    url: `/api/store/model-configs/${encodeURIComponent(String(a.name ?? ''))}${a.force ? '?force=true' : ''}`,
    method: 'DELETE',
  }),
```

Note the wire-name convention for compound resources: `'store.modelConfigs.list'` uses camelCase for the resource segment so the dot-to-underscore conversion (`store_modelConfigs_list`) matches the Rust function name `store_model_configs_list`. **This is a mismatch** — see the next step.

Actually the Rust function is `store_model_configs_list` (snake) and the JS replace produces `store_modelConfigs_list` (camel-in-snake). The current `tauriTransport` does `.replace(/\./g, '_')` which gives `store_modelConfigs_list` from `'store.modelConfigs.list'` — wrong.

**Choose the wire-name shape** to avoid this. Pick the `'store.model_configs.list'` shape (snake on all segments) so `.replace('.', '_')` produces `store_model_configs_list`. Update all 5 modelConfig wire entries above to use `store.model_configs.*`:

Replace the 5 entries you just added (`store.modelConfigs.*`) with:

```ts
  'store.model_configs.list': () => '/api/store/model-configs',
  'store.model_configs.get': a => `/api/store/model-configs/${encodeURIComponent(String(a.name ?? ''))}`,
  'store.model_configs.create': a => ({ url: '/api/store/model-configs', method: 'POST', body: a.body }),
  'store.model_configs.update': a => ({
    url: `/api/store/model-configs/${encodeURIComponent(String(a.name ?? ''))}`,
    method: 'PUT',
    body: a.body,
  }),
  'store.model_configs.delete': a => ({
    url: `/api/store/model-configs/${encodeURIComponent(String(a.name ?? ''))}${a.force ? '?force=true' : ''}`,
    method: 'DELETE',
  }),
```

- [ ] **Step 4: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm test -- transport.test.ts 2>&1 | tail -15`
Expected: all transport tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/lib/transport/fetch.ts packages/ui/src/lib/transport/transport.test.ts
git commit -m "feat(ui): 20 store CRUD wires in fetch transport (POST/PUT/DELETE with body+force)"
```

---

## Task 12: Migrate `use-store.ts` to the transport seam

**Files:**
- Modify: `packages/ui/src/hooks/use-store.ts`

- [ ] **Step 1: Replace the file contents**

Open `packages/ui/src/hooks/use-store.ts`. Replace its entire contents with:

```ts
// React Query hooks for the OhMyC store — agents, skills, commands, model-configs.
// Backend transport is selected at build time via packages/ui/src/lib/transport.ts.
// Bulk import (useStoreImport) intentionally NOT migrated this slice — deferred.
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { request } from '@/lib/transport'

import type {
  Agent,
  Command,
  CreateAgentBody,
  CreateCommandBody,
  CreateModelConfigBody,
  CreateSkillBody,
  ModelConfig,
  Skill,
  UpdateAgentBody,
  UpdateCommandBody,
  UpdateModelConfigBody,
  UpdateSkillBody,
} from '@ohmyc/shared'

// ---- Agents ----
export function useStoreAgents() {
  return useQuery({
    queryKey: ['store', 'agents'],
    queryFn: () => request<{ agents: Agent[] }>('store.agents.list', {}).then(d => d.agents),
  })
}

export function useStoreAgent(name: string | null) {
  return useQuery({
    queryKey: ['store', 'agents', name],
    queryFn: () => request<{ agent: Agent }>('store.agents.get', { name: name! }).then(d => d.agent),
    enabled: !!name,
  })
}

export function useCreateStoreAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateAgentBody) =>
      request<{ agent: Agent }>('store.agents.create', { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'agents'] }),
  })
}

export function useUpdateStoreAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, body }: { name: string, body: UpdateAgentBody }) =>
      request<{ agent: Agent }>('store.agents.update', { name, body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'agents'] }),
  })
}

export function useDeleteStoreAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, force }: { name: string, force?: boolean }) =>
      request<{ success: boolean }>('store.agents.delete', { name, force }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'agents'] }),
  })
}

// ---- Skills ----
export function useStoreSkills() {
  return useQuery({
    queryKey: ['store', 'skills'],
    queryFn: () => request<{ skills: Skill[] }>('store.skills.list', {}).then(d => d.skills),
  })
}

export function useStoreSkill(name: string | null) {
  return useQuery({
    queryKey: ['store', 'skills', name],
    queryFn: () => request<{ skill: Skill }>('store.skills.get', { name: name! }).then(d => d.skill),
    enabled: !!name,
  })
}

export function useCreateStoreSkill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateSkillBody) =>
      request<{ skill: Skill }>('store.skills.create', { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'skills'] }),
  })
}

export function useUpdateStoreSkill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, body }: { name: string, body: UpdateSkillBody }) =>
      request<{ skill: Skill }>('store.skills.update', { name, body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'skills'] }),
  })
}

export function useDeleteStoreSkill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, force }: { name: string, force?: boolean }) =>
      request<{ success: boolean }>('store.skills.delete', { name, force }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'skills'] }),
  })
}

// ---- Commands ----
export function useStoreCommands() {
  return useQuery({
    queryKey: ['store', 'commands'],
    queryFn: () => request<{ commands: Command[] }>('store.commands.list', {}).then(d => d.commands),
  })
}

export function useStoreCommand(name: string | null) {
  return useQuery({
    queryKey: ['store', 'commands', name],
    queryFn: () => request<{ command: Command }>('store.commands.get', { name: name! }).then(d => d.command),
    enabled: !!name,
  })
}

export function useCreateStoreCommand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateCommandBody) =>
      request<{ command: Command }>('store.commands.create', { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'commands'] }),
  })
}

export function useUpdateStoreCommand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, body }: { name: string, body: UpdateCommandBody }) =>
      request<{ command: Command }>('store.commands.update', { name, body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'commands'] }),
  })
}

export function useDeleteStoreCommand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, force }: { name: string, force?: boolean }) =>
      request<{ success: boolean }>('store.commands.delete', { name, force }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'commands'] }),
  })
}

// ---- Model Configs ----
export function useStoreModelConfigs() {
  return useQuery({
    queryKey: ['store', 'model-configs'],
    queryFn: () => request<{ modelConfigs: ModelConfig[] }>('store.model_configs.list', {}).then(d => d.modelConfigs),
  })
}

export function useStoreModelConfig(name: string | null) {
  return useQuery({
    queryKey: ['store', 'model-configs', name],
    queryFn: () => request<{ modelConfig: ModelConfig }>('store.model_configs.get', { name: name! }).then(d => d.modelConfig),
    enabled: !!name,
  })
}

export function useCreateStoreModelConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateModelConfigBody) =>
      request<{ modelConfig: ModelConfig }>('store.model_configs.create', { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'model-configs'] }),
  })
}

export function useUpdateStoreModelConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, body }: { name: string, body: UpdateModelConfigBody }) =>
      request<{ modelConfig: ModelConfig }>('store.model_configs.update', { name, body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'model-configs'] }),
  })
}

export function useDeleteStoreModelConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, force }: { name: string, force?: boolean }) =>
      request<{ success: boolean }>('store.model_configs.delete', { name, force }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store', 'model-configs'] }),
  })
}

// ---- Import ----
// useStoreImport NOT migrated this slice — bulk-import deferred to a
// follow-up. The legacy fetch implementation is preserved below for
// the web dev loop only; the desktop build never exercises it because
// the import UI isn't wired into the main window yet.
async function legacyFetch<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }))
    throw Object.assign(new Error(error.error || 'Request failed'), { data: error })
  }
  return res.json()
}

export function useStoreImport() {
  return useMutation({
    mutationFn: (body: unknown) => legacyFetch('/api/store/import', 'POST', body),
  })
}
```

- [ ] **Step 2: Verify no straggler `fetch(` calls remain for the migrated hooks**

Run: `grep -n 'fetch(' /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui/src/hooks/use-store.ts | head -10`
Expected: one match — `legacyFetch` inside `useStoreImport` only. Everything else is `request()`.

- [ ] **Step 3: Type-check the file**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm tsc --noEmit -p tsconfig.json 2>&1 | grep "use-store" | head -10`
Expected: no errors mentioning `use-store.ts`. (Pre-existing errors elsewhere are fine.)

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/hooks/use-store.ts
git commit -m "feat(ui): 20 store hooks route through transport seam (import deferred)"
```

---

## Task 13: Add `use-store.test.tsx` (sampled coverage)

**Files:**
- Create or replace: `packages/ui/src/hooks/use-store.test.tsx`

20 hooks × full coverage would be ~60 tests. Instead, cover one full CRUD lifecycle on agents (representative of the .md-based shape) plus 1 test each for skills, commands, model-configs to verify wire-name routing. The slice-4 transport tests already validate the underlying `{ url, method, body }` shape.

- [ ] **Step 1: Locate any existing test file**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && find . -name "use-store.test*" -not -path "*/node_modules/*" 2>/dev/null`
Note any existing file — Step 2 replaces or creates.

- [ ] **Step 2: Write the test file**

Create or replace `packages/ui/src/hooks/use-store.test.tsx` with:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import {
  useCreateStoreAgent,
  useDeleteStoreAgent,
  useStoreAgent,
  useStoreAgents,
  useStoreCommands,
  useStoreModelConfigs,
  useStoreSkills,
  useUpdateStoreAgent,
} from './use-store'
import {
  __setTransportForTests,
  resetTransportForTests,
} from '@/lib/transport'
import { resetMock, setMockHandler } from '@/lib/transport/mock'

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
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

describe('store agents — read', () => {
  it('list unwraps the agents array', async () => {
    setMockHandler('store.agents.list', async () => ({
      agents: [{ id: 'a1', frontmatter: { name: 'a1', description: 'd' } }],
    }))
    const { result } = renderHook(() => useStoreAgents(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })

  it('get passes name and unwraps the agent', async () => {
    let captured: unknown = null
    setMockHandler('store.agents.get', async (args) => {
      captured = args
      return { agent: { id: 'a1' } }
    })
    const { result } = renderHook(() => useStoreAgent('a1'), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect((captured as { name: string }).name).toBe('a1')
    expect(result.current.data).toMatchObject({ id: 'a1' })
  })

  it('get is disabled when name is null', () => {
    const { result } = renderHook(() => useStoreAgent(null), { wrapper: wrapper() })
    expect(result.current.isFetched).toBe(false)
  })
})

describe('store agents — write', () => {
  it('create sends body and invalidates the list', async () => {
    let captured: unknown = null
    setMockHandler('store.agents.create', async (args) => {
      captured = args
      return { agent: { id: 'new' } }
    })
    setMockHandler('store.agents.list', async () => ({ agents: [{ id: 'new' }] }))

    const { result } = renderHook(() => useCreateStoreAgent(), { wrapper: wrapper() })
    await act(async () => {
      result.current.mutate({ frontmatter: { name: 'new', description: 'd' }, content: 'x' } as never)
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect((captured as { body?: unknown }).body).toEqual({
      frontmatter: { name: 'new', description: 'd' },
      content: 'x',
    })
  })

  it('update sends { name, body }', async () => {
    let captured: unknown = null
    setMockHandler('store.agents.update', async (args) => {
      captured = args
      return { agent: { id: 'a' } }
    })
    const { result } = renderHook(() => useUpdateStoreAgent(), { wrapper: wrapper() })
    await act(async () => {
      result.current.mutate({ name: 'a', body: { content: 'new body' } } as never)
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(captured).toEqual({ name: 'a', body: { content: 'new body' } })
  })

  it('delete sends { name, force }', async () => {
    let captured: unknown = null
    setMockHandler('store.agents.delete', async (args) => {
      captured = args
      return { success: true }
    })
    const { result } = renderHook(() => useDeleteStoreAgent(), { wrapper: wrapper() })
    await act(async () => {
      result.current.mutate({ name: 'a', force: true } as never)
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(captured).toEqual({ name: 'a', force: true })
  })

  it('delete surfaces Conflict (Used by N profiles)', async () => {
    setMockHandler('store.agents.delete', async () => {
      throw Object.assign(new Error('agent is referenced'), { code: 'Conflict' })
    })
    const { result } = renderHook(() => useDeleteStoreAgent(), { wrapper: wrapper() })
    await act(async () => {
      result.current.mutate({ name: 'a' } as never)
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as { code?: string }).code).toBe('Conflict')
  })
})

describe('store wire routing — sampled across entity types', () => {
  it('skills list uses store.skills.list', async () => {
    let called = false
    setMockHandler('store.skills.list', async () => {
      called = true
      return { skills: [] }
    })
    renderHook(() => useStoreSkills(), { wrapper: wrapper() })
    await waitFor(() => expect(called).toBe(true))
  })

  it('commands list uses store.commands.list', async () => {
    let called = false
    setMockHandler('store.commands.list', async () => {
      called = true
      return { commands: [] }
    })
    renderHook(() => useStoreCommands(), { wrapper: wrapper() })
    await waitFor(() => expect(called).toBe(true))
  })

  it('model configs list uses store.model_configs.list (snake-case wire segment)', async () => {
    let called = false
    setMockHandler('store.model_configs.list', async () => {
      called = true
      return { modelConfigs: [] }
    })
    renderHook(() => useStoreModelConfigs(), { wrapper: wrapper() })
    await waitFor(() => expect(called).toBe(true))
  })
})
```

- [ ] **Step 3: Run the tests**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm test -- use-store.test 2>&1 | tail -15`
Expected: 11 tests pass.

- [ ] **Step 4: Run the full UI suite**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm test 2>&1 | tail -10`
Expected: all tests pass (any pre-existing failures noted but unrelated to this slice).

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/hooks/use-store.test.tsx
git commit -m "test(ui): use-store sampled CRUD coverage + cross-type wire routing"
```

---

## Task 14: Extend `useFsChanged` to invalidate store keys

**Files:**
- Modify: `packages/ui/src/hooks/use-fs-changed.ts`

The watcher only watches `<claude_home>` and the timeline DB dir today. To pick up store writes via the watcher we'd also need to watch `$OHMYC_HOME/store/`. Since the mutation hooks already call `qc.invalidateQueries(['store', '<type>'])` on success via React Query (Task 12's `onSuccess` callbacks), the watcher invalidation is **a nice-to-have** for the case where an external process modifies the store. Wire it for completeness; if `$OHMYC_HOME/store/` isn't being watched in slice 5, the listener will just never fire for those paths and that's fine.

For now, document the gap and extend the path matcher to cover store writes if and when they appear in `fs:changed` events.

- [ ] **Step 1: Add the store path branch**

Open `packages/ui/src/hooks/use-fs-changed.ts`. In the existing `claude_home` event branch (or add a sibling branch if `payload.kind` covers it), append the store invalidation after the `.mcp.json` check:

```ts
        // Slice 5 — invalidate store query keys when a file under
        // <base>/store/<type>/ changes. The watcher's default_watch_paths
        // currently only includes claude_home + timeline_dir; if/when
        // $OHMYC_HOME/store is added, these matchers light up the same
        // invalidation the mutations already trigger via onSuccess.
        if (path.includes('/store/agents/')) {
          void qc.invalidateQueries({ queryKey: ['store', 'agents'] })
        }
        if (path.includes('/store/skills/')) {
          void qc.invalidateQueries({ queryKey: ['store', 'skills'] })
        }
        if (path.includes('/store/commands/')) {
          void qc.invalidateQueries({ queryKey: ['store', 'commands'] })
        }
        if (path.includes('/store/model-configs/')) {
          void qc.invalidateQueries({ queryKey: ['store', 'model-configs'] })
        }
```

- [ ] **Step 2: Run UI suite**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm test 2>&1 | tail -10`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/hooks/use-fs-changed.ts
git commit -m "feat(ui): useFsChanged invalidates store keys on store path matches"
```

---

## Task 15: Manual smoke test

**Files:** none

- [ ] **Step 1: Start the desktop app**

Run: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui && pnpm --filter @ohmyc/desktop tauri dev`

- [ ] **Step 2: Verify the store list pages load**

Click the tray icon → `Open OhMyC →`. Navigate to the Profiles → Components store views (`/profiles/agents`, `/profiles/skills`, `/profiles/commands`, `/profiles/model-configs`).

Expected:
- Each list renders entries from `~/.config/ohmyc/store/<type>/` (or empty if the store has nothing imported yet).
- No console errors about failed `/api/store/*` calls.
- The `Used by N profiles` column appears for each entry — empty/Unused if no profile references it yet.

- [ ] **Step 3: Create + edit + delete one agent end-to-end**

In `/profiles/agents`, click `New Agent`. Fill in a name (`_smoke_test_agent`) and a description, then save.

Expected:
- The agent appears in the list within ~1 second.
- The file exists on disk: `ls ~/.config/ohmyc/store/agents/_smoke_test_agent.md`.

Open the agent, edit its description, save.

Expected:
- The file's frontmatter `description` updates: `cat ~/.config/ohmyc/store/agents/_smoke_test_agent.md`.

Delete the agent (use `Delete` action). Confirm.

Expected:
- File is removed: `ls ~/.config/ohmyc/store/agents/` no longer lists it.
- Agent disappears from the UI list.

- [ ] **Step 4: Verify the "Used by N profiles" delete guard**

Create a test profile that references an agent (use `New Profile`, add the smoke agent created above as a dependency). Then try to delete that agent.

Expected:
- The delete request fails with a `Conflict` error.
- The UI displays which profile is referencing it.
- Confirming with `force` (or removing from the profile first) allows the delete.

Clean up: delete the test profile.

- [ ] **Step 5: Verify the web dev loop still works**

In separate terminals: `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/cli && pnpm dev` then `cd /Volumes/ORICO/Users/jiangwei/projects/claudeui/packages/ui && pnpm dev`. Open `http://localhost:5173/profiles/agents`.

Expected: the page loads via the legacy `/api/store/agents` HTTP route. Create/edit/delete still works against the TS server.

- [ ] **Step 6: Report**

If any step failed, note which one. Do not mark this task complete until steps 1-4 pass; step 5 is informational.

---

## Done criteria for Slice 5

- `cargo test --workspace` green (target: ~140 Rust tests; +40 from slice 4's ~100).
- `pnpm -r test` green.
- `pnpm --filter @ohmyc/desktop tauri build --target aarch64-apple-darwin` produces a binary.
- Manual smoke (Task 15) steps 1-4 pass.
- The TS server's `/api/store/*` routes are still alive (web dev loop works).
- `packages/ui/src/hooks/use-store.ts` contains exactly ONE `fetch(` call — inside the explicitly-deferred `useStoreImport` legacy fallback.
- All 20 CRUD operations work end-to-end in the desktop main window.
- The "Used by N profiles" delete guard fires when expected and respects `force=true`.

---

## What this slice does NOT do (intentional)

- Does not migrate `useStoreImport` — bulk-import lands in a follow-up slice (or folds into Slice 7 Cleanup). The legacy `fetch` call survives inside `use-store.ts` for that one hook only.
- Does not add `<base>/store/` to the watcher's default paths. Mutations already invalidate via React Query's `onSuccess`; the `useFsChanged` extension in Task 14 covers the case where the watcher is broadened in a future slice.
- Does not delete TS server routes (`packages/cli/src/server/routes/store.ts` stays alive). Slice 8 (Cleanup) does that.
- Does not port Zod validation server-side — Rust accepts the JSON and lets `serde_json` + the safe-name regex + `frontmatter::stringify` reject malformed input. Frontend Zod (in `@ohmyc/shared`) still runs client-side.
- Does not address the slice-2 pre-existing menubar-page test failures — out of scope.
