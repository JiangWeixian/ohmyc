// plugins/timeline/opencode.ts
import { appendFileSync, mkdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { Database } from 'bun:sqlite'

import { CURRENT_SCHEMA_VERSION, SCHEMA_SQL } from '../../packages/timeline/src/schema.js'
import { createWriter } from '../../packages/timeline/src/writer.js'

import type { Plugin } from '@opencode-ai/plugin'
import type { ParsedSessionData } from '../../packages/timeline/src/ingest.js'

const LOG_FILE = path.join(os.tmpdir(), 'timeline-plugin.log')

function log(level: string, message: string, extra?: Record<string, unknown>): void {
  const entry = `[${new Date().toISOString()}] [${level}] ${message}${extra ? ` ${JSON.stringify(extra)}` : ''}\n`
  try {
    appendFileSync(LOG_FILE, entry)
  } catch {
    console.log(entry)
  }
}

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

  db.exec(SCHEMA_SQL)
  db.query('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('schema_version', String(CURRENT_SCHEMA_VERSION))
}

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
    summarySource: acc.firstUserMessage ? 'first_message' : 'auto',
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
        switch (event.type) {
          case 'session.created': {
            const sessionID = getEventSessionID(event)
            if (sessionID) {
              const acc = getAccumulator(sessionID)
              acc.startedAt = Date.now()
            }
            break
          }

          case 'session.idle': {
            const sessionID = getEventSessionID(event)
            if (sessionID) {
              const acc = sessions.get(sessionID)
              if (!acc) {
                return
              }
              acc.endedAt = Date.now()
              const data = toParsedSessionData(acc)
              try {
                deps.writer.writeSession(data)
                sessions.delete(sessionID)
              } catch (writeError) {
                deps.log('error', 'Failed to write session on idle', {
                  sessionID,
                  error: writeError instanceof Error ? writeError.message : String(writeError),
                })
              }
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
              }
            }
            break
          }

          case 'message.updated': {
            const info = event.properties?.info || event.properties?.message
            if (info) {
              const sessionID = info.sessionID || info.session_id
              if (sessionID) {
                const acc = getAccumulator(sessionID)

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
                }
              }
            }
            break
          }
        }
      } catch (error) {
        deps.log('error', 'Event handler error', { error: error instanceof Error ? error.message : String(error) })
      }
    },

    toolExecuteBefore: async (hookInput: { sessionID: string; tool: string }) => {
      try {
        const acc = getAccumulator(hookInput.sessionID)
        acc.tools.set(hookInput.tool, (acc.tools.get(hookInput.tool) || 0) + 1)
      } catch (error) {
        deps.log('error', 'Tool execute error', { error: error instanceof Error ? error.message : String(error) })
      }
    },

    toolExecuteAfter: async (hookInput: { sessionID: string; tool: string; args: any }) => {
      try {
        if (hookInput.tool === 'Skill' || hookInput.tool === 'skill') {
          const acc = getAccumulator(hookInput.sessionID)
          const args = hookInput.args
          if (args && typeof args === 'object' && typeof args.name === 'string') {
            acc.skills.add(args.name)
          }
        }
      } catch (error) {
        deps.log('error', 'Tool execute error', { error: error instanceof Error ? error.message : String(error) })
      }
    },
  }
}

export const TimelinePlugin: Plugin = async (input) => {
  const project = getProjectName(input)

  let db: Database | undefined
  let writer: ReturnType<typeof createWriter> | undefined

  try {
    db = ensureDb()
    writer = createWriter(db)
  } catch (error) {
    log('error', 'Database init failed', { error: error instanceof Error ? error.message : String(error) })
    return {}
  }

  const { handler, toolExecuteBefore, toolExecuteAfter } = createEventHandler({ project, writer: writer!, log })

  return {
    event: handler,
    'tool.execute.before': toolExecuteBefore,
    'tool.execute.after': toolExecuteAfter,
  }
}

export default TimelinePlugin
