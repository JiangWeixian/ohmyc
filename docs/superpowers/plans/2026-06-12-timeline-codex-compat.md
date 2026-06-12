# Timeline Plugin Codex Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `plugins/timeline/` work as a Codex plugin in addition to Claude Code and OpenCode, using Codex's `.codex-plugin/` manifest and hooks system.

**Architecture:** Codex plugins are declarative bundles (manifest + hooks + skills). The timeline plugin already has a `hooks/ingest.sh` → `dist/ingest.mjs` path that works for Claude Code. We add a Codex manifest at `.codex-plugin/plugin.json`, create a Codex-compatible marketplace entry at `.agents/plugins/marketplace.json`, and update the hook script to use `PLUGIN_ROOT` (Codex) alongside `CLAUDE_PLUGIN_ROOT` (Claude Code). No changes to `opencode.ts` — Codex does not support function-style plugins.

**Tech Stack:** Shell (hooks), Node.js (ingest), TypeScript (tests), Vitest, jq

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `plugins/timeline/.codex-plugin/plugin.json` | **Create** | Codex plugin manifest — identifies the plugin, points to hooks |
| `.agents/plugins/marketplace.json` | **Create** | Codex marketplace catalog — lets Codex discover the plugin |
| `plugins/timeline/hooks/hooks.json` | **Modify** | Update env var reference to support both `PLUGIN_ROOT` and `CLAUDE_PLUGIN_ROOT` |
| `plugins/timeline/hooks/ingest.sh` | **Modify** | Support `PLUGIN_ROOT` env var, also accept Codex stdin JSON format |
| `plugins/timeline/README.md` | **Modify** | Document Codex as a third supported agent |
| `plugins/timeline/tests/ingest.sh.test.ts` | **Modify** | Add tests for `PLUGIN_ROOT` env var resolution |

---

### Task 1: Create Codex Plugin Manifest

**Files:**
- Create: `plugins/timeline/.codex-plugin/plugin.json`

- [ ] **Step 1: Create the `.codex-plugin` directory**

```bash
mkdir -p plugins/timeline/.codex-plugin
```

- [ ] **Step 2: Create `plugin.json`**

Create `plugins/timeline/.codex-plugin/plugin.json`:

```json
{
  "name": "timeline",
  "version": "1.0.0",
  "description": "Auto-collects Claude Code, OpenCode, and Codex session data for ClaudeUI Timeline dashboard",
  "author": {
    "name": "JiangWeixian",
    "email": "jiangweixian1994@gmail.com"
  },
  "homepage": "https://github.com/jiangweixian/claudeui/tree/main/plugins/timeline",
  "license": "MIT",
  "keywords": ["timeline", "analytics", "session-tracking"],
  "hooks": "./hooks/hooks.json",
  "interface": {
    "displayName": "OhMyC Timeline",
    "shortDescription": "Session analytics for ClaudeUI",
    "longDescription": "Collects session data (turns, tokens, tools, skills) from Claude Code, OpenCode, and Codex agents and writes it to the shared Timeline SQLite database.",
    "developerName": "JiangWeixian",
    "category": "Productivity",
    "capabilities": ["Read"]
  }
}
```

- [ ] **Step 3: Verify the manifest is valid JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('plugins/timeline/.codex-plugin/plugin.json','utf8')); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add plugins/timeline/.codex-plugin/plugin.json
git commit -m "feat(timeline): add Codex plugin manifest at .codex-plugin/plugin.json"
```

---

### Task 2: Create Codex Marketplace Entry

**Files:**
- Create: `.agents/plugins/marketplace.json`

- [ ] **Step 1: Create the `.agents/plugins` directory**

```bash
mkdir -p .agents/plugins
```

- [ ] **Step 2: Create `marketplace.json`**

Create `.agents/plugins/marketplace.json`:

```json
{
  "name": "ohmyc",
  "interface": {
    "displayName": "OhMyC Plugins"
  },
  "plugins": [
    {
      "name": "timeline",
      "source": {
        "source": "local",
        "path": "./plugins/timeline"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Productivity"
    }
  ]
}
```

Note: Codex also reads legacy `.claude-plugin/marketplace.json` for backward compatibility. We keep the existing file at `plugins/timeline/.claude-plugin/marketplace.json` unchanged and add this repo-level marketplace for Codex's `.agents/plugins/` discovery path.

- [ ] **Step 3: Verify the marketplace is valid JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('.agents/plugins/marketplace.json','utf8')); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add .agents/plugins/marketplace.json
git commit -m "feat: add Codex marketplace catalog at .agents/plugins/marketplace.json"
```

---

### Task 3: Update `hooks.json` to Use `PLUGIN_ROOT`

**Files:**
- Modify: `plugins/timeline/hooks/hooks.json`

Codex sets `PLUGIN_ROOT` pointing to the installed plugin root. It also sets `CLAUDE_PLUGIN_ROOT` for backward compatibility. We switch the hook command to use `${PLUGIN_ROOT}` with a fallback, so it works under both Codex and Claude Code.

- [ ] **Step 1: Write the failing test**

Add a test block to `plugins/timeline/tests/ingest.sh.test.ts` that verifies the hooks.json references `PLUGIN_ROOT`:

```typescript
// In plugins/timeline/tests/ingest.sh.test.ts — add this describe block

describe('hooks.json compatibility', () => {
  it('references PLUGIN_ROOT env var', async () => {
    const hooksJson = await import('fs').then(fs =>
      fs.readFileSync(
        new URL('../hooks/hooks.json', import.meta.url),
        'utf8',
      ),
    )
    const parsed = JSON.parse(hooksJson)
    const stopHooks = parsed.hooks?.Stop?.[0]?.hooks ?? []
    const commands = stopHooks.map((h: any) => h.command)
    const usesPluginRoot = commands.some((c: string) => c.includes('PLUGIN_ROOT'))
    expect(usesPluginRoot).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run plugins/timeline/tests/ingest.sh.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: FAIL — the current `hooks.json` only uses `$CLAUDE_PLUGIN_ROOT`, not `PLUGIN_ROOT`.

- [ ] **Step 3: Update `hooks.json`**

Replace the content of `plugins/timeline/hooks/hooks.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "${PLUGIN_ROOT:-$CLAUDE_PLUGIN_ROOT}/hooks/ingest.sh",
            "statusMessage": "Ingesting session for Timeline"
          }
        ]
      }
    ]
  }
}
```

Key change: `${PLUGIN_ROOT:-$CLAUDE_PLUGIN_ROOT}` uses `PLUGIN_ROOT` when set (Codex), falls back to `CLAUDE_PLUGIN_ROOT` (Claude Code).

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run plugins/timeline/tests/ingest.sh.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add plugins/timeline/hooks/hooks.json plugins/timeline/tests/ingest.sh.test.ts
git commit -m "feat(timeline): use PLUGIN_ROOT with CLAUDE_PLUGIN_ROOT fallback in hooks"
```

---

### Task 4: Update `ingest.sh` to Support Codex Environment Variables

**Files:**
- Modify: `plugins/timeline/hooks/ingest.sh`

Codex sets `PLUGIN_ROOT` and `PLUGIN_DATA` in addition to `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA`. The script currently resolves the plugin directory from `SCRIPT_DIR` (relative to the script's own location). This works under both agents, but we should also accept `PLUGIN_ROOT` as the canonical override.

- [ ] **Step 1: Update plugin directory resolution in `ingest.sh`**

Replace lines 12–14 of `plugins/timeline/hooks/ingest.sh`:

```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
INGEST_MJS="$PLUGIN_DIR/dist/ingest.mjs"
```

With:

```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="${PLUGIN_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
INGEST_MJS="$PLUGIN_DIR/dist/ingest.mjs"
```

This uses `PLUGIN_ROOT` when set by Codex, falling back to the relative path resolution that works for Claude Code.

- [ ] **Step 2: Verify `ingest.sh` still parses correctly**

```bash
bash -n plugins/timeline/hooks/ingest.sh && echo "Syntax OK"
```

Expected: `Syntax OK`

- [ ] **Step 3: Run existing tests**

```bash
npx vitest run plugins/timeline/tests/ --reporter=verbose 2>&1 | tail -20
```

Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add plugins/timeline/hooks/ingest.sh
git commit -m "feat(timeline): support PLUGIN_ROOT env var in ingest.sh"
```

---

### Task 5: Handle Codex Transcript Path Discovery

**Files:**
- Modify: `plugins/timeline/hooks/ingest.sh`

Codex's `Stop` hook sends JSON on stdin with `session_id` and `transcript_path` fields. The current script already handles this (lines 58–64), but Codex uses `~/.codex/` instead of `~/.claude/` for transcript storage. We need to also search the Codex transcript directory.

- [ ] **Step 1: Update the session ID argument path to search both Claude and Codex dirs**

Replace lines 48–56 of `plugins/timeline/hooks/ingest.sh`:

```bash
if [ -n "${1:-}" ]; then
  SESSION_ID="$1"
  CLAUDE_HOME="${AGENT_HOME:-$HOME/.claude}"
  TRANSCRIPT_PATH=$(find "$CLAUDE_HOME/projects" -name "${SESSION_ID}.jsonl" -print -quit 2>/dev/null || true)

  if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
    log_error "Transcript not found for session $SESSION_ID"
    exit 0
  fi
```

With:

```bash
if [ -n "${1:-}" ]; then
  SESSION_ID="$1"
  AGENT_HOME="${AGENT_HOME:-$HOME/.claude}"
  TRANSCRIPT_PATH=$(find "$AGENT_HOME/projects" -name "${SESSION_ID}.jsonl" -print -quit 2>/dev/null || true)

  if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
    CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
    TRANSCRIPT_PATH=$(find "$CODEX_HOME" -name "${SESSION_ID}.jsonl" -print -quit 2>/dev/null || true)
  fi

  if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
    log_error "Transcript not found for session $SESSION_ID"
    exit 0
  fi
```

This searches `~/.claude/projects/` first (Claude Code), then falls back to `~/.codex/` (Codex) if not found.

- [ ] **Step 2: Verify syntax**

```bash
bash -n plugins/timeline/hooks/ingest.sh && echo "Syntax OK"
```

Expected: `Syntax OK`

- [ ] **Step 3: Run existing tests**

```bash
npx vitest run plugins/timeline/tests/ --reporter=verbose 2>&1 | tail -20
```

Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add plugins/timeline/hooks/ingest.sh
git commit -m "feat(timeline): search Codex ~/.codex/ dir for session transcripts"
```

---

### Task 6: Update Codex Hook Agent Name in `ingest.sh` jq Extraction

**Files:**
- Modify: `plugins/timeline/hooks/ingest.sh`

The jq extraction on line 98 hardcodes `agentName: "claude"`. Codex transcripts should be labeled as `"codex"`. We detect the agent from the transcript path.

- [ ] **Step 1: Add agent detection and update jq extraction**

In `plugins/timeline/hooks/ingest.sh`, after the transcript path is resolved (before the fast path block around line 75), add agent detection:

```bash
if echo "$TRANSCRIPT_PATH" | grep -q '/\.codex/' 2>/dev/null; then
  AGENT_NAME="codex"
else
  AGENT_NAME="claude"
fi
```

Then in the jq command (around line 98), replace:

```jq
agentName: "claude",
```

With:

```jq
agentName: $agentName,
```

And add the `--arg agentName "$AGENT_NAME"` argument to the `jq` invocation. The full jq call becomes:

```bash
  EXTRACTED=$(jq -s '
    ($transcriptPath | split("/") | .[] | select(. == "projects") as $marker |
      ($transcriptPath | split("/") | index($marker)) as $idx |
      ($transcriptPath | split("/")[($idx + 1):][0]) as $encoded |
      if ($encoded | startswith("-"))
        then ("/" + ($encoded[1:] | gsub("-"; "/")))
        else ($encoded | gsub("-"; "/"))
      end) as $rawProject |
    (($rawProject | startswith($HOME)) as $isHome |
      if $isHome then ("~" + ($rawProject | ltrimstr($HOME))) else $rawProject end) as $project |

    (map(select(.timestamp) | .timestamp | sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601 * 1000) | min // (now * 1000)) as $startedAt |
    (map(select(.timestamp) | .timestamp | sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601 * 1000) | max // (now * 1000)) as $endedAt |
    (map(select(.type == "user" and .message.role == "user" and (.message.content | type) == "string") | .message.content) | first) as $firstUserMessage |
    ([.[] | select(.type == "system" and .subtype == "away_summary") | .content] | last) as $awaySummary |

    {
      sessionId: $sessionId,
      project: $project,
      agentName: $agentName,
      startedAt: $startedAt,
      endedAt: $endedAt,
      durationMs: ($endedAt - $startedAt),
      turns: ([.[] | select(.type == "user" and .message.role == "user" and (.message.content | type) == "string")] | length),
      tokensInput: ([.[] | select(.type == "assistant" and .message.usage) | .message.usage | if .iterations then (.iterations | map(.input_tokens // 0) | add) else (.input_tokens // 0) end] | add // 0),
      tokensOutput: ([.[] | select(.type == "assistant" and .message.usage) | .message.usage | if .iterations then (.iterations | map(.output_tokens // 0) | add) else (.output_tokens // 0) end] | add // 0),
      tokensCached: ([.[] | select(.type == "assistant" and .message.usage) | .message.usage | if .iterations then (.iterations | map((.cache_read_input_tokens // 0) + (.cache_creation_input_tokens // 0)) | add) else ((.cache_read_input_tokens // 0) + (.cache_creation_input_tokens // 0)) end] | add // 0),
      summary: (if $awaySummary then $awaySummary elif $firstUserMessage then (if ($firstUserMessage | length) > 140 then ($firstUserMessage[:140]) else $firstUserMessage end) else "(untitled session)" end),
      summarySource: (if $awaySummary then "auto" elif $firstUserMessage then "first_message" else "auto" end),
      transcriptPath: $transcriptPath,
      fileSize: ($fileSize | tonumber),
      tools: ([.[] | select(.type == "assistant" and .message.content) | .message.content | arrays[] | select(.type == "tool_use") | .name] | group_by(.) | map({toolName: .[0], callCount: length})),
      skills: ([.[] | select(.type == "assistant" and .message.content) | .message.content | arrays[] | select(.type == "tool_use" and .name == "Skill" and .input.skill) | .input.skill] | unique),
      model: ([.[] | select(.type == "assistant" and .message.model) | .message.model] | last // null)
    }
  ' --arg sessionId "$SESSION_ID" --arg transcriptPath "$TRANSCRIPT_PATH" --arg HOME "$HOME" --arg fileSize "$FILE_SIZE" --arg agentName "$AGENT_NAME" "$TRANSCRIPT_PATH" 2>/dev/null)
```

- [ ] **Step 2: Verify syntax**

```bash
bash -n plugins/timeline/hooks/ingest.sh && echo "Syntax OK"
```

Expected: `Syntax OK`

- [ ] **Step 3: Run existing tests**

```bash
npx vitest run plugins/timeline/tests/ --reporter=verbose 2>&1 | tail -20
```

Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add plugins/timeline/hooks/ingest.sh
git commit -m "feat(timeline): detect codex vs claude agent from transcript path"
```

---

### Task 7: Update README with Codex Support

**Files:**
- Modify: `plugins/timeline/README.md`

- [ ] **Step 1: Update the Supported Agents table and add Codex section**

Replace the entire content of `plugins/timeline/README.md`:

```markdown
# OhMyC Timeline Plugin

Collects session data (turns, tokens, tools, skills) from **Claude Code**, **Codex**, and **OpenCode** agents and ingests it into the OhMyC Timeline dashboard.

## Supported Agents

| Agent | Integration | Data Source |
|-------|-------------|-------------|
| Claude Code | Hook-based (`hooks/ingest.sh`) | JSONL transcript files (`~/.claude/`) |
| Codex | Hook-based (`hooks/ingest.sh`) | JSONL transcript files (`~/.codex/`) |
| OpenCode | Plugin-based (`opencode.ts`) | Real-time event hooks |

## Claude Code / Codex Setup

The plugin uses a `Stop` hook that fires when a session ends. The hook script (`hooks/ingest.sh`) parses the transcript with `jq` and writes to the timeline database by invoking the bundled node entry at `dist/ingest.mjs` — no external CLI binary required on PATH. Slow path: when `jq` is unavailable, `dist/ingest.mjs` parses the JSONL itself.

**Runtime requirement:** `node` on PATH. The plugin ships `better-sqlite3` as a runtime dependency (native binding installed via prebuilt binaries during `npm install`).

### Codex-Specific Details

Codex discovers the plugin via the repo-level marketplace at `.agents/plugins/marketplace.json`. The manifest lives at `.codex-plugin/plugin.json`. The hook uses `PLUGIN_ROOT` (set by Codex) with a fallback to `CLAUDE_PLUGIN_ROOT` (set by Claude Code). Transcript files are searched in `~/.codex/` when not found in `~/.claude/`.

## OpenCode Setup

The OpenCode plugin lives at `plugins/timeline/opencode.ts` and is symlinked from `.opencode/plugins/timeline.ts`. It sets `agentName='opencode'` and hooks into:

- `session.created` / `session.idle` / `session.deleted` — session lifecycle
- `message.updated` — message tokens and model info
- `message.part.updated` — user message text for summaries
- `tool.execute.before` / `tool.execute.after` — tool and skill tracking

Data is written directly to `~/.config/ohmyc/timeline.db` using `bun:sqlite` via the shared `@ohmyc/timeline/writer` module.

## Shared Code

All three agents write to the same SQLite database (`~/.config/ohmyc/timeline.db`) using the schema and writer from `@ohmyc/timeline`:

- `@ohmyc/timeline/writer` — Runtime-agnostic writer (works with `better-sqlite3` and `bun:sqlite`)
- `@ohmyc/timeline/schema` — Database schema and TypeScript types

## Future: OpenCode Backfill

OpenCode stores historical session data in `~/.local/share/opencode/opencode.db`. A future enhancement could read this database and backfill missing sessions into the timeline.
```

- [ ] **Step 2: Commit**

```bash
git add plugins/timeline/README.md
git commit -m "docs(timeline): document Codex as a supported agent"
```

---

### Task 8: Update `.claude-plugin/plugin.json` Description

**Files:**
- Modify: `plugins/timeline/.claude-plugin/plugin.json`

The existing Claude Code plugin manifest should mention Codex support.

- [ ] **Step 1: Update description**

Replace `plugins/timeline/.claude-plugin/plugin.json`:

```json
{
  "name": "timeline",
  "version": "1.0.0",
  "description": "Auto-collects Claude Code, Codex, and OpenCode session data for ClaudeUI Timeline dashboard"
}
```

- [ ] **Step 2: Verify JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('plugins/timeline/.claude-plugin/plugin.json','utf8')); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add plugins/timeline/.claude-plugin/plugin.json
git commit -m "docs(timeline): update claude-plugin description to mention Codex"
```

---

### Task 9: Final Verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run all timeline plugin tests**

```bash
npx vitest run plugins/timeline/tests/ --reporter=verbose
```

Expected: All tests PASS

- [ ] **Step 2: Verify all new JSON files are valid**

```bash
node -e "
  const fs = require('fs');
  const files = [
    'plugins/timeline/.codex-plugin/plugin.json',
    'plugins/timeline/.claude-plugin/plugin.json',
    '.agents/plugins/marketplace.json',
    'plugins/timeline/hooks/hooks.json',
  ];
  for (const f of files) {
    JSON.parse(fs.readFileSync(f, 'utf8'));
    console.log('OK:', f);
  }
"
```

Expected: `OK:` for each file.

- [ ] **Step 3: Verify `ingest.sh` syntax**

```bash
bash -n plugins/timeline/hooks/ingest.sh && echo "Syntax OK"
```

Expected: `Syntax OK`

- [ ] **Step 4: Verify the plugin builds successfully**

```bash
cd plugins/timeline && npm run build 2>&1 | tail -5
```

Expected: Build succeeds, `dist/ingest.mjs` exists.

---

## Self-Review

### Spec Coverage

| Requirement | Task |
|-------------|------|
| Codex manifest (`.codex-plugin/plugin.json`) | Task 1 |
| Codex marketplace entry (`.agents/plugins/marketplace.json`) | Task 2 |
| Hook env var compatibility (`PLUGIN_ROOT` + fallback) | Task 3 |
| Shell script `PLUGIN_ROOT` support | Task 4 |
| Codex transcript path discovery (`~/.codex/`) | Task 5 |
| Agent name detection (codex vs claude) | Task 6 |
| README documentation | Task 7 |
| Existing manifest update | Task 8 |
| Final verification | Task 9 |

### Placeholder Scan

No TBD, TODO, "implement later", or placeholder patterns found. Every step contains complete code.

### Type Consistency

- `AGENT_NAME` shell variable is set in Task 6 and used as `$AGENT_NAME` in the same jq invocation — consistent.
- `PLUGIN_DIR` resolution uses `PLUGIN_ROOT` env var consistently across Task 3 (`hooks.json`) and Task 4 (`ingest.sh`).
- `ParsedSessionData.agentName` field uses string values `"claude"`, `"codex"`, `"opencode"` — matches the existing schema in `packages/timeline/src/schema.ts`.
