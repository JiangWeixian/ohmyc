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

export function createAccumulator(sessionId: string, project?: string): SessionAccumulator {
  return {
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
// Event handler
// ---------------------------------------------------------------------------

export interface EventHandlerDeps {
  project: string
  writer: ReturnType<typeof createWriter>
  log: typeof log
}

export function createEventHandler(deps: EventHandlerDeps) {
  const sessions = new Map<string, SessionAccumulator>()

  function getAccumulator(sessionId: string): SessionAccumulator {
    let acc = sessions.get(sessionId)
    if (!acc) {
      acc = createAccumulator(sessionId, deps.project)
      sessions.set(sessionId, acc)
    }
    return acc
  }

  return {
    sessions,
    handler: async ({ event }: { event: any }) => {
      try {
        deps.log('debug', 'Event received', { eventType: event.type })

        switch (event.type) {
          case 'session.created': {
            const sessionID = getEventSessionID(event)
            if (sessionID) {
              const acc = getAccumulator(sessionID)
              acc.startedAt = Date.now()
              deps.log('debug', 'Session created', { sessionID })
            }
            break
          }

          case 'session.idle': {
            const sessionID = getEventSessionID(event)
            if (sessionID) {
              const acc = sessions.get(sessionID)
              if (!acc) {
                deps.log('warn', 'Session idle but not found', { sessionID })
                return
              }
              acc.endedAt = Date.now()
              const data = toParsedSessionData(acc)
              deps.log('debug', 'Writing session', { sessionID, turns: data.turns })
              deps.writer.writeSession(data)
              deps.log('info', 'Session written', { sessionID })
            }
            break
          }

          case 'session.deleted': {
            const sessionID = getEventSessionID(event)
            if (sessionID) {
              const acc = sessions.get(sessionID)
              if (acc) {
                acc.endedAt = Date.now()
                deps.writer.writeSession(toParsedSessionData(acc))
                sessions.delete(sessionID)
                deps.log('info', 'Session deleted', { sessionID })
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
                deps.writer.writeSession(toParsedSessionData(acc))
                deps.log('info', 'Session error written', { sessionID })
              }
            }
            break
          }

          case 'message.updated': {
            const info = event.properties?.info || event.properties?.message
            if (info) {
              const sessionID = info.sessionID || info.session_id
              deps.log('debug', 'Message updated via event', { sessionID, role: info.role, hasTokens: !!info.tokens, modelID: info.modelID })
              if (sessionID) {
                const acc = getAccumulator(sessionID)

                if (info.role === 'user') {
                  acc.turns += 1
                  deps.log('debug', 'Turn counted', { sessionID, turns: acc.turns })
                }

                if (info.role === 'assistant' && info.tokens) {
                  acc.tokensInput += info.tokens.input || 0
                  acc.tokensOutput += info.tokens.output || 0
                  if (info.tokens.cache) {
                    acc.tokensCached += (info.tokens.cache.read || 0) + (info.tokens.cache.write || 0)
                  }
                  deps.log('debug', 'Tokens updated', { sessionID, input: info.tokens.input, output: info.tokens.output })
                }

                if (info.modelID) {
                  acc.model = info.modelID
                }
              }
            }
            break
          }

          case 'message.part.updated': {
            const part = event.properties?.part
            if (part && part.type === 'text' && !part.synthetic && !part.ignored) {
              const sessionID = part.sessionID || part.session_id
              if (sessionID && part.text?.trim()) {
                const acc = getAccumulator(sessionID)
                if (!acc.firstUserMessage) {
                  acc.firstUserMessage = part.text.trim()
                  deps.log('debug', 'First user message captured', { sessionID })
                }
              }
            }
            break
          }

          case 'tool.execute.before': {
            const sessionID = event.properties?.sessionID
            const toolName = event.properties?.tool
            if (sessionID && toolName) {
              const acc = getAccumulator(sessionID)
              acc.tools.set(toolName, (acc.tools.get(toolName) || 0) + 1)
            }
            break
          }

          case 'tool.execute.after': {
            const sessionID = event.properties?.sessionID
            const toolName = event.properties?.tool
            const args = event.properties?.args
            if (sessionID && (toolName === 'Skill' || toolName === 'skill') && args?.skill) {
              const acc = sessions.get(sessionID)
              if (acc) {
                acc.skills.add(args.skill)
              }
            }
            break
          }
        }
      } catch (error) {
        deps.log('error', 'Event handler error', { error: error instanceof Error ? error.message : String(error) })
      }
    },
  }
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

  const { handler } = createEventHandler({ project, writer: writer!, log })

  return {
    event: handler,
  }
}

export default TimelinePlugin
