import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import type Database from 'better-sqlite3'

export interface IngestResult {
  sessionId: string
  project: string
  sessionsInserted: number
  sessionsUpdated: number
}

function decodeProjectName(encodedName: string): string {
  if (encodedName.startsWith('-')) {
    return `/${encodedName.slice(1).replaceAll('-', '/')}`
  }
  return encodedName.replaceAll('-', '/')
}

function extractProjectFromPath(transcriptPath: string): string {
  const parts = transcriptPath.split(path.sep)
  const projectsIndex = parts.indexOf('projects')
  if (projectsIndex !== -1 && projectsIndex + 1 < parts.length) {
    const encodedName = parts[projectsIndex + 1]
    return decodeProjectName(encodedName)
  }
  return 'unknown'
}

export function ingestSession(
  db: Database.Database,
  sessionId: string,
  transcriptPath: string,
): IngestResult {
  const fileStat = statSync(transcriptPath)
  const fileSize = fileStat.size

  const existingRow = db
    .prepare('SELECT last_offset FROM sessions WHERE session_id = ?')
    .get(sessionId) as { last_offset: number } | undefined

  // Always parse the full file to ensure complete data on incremental ingests.
  // The last_offset optimization is disabled to prevent data loss when the file
  // grows between ingests. See: incremental ingest bug fix.
  const buffer = readFileSync(transcriptPath)
  const content = buffer.toString('utf8', 0)
  const lines = content.split('\n')

  let firstTimestamp: number | null = null
  let lastTimestamp: number | null = null
  let turns = 0
  let firstUserMessage: string | null = null
  let tokensInput = 0
  let tokensOutput = 0
  let tokensCached = 0
  const toolCounts = new Map<string, number>()
  const skills = new Set<string>()
  let summary: string | null = null
  let summarySource: string | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      continue
    }

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      console.error(`Malformed JSON line in ${transcriptPath}: ${trimmed.slice(0, 200)}`)
      continue
    }

    const timestamp = parsed.timestamp
    if (typeof timestamp === 'string') {
      const ts = new Date(timestamp).getTime()
      if (!Number.isNaN(ts)) {
        if (firstTimestamp === null || ts < firstTimestamp) {
          firstTimestamp = ts
        }
        if (lastTimestamp === null || ts > lastTimestamp) {
          lastTimestamp = ts
        }
      }
    }

    const type = parsed.type
    if (type === 'user') {
      const message = parsed.message as Record<string, unknown> | undefined
      if (message?.role === 'user') {
        turns++
        const content = message.content
        if (firstUserMessage === null && typeof content === 'string') {
          firstUserMessage = content
        }
      }
    }

    if (type === 'assistant') {
      const message = parsed.message as Record<string, unknown> | undefined
      if (message?.role === 'assistant') {
        const usage = message.usage as Record<string, unknown> | undefined
        if (usage) {
          const iterations = usage.iterations as Array<Record<string, unknown>> | undefined
          if (iterations && iterations.length > 0) {
            for (const iter of iterations) {
              tokensInput += Number(iter.input_tokens) || 0
              tokensOutput += Number(iter.output_tokens) || 0
              tokensCached += Number(iter.cache_read_input_tokens) || 0
              tokensCached += Number(iter.cache_creation_input_tokens) || 0
            }
          } else {
            tokensInput += Number(usage.input_tokens) || 0
            tokensOutput += Number(usage.output_tokens) || 0
            tokensCached += Number(usage.cache_read_input_tokens) || 0
            tokensCached += Number(usage.cache_creation_input_tokens) || 0
          }
        }

        const content = message.content as Array<Record<string, unknown>> | undefined
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'tool_use' && typeof block.name === 'string') {
              const toolName = block.name
              toolCounts.set(toolName, (toolCounts.get(toolName) || 0) + 1)

              if (toolName === 'Skill') {
                const input = block.input as Record<string, unknown> | undefined
                if (typeof input?.skill === 'string') {
                  skills.add(input.skill)
                }
              }
            }
          }
        }
      }
    }

    if (type === 'system') {
      const subtype = parsed.subtype
      if (subtype === 'away_summary' && typeof parsed.content === 'string') {
        summary = parsed.content
        summarySource = 'auto'
      }
    }
  }

  if (summary === null && firstUserMessage !== null) {
    summary = firstUserMessage.length > 140
      ? firstUserMessage.slice(0, 140)
      : firstUserMessage
    summarySource = 'first_message'
  }

  if (summary === null) {
    summary = '(untitled session)'
    summarySource = 'first_message'
  }

  const project = extractProjectFromPath(transcriptPath)
  const startedAt = firstTimestamp ?? Date.now()
  const endedAt = lastTimestamp ?? Date.now()
  const durationMs = endedAt - startedAt
  const ingestedAt = Date.now()

  const sessionsInserted = existingRow ? 0 : 1
  const sessionsUpdated = existingRow ? 1 : 0

  const upsertSession = db.prepare(`
    INSERT OR REPLACE INTO sessions (
      session_id, project, started_at, ended_at, duration_ms,
      turns, tokens_input, tokens_output, tokens_cached,
      summary, summary_source, transcript_path, last_offset, ingested_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const deleteTools = db.prepare('DELETE FROM session_tools WHERE session_id = ?')
  const insertTool = db.prepare('INSERT OR REPLACE INTO session_tools (session_id, tool_name, call_count) VALUES (?, ?, ?)')
  const deleteSkills = db.prepare('DELETE FROM session_skills WHERE session_id = ?')
  const insertSkill = db.prepare('INSERT OR REPLACE INTO session_skills (session_id, skill_name) VALUES (?, ?)')

  const transaction = db.transaction(() => {
    upsertSession.run(
      sessionId,
      project,
      startedAt,
      endedAt,
      durationMs,
      turns,
      tokensInput,
      tokensOutput,
      tokensCached,
      summary,
      summarySource,
      transcriptPath,
      fileSize,
      ingestedAt,
    )

    deleteTools.run(sessionId)
    for (const [toolName, callCount] of toolCounts) {
      insertTool.run(sessionId, toolName, callCount)
    }

    deleteSkills.run(sessionId)
    for (const skillName of skills) {
      insertSkill.run(sessionId, skillName)
    }
  })

  transaction()

  return {
    sessionId,
    project,
    sessionsInserted,
    sessionsUpdated,
  }
}
