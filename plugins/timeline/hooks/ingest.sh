#!/bin/bash
set -e

SESSION_ID="$1"
if [ -z "$SESSION_ID" ]; then
  echo "Usage: $0 <session-id>" >&2
  exit 1
fi

CLAUDE_HOME="${AGENT_HOME:-$HOME/.claude}"
TRANSCRIPT_FILE=$(find "$CLAUDE_HOME/projects" -name "${SESSION_ID}.jsonl" -print -quit 2>/dev/null || true)

if [ -z "$TRANSCRIPT_FILE" ] || [ ! -f "$TRANSCRIPT_FILE" ]; then
  echo "Transcript not found for session $SESSION_ID" >&2
  exit 0
fi

if command -v claudeui >/dev/null 2>&1; then
  claudeui dashboard --ingest --session "$SESSION_ID" --file "$TRANSCRIPT_FILE"
elif command -v cu >/dev/null 2>&1; then
  cu dashboard --ingest --session "$SESSION_ID" --file "$TRANSCRIPT_FILE"
else
  echo "claudeui CLI not found. Cannot ingest session $SESSION_ID." >&2
  exit 1
fi
