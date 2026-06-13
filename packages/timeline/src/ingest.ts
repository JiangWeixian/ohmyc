// ============================================================
// @ohmyc/timeline — Transcript Ingest
// Parses Claude Code JSONL transcript files and upserts
// session data (turns, tokens, tools, skills) into SQLite.
// ============================================================

import { readFileSync, statSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { createWriter } from './writer.js'

import type Database from 'better-sqlite3'
import type { IngestResult, ParsedSessionData } from './schema.js'
import type { SqliteDatabase } from './writer.js'

export type { ParsedSessionData, IngestResult } from './schema.js'

/** Options accepted by transcript parsing and ingest entry points. */
export interface TranscriptParseOptions {
  /** Agent that produced the transcript. Defaults to `claude` for historical Claude JSONL ingestion. */
  agentName?: string | null
}

// ---------------------------------------------------------------------------
// Parser — pure function, does not touch the database
// ---------------------------------------------------------------------------

/**
 * Pure-function parser: reads a Claude Code JSONL transcript and returns
 * structured session data without touching the database.
 * This is separated from the writer so it can be called independently
 * (e.g. from a shell pipeline via jq).
 *
 * @param sessionId - Unique session identifier (UUID).
 * @param transcriptPath - Absolute path to the JSONL transcript file.
 * @returns Structured session data ready to be written to the database.
 */
export function parseTranscript(
  sessionId: string,
  transcriptPath: string,
  options?: TranscriptParseOptions,
): ParsedSessionData {
  const fileStat = statSync(transcriptPath)
  const fileSize = fileStat.size

  const buffer = readFileSync(transcriptPath)
  const content = buffer.toString('utf8')
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
  let summarySource: 'auto' | 'first_message' = 'first_message'
  let model: string | null = null

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
        const content = message.content
        // Only count natural language input as a turn, exclude tool_result arrays
        if (typeof content === 'string') {
          turns++
          if (firstUserMessage === null) {
            firstUserMessage = content
          }
        }
      }
    }

    if (type === 'assistant') {
      const message = parsed.message as Record<string, unknown> | undefined
      if (message?.role === 'assistant') {
        if (typeof message.model === 'string') {
          model = message.model
        }
        const usage = message.usage as Record<string, unknown> | undefined
        if (usage) {
          const iterations = usage.iterations as Array<Record<string, unknown>> | undefined
          if (iterations && iterations.length > 0) {
            for (const iter of iterations) {
              tokensInput += Number(iter.input_tokens) || 0
              tokensOutput += Number(iter.output_tokens) || 0
            }
            // Only record cache from the last assistant message (cumulative state)
            const lastIter = iterations.at(-1)
            if (lastIter) {
              tokensCached = Number(lastIter.cache_read_input_tokens) || 0
              tokensCached += Number(lastIter.cache_creation_input_tokens) || 0
            }
          } else {
            tokensInput += Number(usage.input_tokens) || 0
            tokensOutput += Number(usage.output_tokens) || 0
            tokensCached = Number(usage.cache_read_input_tokens) || 0
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
    // Truncate to keep summaries compact for list views
    summary = firstUserMessage.length > 140
      ? firstUserMessage.slice(0, 140)
      : firstUserMessage
  }

  if (summary === null) {
    summary = '(untitled session)'
  }

  const project = extractProjectFromPath(transcriptPath)
  const startedAt = firstTimestamp ?? Date.now()
  const endedAt = lastTimestamp ?? Date.now()
  const durationMs = endedAt - startedAt

  return {
    sessionId,
    project,
    agentName: options?.agentName ?? 'claude',
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
    tools: [...toolCounts.entries()].map(([toolName, callCount]) => ({ toolName, callCount })),
    skills: [...skills],
    model,
  }
}

// ---------------------------------------------------------------------------
// Writer — receives parsed data and writes to the database
// ---------------------------------------------------------------------------

/**
 * Writes parsed session data into the database using INSERT OR REPLACE.
 * Deletes and re-inserts tool/skill rows for the session to stay in sync.
 * Returns a summary of whether the session was new or an update.
 *
 * @param db - Database handle conforming to {@link SqliteDatabase}.
 * @param sessionId - Unique session identifier.
 * @param data - Pre-parsed session data to write.
 * @returns Summary of the write operation.
 */
export function upsertSessionData(
  db: SqliteDatabase,
  sessionId: string,
  data: ParsedSessionData,
): IngestResult {
  return createWriter(db).writeSession(data)
}

// ---------------------------------------------------------------------------
// Original entry point — combines parse + write (for CLI direct calls)
// ---------------------------------------------------------------------------

/**
 * Convenience entry point that combines {@link parseTranscript} and
 * {@link upsertSessionData}. Used by the backfill process and CLI.
 *
 * @param db - Open `better-sqlite3` database instance.
 * @param sessionId - Unique session identifier (UUID).
 * @param transcriptPath - Absolute path to the JSONL transcript file.
 * @returns Summary of the write operation.
 */
export function ingestSession(
  db: Database.Database,
  sessionId: string,
  transcriptPath: string,
  options?: TranscriptParseOptions,
): IngestResult {
  const data = parseTranscript(sessionId, transcriptPath, options)
  return upsertSessionData(db, sessionId, data)
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/**
 * Decodes a Claude Code project directory name back to its original path.
 * Claude encodes paths by replacing `/` with `-`; absolute paths are
 * prefixed with an extra `-` to distinguish them from relative paths.
 * For example `-Volumes-Users-foo-bar` decodes to `/Volumes/Users/foo/bar`.
 */
function decodeProjectName(encodedName: string): string {
  if (encodedName.startsWith('-')) {
    return `/${encodedName.slice(1).replaceAll('-', '/')}`
  }
  return encodedName.replaceAll('-', '/')
}

/** Extracts the project path from a transcript file path by finding the `projects` directory segment.
 *  Strips the home directory prefix for a display-friendly name.
 */
function extractProjectFromPath(transcriptPath: string): string {
  const parts = transcriptPath.split(path.sep)
  const projectsIndex = parts.indexOf('projects')
  if (projectsIndex !== -1 && projectsIndex + 1 < parts.length) {
    const encodedName = parts[projectsIndex + 1]
    const absolutePath = decodeProjectName(encodedName)
    const homeDir = os.homedir()
    if (absolutePath.startsWith(homeDir)) {
      return `~${absolutePath.slice(homeDir.length)}`
    }
    return absolutePath
  }
  return 'unknown'
}
