#!/bin/bash
# ClaudeUI Timeline Stop Hook
# Extracts session data from transcript and ingests into ~/.cui/timeline.db
#
# Usage: Triggered by Claude Code's Stop hook automatically.
#        Can also be called manually with session ID as argument.

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

log_error() {
  echo "[timeline] $1" >&2
}

log_info() {
  echo "[timeline] $1" >&2
}

# ---------------------------------------------------------------------------
# Determine transcript path
# ---------------------------------------------------------------------------

# Prefer hook input (stdin) for transcript_path when invoked by Claude Code
# Fallback to command-line argument for manual invocation
if [ -p /dev/stdin ]; then
  # stdin is a pipe — invoked by Claude Code hook
  HOOK_INPUT=$(cat)
  TRANSCRIPT_PATH=$(echo "$HOOK_INPUT" | jq -r '.transcript_path // empty' 2>/dev/null || true)

  if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
    log_error "No transcript path in hook input or file not found"
    exit 0
  fi

  SESSION_ID=$(basename "$TRANSCRIPT_PATH" .jsonl)
else
  # stdin is a terminal — manual invocation
  SESSION_ID="${1:-}"
  if [ -z "$SESSION_ID" ]; then
    log_error "Usage: $0 <session-id>"
    exit 1
  fi

  CLAUDE_HOME="${AGENT_HOME:-$HOME/.claude}"
  TRANSCRIPT_PATH=$(find "$CLAUDE_HOME/projects" -name "${SESSION_ID}.jsonl" -print -quit 2>/dev/null || true)

  if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
    log_error "Transcript not found for session $SESSION_ID"
    exit 0
  fi
fi

# ---------------------------------------------------------------------------
# Find claudeui CLI
# ---------------------------------------------------------------------------

CLI_CMD=""

# 1. Check if 'claudeui' is in PATH
if command -v claudeui >/dev/null 2>&1; then
  CLI_CMD="claudeui"
# 2. Check if 'cu' is our CLI (not the Unix utility)
elif command -v cu >/dev/null 2>&1 && cu --help 2>&1 | grep -q "dashboard"; then
  CLI_CMD="cu"
# 3. Look for bundled CLI relative to plugin directory
#    Plugin is at: plugins/timeline/
#    CLI is at:    packages/cli/dist/index.mjs (from repo root)
#    Or:          dist/index.mjs (bundled package)
else
  REPO_ROOT="$(cd "$PLUGIN_DIR/../.." && pwd)"
  if [ -f "$REPO_ROOT/packages/cli/dist/index.mjs" ]; then
    CLI_CMD="node $REPO_ROOT/packages/cli/dist/index.mjs"
  elif [ -f "$REPO_ROOT/dist/index.mjs" ]; then
    CLI_CMD="node $REPO_ROOT/dist/index.mjs"
  fi
fi

if [ -z "$CLI_CMD" ]; then
  log_error "claudeui CLI not found. Cannot ingest session $SESSION_ID."
  exit 1
fi

# ---------------------------------------------------------------------------
# Fast path: jq preprocessing + Node.js ingest
# ---------------------------------------------------------------------------

if command -v jq >/dev/null 2>&1; then
  log_info "Using jq fast path for session $SESSION_ID"

  # Extract all session metadata in one pass with jq
  EXTRACTED=$(jq -s '
    {
      sessionId: $sessionId,
      transcriptPath: $transcriptPath,
      startedAt: (map(select(.timestamp) | .timestamp | sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601) | min // now),
      endedAt: (map(select(.timestamp) | .timestamp | sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601) | max // now),
      turns: ([.[] | select(.type == "user" and .message.role == "user")] | length),
      tokensInput: ([.[] | select(.type == "assistant" and .message.usage) | .message.usage | if .iterations then (.iterations | map(.input_tokens // 0) | add) else (.input_tokens // 0) end] | add // 0),
      tokensOutput: ([.[] | select(.type == "assistant" and .message.usage) | .message.usage | if .iterations then (.iterations | map(.output_tokens // 0) | add) else (.output_tokens // 0) end] | add // 0),
      tokensCached: ([.[] | select(.type == "assistant" and .message.usage) | .message.usage | if .iterations then (.iterations | map((.cache_read_input_tokens // 0) + (.cache_creation_input_tokens // 0)) | add) else ((.cache_read_input_tokens // 0) + (.cache_creation_input_tokens // 0)) end] | add // 0),
      tools: ([.[] | select(.type == "assistant" and .message.content) | .message.content | arrays[] | select(.type == "tool_use") | .name] | group_by(.) | map({toolName: .[0], callCount: length})),
      skills: ([.[] | select(.type == "assistant" and .message.content) | .message.content | arrays[] | select(.type == "tool_use" and .name == "Skill" and .input.skill) | .input.skill] | unique),
      summary: ([.[] | select(.type == "system" and .subtype == "away_summary") | .content] | last // null),
      firstUserMessage: ([.[] | select(.type == "user" and .message.role == "user" and (.message.content | type) == "string") | .message.content] | first // null)
    }
  ' --arg sessionId "$SESSION_ID" --arg transcriptPath "$TRANSCRIPT_PATH" "$TRANSCRIPT_PATH")

  # Validate jq output
  if [ -z "$EXTRACTED" ] || [ "$EXTRACTED" = "null" ]; then
    log_error "jq extraction failed for $SESSION_ID, falling back to CLI"
    # Fall through to CLI path below
  else
    # Pipe extracted JSON to Node.js for database write
    # Use a small inline Node.js script that imports @claudeui/timeline
    # Since @claudeui/timeline is bundled with the CLI, we invoke via CLI
    # For now, use the CLI ingest command which does full parsing
    # TODO: Add --ingest-raw flag to CLI to accept JSON from stdin
    $CLI_CMD dashboard --ingest --session "$SESSION_ID" --file "$TRANSCRIPT_PATH"
    exit 0
  fi
fi

# ---------------------------------------------------------------------------
# Fallback: CLI does full JSONL parsing in Node.js
# ---------------------------------------------------------------------------

log_info "jq not available, using Node.js fallback for session $SESSION_ID"
$CLI_CMD dashboard --ingest --session "$SESSION_ID" --file "$TRANSCRIPT_PATH"
