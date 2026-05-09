#!/bin/bash
# OhMyC Timeline Stop Hook
# Extracts session data from transcript and ingests into $OHMYC_HOME/timeline.db (defaults to ~/.config/ohmyc/timeline.db)
#
# Usage: Triggered by Claude Code's Stop hook automatically.
#        Can also be called manually with session ID as argument.

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -n "${OHMYC_HOME:-}" ]; then
  OHMYC_DIR="$OHMYC_HOME"
elif [ -d "$HOME/.config/ohmyc" ]; then
  OHMYC_DIR="$HOME/.config/ohmyc"
elif [ -d "$HOME/.cui" ]; then
  OHMYC_DIR="$HOME/.cui"
else
  OHMYC_DIR="$HOME/.config/ohmyc"
fi
export OHMYC_DIR
DB_PATH="$OHMYC_DIR/timeline.db"

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

if [ -n "${1:-}" ]; then
  SESSION_ID="$1"

  CLAUDE_HOME="${AGENT_HOME:-$HOME/.claude}"
  TRANSCRIPT_PATH=$(find "$CLAUDE_HOME/projects" -name "${SESSION_ID}.jsonl" -print -quit 2>/dev/null || true)

  if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
    log_error "Transcript not found for session $SESSION_ID"
    exit 0
  fi
else
  HOOK_INPUT=$(cat)
  TRANSCRIPT_PATH=$(echo "$HOOK_INPUT" | jq -r '.transcript_path // empty' 2>/dev/null || true)

  if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
    log_error "No transcript path in hook input or file not found"
    exit 0
  fi

  SESSION_ID=$(basename "$TRANSCRIPT_PATH" .jsonl)
fi

FILE_SIZE=$(stat -f%z "$TRANSCRIPT_PATH" 2>/dev/null || stat -c%s "$TRANSCRIPT_PATH" 2>/dev/null || echo 0)

# ---------------------------------------------------------------------------
# Find ohmyc CLI (for fallback and --ingest-raw); also accepts the legacy `cui` name.
# ---------------------------------------------------------------------------

if [ "${CLI_CMD+isset}" = "isset" ]; then
  :
elif command -v ohmyc >/dev/null 2>&1; then
  CLI_CMD="ohmyc"
elif command -v cui >/dev/null 2>&1 && cui --help 2>&1 | grep -q "dashboard"; then
  CLI_CMD="cui"
else
  REPO_ROOT="$(cd "$PLUGIN_DIR/../.." && pwd)"
  if [ -f "$REPO_ROOT/packages/cli/dist/index.mjs" ]; then
    CLI_CMD="node $REPO_ROOT/packages/cli/dist/index.mjs"
  elif [ -f "$REPO_ROOT/dist/index.mjs" ]; then
    CLI_CMD="node $REPO_ROOT/dist/index.mjs"
  fi
fi

# ---------------------------------------------------------------------------
# Fast path: jq preprocessing + Node.js direct write
#
# Extracts all ParsedSessionData fields in one jq pass, matching the
# field order and logic from @ohmyc/timeline's parseTranscript().
# Pipes the result to the CLI's --ingest-raw mode which writes directly
# to the database without re-parsing the transcript.
# ---------------------------------------------------------------------------

if command -v jq >/dev/null 2>&1; then
  log_info "Using jq fast path for session $SESSION_ID"

  # The jq expression mirrors parseTranscript() in ingest.ts exactly:
  #   - Timestamps converted from ISO 8601 to epoch ms
  #   - Turns = user messages with string content (not tool_result arrays)
  #   - Tokens from assistant .message.usage (handles iterations array)
  #   - Cache tokens = cache_read + cache_creation (from last iteration only)
  #   - Model from last assistant message's .message.model
  #   - Summary prefers away_summary, then first user message (truncated 140)
  #   - agentName is always "claude" for hook-sourced sessions
  set +e
  EXTRACTED=$(jq -s '
    # Pre-compute values shared across fields
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
      agentName: "claude",
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
  ' --arg sessionId "$SESSION_ID" --arg transcriptPath "$TRANSCRIPT_PATH" --arg HOME "$HOME" --arg fileSize "$FILE_SIZE" "$TRANSCRIPT_PATH" 2>/dev/null)
  JQ_STATUS=$?
  set -e

  if [ $JQ_STATUS -ne 0 ] || [ -z "$EXTRACTED" ] || [ "$EXTRACTED" = "null" ]; then
    log_error "jq extraction failed for $SESSION_ID, falling back to CLI"
  else
    # Write pre-parsed JSON directly to the database via the CLI.
    # Falls back to full re-parse if CLI lacks --ingest-raw.
    if [ -n "$CLI_CMD" ]; then
      echo "$EXTRACTED" | $CLI_CMD dashboard --ingest-raw 2>/dev/null && exit 0
    fi

    # Fallback: re-ingest via CLI full parse
    $CLI_CMD dashboard --ingest --session "$SESSION_ID" --file "$TRANSCRIPT_PATH"
    exit 0
  fi
fi

# ---------------------------------------------------------------------------
# Fallback: CLI does full JSONL parsing in Node.js
# ---------------------------------------------------------------------------

if [ -n "$CLI_CMD" ]; then
  log_info "Using CLI fallback for session $SESSION_ID"
  $CLI_CMD dashboard --ingest --session "$SESSION_ID" --file "$TRANSCRIPT_PATH"
else
  log_error "ohmyc CLI not found. Cannot ingest session $SESSION_ID."
  exit 1
fi
