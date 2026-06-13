#!/bin/bash
# OhMyC Timeline Codex Stop Hook — ingests Codex session transcripts.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="${PLUGIN_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
INGEST_MJS="$PLUGIN_DIR/dist/ingest.mjs"

if [ -n "${OHMYC_HOME:-}" ]; then
  OHMYC_DIR="$OHMYC_HOME"
elif [ -d "$HOME/.config/ohmyc" ]; then
  OHMYC_DIR="$HOME/.config/ohmyc"
elif [ -d "$HOME/.cui" ]; then
  OHMYC_DIR="$HOME/.cui"
else
  OHMYC_DIR="$HOME/.config/ohmyc"
fi
export OHMYC_HOME="$OHMYC_DIR"

log_error() { echo "[timeline] $1" >&2; }
log_info()  { echo "[timeline] $1" >&2; }

if ! command -v node >/dev/null 2>&1; then
  log_error "node not found on PATH. Cannot ingest session."
  exit 0
fi

if [ ! -f "$INGEST_MJS" ]; then
  log_error "ingest bundle not found at $INGEST_MJS (did you run \`pnpm --filter @ohmyc/timeline-plugin build\`?)"
  exit 0
fi

HOOK_INPUT=$(cat)
HOOK_FIELDS=$(HOOK_INPUT="$HOOK_INPUT" node -e '
const input = process.env.HOOK_INPUT || ""
try {
  const parsed = JSON.parse(input)
  console.log(JSON.stringify({
    sessionId: typeof parsed.session_id === "string" ? parsed.session_id : "",
    transcriptPath: typeof parsed.transcript_path === "string" ? parsed.transcript_path : "",
  }))
} catch {
  console.log(JSON.stringify({ sessionId: "", transcriptPath: "" }))
}
')
TRANSCRIPT_PATH=$(echo "$HOOK_FIELDS" | node -e 'let b=""; process.stdin.on("data", c => b += c); process.stdin.on("end", () => { try { console.log(JSON.parse(b).transcriptPath || "") } catch { console.log("") } })')
SESSION_ID=$(echo "$HOOK_FIELDS" | node -e 'let b=""; process.stdin.on("data", c => b += c); process.stdin.on("end", () => { try { console.log(JSON.parse(b).sessionId || "") } catch { console.log("") } })')

if [ -z "$TRANSCRIPT_PATH" ] && [ -n "$SESSION_ID" ]; then
  CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
  TRANSCRIPT_PATH=$(find "$CODEX_HOME/sessions" "$CODEX_HOME/archived_sessions" -name "*${SESSION_ID}.jsonl" -print -quit 2>/dev/null || true)
fi

if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
  log_error "No Codex transcript path in hook input or file not found"
  exit 0
fi

if [ -z "$SESSION_ID" ]; then
  SESSION_ID=$(basename "$TRANSCRIPT_PATH" .jsonl)
  SESSION_ID="${SESSION_ID##rollout-*T*-}"
fi

FILE_SIZE=$(stat -f%z "$TRANSCRIPT_PATH" 2>/dev/null || stat -c%s "$TRANSCRIPT_PATH" 2>/dev/null || echo 0)

if command -v jq >/dev/null 2>&1; then
  log_info "Using jq fast path for Codex session $SESSION_ID"
  set +e
  EXTRACTED=$(jq -s '
    (map(select(.timestamp) | .timestamp | sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601 * 1000) | min // (now * 1000)) as $startedAt |
    (map(select(.timestamp) | .timestamp | sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601 * 1000) | max // (now * 1000)) as $endedAt |
    ([.[] | select(.type == "session_meta" and (.payload.cwd | type) == "string") | .payload.cwd] | last) as $sessionProject |
    ([.[] | select(.type == "turn_context" and (.payload.cwd | type) == "string") | .payload.cwd] | last) as $turnProject |
    ([.[] | select(.type == "turn_context" and (.payload.model | type) == "string") | .payload.model] | last // null) as $model |
    ([.[] | select(.type == "response_item" and .payload.type == "message" and .payload.role == "user") | .payload.content |
      if type == "string" then .
      elif type == "array" then ([.[] | select((.text | type) == "string") | .text] | join("\n"))
      else empty end
    ] | map(select(length > 0))) as $userMessages |
    ([.[] | select(.type == "event_msg" and .payload.type == "token_count" and (.payload.info | type) == "object") | .payload.info] | last // {}) as $usage |
    {
      sessionId: $sessionId,
      project: ($turnProject // $sessionProject // "unknown"),
      agentName: "codex",
      startedAt: $startedAt,
      endedAt: $endedAt,
      durationMs: ($endedAt - $startedAt),
      turns: ($userMessages | length),
      tokensInput: ($usage.input_tokens // 0),
      tokensOutput: ($usage.output_tokens // 0),
      tokensCached: ($usage.cached_input_tokens // 0),
      summary: (if ($userMessages | length) > 0 then (if ($userMessages[0] | length) > 140 then $userMessages[0][:140] else $userMessages[0] end) else "(untitled session)" end),
      summarySource: (if ($userMessages | length) > 0 then "first_message" else "auto" end),
      transcriptPath: $transcriptPath,
      fileSize: ($fileSize | tonumber),
      tools: ([.[] | select(.type == "response_item" and .payload.type == "function_call" and (.payload.name | type) == "string") | .payload.name] | group_by(.) | map({toolName: .[0], callCount: length})),
      skills: [],
      model: $model
    }
  ' --arg sessionId "$SESSION_ID" --arg transcriptPath "$TRANSCRIPT_PATH" --arg fileSize "$FILE_SIZE" "$TRANSCRIPT_PATH" 2>/dev/null)
  JQ_STATUS=$?
  set -e

  if [ $JQ_STATUS -eq 0 ] && [ -n "$EXTRACTED" ] && [ "$EXTRACTED" != "null" ]; then
    echo "$EXTRACTED" | node "$INGEST_MJS" --raw && exit 0
    log_error "Codex jq fast path failed for $SESSION_ID, falling back to slow path"
  else
    log_error "Codex jq extraction failed for $SESSION_ID, falling back to slow path"
  fi
fi

log_info "Using Node parser for Codex session $SESSION_ID"
node "$INGEST_MJS" --session-id "$SESSION_ID" --transcript-path "$TRANSCRIPT_PATH" --agent-name codex
