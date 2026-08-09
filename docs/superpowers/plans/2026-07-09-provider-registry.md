# Provider Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a provider-aware Rust backend that inventories Codex, Claude, OpenCode, and shared agent resources across agents, skills, commands, and plugins.

**Architecture:** Add provider-specific readers behind a `ProviderRegistry`, keep existing Tauri command names, and make the API responses additive through stable locators and provider metadata. Start with core identity/schema changes, then implement provider parsers, registry merging, plugin resources, frontend locator compatibility, and watcher refresh.

**Performance Note:** Keep providers stateless in this version. Each list API parses only its requested resource type (`agents`, `skills`, `commands`, or `plugins`) instead of building a cross-resource inventory cache. This avoids cache invalidation complexity across watcher events, project-root changes, origin filters, and plugin enablement. The implementation must include code comments at the registry and plugin parsing boundaries that explain this choice.

**Tech Stack:** Rust workspace (`ohmyc-core`, `ohmyc-desktop`), Tauri commands, serde/serde_json, gray_matter YAML frontmatter, new Rust parser deps `toml`, `json5`, and `sha2`, React Query, Zustand, TypeScript shared schemas, Vitest, Cargo tests.

---

## File Structure

- Modify `crates/ohmyc-core/Cargo.toml`: add `toml`, `json5`, and `sha2` dependencies without rewriting existing dependency sections.
- Modify `crates/ohmyc-core/src/lib.rs`: expose the new provider module.
- Modify `crates/ohmyc-core/src/components/mod.rs`: extend shared enums and add locator/source metadata helpers.
- Modify `crates/ohmyc-core/src/components/agents.rs`: accept source metadata, recursive scans, and Codex/OpenCode parser entry points.
- Modify `crates/ohmyc-core/src/components/skills.rs`: accept source metadata and origin sets.
- Modify `crates/ohmyc-core/src/components/commands.rs`: accept source metadata, legacy prompt badges, and config-backed command parsing.
- Create `crates/ohmyc-core/src/providers/mod.rs`: registry, provider trait, common merge/filter utilities.
- Create `crates/ohmyc-core/src/providers/paths.rs`: home/project path resolution helpers.
- Create `crates/ohmyc-core/src/providers/claude.rs`: Claude resource provider.
- Create `crates/ohmyc-core/src/providers/codex.rs`: Codex resource provider.
- Create `crates/ohmyc-core/src/providers/opencode.rs`: OpenCode resource provider.
- Create `crates/ohmyc-core/src/providers/shared_agents.rs`: shared `.agents` provider.
- Modify `crates/ohmyc-core/src/plugins.rs`: expose static plugin component parsing for provider use and add source provider metadata.
- Modify `packages/desktop/src-tauri/src/api/mod.rs`: update origin filter behavior for `codex`.
- Modify `packages/desktop/src-tauri/src/api/agents.rs`: route list/get through `ProviderRegistry`.
- Modify `packages/desktop/src-tauri/src/api/skills.rs`: route list/get through `ProviderRegistry`.
- Modify `packages/desktop/src-tauri/src/api/commands.rs`: route list/get through `ProviderRegistry`.
- Modify `packages/desktop/src-tauri/src/api/plugins.rs`: route list/get through `ProviderRegistry`.
- Modify `crates/ohmyc-core/src/watcher.rs` and `packages/ui/src/hooks/use-fs-changed.ts`: watch provider config roots and invalidate provider resources.
- Modify `packages/shared/src/provider.ts`: replace `agents` origin with `codex`.
- Modify `packages/shared/src/agent-schema.ts`, `skill-schema.ts`, `command-schema.ts`, `plugin-schema.ts`: add locator/source metadata.
- Modify `packages/ui/src/state/sources.ts`: register `codex`, `claude`, `opencode`.
- Modify `packages/ui/src/hooks/use-agents.ts`, `use-skills.ts`, `use-commands.ts`: use `locatorId` for detail queries.
- Modify `packages/ui/src/components/entity-list.tsx`: use `locatorId` for keys and selection.
- Modify related UI tests under `packages/ui/tests/**` and Rust tests under `crates/ohmyc-core/src/**`.

---

### Task 1: Add Core Identity Metadata

**Files:**
- Modify: `crates/ohmyc-core/Cargo.toml`
- Modify: `crates/ohmyc-core/src/components/mod.rs`
- Modify: `crates/ohmyc-core/src/components/agents.rs`
- Modify: `crates/ohmyc-core/src/components/skills.rs`
- Modify: `crates/ohmyc-core/src/components/commands.rs`

- [ ] **Step 1: Write failing enum and locator tests**

Add these tests to `crates/ohmyc-core/src/components/mod.rs`:

```rust
#[test]
fn source_and_origin_enums_match_frontend_contract() {
    assert_eq!(serde_json::to_value(Origin::Codex).unwrap(), "codex");
    assert_eq!(serde_json::to_value(Origin::Claude).unwrap(), "claude");
    assert_eq!(serde_json::to_value(Origin::Opencode).unwrap(), "opencode");
    assert_eq!(serde_json::to_value(ComponentSource::Local).unwrap(), "local");
    assert_eq!(serde_json::to_value(ComponentSource::Plugin).unwrap(), "plugin");
    assert_eq!(serde_json::to_value(ComponentSource::Project).unwrap(), "project");
    assert_eq!(serde_json::to_value(SourceProvider::Shared).unwrap(), "shared");
    assert_eq!(serde_json::to_value(SourceKind::Shared).unwrap(), "shared");
}

#[test]
fn locator_id_is_stable_and_distinguishes_sources() {
    let left = locator_id(
        ComponentKind::Skills,
        SourceProvider::Claude,
        ComponentSource::Local,
        Scope::Global,
        None,
        "review",
        Some(std::path::Path::new("/tmp/.claude/skills/review/SKILL.md")),
    );
    let right = locator_id(
        ComponentKind::Skills,
        SourceProvider::Shared,
        ComponentSource::Local,
        Scope::Global,
        None,
        "review",
        Some(std::path::Path::new("/tmp/.agents/skills/review/SKILL.md")),
    );
    assert_ne!(left, right);
    assert_eq!(left, "skills:claude:local:global:none:review:451173795d55287c");
    assert_eq!(right, "skills:shared:local:global:none:review:8322be38db255add");
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cargo test -p ohmyc-core components::tests
```

Expected: FAIL because `Origin::Codex`, `Origin::Opencode`, `ComponentKind`, `SourceProvider`, `SourceKind`, and `locator_id` are not defined yet.

- [ ] **Step 3: Add parser and stable hash dependencies**

Append only these dependency lines under the existing `[dependencies]` section in `crates/ohmyc-core/Cargo.toml`. Preserve the existing `[dev-dependencies]` section and all existing dependency lines:

```toml
toml = "0.8"
json5 = "0.4"
sha2 = "0.10"
```

- [ ] **Step 4: Implement shared metadata types**

In `crates/ohmyc-core/src/components/mod.rs`, change the serde import to `use serde::{Deserialize, Serialize};`, then add the new enums and helper:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ComponentKind {
    Agents,
    Commands,
    Skills,
    Plugins,
}

impl ComponentKind {
    fn as_str(self) -> &'static str {
        match self {
            Self::Agents => "agents",
            Self::Commands => "commands",
            Self::Skills => "skills",
            Self::Plugins => "plugins",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ComponentSource {
    Local,
    Plugin,
    Project,
}

impl ComponentSource {
    fn as_str(self) -> &'static str {
        match self {
            Self::Local => "local",
            Self::Plugin => "plugin",
            Self::Project => "project",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Origin {
    Codex,
    Claude,
    Opencode,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SourceProvider {
    Codex,
    Claude,
    Opencode,
    Shared,
}

impl SourceProvider {
    fn as_str(self) -> &'static str {
        match self {
            Self::Codex => "codex",
            Self::Claude => "claude",
            Self::Opencode => "opencode",
            Self::Shared => "shared",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SourceKind {
    Global,
    Project,
    Plugin,
    Shared,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Scope {
    Global,
    Project,
}

impl Scope {
    fn as_str(self) -> &'static str {
        match self {
            Self::Global => "global",
            Self::Project => "project",
        }
    }
}

pub fn locator_id(
    kind: ComponentKind,
    provider: SourceProvider,
    source: ComponentSource,
    scope: Scope,
    plugin_id: Option<&str>,
    id: &str,
    source_path: Option<&std::path::Path>,
) -> String {
    use sha2::{Digest, Sha256};
    let normalized_path = source_path
        .map(|path| path.to_string_lossy().to_string())
        .unwrap_or_default();
    let hash = Sha256::digest(normalized_path.as_bytes());
    let path_hash = format!("{hash:x}");
    format!(
        "{}:{}:{}:{}:{}:{}:{}",
        kind.as_str(),
        provider.as_str(),
        source.as_str(),
        scope.as_str(),
        plugin_id.unwrap_or("none"),
        id,
        &path_hash[..16],
    )
}
```

- [ ] **Step 5: Add shared metadata fields to entity structs**

Add these fields to `Agent`, `Skill`, and `Command`:

```rust
#[serde(rename = "locatorId")]
pub locator_id: String,
#[serde(rename = "sourcePath", skip_serializing_if = "Option::is_none")]
pub source_path: Option<String>,
#[serde(rename = "sourceProvider")]
pub source_provider: SourceProvider,
#[serde(rename = "sourceKind")]
pub source_kind: SourceKind,
#[serde(rename = "pluginId", skip_serializing_if = "Option::is_none")]
pub plugin_id: Option<String>,
```

Import the new types in each file:

```rust
use super::{
    is_safe_name, locator_id, read_md_or_skip, ComponentKind, ComponentSource, Origin, Scope, SourceKind,
    SourceProvider,
};
```

For existing create/update/list constructors, set Claude-compatible defaults. For create/update responses, pass the actual file path that was written as `Some(&path)`; do not emit a `locator_id` computed with `None`, because detail lookups use the path-aware `locator_id` returned by list APIs.

```rust
locator_id: locator_id(
    ComponentKind::Agents,
    SourceProvider::Claude,
    ComponentSource::Local,
    Scope::Global,
    &id,
    Some(&path),
),
source_path: Some(path.to_string_lossy().to_string()),
source_provider: SourceProvider::Claude,
source_kind: SourceKind::Global,
plugin_id: None,
```

Use `ComponentKind::Skills` for `Skill` and `ComponentKind::Commands` for `Command`.

- [ ] **Step 6: Remove stale `Origin::Agents` compile sites and run focused tests**

Replace every Rust reference to `Origin::Agents` with the new model before testing. In the pre-registry desktop API, change `packages/desktop/src-tauri/src/api/skills.rs` shared `.agents` calls to use `Origin::Codex` as a temporary compatibility value; Task 6 replaces that API path with `ProviderRegistry` and the final shared skill origins become `[Codex, Opencode]`.

Run:

```bash
cargo test -p ohmyc-core components
cargo test -p ohmyc-desktop api::skills
```

Expected: PASS. Existing tests that asserted `Origin::Agents` must be updated to the new source/origin model.

- [ ] **Step 7: Commit core metadata**

Run:

```bash
git add crates/ohmyc-core/Cargo.toml crates/ohmyc-core/src/components/mod.rs crates/ohmyc-core/src/components/agents.rs crates/ohmyc-core/src/components/skills.rs crates/ohmyc-core/src/components/commands.rs packages/desktop/src-tauri/src/api/skills.rs Cargo.lock packages/desktop/src-tauri/Cargo.lock
git commit -m "feat(core): add provider resource identity"
```

Expected: commit succeeds with only core metadata and lockfile changes.

---

### Task 2: Add Provider Registry Skeleton

**Files:**
- Modify: `crates/ohmyc-core/src/lib.rs`
- Create: `crates/ohmyc-core/src/providers/mod.rs`
- Create: `crates/ohmyc-core/src/providers/paths.rs`

- [ ] **Step 1: Write failing registry origin filter tests**

Create `crates/ohmyc-core/src/providers/mod.rs` with module declarations and tests first:

```rust
pub mod paths;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn origin_filter_matches_resources_with_any_selected_origin() {
        assert!(matches_origin_filter(None, &[crate::components::Origin::Codex]));
        assert!(matches_origin_filter(
            Some(&[crate::components::Origin::Opencode]),
            &[crate::components::Origin::Codex, crate::components::Origin::Opencode],
        ));
        assert!(!matches_origin_filter(
            Some(&[crate::components::Origin::Claude]),
            &[crate::components::Origin::Codex, crate::components::Origin::Opencode],
        ));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cargo test -p ohmyc-core providers::tests::origin_filter_matches_resources_with_any_selected_origin
```

Expected: FAIL because the provider module is not exported and `matches_origin_filter` is missing.

- [ ] **Step 3: Export providers module**

Add to `crates/ohmyc-core/src/lib.rs`:

```rust
pub mod providers;
```

- [ ] **Step 4: Implement registry skeleton and filter helper**

Replace `crates/ohmyc-core/src/providers/mod.rs` content with:

```rust
pub mod paths;

use crate::components::Origin;
use crate::error::ApiError;

pub struct ProviderRegistry {
    cwd: std::path::PathBuf,
    project_root: std::path::PathBuf,
}

impl ProviderRegistry {
    pub fn new(cwd: impl Into<std::path::PathBuf>) -> Self {
        let cwd = cwd.into();
        let project_root = paths::find_project_root(&cwd);
        Self { cwd, project_root }
    }

    pub fn current_dir() -> Result<Self, ApiError> {
        let cwd = std::env::current_dir().map_err(|e| ApiError::Io(format!("current_dir: {e}")))?;
        Ok(Self::new(cwd))
    }

    pub fn cwd(&self) -> &std::path::Path {
        &self.cwd
    }

    pub fn project_root(&self) -> &std::path::Path {
        &self.project_root
    }
}

pub fn matches_origin_filter(filter: Option<&[Origin]>, resource_origins: &[Origin]) -> bool {
    let Some(filter) = filter else {
        return true;
    };
    filter
        .iter()
        .any(|selected| resource_origins.iter().any(|origin| origin == selected))
}
```

- [ ] **Step 5: Add path helpers**

Create `crates/ohmyc-core/src/providers/paths.rs`:

```rust
use std::path::{Path, PathBuf};

use crate::error::ApiError;

pub fn home_dir() -> Result<PathBuf, ApiError> {
    dirs::home_dir().ok_or_else(|| ApiError::Internal("could not determine home dir".to_string()))
}

pub fn codex_home() -> Result<PathBuf, ApiError> {
    if let Ok(v) = std::env::var("OHMYC_CODEX_HOME") {
        if !v.trim().is_empty() {
            return Ok(PathBuf::from(v));
        }
    }
    Ok(home_dir()?.join(".codex"))
}

pub fn opencode_home() -> Result<PathBuf, ApiError> {
    if let Ok(v) = std::env::var("OHMYC_OPENCODE_HOME") {
        if !v.trim().is_empty() {
            return Ok(PathBuf::from(v));
        }
    }
    Ok(home_dir()?.join(".config").join("opencode"))
}

pub fn shared_agents_home() -> Result<PathBuf, ApiError> {
    if let Ok(v) = std::env::var("OHMYC_AGENTS_HOME") {
        if !v.trim().is_empty() {
            return Ok(PathBuf::from(v));
        }
    }
    Ok(home_dir()?.join(".agents"))
}

pub fn find_project_root(start: &Path) -> PathBuf {
    let mut cur = start.to_path_buf();
    loop {
        if cur.join(".git").exists() {
            return cur;
        }
        if !cur.pop() {
            return start.to_path_buf();
        }
    }
}
```

- [ ] **Step 6: Run registry tests**

Run:

```bash
cargo test -p ohmyc-core providers
```

Expected: PASS.

- [ ] **Step 7: Commit registry skeleton**

Run:

```bash
git add crates/ohmyc-core/src/lib.rs crates/ohmyc-core/src/providers/mod.rs crates/ohmyc-core/src/providers/paths.rs
git commit -m "feat(core): add provider registry skeleton"
```

Expected: commit succeeds.

---

### Task 3: Implement Claude and Shared Agents Providers

**Files:**
- Modify: `crates/ohmyc-core/src/components/agents.rs`
- Modify: `crates/ohmyc-core/src/components/skills.rs`
- Modify: `crates/ohmyc-core/src/components/commands.rs`
- Create: `crates/ohmyc-core/src/providers/claude.rs`
- Create: `crates/ohmyc-core/src/providers/shared_agents.rs`
- Modify: `crates/ohmyc-core/src/providers/mod.rs`

- [ ] **Step 1: Write failing provider tests**

Add to `crates/ohmyc-core/src/providers/claude.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn claude_provider_reads_global_agents_skills_and_commands() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(tmp.path().join("agents")).unwrap();
        std::fs::create_dir_all(tmp.path().join("skills/review")).unwrap();
        std::fs::create_dir_all(tmp.path().join("commands")).unwrap();
        std::fs::write(
            tmp.path().join("agents/reviewer.md"),
            "---\nname: reviewer\ndescription: Reviews code\n---\nAgent body",
        )
        .unwrap();
        std::fs::write(
            tmp.path().join("skills/review/SKILL.md"),
            "---\nname: review\ndescription: Review code\n---\nSkill body",
        )
        .unwrap();
        std::fs::write(
            tmp.path().join("commands/ship.md"),
            "---\nname: ship\ndescription: Ship it\n---\nCommand body",
        )
        .unwrap();

        let provider = ClaudeProvider::from_home(tmp.path().to_path_buf());
        assert_eq!(provider.agents().unwrap()[0].origins, vec![crate::components::Origin::Claude]);
        assert_eq!(
            provider.skills().unwrap()[0].origins,
            vec![crate::components::Origin::Claude, crate::components::Origin::Opencode],
        );
        assert_eq!(provider.commands().unwrap()[0].origins, vec![crate::components::Origin::Claude]);
    }
}
```

Add to `crates/ohmyc-core/src/providers/shared_agents.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shared_agents_provider_marks_skills_as_codex_and_opencode() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(tmp.path().join("skills/fast-commit")).unwrap();
        std::fs::write(
            tmp.path().join("skills/fast-commit/SKILL.md"),
            "---\nname: fast-commit\ndescription: Commit quickly\n---\nSkill body",
        )
        .unwrap();

        let provider = SharedAgentsProvider::from_home(tmp.path().to_path_buf());
        let skills = provider.skills().unwrap();
        assert_eq!(skills[0].id, "fast-commit");
        assert_eq!(
            skills[0].origins,
            vec![crate::components::Origin::Codex, crate::components::Origin::Opencode],
        );
        assert_eq!(skills[0].source_provider, crate::components::SourceProvider::Shared);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cargo test -p ohmyc-core providers::claude
cargo test -p ohmyc-core providers::shared_agents
```

Expected: FAIL because provider modules and metadata-aware constructors are missing.

- [ ] **Step 3: Add metadata-aware list functions**

In `agents.rs`, add:

```rust
pub fn list_with_meta(
    dir: &Path,
    origin: Origin,
    source_provider: SourceProvider,
    source: ComponentSource,
    scope: Scope,
    source_kind: SourceKind,
    plugin_id: Option<String>,
) -> Result<Vec<Agent>, ApiError> {
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut out = Vec::new();
    list_agent_files(dir, &mut out, origin, source_provider, source, scope, source_kind, plugin_id)?;
    out.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(out)
}
```

Implement `list_agent_files` recursively with this policy: recurse into normal subdirectories, skip directory names starting with `.`, skip `node_modules`, skip symlinks, and include only `.md` files. Make it call a new `parse_agent_with_meta(filename, raw, path, ...)` that sets `locator_id`, `source_path`, `source_provider`, `source_kind`, `plugin_id`, `source`, `scope`, and `origins`.

Parser rules:
- Claude Markdown agents require `description`; `name` defaults to the file stem when missing.
- OpenCode Markdown agents require `description`; `name` defaults to the file stem when missing.
- Codex TOML agents keep the stricter Codex rule in Task 4: `name`, `description`, and `developer_instructions` are required.
- Markdown commands require content; `name` defaults to file stem and `description` defaults to an empty string when missing.
- Skills require `SKILL.md`; `name` defaults to the skill directory name and `description` defaults to an empty string when missing.

Repeat the same pattern in `skills.rs` as `list_with_origins_and_meta`, accepting `Vec<Origin>` because shared skills need two origins.

Repeat the same pattern in `commands.rs` as `list_with_meta`.

- [ ] **Step 4: Implement ClaudeProvider**

Create `crates/ohmyc-core/src/providers/claude.rs`:

```rust
use std::path::PathBuf;

use crate::components::{
    agents::{self, Agent},
    commands::{self, Command},
    skills::{self, Skill},
    ComponentSource, Origin, Scope, SourceKind, SourceProvider,
};
use crate::error::ApiError;

pub struct ClaudeProvider {
    home: PathBuf,
    project_root: Option<PathBuf>,
}

impl ClaudeProvider {
    pub fn new() -> Result<Self, ApiError> {
        Ok(Self {
            home: crate::claude_home::resolve()?,
            project_root: None,
        })
    }

    pub fn from_home(home: PathBuf) -> Self {
        Self { home, project_root: None }
    }

    pub fn with_project_root(mut self, project_root: PathBuf) -> Self {
        self.project_root = Some(project_root);
        self
    }

    pub fn agents(&self) -> Result<Vec<Agent>, ApiError> {
        let mut out = agents::list_with_meta(
            &self.home.join("agents"),
            Origin::Claude,
            SourceProvider::Claude,
            ComponentSource::Local,
            Scope::Global,
            SourceKind::Global,
            None,
        )?;
        if let Some(project_root) = &self.project_root {
            out.extend(agents::list_with_meta(
                &project_root.join(".claude").join("agents"),
                Origin::Claude,
                SourceProvider::Claude,
                ComponentSource::Project,
                Scope::Project,
                SourceKind::Project,
                None,
            )?);
        }
        out.sort_by(|a, b| a.id.cmp(&b.id).then_with(|| a.locator_id.cmp(&b.locator_id)));
        Ok(out)
    }

    pub fn skills(&self) -> Result<Vec<Skill>, ApiError> {
        let mut out = skills::list_with_origins_and_meta(
            &self.home.join("skills"),
            vec![Origin::Claude, Origin::Opencode],
            SourceProvider::Claude,
            ComponentSource::Local,
            Scope::Global,
            SourceKind::Global,
            None,
        )?;
        if let Some(project_root) = &self.project_root {
            out.extend(skills::list_with_origins_and_meta(
                &project_root.join(".claude").join("skills"),
                vec![Origin::Claude, Origin::Opencode],
                SourceProvider::Claude,
                ComponentSource::Project,
                Scope::Project,
                SourceKind::Project,
                None,
            )?);
        }
        out.sort_by(|a, b| a.id.cmp(&b.id).then_with(|| a.locator_id.cmp(&b.locator_id)));
        Ok(out)
    }

    pub fn commands(&self) -> Result<Vec<Command>, ApiError> {
        let mut out = commands::list_with_meta(
            &self.home.join("commands"),
            Origin::Claude,
            SourceProvider::Claude,
            ComponentSource::Local,
            Scope::Global,
            SourceKind::Global,
            None,
        )?;
        if let Some(project_root) = &self.project_root {
            out.extend(commands::list_with_meta(
                &project_root.join(".claude").join("commands"),
                Origin::Claude,
                SourceProvider::Claude,
                ComponentSource::Project,
                Scope::Project,
                SourceKind::Project,
                None,
            )?);
        }
        out.sort_by(|a, b| a.id.cmp(&b.id).then_with(|| a.locator_id.cmp(&b.locator_id)));
        Ok(out)
    }
}
```

- [ ] **Step 5: Implement SharedAgentsProvider**

Create `crates/ohmyc-core/src/providers/shared_agents.rs`:

```rust
use std::path::PathBuf;

use crate::components::{
    skills::{self, Skill},
    ComponentSource, Origin, Scope, SourceKind, SourceProvider,
};
use crate::error::ApiError;

pub struct SharedAgentsProvider {
    home: PathBuf,
    project_root: Option<PathBuf>,
}

impl SharedAgentsProvider {
    pub fn new() -> Result<Self, ApiError> {
        Ok(Self {
            home: super::paths::shared_agents_home()?,
            project_root: None,
        })
    }

    pub fn from_home(home: PathBuf) -> Self {
        Self { home, project_root: None }
    }

    pub fn with_project_root(mut self, project_root: PathBuf) -> Self {
        self.project_root = Some(project_root);
        self
    }

    pub fn skills(&self) -> Result<Vec<Skill>, ApiError> {
        let mut out = skills::list_with_origins_and_meta(
            &self.home.join("skills"),
            vec![Origin::Codex, Origin::Opencode],
            SourceProvider::Shared,
            ComponentSource::Local,
            Scope::Global,
            SourceKind::Shared,
            None,
        )?;
        if let Some(project_root) = &self.project_root {
            out.extend(skills::list_with_origins_and_meta(
                &project_root.join(".agents").join("skills"),
                vec![Origin::Codex, Origin::Opencode],
                SourceProvider::Shared,
                ComponentSource::Project,
                Scope::Project,
                SourceKind::Shared,
                None,
            )?);
        }
        out.sort_by(|a, b| a.id.cmp(&b.id).then_with(|| a.locator_id.cmp(&b.locator_id)));
        Ok(out)
    }
}
```

- [ ] **Step 6: Export provider modules**

Add to `crates/ohmyc-core/src/providers/mod.rs`:

```rust
pub mod claude;
pub mod shared_agents;
```

- [ ] **Step 7: Run provider tests**

Run:

```bash
cargo test -p ohmyc-core providers::claude
cargo test -p ohmyc-core providers::shared_agents
cargo test -p ohmyc-core components
```

Expected: PASS.

- [ ] **Step 8: Commit Claude/shared providers**

Run:

```bash
git add crates/ohmyc-core/src/components/agents.rs crates/ohmyc-core/src/components/skills.rs crates/ohmyc-core/src/components/commands.rs crates/ohmyc-core/src/providers/mod.rs crates/ohmyc-core/src/providers/claude.rs crates/ohmyc-core/src/providers/shared_agents.rs
git commit -m "feat(core): read claude and shared agent resources"
```

Expected: commit succeeds.

---

### Task 4: Implement Codex Provider

**Files:**
- Create: `crates/ohmyc-core/src/providers/codex.rs`
- Modify: `crates/ohmyc-core/src/providers/mod.rs`
- Modify: `crates/ohmyc-core/src/components/agents.rs`
- Modify: `crates/ohmyc-core/src/components/commands.rs`
- Modify: `crates/ohmyc-core/src/plugins.rs`

- [ ] **Step 1: Write failing Codex parser tests**

Create `crates/ohmyc-core/src/providers/codex.rs` with tests:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codex_provider_reads_toml_agents_and_legacy_prompts() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(tmp.path().join("agents")).unwrap();
        std::fs::create_dir_all(tmp.path().join("prompts")).unwrap();
        std::fs::create_dir_all(tmp.path().join("skills/review")).unwrap();
        std::fs::write(
            tmp.path().join("agents/reviewer.toml"),
            r#"
name = "reviewer"
description = "Reviews PRs"
developer_instructions = """
Review correctness, security, and missing tests.
"""
"#,
        )
        .unwrap();
        std::fs::write(
            tmp.path().join("prompts/draftpr.md"),
            "---\ndescription: Draft a PR\nargument-hint: FILES=<paths>\n---\nDraft a PR for $FILES.",
        )
        .unwrap();
        std::fs::write(
            tmp.path().join("skills/review/SKILL.md"),
            "---\nname: review\ndescription: Review code\n---\nSkill body",
        )
        .unwrap();

        let provider = CodexProvider::from_home(tmp.path().to_path_buf());
        assert_eq!(provider.agents().unwrap()[0].id, "reviewer");
        assert_eq!(provider.skills().unwrap()[0].origins, vec![crate::components::Origin::Codex]);
        assert_eq!(provider.commands().unwrap()[0].id, "draftpr");
        assert_eq!(provider.commands().unwrap()[0].origins, vec![crate::components::Origin::Codex]);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cargo test -p ohmyc-core providers::codex
```

Expected: FAIL because `CodexProvider` does not exist.

- [ ] **Step 3: Add Codex TOML agent parser**

In `agents.rs`, add:

```rust
pub fn parse_codex_toml_agent(
    filename: &str,
    raw: &str,
    source_path: &std::path::Path,
    scope: Scope,
) -> Result<Option<Agent>, ApiError> {
    let value: toml::Value = toml::from_str(raw).map_err(|e| ApiError::Parse(format!("codex agent toml: {e}")))?;
    let Some(name) = value.get("name").and_then(|v| v.as_str()).filter(|s| !s.is_empty()) else {
        return Ok(None);
    };
    let Some(description) = value.get("description").and_then(|v| v.as_str()).filter(|s| !s.is_empty()) else {
        return Ok(None);
    };
    let Some(instructions) = value
        .get("developer_instructions")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
    else {
        return Ok(None);
    };
    let mut frontmatter = serde_json::Map::new();
    frontmatter.insert("name".into(), serde_json::Value::String(name.to_string()));
    frontmatter.insert("description".into(), serde_json::Value::String(description.to_string()));
    if let Some(model) = value.get("model").and_then(|v| v.as_str()) {
        frontmatter.insert("model".into(), serde_json::Value::String(model.to_string()));
    }
    let id = name.to_string();
    Ok(Some(Agent {
        id: id.clone(),
        frontmatter: serde_json::Value::Object(frontmatter),
        content: instructions.trim().to_string(),
        raw: raw.to_string(),
        filename: filename.to_string(),
        source: ComponentSource::Local,
        scope,
        origins: vec![Origin::Codex],
        badges: Vec::new(),
        locator_id: locator_id(
            ComponentKind::Agents,
            SourceProvider::Codex,
            ComponentSource::Local,
            scope,
            None,
            &id,
            Some(source_path),
        ),
        source_path: Some(source_path.to_string_lossy().to_string()),
        source_provider: SourceProvider::Codex,
        source_kind: match scope {
            Scope::Global => SourceKind::Global,
            Scope::Project => SourceKind::Project,
        },
        plugin_id: None,
    }))
}
```

- [ ] **Step 4: Add Codex prompt parser**

In `commands.rs`, add:

```rust
pub fn parse_codex_prompt(
    filename: &str,
    raw: &str,
    source_path: &std::path::Path,
    scope: Scope,
) -> Result<Option<Command>, ApiError> {
    let (mut frontmatter, content) = frontmatter::parse(raw)?;
    let id = filename.trim_end_matches(".md").to_string();
    if let Some(obj) = frontmatter.as_object_mut() {
        obj.entry("name".to_string()).or_insert_with(|| serde_json::Value::String(id.clone()));
        obj.entry("description".to_string()).or_insert_with(|| serde_json::Value::String("Codex legacy prompt".into()));
    }
    Ok(Some(Command {
        id: id.clone(),
        frontmatter,
        content,
        raw: raw.to_string(),
        filename: filename.to_string(),
        source: ComponentSource::Local,
        scope,
        origins: vec![Origin::Codex],
        badges: vec![serde_json::json!({"kind": "pill", "label": "prompt", "tone": "neutral"})],
        locator_id: locator_id(
            ComponentKind::Commands,
            SourceProvider::Codex,
            ComponentSource::Local,
            scope,
            None,
            &id,
            Some(source_path),
        ),
        source_path: Some(source_path.to_string_lossy().to_string()),
        source_provider: SourceProvider::Codex,
        source_kind: match scope {
            Scope::Global => SourceKind::Global,
            Scope::Project => SourceKind::Project,
        },
        plugin_id: None,
    }))
}
```

- [ ] **Step 5: Implement CodexProvider**

Create `crates/ohmyc-core/src/providers/codex.rs`:

```rust
use std::path::PathBuf;

use crate::components::{
    agents::{parse_codex_toml_agent, Agent},
    commands::{parse_codex_prompt, Command},
    skills::{self, Skill},
    ComponentSource, Origin, Scope, SourceKind, SourceProvider,
};
use crate::error::ApiError;

pub struct CodexProvider {
    home: PathBuf,
    project_root: Option<PathBuf>,
}

impl CodexProvider {
    pub fn new() -> Result<Self, ApiError> {
        Ok(Self {
            home: super::paths::codex_home()?,
            project_root: None,
        })
    }

    pub fn from_home(home: PathBuf) -> Self {
        Self { home, project_root: None }
    }

    pub fn with_project_root(mut self, project_root: PathBuf) -> Self {
        self.project_root = Some(project_root);
        self
    }

    pub fn agents(&self) -> Result<Vec<Agent>, ApiError> {
        let mut out = self.read_agents_dir(&self.home.join("agents"), Scope::Global)?;
        if let Some(project_root) = &self.project_root {
            out.extend(self.read_agents_dir(&project_root.join(".codex").join("agents"), Scope::Project)?);
        }
        out.sort_by(|a, b| a.id.cmp(&b.id).then_with(|| a.locator_id.cmp(&b.locator_id)));
        Ok(out)
    }

    fn read_agents_dir(&self, dir: &std::path::Path, scope: Scope) -> Result<Vec<Agent>, ApiError> {
        if !dir.exists() {
            return Ok(Vec::new());
        }
        let mut out = Vec::new();
        for entry in std::fs::read_dir(dir).map_err(ApiError::from)? {
            let entry = entry.map_err(ApiError::from)?;
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) != Some("toml") {
                continue;
            }
            let Some(filename) = path.file_name().and_then(|s| s.to_str()) else {
                continue;
            };
            let raw = std::fs::read_to_string(&path)
                .map_err(|e| ApiError::Io(format!("read {}: {e}", path.display())))?;
            if let Some(agent) = parse_codex_toml_agent(filename, &raw, &path, scope)? {
                out.push(agent);
            }
        }
        Ok(out)
    }

    pub fn skills(&self) -> Result<Vec<Skill>, ApiError> {
        let mut out = skills::list_with_origins_and_meta(
            &self.home.join("skills"),
            vec![Origin::Codex],
            SourceProvider::Codex,
            ComponentSource::Local,
            Scope::Global,
            SourceKind::Global,
            None,
        )?;
        if let Some(project_root) = &self.project_root {
            out.extend(skills::list_with_origins_and_meta(
                &project_root.join(".codex").join("skills"),
                vec![Origin::Codex],
                SourceProvider::Codex,
                ComponentSource::Project,
                Scope::Project,
                SourceKind::Project,
                None,
            )?);
        }
        out.sort_by(|a, b| a.id.cmp(&b.id).then_with(|| a.locator_id.cmp(&b.locator_id)));
        Ok(out)
    }

    pub fn skills_from_plugins(&self) -> Result<Vec<Skill>, ApiError> {
        let cache = self.home.join("plugins").join("cache");
        crate::plugins::list_codex_plugins(&cache).map(|_| Vec::new())
    }

    pub fn commands(&self) -> Result<Vec<Command>, ApiError> {
        let mut out = self.read_prompts_dir(&self.home.join("prompts"), Scope::Global)?;
        if let Some(project_root) = &self.project_root {
            out.extend(self.read_prompts_dir(&project_root.join(".codex").join("prompts"), Scope::Project)?);
        }
        out.sort_by(|a, b| a.id.cmp(&b.id).then_with(|| a.locator_id.cmp(&b.locator_id)));
        Ok(out)
    }

    fn read_prompts_dir(&self, dir: &std::path::Path, scope: Scope) -> Result<Vec<Command>, ApiError> {
        if !dir.exists() {
            return Ok(Vec::new());
        }
        let mut out = Vec::new();
        for entry in std::fs::read_dir(dir).map_err(ApiError::from)? {
            let entry = entry.map_err(ApiError::from)?;
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) != Some("md") {
                continue;
            }
            let Some(filename) = path.file_name().and_then(|s| s.to_str()) else {
                continue;
            };
            let raw = std::fs::read_to_string(&path)
                .map_err(|e| ApiError::Io(format!("read {}: {e}", path.display())))?;
            if let Some(command) = parse_codex_prompt(filename, &raw, &path, scope)? {
                out.push(command);
            }
        }
        Ok(out)
    }
}
```

The `skills_from_plugins` body is only a temporary compile scaffold in this task. Task 7 replaces it with real plugin skill parsing before the feature is accepted.

- [ ] **Step 6: Export CodexProvider**

Add to `crates/ohmyc-core/src/providers/mod.rs`:

```rust
pub mod codex;
```

- [ ] **Step 7: Run Codex provider tests**

Run:

```bash
cargo test -p ohmyc-core providers::codex
```

Expected: PASS.

- [ ] **Step 8: Commit Codex provider**

Run:

```bash
git add crates/ohmyc-core/src/components/agents.rs crates/ohmyc-core/src/components/commands.rs crates/ohmyc-core/src/components/skills.rs crates/ohmyc-core/src/providers/mod.rs crates/ohmyc-core/src/providers/codex.rs
git commit -m "feat(core): read codex resources"
```

Expected: commit succeeds.

---

### Task 5: Implement OpenCode Provider

**Files:**
- Create: `crates/ohmyc-core/src/providers/opencode.rs`
- Modify: `crates/ohmyc-core/src/providers/mod.rs`
- Modify: `crates/ohmyc-core/src/components/agents.rs`
- Modify: `crates/ohmyc-core/src/components/commands.rs`

- [ ] **Step 1: Write failing OpenCode provider tests**

Create `crates/ohmyc-core/src/providers/opencode.rs` with tests:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn opencode_provider_reads_markdown_and_jsonc_resources() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(tmp.path().join("agents")).unwrap();
        std::fs::create_dir_all(tmp.path().join("commands")).unwrap();
        std::fs::create_dir_all(tmp.path().join("skills/native")).unwrap();
        std::fs::write(
            tmp.path().join("agents/review.md"),
            "---\ndescription: Reviews code\nmode: subagent\n---\nReview carefully.",
        )
        .unwrap();
        std::fs::write(
            tmp.path().join("commands/test.md"),
            "---\ndescription: Run tests\nagent: build\n---\nRun tests.",
        )
        .unwrap();
        std::fs::write(
            tmp.path().join("skills/native/SKILL.md"),
            "---\nname: native\ndescription: Native OpenCode skill\n---\nSkill body.",
        )
        .unwrap();
        std::fs::write(
            tmp.path().join("opencode.jsonc"),
            r#"{
              // config-backed resources
              "agent": {
                "planner": {
                  "description": "Plans work",
                  "mode": "primary",
                  "prompt": "Plan without editing."
                }
              },
              "command": {
                "component": {
                  "description": "Create a component",
                  "template": "Create $ARGUMENTS",
                },
              },
            }"#,
        )
        .unwrap();

        let provider = OpenCodeProvider::from_home(tmp.path().to_path_buf());
        assert_eq!(provider.agents().unwrap().len(), 2);
        assert_eq!(provider.commands().unwrap().len(), 2);
        assert_eq!(provider.skills().unwrap()[0].origins, vec![crate::components::Origin::Opencode]);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cargo test -p ohmyc-core providers::opencode
```

Expected: FAIL because `OpenCodeProvider` does not exist.

- [ ] **Step 3: Add JSONC config parse helper**

In `crates/ohmyc-core/src/providers/opencode.rs`, implement:

```rust
fn read_jsonc(path: &std::path::Path) -> Result<Option<serde_json::Value>, ApiError> {
    let raw = match std::fs::read_to_string(path) {
        Ok(raw) => raw,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(ApiError::Io(format!("read {}: {e}", path.display()))),
    };
    let value = json5::from_str::<serde_json::Value>(&raw)
        .map_err(|e| ApiError::Parse(format!("jsonc {}: {e}", path.display())))?;
    Ok(Some(value))
}
```

- [ ] **Step 4: Add OpenCode config-backed parsers**

In `agents.rs`, add `agent_from_opencode_config`:

```rust
pub fn agent_from_opencode_config(
    id: &str,
    value: &serde_json::Value,
    source_path: &std::path::Path,
    scope: Scope,
) -> Option<Agent> {
    let description = value.get("description")?.as_str()?.to_string();
    let content = value
        .get("prompt")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    let mut frontmatter = value.as_object().cloned().unwrap_or_default();
    frontmatter.insert("name".into(), serde_json::Value::String(id.to_string()));
    frontmatter.insert("description".into(), serde_json::Value::String(description));
    Some(Agent {
        id: id.to_string(),
        frontmatter: serde_json::Value::Object(frontmatter),
        content,
        raw: value.to_string(),
        filename: source_path.file_name()?.to_string_lossy().to_string(),
        source: ComponentSource::Local,
        scope,
        origins: vec![Origin::Opencode],
        badges: Vec::new(),
        locator_id: locator_id(ComponentKind::Agents, SourceProvider::Opencode, ComponentSource::Local, scope, None, id, Some(source_path)),
        source_path: Some(source_path.to_string_lossy().to_string()),
        source_provider: SourceProvider::Opencode,
        source_kind: match scope {
            Scope::Global => SourceKind::Global,
            Scope::Project => SourceKind::Project,
        },
        plugin_id: None,
    })
}
```

In `commands.rs`, add `command_from_opencode_config`:

```rust
pub fn command_from_opencode_config(
    id: &str,
    value: &serde_json::Value,
    source_path: &std::path::Path,
    scope: Scope,
) -> Option<Command> {
    let template = value.get("template")?.as_str()?.to_string();
    let description = value
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let mut frontmatter = value.as_object().cloned().unwrap_or_default();
    frontmatter.insert("name".into(), serde_json::Value::String(id.to_string()));
    frontmatter.insert("description".into(), serde_json::Value::String(description));
    Some(Command {
        id: id.to_string(),
        frontmatter: serde_json::Value::Object(frontmatter),
        content: template,
        raw: value.to_string(),
        filename: source_path.file_name()?.to_string_lossy().to_string(),
        source: ComponentSource::Local,
        scope,
        origins: vec![Origin::Opencode],
        badges: Vec::new(),
        locator_id: locator_id(ComponentKind::Commands, SourceProvider::Opencode, ComponentSource::Local, scope, None, id, Some(source_path)),
        source_path: Some(source_path.to_string_lossy().to_string()),
        source_provider: SourceProvider::Opencode,
        source_kind: match scope {
            Scope::Global => SourceKind::Global,
            Scope::Project => SourceKind::Project,
        },
        plugin_id: None,
    })
}
```

- [ ] **Step 5: Implement OpenCodeProvider**

Create `crates/ohmyc-core/src/providers/opencode.rs` with:

```rust
use std::path::PathBuf;

use crate::components::{
    agents::{self, agent_from_opencode_config, Agent},
    commands::{self, command_from_opencode_config, Command},
    skills::{self, Skill},
    ComponentSource, Origin, Scope, SourceKind, SourceProvider,
};
use crate::error::ApiError;

pub struct OpenCodeProvider {
    home: PathBuf,
    project_root: Option<PathBuf>,
}

impl OpenCodeProvider {
    pub fn new() -> Result<Self, ApiError> {
        Ok(Self {
            home: super::paths::opencode_home()?,
            project_root: None,
        })
    }

    pub fn from_home(home: PathBuf) -> Self {
        Self { home, project_root: None }
    }

    pub fn with_project_root(mut self, project_root: PathBuf) -> Self {
        self.project_root = Some(project_root);
        self
    }

    pub fn agents(&self) -> Result<Vec<Agent>, ApiError> {
        let mut out = agents::list_with_meta(
            &self.home.join("agents"),
            Origin::Opencode,
            SourceProvider::Opencode,
            ComponentSource::Local,
            Scope::Global,
            SourceKind::Global,
            None,
        )?;
        if let Some(project_root) = &self.project_root {
            out.extend(agents::list_with_meta(
                &project_root.join(".opencode").join("agents"),
                Origin::Opencode,
                SourceProvider::Opencode,
                ComponentSource::Project,
                Scope::Project,
                SourceKind::Project,
                None,
            )?);
        }
        self.read_config_agents(&mut out)?;
        out.sort_by(|a, b| a.id.cmp(&b.id));
        Ok(out)
    }

    pub fn skills(&self) -> Result<Vec<Skill>, ApiError> {
        let mut out = skills::list_with_origins_and_meta(
            &self.home.join("skills"),
            vec![Origin::Opencode],
            SourceProvider::Opencode,
            ComponentSource::Local,
            Scope::Global,
            SourceKind::Global,
            None,
        )?;
        if let Some(project_root) = &self.project_root {
            out.extend(skills::list_with_origins_and_meta(
                &project_root.join(".opencode").join("skills"),
                vec![Origin::Opencode],
                SourceProvider::Opencode,
                ComponentSource::Project,
                Scope::Project,
                SourceKind::Project,
                None,
            )?);
        }
        out.sort_by(|a, b| a.id.cmp(&b.id).then_with(|| a.locator_id.cmp(&b.locator_id)));
        Ok(out)
    }

    pub fn commands(&self) -> Result<Vec<Command>, ApiError> {
        let mut out = commands::list_with_meta(
            &self.home.join("commands"),
            Origin::Opencode,
            SourceProvider::Opencode,
            ComponentSource::Local,
            Scope::Global,
            SourceKind::Global,
            None,
        )?;
        if let Some(project_root) = &self.project_root {
            out.extend(commands::list_with_meta(
                &project_root.join(".opencode").join("commands"),
                Origin::Opencode,
                SourceProvider::Opencode,
                ComponentSource::Project,
                Scope::Project,
                SourceKind::Project,
                None,
            )?);
        }
        self.read_config_commands(&mut out)?;
        out.sort_by(|a, b| a.id.cmp(&b.id));
        Ok(out)
    }

    fn config_paths(&self) -> [PathBuf; 2] {
        [self.home.join("opencode.json"), self.home.join("opencode.jsonc")]
    }

    fn project_config_paths(&self) -> Vec<PathBuf> {
        self.project_root
            .as_ref()
            .map(|root| vec![root.join("opencode.json"), root.join("opencode.jsonc")])
            .unwrap_or_default()
    }

    fn read_config_agents(&self, out: &mut Vec<Agent>) -> Result<(), ApiError> {
        for path in self.config_paths().into_iter().chain(self.project_config_paths()) {
            let Some(json) = read_jsonc(&path)? else {
                continue;
            };
            let Some(map) = json.get("agent").and_then(|v| v.as_object()) else {
                continue;
            };
            for (id, value) in map {
                let scope = if self.project_root.as_ref().is_some_and(|root| path.starts_with(root)) {
                    Scope::Project
                } else {
                    Scope::Global
                };
                if let Some(agent) = agent_from_opencode_config(id, value, &path, scope) {
                    out.push(agent);
                }
            }
        }
        Ok(())
    }

    fn read_config_commands(&self, out: &mut Vec<Command>) -> Result<(), ApiError> {
        for path in self.config_paths().into_iter().chain(self.project_config_paths()) {
            let Some(json) = read_jsonc(&path)? else {
                continue;
            };
            let Some(map) = json.get("command").and_then(|v| v.as_object()) else {
                continue;
            };
            for (id, value) in map {
                let scope = if self.project_root.as_ref().is_some_and(|root| path.starts_with(root)) {
                    Scope::Project
                } else {
                    Scope::Global
                };
                if let Some(command) = command_from_opencode_config(id, value, &path, scope) {
                    out.push(command);
                }
            }
        }
        Ok(())
    }
}
```

- [ ] **Step 6: Export OpenCodeProvider**

Add to `crates/ohmyc-core/src/providers/mod.rs`:

```rust
pub mod opencode;
```

- [ ] **Step 7: Run OpenCode provider tests**

Run:

```bash
cargo test -p ohmyc-core providers::opencode
```

Expected: PASS.

- [ ] **Step 8: Commit OpenCode provider**

Run:

```bash
git add crates/ohmyc-core/src/components/agents.rs crates/ohmyc-core/src/components/commands.rs crates/ohmyc-core/src/providers/mod.rs crates/ohmyc-core/src/providers/opencode.rs
git commit -m "feat(core): read opencode resources"
```

Expected: commit succeeds.

---

### Task 6: Wire Registry Lists and Tauri API

**Files:**
- Modify: `crates/ohmyc-core/src/providers/mod.rs`
- Modify: `packages/desktop/src-tauri/src/api/mod.rs`
- Modify: `packages/desktop/src-tauri/src/api/agents.rs`
- Modify: `packages/desktop/src-tauri/src/api/skills.rs`
- Modify: `packages/desktop/src-tauri/src/api/commands.rs`

- [ ] **Step 1: Write failing registry integration tests**

Add to `crates/ohmyc-core/src/providers/mod.rs` tests:

```rust
#[test]
fn registry_lists_shared_and_codex_skills_for_codex_origin() {
    let codex_home = tempfile::tempdir().unwrap();
    let shared_home = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(codex_home.path().join("skills/native")).unwrap();
    std::fs::create_dir_all(shared_home.path().join("skills/shared")).unwrap();
    std::fs::write(codex_home.path().join("skills/native/SKILL.md"), "---\nname: native\ndescription: Native\n---\nBody").unwrap();
    std::fs::write(shared_home.path().join("skills/shared/SKILL.md"), "---\nname: shared\ndescription: Shared\n---\nBody").unwrap();

    let prev_codex = std::env::var("OHMYC_CODEX_HOME").ok();
    let prev_agents = std::env::var("OHMYC_AGENTS_HOME").ok();
    std::env::set_var("OHMYC_CODEX_HOME", codex_home.path());
    std::env::set_var("OHMYC_AGENTS_HOME", shared_home.path());

    let registry = ProviderRegistry::new(tempfile::tempdir().unwrap().path());
    let skills = registry.list_skills(Some(&[crate::components::Origin::Codex])).unwrap();

    match prev_codex {
        Some(v) => std::env::set_var("OHMYC_CODEX_HOME", v),
        None => std::env::remove_var("OHMYC_CODEX_HOME"),
    }
    match prev_agents {
        Some(v) => std::env::set_var("OHMYC_AGENTS_HOME", v),
        None => std::env::remove_var("OHMYC_AGENTS_HOME"),
    }

    let ids: Vec<_> = skills.iter().map(|skill| skill.id.as_str()).collect();
    assert!(ids.contains(&"native"));
    assert!(ids.contains(&"shared"));
}
```

Add to `packages/desktop/src-tauri/src/api/mod.rs` tests:

```rust
#[test]
fn origins_parser_accepts_codex_claude_and_opencode() {
    assert_eq!(
        parse_origins(&Some(serde_json::json!("codex,claude,opencode"))).unwrap(),
        Some(vec![
            ohmyc_core::components::Origin::Codex,
            ohmyc_core::components::Origin::Claude,
            ohmyc_core::components::Origin::Opencode,
        ]),
    );
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cargo test -p ohmyc-core providers::tests::registry_lists_shared_and_codex_skills_for_codex_origin
cargo test -p ohmyc-desktop api::tests::origins_parser_accepts_codex_claude_and_opencode
```

Expected: second command FAILS because `parse_origins` is missing.

- [ ] **Step 3: Implement registry list methods**

In `crates/ohmyc-core/src/providers/mod.rs`, add:

```rust
use crate::components::{agents::Agent, commands::Command, skills::Skill};

impl ProviderRegistry {
    pub fn list_agents(&self, origins: Option<&[Origin]>) -> Result<Vec<Agent>, ApiError> {
        // Providers are intentionally stateless: each API reads only the
        // requested resource type. A shared inventory cache would need
        // watcher-driven invalidation across project roots, origin filters,
        // and plugin enablement, which is not needed for the first version.
        let mut out = Vec::new();
        out.extend(claude::ClaudeProvider::new()?.with_project_root(self.project_root.clone()).agents()?);
        out.extend(codex::CodexProvider::new()?.with_project_root(self.project_root.clone()).agents()?);
        out.extend(opencode::OpenCodeProvider::new()?.with_project_root(self.project_root.clone()).agents()?);
        out.retain(|agent| matches_origin_filter(origins, &agent.origins));
        out.sort_by(|a, b| a.id.cmp(&b.id).then_with(|| a.locator_id.cmp(&b.locator_id)));
        Ok(out)
    }

    pub fn list_skills(&self, origins: Option<&[Origin]>) -> Result<Vec<Skill>, ApiError> {
        // Keep this skills-only. Do not call a plugin or provider helper that
        // parses agents/commands as a side effect; cross-resource caching is
        // a later optimization once watcher invalidation is mature.
        let mut out = Vec::new();
        let codex = codex::CodexProvider::new()?.with_project_root(self.project_root.clone());
        out.extend(claude::ClaudeProvider::new()?.with_project_root(self.project_root.clone()).skills()?);
        out.extend(shared_agents::SharedAgentsProvider::new()?.with_project_root(self.project_root.clone()).skills()?);
        out.extend(codex.skills()?);
        out.extend(codex.skills_from_plugins()?);
        out.extend(opencode::OpenCodeProvider::new()?.with_project_root(self.project_root.clone()).skills()?);
        out.retain(|skill| matches_origin_filter(origins, &skill.origins));
        out.sort_by(|a, b| a.id.cmp(&b.id).then_with(|| a.locator_id.cmp(&b.locator_id)));
        Ok(out)
    }

    pub fn list_commands(&self, origins: Option<&[Origin]>) -> Result<Vec<Command>, ApiError> {
        // Commands are parsed independently for the same reason as agents and
        // skills: this keeps refresh behavior simple and avoids stale cache
        // state after config or plugin changes.
        let mut out = Vec::new();
        out.extend(claude::ClaudeProvider::new()?.with_project_root(self.project_root.clone()).commands()?);
        out.extend(codex::CodexProvider::new()?.with_project_root(self.project_root.clone()).commands()?);
        out.extend(opencode::OpenCodeProvider::new()?.with_project_root(self.project_root.clone()).commands()?);
        out.retain(|command| matches_origin_filter(origins, &command.origins));
        out.sort_by(|a, b| a.id.cmp(&b.id).then_with(|| a.locator_id.cmp(&b.locator_id)));
        Ok(out)
    }
}
```

- [ ] **Step 4: Implement API origin parser**

In `packages/desktop/src-tauri/src/api/mod.rs`, add:

```rust
pub fn parse_origins(filter: &Option<serde_json::Value>) -> Result<Option<Vec<ohmyc_core::components::Origin>>, ApiError> {
    let Some(v) = filter.as_ref() else {
        return Ok(None);
    };
    let parts: Vec<String> = match v {
        serde_json::Value::String(s) => s.split(',').map(|p| p.trim().to_string()).filter(|p| !p.is_empty()).collect(),
        serde_json::Value::Array(items) => items.iter().filter_map(|i| i.as_str().map(ToString::to_string)).collect(),
        _ => return Ok(None),
    };
    let mut out = Vec::new();
    for part in parts {
        match part.as_str() {
            "codex" => out.push(ohmyc_core::components::Origin::Codex),
            "claude" => out.push(ohmyc_core::components::Origin::Claude),
            "opencode" => out.push(ohmyc_core::components::Origin::Opencode),
            _ => {}
        }
    }
    Ok(Some(out))
}
```

Keep `include_origin` for existing plugin/settings callers until they are migrated or removed.

- [ ] **Step 5: Route list APIs through registry**

In `packages/desktop/src-tauri/src/api/agents.rs`, replace `agents_list` body:

```rust
#[tauri::command]
pub fn agents_list(origins: Option<serde_json::Value>) -> Result<AgentsResponse, ApiError> {
    let parsed = super::parse_origins(&origins)?;
    let registry = ohmyc_core::providers::ProviderRegistry::current_dir()?;
    let agents = registry.list_agents(parsed.as_deref())?;
    Ok(AgentsResponse { agents })
}
```

Use the same pattern in `skills.rs` and `commands.rs`.

- [ ] **Step 6: Keep get APIs compatible**

For each get API, first support the Tauri command argument `locator_id` when provided, then fallback to `name`.

Use this request shape:

```rust
#[tauri::command]
pub fn agents_get(name: String, locator_id: Option<String>) -> Result<AgentResponse, ApiError> {
    let registry = ohmyc_core::providers::ProviderRegistry::current_dir()?;
    let agents = registry.list_agents(None)?;
    let agent = match locator_id {
        Some(locator_id) => agents.into_iter().find(|agent| agent.locator_id == locator_id),
        None => agents.into_iter().find(|agent| agent.id == name),
    };
    Ok(AgentResponse { agent })
}
```

Apply equivalent logic to skills and commands.

- [ ] **Step 7: Run API tests**

Run:

```bash
cargo test -p ohmyc-core providers
cargo test -p ohmyc-desktop api
```

Expected: PASS.

- [ ] **Step 8: Commit API registry wiring**

Run:

```bash
git add crates/ohmyc-core/src/providers/mod.rs packages/desktop/src-tauri/src/api/mod.rs packages/desktop/src-tauri/src/api/agents.rs packages/desktop/src-tauri/src/api/skills.rs packages/desktop/src-tauri/src/api/commands.rs
git commit -m "feat(api): route resources through provider registry"
```

Expected: commit succeeds.

---

### Task 7: Add Static Plugin Resource Parsing

**Files:**
- Modify: `crates/ohmyc-core/src/plugins.rs`
- Modify: `crates/ohmyc-core/src/providers/claude.rs`
- Modify: `crates/ohmyc-core/src/providers/codex.rs`
- Modify: `crates/ohmyc-core/src/providers/mod.rs`
- Modify: `packages/desktop/src-tauri/src/api/plugins.rs`

- [ ] **Step 1: Write failing plugin resource tests**

Add to `crates/ohmyc-core/src/providers/claude.rs` tests:

```rust
#[test]
fn claude_provider_reads_plugin_skills_agents_and_commands() {
    let tmp = tempfile::tempdir().unwrap();
    let plugin = tmp.path().join("plugin");
    std::fs::create_dir_all(plugin.join(".claude-plugin")).unwrap();
    std::fs::create_dir_all(plugin.join("skills/review")).unwrap();
    std::fs::create_dir_all(plugin.join("agents")).unwrap();
    std::fs::create_dir_all(plugin.join("commands")).unwrap();
    std::fs::write(plugin.join(".claude-plugin/plugin.json"), r#"{"name":"toolbox","version":"1.0.0"}"#).unwrap();
    std::fs::write(plugin.join("skills/review/SKILL.md"), "---\nname: review\ndescription: Review\n---\nBody").unwrap();
    std::fs::write(plugin.join("agents/reviewer.md"), "---\nname: reviewer\ndescription: Reviews\n---\nBody").unwrap();
    std::fs::write(plugin.join("commands/ship.md"), "---\nname: ship\ndescription: Ship\n---\nBody").unwrap();

    let resources = crate::plugins::parse_claude_plugin_resources(&plugin, "toolbox@local").unwrap();
    assert_eq!(resources.skills[0].source, crate::components::ComponentSource::Plugin);
    assert_eq!(resources.agents[0].plugin_id.as_deref(), Some("toolbox@local"));
    assert_eq!(resources.commands[0].origins, vec![crate::components::Origin::Claude]);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cargo test -p ohmyc-core providers::claude::tests::claude_provider_reads_plugin_skills_agents_and_commands
```

Expected: FAIL because plugin resource parsing is missing.

- [ ] **Step 3: Add plugin resource envelope**

In `crates/ohmyc-core/src/plugins.rs`, first extend `InstalledPlugin` with additive source metadata:

```rust
#[serde(rename = "locatorId", default)]
pub locator_id: String,
#[serde(rename = "sourceProvider", default = "default_plugin_source_provider")]
pub source_provider: crate::components::SourceProvider,
#[serde(rename = "sourceKind", default = "default_plugin_source_kind")]
pub source_kind: crate::components::SourceKind,
#[serde(default)]
pub origins: Vec<crate::components::Origin>,
```

Add helper defaults in `plugins.rs`:

```rust
fn default_plugin_source_provider() -> crate::components::SourceProvider {
    crate::components::SourceProvider::Claude
}

fn default_plugin_source_kind() -> crate::components::SourceKind {
    crate::components::SourceKind::Plugin
}
```

When building Claude plugins, set `source_provider = SourceProvider::Claude`, `source_kind = SourceKind::Plugin`, `origins = vec![Origin::Claude]`, and `locator_id = locator_id(ComponentKind::Plugins, SourceProvider::Claude, ComponentSource::Plugin, Scope::Global, Some(&id), &id, plugin.installs.first().map(|install| std::path::Path::new(&install.install_path)))`.

When building Codex plugins, set `source_provider = SourceProvider::Codex`, `source_kind = SourceKind::Plugin`, `origins = vec![Origin::Codex]`, and use `SourceProvider::Codex` in `locator_id`.

Then add:

```rust
#[derive(Debug, Clone, Default)]
pub struct PluginResources {
    pub agents: Vec<crate::components::agents::Agent>,
    pub skills: Vec<crate::components::skills::Skill>,
    pub commands: Vec<crate::components::commands::Command>,
}
```

- [ ] **Step 4: Implement Claude plugin resource parser**

Add to `plugins.rs`:

```rust
pub fn parse_claude_plugin_resources(install_path: &Path, plugin_id: &str) -> Result<PluginResources, ApiError> {
    // Used by focused tests and future full-inventory callers. Production
    // list APIs should prefer resource-specific plugin parsers so a skills
    // request does not parse plugin agents and commands unnecessarily.
    Ok(PluginResources {
        agents: parse_claude_plugin_agents(install_path, plugin_id)?,
        skills: parse_claude_plugin_skills(install_path, plugin_id)?,
        commands: parse_claude_plugin_commands(install_path, plugin_id)?,
    })
}

pub fn parse_claude_plugin_agents(install_path: &Path, plugin_id: &str) -> Result<Vec<crate::components::agents::Agent>, ApiError> {
    use crate::components::{ComponentSource, Origin, Scope, SourceKind, SourceProvider};
    crate::components::agents::list_with_meta(
        &install_path.join("agents"),
        Origin::Claude,
        SourceProvider::Claude,
        ComponentSource::Plugin,
        Scope::Global,
        SourceKind::Plugin,
        Some(plugin_id.to_string()),
    )
}

pub fn parse_claude_plugin_skills(install_path: &Path, plugin_id: &str) -> Result<Vec<crate::components::skills::Skill>, ApiError> {
    use crate::components::{ComponentSource, Origin, Scope, SourceKind, SourceProvider};
    crate::components::skills::list_with_origins_and_meta(
        &install_path.join("skills"),
        vec![Origin::Claude, Origin::Opencode],
        SourceProvider::Claude,
        ComponentSource::Plugin,
        Scope::Global,
        SourceKind::Plugin,
        Some(plugin_id.to_string()),
    )
}

pub fn parse_claude_plugin_commands(install_path: &Path, plugin_id: &str) -> Result<Vec<crate::components::commands::Command>, ApiError> {
    use crate::components::{ComponentSource, Origin, Scope, SourceKind, SourceProvider};
    crate::components::commands::list_with_meta(
        &install_path.join("commands"),
        Origin::Claude,
        SourceProvider::Claude,
        ComponentSource::Plugin,
        Scope::Global,
        SourceKind::Plugin,
        Some(plugin_id.to_string()),
    )
}
```

- [ ] **Step 5: Implement Codex plugin skill parser**

Add to `plugins.rs`:

```rust
pub fn parse_codex_plugin_resources(install_path: &Path, plugin_id: &str) -> Result<PluginResources, ApiError> {
    // Codex plugins currently expose skills only. Keep this parser explicit
    // so future agent/command support does not silently change skills-list
    // performance or behavior.
    Ok(PluginResources {
        agents: Vec::new(),
        skills: parse_codex_plugin_skills(install_path, plugin_id)?,
        commands: Vec::new(),
    })
}

pub fn parse_codex_plugin_skills(install_path: &Path, plugin_id: &str) -> Result<Vec<crate::components::skills::Skill>, ApiError> {
    use crate::components::{ComponentSource, Origin, Scope, SourceKind, SourceProvider};
    crate::components::skills::list_with_origins_and_meta(
        &install_path.join("skills"),
        vec![Origin::Codex],
        SourceProvider::Codex,
        ComponentSource::Plugin,
        Scope::Global,
        SourceKind::Plugin,
        Some(plugin_id.to_string()),
    )
}
```

- [ ] **Step 6: Merge plugin resources into providers**

In `ClaudeProvider`, add resource-specific methods that read installed plugins and append only the requested resource type:

```rust
fn plugin_skills(&self) -> Result<Vec<Skill>, ApiError> {
    // Keep plugin parsing resource-specific. A skills request should not parse
    // plugin agents and commands unless a later measured cache design needs it.
    let mut out = Vec::new();
    let plugins = crate::plugins::list_plugins(&self.home.join("plugins"), &self.home.join("settings.json"))?;
    for plugin in plugins {
        if !plugin.enabled {
            continue;
        }
        let Some(first) = plugin.installs.first() else {
            continue;
        };
        out.extend(crate::plugins::parse_claude_plugin_skills(std::path::Path::new(&first.install_path), &plugin.id)?);
    }
    Ok(out)
}
```

Add equivalent `plugin_agents()` and `plugin_commands()` methods that call `parse_claude_plugin_agents` and `parse_claude_plugin_commands`, then append those vectors in `agents()`, `skills()`, and `commands()`.

In `CodexProvider`, replace the scaffold `skills_from_plugins` with real parsing:

```rust
pub fn skills_from_plugins(&self) -> Result<Vec<Skill>, ApiError> {
    let cache = self.home.join("plugins").join("cache");
    let mut out = Vec::new();
    for plugin in crate::plugins::list_codex_plugins(&cache)? {
        let Some(first) = plugin.installs.first() else {
            continue;
        };
        out.extend(crate::plugins::parse_codex_plugin_skills(std::path::Path::new(&first.install_path), &plugin.id)?);
    }
    Ok(out)
}
```

Then append `skills_from_plugins()` in `ProviderRegistry::list_skills`.

Also add provider-aware plugin list/get methods to `ProviderRegistry`:

```rust
pub fn list_plugins(&self, origins: Option<&[Origin]>) -> Result<Vec<crate::plugins::InstalledPlugin>, ApiError> {
    let dir = crate::claude_home::plugins_dir()?;
    let settings = crate::claude_home::settings_path()?;
    let mut plugins = crate::plugins::list_plugins(&dir, &settings)?;
    let codex_dir = crate::plugins::codex_plugins_cache_dir()?;
    let mut seen: std::collections::BTreeSet<String> = plugins.iter().map(|plugin| plugin.id.clone()).collect();
    for plugin in crate::plugins::list_codex_plugins(&codex_dir)? {
        if seen.insert(plugin.id.clone()) {
            plugins.push(plugin);
        }
    }
    plugins.retain(|plugin| matches_origin_filter(origins, &plugin.origins));
    plugins.sort_by(|a, b| a.name.cmp(&b.name).then_with(|| a.locator_id.cmp(&b.locator_id)));
    Ok(plugins)
}

pub fn get_plugin(&self, id: &str, locator_id: Option<&str>) -> Result<Option<crate::plugins::InstalledPlugin>, ApiError> {
    let plugins = self.list_plugins(None)?;
    Ok(match locator_id {
        Some(locator_id) => plugins.into_iter().find(|plugin| plugin.locator_id == locator_id),
        None => plugins.into_iter().find(|plugin| plugin.id == id),
    })
}
```

Update `packages/desktop/src-tauri/src/api/plugins.rs` so `plugins_list(origins: Option<serde_json::Value>)` uses `parse_origins` plus `ProviderRegistry::list_plugins`, and `plugins_get(id: String, locator_id: Option<String>)` uses `ProviderRegistry::get_plugin(&id, locator_id.as_deref())`. Keep marketplace routes on the existing plugin helpers.

Add API tests that seed one Claude plugin and one Codex plugin in temp dirs, assert `plugins_list(Some("codex"))` returns only the Codex plugin, and assert `plugins_get(id, Some(locator_id))` resolves the correct plugin when ids collide.

- [ ] **Step 7: Run plugin tests**

Run:

```bash
cargo test -p ohmyc-core plugins
cargo test -p ohmyc-core providers::claude
cargo test -p ohmyc-core providers::codex
```

Expected: PASS.

- [ ] **Step 8: Commit plugin resource parsing**

Run:

```bash
git add crates/ohmyc-core/src/plugins.rs crates/ohmyc-core/src/providers/claude.rs crates/ohmyc-core/src/providers/codex.rs crates/ohmyc-core/src/providers/mod.rs packages/desktop/src-tauri/src/api/plugins.rs
git commit -m "feat(core): parse plugin resource inventory"
```

Expected: commit succeeds.

---

### Task 8: Update Frontend Shared Schemas and Source Switcher

**Files:**
- Modify: `packages/shared/src/provider.ts`
- Modify: `packages/shared/src/agent-schema.ts`
- Modify: `packages/shared/src/skill-schema.ts`
- Modify: `packages/shared/src/command-schema.ts`
- Modify: `packages/shared/src/plugin-schema.ts`
- Modify: `packages/ui/src/state/sources.ts`
- Modify: `packages/ui/src/hooks/use-agents.ts`
- Modify: `packages/ui/src/hooks/use-skills.ts`
- Modify: `packages/ui/src/hooks/use-commands.ts`
- Modify: `packages/ui/src/components/entity-list.tsx`

- [ ] **Step 1: Write failing frontend tests**

Create or add tests in `packages/ui/tests/state/sources.test.ts`:

```ts
it('defaults to codex claude and opencode', () => {
  useSources.getState().hydrate()
  expect([...useSources.getState().selected].toSorted()).toEqual(['claude', 'codex', 'opencode'])
})
```

Create or add to `packages/ui/tests/components/entity-card.test.tsx`:

```tsx
it('renders shared codex opencode origins', () => {
  render(
    <EntityCard
      icon={Sparkles}
      title="fast-commit"
      description="Commit quickly"
      origins={['codex', 'opencode']}
      onClick={() => {}}
    />,
  )
  expect(screen.getByText('codex · opencode')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @ohmyc/ui test -- --run packages/ui/tests/state/sources.test.ts packages/ui/tests/components/entity-card.test.tsx
```

Expected: FAIL because `codex` is not in `OriginEnum` or registered origins.

- [ ] **Step 3: Update shared origin type**

In `packages/shared/src/provider.ts`, change:

```ts
export type Origin = 'codex' | 'claude' | 'opencode'
export const OriginEnum = z.enum(['codex', 'claude', 'opencode'])
```

Remove `agents` from the public origin union.

- [ ] **Step 4: Add shared schema metadata**

Add these fields to `AgentSchema`, `SkillSchema`, `CommandSchema`, and `InstalledPluginSchema`:

```ts
locatorId: z.string().optional(),
sourcePath: z.string().optional(),
sourceProvider: z.enum(['codex', 'claude', 'opencode', 'shared']).optional(),
sourceKind: z.enum(['global', 'project', 'plugin', 'shared']).optional(),
origins: z.array(OriginEnum).optional(),
```

- [ ] **Step 5: Register Codex in source switcher state**

In `packages/ui/src/state/sources.ts`, change:

```ts
// Zustand store for which provider origins (codex/claude/opencode) the Explorer is filtered to.
export const REGISTERED_ORIGINS: readonly Origin[] = ['codex', 'claude', 'opencode']
```

- [ ] **Step 6: Update locator type and hooks**

In `packages/ui/src/hooks/use-agents.ts`, change `ItemLocator`:

```ts
export interface ItemLocator {
  name: string
  locatorId?: string
  source?: string
  pluginId?: string
  scope?: 'global' | 'project'
}
```

Update query keys and args:

```ts
queryKey: ['agents', locator?.locatorId, locator?.name, locator?.source, locator?.pluginId, locator?.scope],
```

```ts
if (locator!.locatorId) {
  args.locator_id = locator!.locatorId
}
```

Apply the same query key and args pattern in `use-skills.ts` and `use-commands.ts`.

- [ ] **Step 7: Use locatorId in EntityList**

In `packages/ui/src/components/entity-list.tsx`, change:

```tsx
key={entity.locatorId ?? `${entity.source ?? 'local'}:${entity.scope ?? 'global'}:${entity.pluginId ?? 'none'}:${entity.id}`}
```

And selection:

```tsx
onSelectItem({
  name: entity.id,
  locatorId: entity.locatorId,
  source: entity.source,
  pluginId: entity.pluginId,
  scope: entity.scope,
})
```

- [ ] **Step 8: Run frontend tests**

Run:

```bash
pnpm --filter @ohmyc/ui test -- --run packages/ui/tests/state/sources.test.ts packages/ui/tests/components/entity-card.test.tsx packages/ui/tests/hooks/use-agents.test.tsx packages/ui/tests/hooks/use-skills.test.tsx packages/ui/tests/hooks/use-commands.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit frontend source compatibility**

Run:

```bash
git add packages/shared/src/provider.ts packages/shared/src/agent-schema.ts packages/shared/src/skill-schema.ts packages/shared/src/command-schema.ts packages/shared/src/plugin-schema.ts packages/ui/src/state/sources.ts packages/ui/src/hooks/use-agents.ts packages/ui/src/hooks/use-skills.ts packages/ui/src/hooks/use-commands.ts packages/ui/src/components/entity-list.tsx packages/ui/tests/state/sources.test.ts packages/ui/tests/components/entity-card.test.tsx packages/ui/tests/hooks/use-agents.test.tsx packages/ui/tests/hooks/use-skills.test.tsx packages/ui/tests/hooks/use-commands.test.tsx
git commit -m "feat(ui): support codex provider origins"
```

Expected: commit succeeds.

---

### Task 9: Add Provider Watch Roots

**Files:**
- Modify: `crates/ohmyc-core/src/watcher.rs`
- Modify: `packages/ui/src/hooks/use-fs-changed.ts`

- [ ] **Step 1: Write failing watcher root test**

Add to `crates/ohmyc-core/src/watcher.rs` tests:

```rust
#[test]
fn default_watch_paths_include_provider_config_dirs() {
    let roots = provider_config_roots_for(
        std::path::Path::new("/home/alice"),
        std::path::Path::new("/repo"),
    );
    assert!(roots.contains(&std::path::PathBuf::from("/home/alice/.claude")));
    assert!(roots.contains(&std::path::PathBuf::from("/home/alice/.codex")));
    assert!(roots.contains(&std::path::PathBuf::from("/home/alice/.agents")));
    assert!(roots.contains(&std::path::PathBuf::from("/home/alice/.config/opencode")));
    assert!(roots.contains(&std::path::PathBuf::from("/repo/.codex")));
    assert!(roots.contains(&std::path::PathBuf::from("/repo/.agents")));
    assert!(roots.contains(&std::path::PathBuf::from("/repo/.opencode")));
    assert!(roots.contains(&std::path::PathBuf::from("/repo/opencode.json")));
    assert!(roots.contains(&std::path::PathBuf::from("/repo/opencode.jsonc")));
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cargo test -p ohmyc-core watcher::tests::default_watch_paths_include_provider_config_dirs
```

Expected: FAIL because `provider_config_roots_for` is missing.

- [ ] **Step 3: Implement provider watch roots**

In `watcher.rs`, add:

```rust
pub fn provider_config_roots_for(home: &std::path::Path, project_root: &std::path::Path) -> Vec<std::path::PathBuf> {
    vec![
        home.join(".claude"),
        home.join(".codex"),
        home.join(".agents"),
        home.join(".config").join("opencode"),
        project_root.join(".claude"),
        project_root.join(".codex"),
        project_root.join(".agents"),
        project_root.join(".opencode"),
        project_root.join("opencode.json"),
        project_root.join("opencode.jsonc"),
    ]
}
```

Update `default_watch_paths()` directly. It currently returns `[db_dir, claude_home, ohmyc_base]`; change it to append `provider_config_roots_for(&home, &project_root)` using `dirs::home_dir()`, `std::env::current_dir()`, and `providers::paths::find_project_root`.

Add a backend event variant:

```rust
ProviderConfig { path: String },
```

Add a small classifier function and use it inside `spawn` before falling back to `ClaudeHome`:

```rust
fn is_provider_config_path(path: &std::path::Path) -> bool {
    let s = path.to_string_lossy();
    s.contains("/.claude/")
        || s.contains("/.codex/")
        || s.contains("/.agents/")
        || s.contains("/.opencode/")
        || s.contains("/.config/opencode/")
        || s.ends_with("/opencode.json")
        || s.ends_with("/opencode.jsonc")
}
```

Classification order in `spawn` must be: timeline DB files first, then provider config paths as `FsEvent::ProviderConfig`, then legacy `FsEvent::ClaudeHome`.

Add tests for serialization and classification:

```rust
#[test]
fn provider_config_event_serializes_with_tag_and_path() {
    let ev = FsEvent::ProviderConfig { path: "/repo/.codex/agents/reviewer.toml".into() };
    let json = serde_json::to_value(&ev).unwrap();
    assert_eq!(json["kind"], "provider_config");
    assert_eq!(json["path"], "/repo/.codex/agents/reviewer.toml");
}

#[test]
fn classifier_marks_provider_paths() {
    assert!(is_provider_config_path(std::path::Path::new("/repo/.codex/agents/reviewer.toml")));
    assert!(is_provider_config_path(std::path::Path::new("/repo/opencode.json")));
    assert!(is_provider_config_path(std::path::Path::new("/home/alice/.config/opencode/opencode.json")));
}
```

- [ ] **Step 4: Update frontend invalidation**

In `packages/ui/src/hooks/use-fs-changed.ts`, extend `FsEvent.kind` to:

```ts
kind: 'claude_home' | 'timeline_db' | 'provider_config'
```

Then update payload kind handling:

```ts
if (payload.kind === 'provider_config') {
  void qc.invalidateQueries({ queryKey: ['agents'] })
  void qc.invalidateQueries({ queryKey: ['skills'] })
  void qc.invalidateQueries({ queryKey: ['commands'] })
  void qc.invalidateQueries({ queryKey: ['plugins'] })
  return
}
```

Keep the existing `claude_home` path-specific invalidation branches so current Claude behavior remains compatible.

- [ ] **Step 5: Run watcher and UI hook tests**

Run:

```bash
cargo test -p ohmyc-core watcher
pnpm --filter @ohmyc/ui test -- --run packages/ui/tests/hooks/use-fs-changed.test.tsx
```

Expected: PASS. Create `packages/ui/tests/hooks/use-fs-changed.test.tsx` because this hook currently has no test file. The test should mock `packages/ui/src/lib/tauri-event-bridge.ts`, render `useFsChanged` inside a `QueryClientProvider`, emit a `{ kind: 'provider_config', path: '/home/alice/.codex/agents/reviewer.toml' }` payload through the mocked callback, and assert invalidation calls for `['agents']`, `['skills']`, `['commands']`, and `['plugins']`.

- [ ] **Step 6: Commit watcher updates**

Run:

```bash
git add crates/ohmyc-core/src/watcher.rs packages/ui/src/hooks/use-fs-changed.ts packages/ui/tests/hooks/use-fs-changed.test.tsx
git commit -m "feat(desktop): watch provider config roots"
```

Expected: commit succeeds.

---

### Task 10: Full Verification and Cleanup

**Files:**
- Modify only files needed to fix failures from verification.

- [ ] **Step 1: Run Rust tests**

Run:

```bash
cargo test -p ohmyc-core -p ohmyc-desktop
```

Expected: PASS.

- [ ] **Step 2: Run UI tests**

Run:

```bash
pnpm --filter @ohmyc/ui test -- --run
```

Expected: PASS.

- [ ] **Step 3: Run UI build**

Run:

```bash
pnpm --filter @ohmyc/ui build
```

Expected: PASS. Existing Vite chunk-size/font mixed import warnings are acceptable if unchanged.

- [ ] **Step 4: Check for stale `agents` origin usage**

Run:

```bash
rg -n "Origin::Agents|'agents' \\||\\['agents'|OriginEnum = z.enum\\(\\['agents'|REGISTERED_ORIGINS.*agents" crates packages --glob '!packages/ui/storybook-static/**' --glob '!packages/ui/playwright-report/**'
```

Expected: no matches for public origin typing. Matches in prose docs are acceptable only when discussing shared `.agents` paths.

- [ ] **Step 5: Check git status**

Run:

```bash
git status --short --branch
```

Expected: branch is clean or only contains intended verification fixes.

- [ ] **Step 6: Resolve verification failures at their owning task boundary**

If Step 1-4 finds a failure, return to the task that introduced that behavior, add the missing test or implementation there, rerun that task's focused verification, and amend that task's commit. When no failures remain, leave the branch clean with only the intended task commits.
