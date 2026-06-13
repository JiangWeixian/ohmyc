#!/usr/bin/env node
// Timeline plugin ingest entry — Claude Code Stop-hook hot path.
// Replaces `ohmyc dashboard --ingest` and `--ingest-raw`.

import { mkdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { parseTranscript } from '@ohmyc/timeline/ingest'
import { migrate } from '@ohmyc/timeline/migrate'
import { createWriter } from '@ohmyc/timeline/writer'
import { cac } from 'cac'

import type { ParsedSessionData } from '@ohmyc/timeline/schema'
import type { SqliteDatabase, SqliteStatement } from '@ohmyc/timeline/writer'

const cli = cac('ohmyc-timeline-ingest')

cli
  .command('', 'Ingest a single session into the timeline DB')
  .option('--session-id <id>', 'Session UUID (disk-path mode)')
  .option('--transcript-path <path>', 'Path to JSONL transcript (disk-path mode)')
  .option('--agent-name <name>', 'Agent name for disk-path mode', { default: 'claude' })
  .option('--raw', 'Read pre-parsed ParsedSessionData JSON from stdin')
  .action(async (options: {
    sessionId?: string
    transcriptPath?: string
    agentName?: string
    raw?: boolean
  }) => {
    if (options.raw) {
      await runRawMode()
      return
    }
    if (!options.sessionId || !options.transcriptPath) {
      console.error('error: --session-id and --transcript-path are required when --raw is not set')
      process.exit(1)
    }
    await runDiskMode(options.sessionId, options.transcriptPath, options.agentName ?? 'claude')
  })

cli.help()
cli.parse()

async function runDiskMode(sessionId: string, transcriptPath: string, agentName: string): Promise<void> {
  const { db, close } = await openTimelineDatabase()
  try {
    const data = parseTranscript(sessionId, transcriptPath, { agentName })
    createWriter(db).writeSession(data)
  } finally {
    close()
  }
}

async function runRawMode(): Promise<void> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer)
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) {
    console.error('error: --raw expects JSON on stdin')
    process.exit(1)
  }
  let data: ParsedSessionData
  try {
    data = JSON.parse(raw) as ParsedSessionData
  } catch (parseError) {
    console.error(`error: invalid JSON on stdin: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
    process.exit(1)
  }
  const { db, close } = await openTimelineDatabase()
  try {
    createWriter(db).writeSession(data)
  } finally {
    close()
  }
}

interface OpenedTimelineDatabase {
  db: SqliteDatabase
  close: () => void
}

async function openTimelineDatabase(): Promise<OpenedTimelineDatabase> {
  const dbPath = getDefaultDbPath()
  mkdirSync(path.dirname(dbPath), { recursive: true })

  try {
    const module = await import('better-sqlite3')
    const Database = module.default
    const db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    migrate(db)
    return {
      db,
      close: () => db.close(),
    }
  } catch (error) {
    if (!isMissingBetterSqlite(error)) {
      throw error
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports, unicorn/prefer-module
  const { DatabaseSync } = require(`node:${'sqlite'}`) as { DatabaseSync: new (path: string) => NodeSqliteDatabase }
  const nativeDb = new DatabaseSync(dbPath)
  const db = wrapNodeSqlite(nativeDb)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  migrate(db)
  return {
    db,
    close: () => nativeDb.close(),
  }
}

function getDefaultDbPath(): string {
  const home = process.env.OHMYC_HOME || path.join(os.homedir(), '.config', 'ohmyc')
  return path.join(home, 'timeline.db')
}

function isMissingBetterSqlite(error: unknown): boolean {
  return (
    error instanceof Error
    && 'code' in error
    && (error as { code?: unknown }).code === 'ERR_MODULE_NOT_FOUND'
    && error.message.includes('better-sqlite3')
  )
}

function wrapNodeSqlite(nativeDb: NodeSqliteDatabase): SqliteDatabase {
  return {
    exec: sql => nativeDb.exec(sql),
    prepare: (sql) => {
      const statement = nativeDb.prepare(sql)
      return {
        run: (...params: unknown[]) => {
          statement.run(...params)
        },
        get: (...params: unknown[]) => statement.get(...params),
        all: (...params: unknown[]) => statement.all(...params),
      } satisfies SqliteStatement
    },
    transaction: (fn: () => void) => () => {
      nativeDb.exec('BEGIN IMMEDIATE')
      try {
        fn()
        nativeDb.exec('COMMIT')
      } catch (error) {
        nativeDb.exec('ROLLBACK')
        throw error
      }
    },
  }
}

interface NodeSqliteDatabase {
  exec: (sql: string) => void
  prepare: (sql: string) => NodeSqliteStatement
  close: () => void
}

interface NodeSqliteStatement {
  run: (...params: unknown[]) => void
  get: (...params: unknown[]) => unknown
  all: (...params: unknown[]) => unknown[]
}
