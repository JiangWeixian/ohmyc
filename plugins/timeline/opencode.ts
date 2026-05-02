// plugins/timeline/opencode.ts
import { mkdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { Database } from 'bun:sqlite'

import { createWriter } from '../../packages/timeline/src/writer.js'

import type { Plugin } from '@opencode-ai/plugin'
import type { ParsedSessionData } from '../../packages/timeline/src/schema.js'

// ---------------------------------------------------------------------------
// Database setup
// ---------------------------------------------------------------------------

function getDbPath(): string {
  const home = process.env.CUI_HOME ?? path.join(os.homedir(), '.cui')
  return path.join(home, 'timeline.db')
}

function ensureDb(): Database {
  const dbPath = getDbPath()
  mkdirSync(path.dirname(dbPath), { recursive: true })
  const db = new Database(dbPath)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  ensureSchema(db)
  return db
}

function ensureSchema(db: Database): void {
  const hasSessions = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'").get()
  if (hasSessions) {
    // Check if agent_name column exists (migration from v2 to v3)
    const hasAgentName = db.query('PRAGMA table_info(sessions)').all()
      .some((col: any) => col.name === 'agent_name')
    if (!hasAgentName) {
      db.exec('ALTER TABLE sessions ADD COLUMN agent_name TEXT;')
    }
    return
  }

  db.exec(`
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
    CREATE INDEX idx_sessions_started_at ON sessions(started_at DESC);
    CREATE INDEX idx_sessions_project    ON sessions(project, started_at DESC);

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
  `)
}

// ---------------------------------------------------------------------------
// Session accumulator
// ---------------------------------------------------------------------------

interface SessionAccumulator {
  sessionId: string
  project: string
  startedAt: number
  endedAt: number
  turns: number
  tokensInput: number
  tokensOutput: number
  tokensCached: number
  tools: Map<string, number>
  skills: Set<string>
  firstUserMessage: string | null
  summary: string | null
  model: string | null
}

const sessions = new Map<string, SessionAccumulator>()

function getAccumulator(sessionId: string, project?: string): SessionAccumulator {
  let acc = sessions.get(sessionId)
  if (!acc) {
    acc = {
      sessionId,
      project: project ?? 'unknown',
      startedAt: Date.now(),
      endedAt: Date.now(),
      turns: 0,
      tokensInput: 0,
      tokensOutput: 0,
      tokensCached: 0,
      tools: new Map(),
      skills: new Set(),
      firstUserMessage: null,
      summary: null,
      model: null,
    }
    sessions.set(sessionId, acc)
  }
  return acc
}

function getProjectName(input: { project?: { worktree?: string }; directory?: string }): string {
  if (input.project?.worktree) {
    return path.basename(input.project.worktree)
  }
  if (input.directory) {
    return path.basename(input.directory)
  }
  return 'unknown'
}

function toParsedSessionData(acc: SessionAccumulator): ParsedSessionData {
  return {
    sessionId: acc.sessionId,
    project: acc.project,
    agentName: 'opencode',
    startedAt: acc.startedAt,
    endedAt: acc.endedAt,
    durationMs: acc.endedAt - acc.startedAt,
    turns: acc.turns,
    tokensInput: acc.tokensInput,
    tokensOutput: acc.tokensOutput,
    tokensCached: acc.tokensCached,
    summary: acc.summary ?? acc.firstUserMessage ?? '(untitled session)',
    summarySource: acc.summary ? 'auto' : 'first_message',
    transcriptPath: `opencode://${acc.sessionId}`,
    fileSize: 0,
    tools: [...acc.tools.entries()].map(([toolName, callCount]) => ({ toolName, callCount })),
    skills: [...acc.skills],
    model: acc.model,
  }
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export const TimelinePlugin: Plugin = async (input) => {
  const project = getProjectName(input)
  console.log(`[timeline-plugin] Initializing for project: ${project}, db: ${getDbPath()}`)

  let db: Database | undefined
  let writer: ReturnType<typeof createWriter> | undefined

  try {
    db = ensureDb()
    writer = createWriter(db)
    console.log('[timeline-plugin] Database ready')
  } catch (error) {
    console.error('[timeline-plugin] Database init failed:', error)
    return {}
  }

  return {
    'session.created': async (hookInput) => {
      try {
        const acc = getAccumulator(hookInput.sessionID, project)
        acc.startedAt = Date.now()
        console.log(`[timeline-plugin] Session created: ${hookInput.sessionID}`)
      } catch (error) {
        console.error('[timeline-plugin] Session created error:', error)
      }
    },

    'session.idle': async (hookInput) => {
      try {
        const acc = sessions.get(hookInput.sessionID)
        if (!acc) {
          console.warn(`[timeline-plugin] Session idle but not found: ${hookInput.sessionID}`)
          return
        }
        acc.endedAt = Date.now()
        const data = toParsedSessionData(acc)
        console.log(`[timeline-plugin] Writing session: ${hookInput.sessionID}, turns: ${data.turns}`)
        writer!.writeSession(data)
        console.log(`[timeline-plugin] Session written: ${hookInput.sessionID}`)
      } catch (error) {
        console.error('[timeline-plugin] Session idle error:', error)
      }
    },

    'session.deleted': async (hookInput) => {
      try {
        const acc = sessions.get(hookInput.sessionID)
        if (!acc) {
          return
        }
        acc.endedAt = Date.now()
        writer!.writeSession(toParsedSessionData(acc))
        sessions.delete(hookInput.sessionID)
        console.log(`[timeline-plugin] Session deleted: ${hookInput.sessionID}`)
      } catch (error) {
        console.error('[timeline-plugin] Session deleted error:', error)
      }
    },

    'message.updated': async (hookInput) => {
      try {
        const info = hookInput.info
        const acc = getAccumulator(info.sessionID, project)

        if (info.role === 'user') {
          acc.turns += 1
        }

        if (info.role === 'assistant' && info.tokens) {
          acc.tokensInput += info.tokens.input || 0
          acc.tokensOutput += info.tokens.output || 0
          if (info.tokens.cache) {
            acc.tokensCached += (info.tokens.cache.read || 0) + (info.tokens.cache.write || 0)
          }
        }

        if (info.modelID) {
          acc.model = info.modelID
        }
      } catch (error) {
        console.error('[timeline-plugin] Message updated error:', error)
      }
    },

    'message.part.updated': async (hookInput) => {
      try {
        const part = hookInput.part
        if (part.type !== 'text' || part.synthetic || part.ignored) {
          return
        }

        const acc = getAccumulator(part.sessionID, project)
        if (!acc.firstUserMessage && part.text.trim()) {
          acc.firstUserMessage = part.text.trim()
        }
      } catch (error) {
        console.error('[timeline-plugin] Message part updated error:', error)
      }
    },

    'tool.execute.before': async (hookInput) => {
      try {
        const acc = getAccumulator(hookInput.sessionID, project)
        const toolName = hookInput.tool
        acc.tools.set(toolName, (acc.tools.get(toolName) || 0) + 1)
      } catch (error) {
        console.error('[timeline-plugin] Tool execute before error:', error)
      }
    },

    'tool.execute.after': async (hookInput) => {
      try {
        const acc = sessions.get(hookInput.sessionID)
        if (!acc) {
          return
        }

        if (hookInput.tool === 'Skill' || hookInput.tool === 'skill') {
          const args = hookInput.args
          if (args && typeof args === 'object' && typeof args.skill === 'string') {
            acc.skills.add(args.skill)
          }
        }
      } catch (error) {
        console.error('[timeline-plugin] Tool execute after error:', error)
      }
    },

    event: async ({ event }) => {
      if (event.type === 'session.error') {
        try {
          const sessionID
            = (event.properties.sessionID as string)
              || (event.properties.info && typeof event.properties.info === 'object'
                ? (event.properties.info as Record<string, unknown>).id
                : undefined)
              || 'unknown'

          const acc = sessions.get(sessionID)
          if (acc) {
            acc.endedAt = Date.now()
            writer!.writeSession(toParsedSessionData(acc))
            console.log(`[timeline-plugin] Session error written: ${sessionID}`)
          }
        } catch (error) {
          console.error('[timeline-plugin] Session error handler failed:', error)
        }
      }
    },
  }
}

export default TimelinePlugin
