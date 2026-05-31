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
