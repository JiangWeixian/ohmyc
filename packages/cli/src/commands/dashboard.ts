import { execSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  backfillAll,
  closeDatabase,
  getDefaultProjectsDir,
  getStatus,
  ingestSession,
  openDatabase,
} from '@claudeui/timeline'

import type { PluginInstall } from '@claudeui/shared'
import type Database from 'better-sqlite3'

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

export function getPluginsDir(): string {
  const agentHome = process.env.AGENT_HOME
  const claudeDir = agentHome || path.join(os.homedir(), '.claude')
  return path.join(claudeDir, 'plugins')
}

export function getInstalledPluginsPath(): string {
  return path.join(getPluginsDir(), 'installed_plugins.json')
}

export function readInstalledPlugins(): { version?: number; plugins: Record<string, PluginInstall[]> } {
  try {
    const raw = readFileSync(getInstalledPluginsPath(), 'utf8')
    return JSON.parse(raw)
  } catch {
    return { version: 1, plugins: {} }
  }
}

export function writeInstalledPlugins(data: { version?: number; plugins: Record<string, PluginInstall[]> }): void {
  const pluginsDir = getPluginsDir()
  mkdirSync(pluginsDir, { recursive: true })
  writeFileSync(getInstalledPluginsPath(), JSON.stringify(data, null, 2), 'utf8')
}

export function hasJq(): boolean {
  try {
    execSync('jq --version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

export function getPluginSourceDir(): string {
  // In development: resolve from src/commands/dashboard.ts → ../../plugins/timeline
  // In production (bundled): resolve from dist/index.mjs → ./plugins/timeline
  const srcPath = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', 'plugins', 'timeline')
  const distPath = path.resolve(fileURLToPath(import.meta.url), '..', '..', 'plugins', 'timeline')

  if (existsSync(distPath)) {
    return distPath
  }
  return srcPath
}

function formatDate(ts: number | undefined): string {
  if (ts === undefined || Number.isNaN(ts)) {
    return 'never'
  }
  return new Date(ts).toLocaleString()
}

// ------------------------------------------------------------------
// runInstall
// ------------------------------------------------------------------

export async function runInstall(): Promise<void> {
  const pluginSourceDir = getPluginSourceDir()

  if (!hasJq()) {
    console.warn('Warning: jq is not installed. Some plugin operations may be limited.')
  }

  // Read / create registry
  const registry = readInstalledPlugins()

  const now = new Date().toISOString()
  const installRecord: PluginInstall = {
    version: '1.0.0',
    installedAt: now,
    lastUpdated: now,
    installPath: pluginSourceDir,
    isLocal: true,
    scope: 'user',
  }

  registry.plugins['claudeui-timeline'] = [installRecord]
  writeInstalledPlugins(registry)
  console.log('Plugin claudeui-timeline registered.')

  // Open database and optionally backfill
  const db = openDatabase()
  try {
    const status = getStatus(db)
    if (status.lastSyncAt === undefined) {
      console.log('Database empty. Running initial backfill...')
      const result = backfillAll(db, {
        onProgress: (done, total) => {
          console.log(`  Backfill: ${done}/${total}`)
        },
      })
      console.log(`Backfill complete: ${result.indexed} indexed, ${result.skipped} skipped, ${result.errors} errors`)
    } else {
      console.log(`Database already has ${status.sessionCount} sessions (last sync: ${formatDate(status.lastSyncAt)})`)
    }
  } finally {
    closeDatabase(db)
  }

  console.log(`Install complete. Plugin source: ${pluginSourceDir}`)
}

// ------------------------------------------------------------------
// runUninstall
// ------------------------------------------------------------------

export async function runUninstall(): Promise<void> {
  const registry = readInstalledPlugins()
  if (registry.plugins['claudeui-timeline']) {
    delete registry.plugins['claudeui-timeline']
    writeInstalledPlugins(registry)
  }
  console.log('Plugin removed. Database preserved — run `cu dashboard --install` to re-register.')
}

// ------------------------------------------------------------------
// runSync
// ------------------------------------------------------------------

export async function runSync(): Promise<void> {
  const db = openDatabase()
  try {
    console.log('Running sync...')
    const result = backfillAll(db, {
      onProgress: (done, total) => {
        console.log(`  Sync: ${done}/${total}`)
      },
    })
    console.log(`Sync complete: ${result.indexed} indexed, ${result.skipped} skipped, ${result.errors} errors`)
  } finally {
    closeDatabase(db)
  }
}

// ------------------------------------------------------------------
// runIngest
// ------------------------------------------------------------------

export async function runIngest(sessionId: string, filePath?: string): Promise<void> {
  let transcriptPath: string

  if (filePath) {
    transcriptPath = path.resolve(filePath)
    if (!existsSync(transcriptPath)) {
      throw new Error(`File not found: ${transcriptPath}`)
    }
  } else {
    const projectsDir = getDefaultProjectsDir()
    transcriptPath = path.join(projectsDir, `${sessionId}.jsonl`)
    if (!existsSync(transcriptPath)) {
      // Search recursively
      const found = searchForTranscript(projectsDir, `${sessionId}.jsonl`)
      if (!found) {
        throw new Error(`Transcript not found for session ${sessionId} under ${projectsDir}`)
      }
      transcriptPath = found
    }
  }

  const db = openDatabase()
  try {
    const result = ingestSession(db, sessionId, transcriptPath)
    console.log(`Ingested ${result.sessionId} (${result.project}): inserted=${result.sessionsInserted}, updated=${result.sessionsUpdated}`)
  } finally {
    closeDatabase(db)
  }
}

function searchForTranscript(dir: string, filename: string): string | null {
  const entries = readDirRecursive(dir)
  for (const entry of entries) {
    if (entry.endsWith(path.sep + filename)) {
      return entry
    }
  }
  return null
}

function readDirRecursive(dir: string): string[] {
  const results: string[] = []
  try {
    const items = readdirSync(dir, { withFileTypes: true })
    for (const item of items) {
      const full = path.join(dir, item.name)
      if (item.isDirectory()) {
        results.push(...readDirRecursive(full))
      } else {
        results.push(full)
      }
    }
  } catch {
    // ignore
  }
  return results
}

// ------------------------------------------------------------------
// runDoctor
// ------------------------------------------------------------------

export async function runDoctor(): Promise<void> {
  const issues: string[] = []

  // 1. Check plugin installed
  const registry = readInstalledPlugins()
  const pluginInstalled = !!registry.plugins['claudeui-timeline']
  if (!pluginInstalled) {
    issues.push('Plugin claudeui-timeline is not installed.')
  }

  // 2. Check jq available
  const jqAvailable = hasJq()
  if (!jqAvailable) {
    issues.push('jq is not available on PATH.')
  }

  // 3. Check DB exists and integrity
  let db: Database.Database | null = null
  try {
    db = openDatabase()
    const integrityResult = db.pragma('integrity_check') as Array<{ integrity_check: string }>
    const integrityOk = integrityResult.length > 0 && integrityResult[0].integrity_check === 'ok'
    if (!integrityOk) {
      issues.push(`Database integrity check failed: ${JSON.stringify(integrityResult)}`)
    }

    const status = getStatus(db)
    console.log(`Sessions: ${status.sessionCount}`)
    console.log(`Last sync: ${formatDate(status.lastSyncAt)}`)
  } catch (error) {
    issues.push(`Database error: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    if (db) {
      closeDatabase(db)
    }
  }

  if (issues.length > 0) {
    const summary = issues.join('\n  - ')
    throw new Error(`Issues found:\n  - ${summary}`)
  }

  console.log('All checks passed.')
}
