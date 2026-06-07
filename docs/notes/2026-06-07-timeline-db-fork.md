# Timeline DB fork: `~/.cui` vs `~/.config/ohmyc`

**Discovered:** 2026-06-07
**Context:** After slice 8 cleanup landed (the desktop migration completed), the OhMyC menubar Timeline view was only showing ~19 sessions despite months of active use across OpenCode and Claude Code.

## TL;DR

Two timeline databases on disk, both actively written today by different agents. The OhMyC desktop app reads only the new path, so ~90% of historical session data is invisible. Root cause: the OpenCode plugin pin in `~/.config/opencode/opencode.json` is stuck on a pre-rename snapshot that still writes to `~/.cui/`.

## Observed state

| Path | Sessions | claude | opencode | Last WAL write | Active writer |
|---|---:|---:|---:|---|---|
| `~/.cui/timeline.db` (legacy) | **219** | 8 | **202** | Jun 7 17:15 | OpenCode (PID 28220, 28993) |
| `~/.config/ohmyc/timeline.db` (new) | 19 | 4 | 15 | Jun 7 17:21 | OhMyC bun plugin (Claude Code hooks) |

The legacy `~/.cui/` directory still contains:
- `timeline.db` + WAL + SHM (4.4 MB total).
- `store/{agents,skills,commands}/` — 31 agents migrated from the pre-rename era.
- `profiles/{p1,P2}/profile.json` — legacy profile fixtures.
- `logs/ohmyc.{1..5}.log` — old launcher logs (the launcher itself was deleted in slice 8 Task 7).
- `.claude-plugin/marketplace.json` — the synthetic profiles marketplace.
- `settings.json` (2 bytes — empty object).

## Why the fork persists

The desktop migration's read path (`crates/ohmyc-core/src/timeline.rs:18-30`) resolves:

1. `$OHMYC_HOME/timeline.db` if set
2. `$HOME/.config/ohmyc/timeline.db` otherwise

The bun-based plugin (`plugins/timeline/opencode.ts:29-32`) uses the exact same resolution. Both target `~/.config/ohmyc/timeline.db` when `OHMYC_HOME` is unset (the user's setup).

But `~/.config/opencode/opencode.json` registers:
```json
"plugin": [
  "...",
  "@ohmyc/timeline-plugin@0.0.0-snapshot-20260503083547"
]
```

That snapshot (2026-05-03) predates the `CUI_HOME` → `OHMYC_HOME` rename (commit `8798403`, mid-May 2026). The pinned snapshot still resolves `~/.cui/timeline.db` because at snapshot time the env var was `CUI_HOME` and the fallback was `~/.cui/`.

Slice 8 deleted `packages/cli/src/migrate-home.ts` because the migration shipped in May 2026 and was assumed complete. It WAS complete for the Claude Code side (the install path via `ohmyc dashboard --install`), but the OpenCode plugin reference never got bumped, so its writer kept living in the past.

`lsof` confirmation that legacy is alive:
```
opencode. 28220 jiangwei  16u  REG  ...  /Volumes/.../.cui/timeline.db
opencode. 28220 jiangwei  17u  REG  ...  /Volumes/.../.cui/timeline.db-wal
opencode. 28993 jiangwei  17u  REG  ...  /Volumes/.../.cui/timeline.db
opencode. 28993 jiangwei  19u  REG  ...  /Volumes/.../.cui/timeline.db-wal
```

## Resolution

### 1. Bump the OpenCode plugin pin

Edit `~/.config/opencode/opencode.json`:

```diff
- "@ohmyc/timeline-plugin@0.0.0-snapshot-20260503083547"
+ "@ohmyc/timeline-plugin@latest"
```

Restart OpenCode. The new plugin will start writing to `~/.config/ohmyc/timeline.db`.

### 2. Merge the historical data

The DB schemas are identical (sessions / session_skills / session_tools, with the v3 `agent_name` column). Two options:

**Quick (DB-level merge):**
```bash
# Stop any active opencode/claude processes touching either DB first.
sqlite3 ~/.config/ohmyc/timeline.db <<'SQL'
ATTACH '/Volumes/ORICO/Users/jiangwei/.cui/timeline.db' AS legacy;
INSERT OR IGNORE INTO sessions       SELECT * FROM legacy.sessions;
INSERT OR IGNORE INTO session_skills SELECT * FROM legacy.session_skills;
INSERT OR IGNORE INTO session_tools  SELECT * FROM legacy.session_tools;
DETACH legacy;
SQL
```

Safe because `session_id` is the PK and the same session won't appear twice across DBs (each process holds an exclusive lock on its DB while writing).

**Cleaner (re-ingest from transcripts):**
```bash
ohmyc dashboard --sync
```

After the upgraded plugin lands, this walks `~/.claude/projects/**/*.jsonl` + `~/.opencode/.../*.jsonl` and ingests anything not already in the new DB. The transcripts on disk are the source of truth — nothing is lost.

### 3. Archive `~/.cui/`

Once data is merged and verified (`SELECT COUNT(*) FROM sessions` in the new DB should approach 238 = 219 + 19):

```bash
mv ~/.cui ~/.cui.archived-2026-06-07
# Verify nothing breaks for a week, then:
# rm -rf ~/.cui.archived-2026-06-07
```

## Lessons for future migrations

1. **Auto-migration code (`migrate-home.ts`) was deleted too early.** Slice 8 Task 7 dropped it on the assumption that "any user installing fresh today goes directly to `~/.config/ohmyc`." That's true for fresh installs but NOT for users with a pre-rename pinned plugin in a sibling tool's config. A grace period or one-shot migration command (`ohmyc dashboard --migrate-from-cui`) would have caught this.
2. **Schema-compatible producer/consumer splits hide for a long time.** Both DBs had the same schema, so both worked silently. The only signal was a missing-session count in the menubar — easy to miss until you look at totals.
3. **Pinned plugin versions in `opencode.json` are out-of-band from the OhMyC release cycle.** Worth adding a startup check: if the bun plugin detects `~/.cui/timeline.db` exists and is newer than `~/.config/ohmyc/timeline.db`, log a warning pointing at this note.

## Reference paths

- DB resolver (Rust reader): `crates/ohmyc-core/src/timeline.rs:18-30`
- DB resolver (bun writer): `plugins/timeline/opencode.ts:29-32`
- OpenCode plugin pin: `~/.config/opencode/opencode.json:plugin[]`
- Deleted auto-migration: `packages/cli/src/migrate-home.ts` (slice 8 Task 7 deletion)
