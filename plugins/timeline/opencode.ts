// plugins/timeline/opencode.ts
import { appendFileSync, mkdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { Database } from 'bun:sqlite'

import { createWriter } from '../../packages/timeline/src/writer.js'

import type { Plugin } from '@opencode-ai/plugin'
import type { ParsedSessionData } from '../../packages/timeline/src/schema.js'

// ---------------------------------------------------------------------------
// Logging helper - writes to file since console.log may not be visible
// ---------------------------------------------------------------------------

const LOG_FILE = '/tmp/timeline-plugin.log'

function log(level: string, message: string, extra?: Record<string, unknown>): void {
  const entry = `[${new Date().toISOString()}] [${level}] ${message}${extra ? ` ${JSON.stringify(extra)}` : ''}\n`
  try {
    appendFileSync(LOG_FILE, entry)
  } catch {
    console.log(entry)
  }
}

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

function getEventSessionID(event: any): string | undefined {
  if (event.properties?.sessionID) {
    return event.properties.sessionID as string
  }
  if (event.properties?.info?.id) {
    return event.properties.info.id as string
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export const TimelinePlugin: Plugin = async (input) => {
  const project = getProjectName(input)
  log('info', 'Plugin initializing', { project, dbPath: getDbPath() })

  let db: Database | undefined
  let writer: ReturnType<typeof createWriter> | undefined

  try {
    db = ensureDb()
    writer = createWriter(db)
    log('info', 'Database ready')
  } catch (error) {
    log('error', 'Database init failed', { error: error instanceof Error ? error.message : String(error) })
    return {}
  }

  return {
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
        log('error', 'Message updated error', { error: error instanceof Error ? error.message : String(error) })
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
        log('error', 'Message part updated error', { error: error instanceof Error ? error.message : String(error) })
      }
    },

    'tool.execute.before': async (hookInput) => {
      try {
        const acc = getAccumulator(hookInput.sessionID, project)
        const toolName = hookInput.tool
        acc.tools.set(toolName, (acc.tools.get(toolName) || 0) + 1)
      } catch (error) {
        log('error', 'Tool execute before error', { error: error instanceof Error ? error.message : String(error) })
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
        log('error', 'Tool execute after error', { error: error instanceof Error ? error.message : String(error) })
      }
    },

    event: async ({ event }) => {
      try {
        log('debug', 'Event received', { eventType: event.type })

        switch (event.type) {
          case 'session.created': {
            const sessionID = getEventSessionID(event)
            if (sessionID) {
              const acc = getAccumulator(sessionID, project)
              acc.startedAt = Date.now()
              log('debug', 'Session created', { sessionID })
            }
            break
          }

          case 'session.idle': {
            const sessionID = getEventSessionID(event)
            if (sessionID) {
              const acc = sessions.get(sessionID)
              if (!acc) {
                log('warn', 'Session idle but not found', { sessionID })
                return
              }
              acc.endedAt = Date.now()
              const data = toParsedSessionData(acc)
              log('debug', 'Writing session', { sessionID, turns: data.turns })
              writer!.writeSession(data)
              log('info', 'Session written', { sessionID })
            }
            break
          }

          case 'session.deleted': {
            const sessionID = getEventSessionID(event)
            if (sessionID) {
              const acc = sessions.get(sessionID)
              if (acc) {
                acc.endedAt = Date.now()
                writer!.writeSession(toParsedSessionData(acc))
                sessions.delete(sessionID)
                log('info', 'Session deleted', { sessionID })
              }
            }
            break
          }

          case 'session.error': {
            const sessionID = getEventSessionID(event)
            if (sessionID) {
              const acc = sessions.get(sessionID)
              if (acc) {
                acc.endedAt = Date.now()
                writer!.writeSession(toParsedSessionData(acc))
                log('info', 'Session error written', { sessionID })
              }
            }
            break
          }
        }
      } catch (error) {
        log('error', 'Event handler error', { error: error instanceof Error ? error.message : String(error) })
      }
    },
  }
}

export default TimelinePlugin
