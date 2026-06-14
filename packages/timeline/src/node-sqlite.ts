import type { DatabaseSync as NativeDatabaseSync } from 'node:sqlite'
import type { SqliteDatabase, SqliteStatement } from './writer.js'

interface NodeSqliteModule {
  DatabaseSync: new (path: string) => NativeDatabaseSync
}

export interface NodeSqliteDatabase extends SqliteDatabase {
  close: () => void
}

export function openNodeSqliteDatabase(dbPath: string): NodeSqliteDatabase {
  let nativeDb: NativeDatabaseSync
  try {
    const { DatabaseSync } = loadNodeSqliteModule()
    nativeDb = new DatabaseSync(dbPath)
  } catch (error) {
    if (isMissingNodeSqlite(error)) {
      throw new Error('Timeline requires Node 22+ because it uses node:sqlite')
    }
    throw error
  }

  return wrapNodeSqlite(nativeDb)
}

function loadNodeSqliteModule(): NodeSqliteModule {
  const module = process.getBuiltinModule?.(`node:${'sqlite'}`) as NodeSqliteModule | undefined
  if (!module) {
    throw new Error('Timeline requires Node 22+ because it uses node:sqlite')
  }
  return module
}

function wrapNodeSqlite(nativeDb: NativeDatabaseSync): NodeSqliteDatabase {
  return {
    exec: sql => nativeDb.exec(sql),
    prepare: (sql) => {
      const statement = nativeDb.prepare(sql)
      return {
        run: (...params: any[]) => {
          statement.run(...params)
        },
        get: (...params: any[]) => statement.get(...params),
        all: (...params: any[]) => statement.all(...params),
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
    close: () => nativeDb.close(),
  }
}

function isMissingNodeSqlite(error: unknown): boolean {
  return (
    error instanceof Error
    && (
      error.message.includes('node:sqlite')
      || error.message.includes('No such built-in module')
      || error.message.includes('Unknown built-in module')
    )
  )
}
