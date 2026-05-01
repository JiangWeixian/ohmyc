import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import { closeDatabase, openDatabase } from './db.js'
import {
  getEvents,
  getHeatmap,
  getProjects,
  getSession,
  getStatus,
  getYears,
} from './query.js'

import type Database from 'better-sqlite3'

describe('query', () => {
  let tmpDir: string
  let db: Database.Database

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'timeline-query-test-'))
    db = openDatabase({ dbPath: path.join(tmpDir, 'timeline.db') })

    // Seed 4 sessions across 3 days and 2 projects
    const insertSession = db.prepare(`
      INSERT INTO sessions (
        session_id, project, started_at, ended_at, duration_ms,
        turns, tokens_input, tokens_output, tokens_cached,
        summary, summary_source, transcript_path, last_offset, ingested_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const insertTool = db.prepare('INSERT INTO session_tools (session_id, tool_name, call_count) VALUES (?, ?, ?)')
    const insertSkill = db.prepare('INSERT INTO session_skills (session_id, skill_name) VALUES (?, ?)')

    const d1 = Date.UTC(2026, 3, 28) // 2026-04-28
    const d2 = Date.UTC(2026, 3, 29) // 2026-04-29
    const d3 = Date.UTC(2026, 3, 30) // 2026-04-30

    // Day 1: project-a, 1 session
    insertSession.run('s1', 'project-a', d1, d1 + 60_000, 60_000, 5, 100, 200, 50, 'Summary 1', 'auto', '/tmp/t1.jsonl', 0, d1)
    insertTool.run('s1', 'Read', 2)
    insertTool.run('s1', 'Write', 1)
    insertSkill.run('s1', 'design-consultation')

    // Day 2: project-a, 1 session
    insertSession.run('s2', 'project-a', d2, d2 + 120_000, 120_000, 3, 50, 80, 20, 'Summary 2', 'auto', '/tmp/t2.jsonl', 0, d2)
    insertTool.run('s2', 'Bash', 1)

    // Day 2: project-b, 1 session
    insertSession.run('s3', 'project-b', d2 + 3_600_000, d2 + 3_600_000 + 30_000, 30_000, 8, 300, 400, 100, 'Summary 3', 'auto', '/tmp/t3.jsonl', 0, d2)
    insertSkill.run('s3', 'security-audit')
    insertSkill.run('s3', 'codex-review')

    // Day 3: project-b, 1 session
    insertSession.run('s4', 'project-b', d3, d3 + 90_000, 90_000, 2, 20, 30, 10, 'Summary 4', 'auto', '/tmp/t4.jsonl', 0, d3)
  })

  afterEach(() => {
    closeDatabase(db)
    rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('getHeatmap', () => {
    it('returns correct daily session counts', () => {
      const result = getHeatmap(db, {
        from: '2026-04-28',
        to: '2026-04-30',
        metric: 'sessions',
      })

      expect(result).toEqual([
        { date: '2026-04-28', value: 1 },
        { date: '2026-04-29', value: 2 },
        { date: '2026-04-30', value: 1 },
      ])
    })

    it('returns correct daily token sums', () => {
      const result = getHeatmap(db, {
        from: '2026-04-28',
        to: '2026-04-30',
        metric: 'tokens',
      })

      // s1: 100+200+50=350, s2: 50+80+20=150, s3: 300+400+100=800, s4: 20+30+10=60
      expect(result).toEqual([
        { date: '2026-04-28', value: 350 },
        { date: '2026-04-29', value: 950 },
        { date: '2026-04-30', value: 60 },
      ])
    })

    it('returns correct daily turn counts', () => {
      const result = getHeatmap(db, {
        from: '2026-04-28',
        to: '2026-04-30',
        metric: 'turns',
      })

      expect(result).toEqual([
        { date: '2026-04-28', value: 5 },
        { date: '2026-04-29', value: 11 },
        { date: '2026-04-30', value: 2 },
      ])
    })

    it('filters by project', () => {
      const result = getHeatmap(db, {
        from: '2026-04-28',
        to: '2026-04-30',
        metric: 'sessions',
        project: 'project-b',
      })

      expect(result).toEqual([
        { date: '2026-04-28', value: 0 },
        { date: '2026-04-29', value: 1 },
        { date: '2026-04-30', value: 1 },
      ])
    })

    it('fills gaps with 0', () => {
      const result = getHeatmap(db, {
        from: '2026-04-25',
        to: '2026-05-01',
        metric: 'sessions',
      })

      expect(result).toHaveLength(7)
      expect(result[0]).toEqual({ date: '2026-04-25', value: 0 })
      expect(result[5]).toEqual({ date: '2026-04-30', value: 1 })
      expect(result[6]).toEqual({ date: '2026-05-01', value: 0 })
    })
  })

  describe('getEvents', () => {
    it('returns events grouped by day and project in descending order', () => {
      const result = getEvents(db)

      expect(result.days).toHaveLength(3)
      expect(result.days[0].day).toBe('2026-04-30')
      expect(result.days[1].day).toBe('2026-04-29')
      expect(result.days[2].day).toBe('2026-04-28')

      // Day 3: 1 project group
      expect(result.days[0].projectGroups).toHaveLength(1)
      expect(result.days[0].projectGroups[0].project).toBe('project-b')
      expect(result.days[0].projectGroups[0].sessions).toHaveLength(1)

      // Day 2: 2 project groups
      expect(result.days[1].projectGroups).toHaveLength(2)
      const day2Projects = result.days[1].projectGroups.map(g => g.project)
      expect(day2Projects).toContain('project-a')
      expect(day2Projects).toContain('project-b')

      // Check aggregates
      const projectAGroup = result.days[1].projectGroups.find(g => g.project === 'project-a')!
      expect(projectAGroup.session_count).toBe(1)
      expect(projectAGroup.turn_count).toBe(3)
      expect(projectAGroup.token_count).toBe(150)
      expect(projectAGroup.tool_count).toBe(1)
      expect(projectAGroup.skill_count).toBe(0)

      const projectBGroup = result.days[1].projectGroups.find(g => g.project === 'project-b')!
      expect(projectBGroup.session_count).toBe(1)
      expect(projectBGroup.turn_count).toBe(8)
      expect(projectBGroup.token_count).toBe(800)
      expect(projectBGroup.tool_count).toBe(0)
      expect(projectBGroup.skill_count).toBe(2)
    })

    it('supports cursor pagination', () => {
      const page1 = getEvents(db, { limit: 1 })
      expect(page1.days).toHaveLength(1)
      expect(page1.days[0].day).toBe('2026-04-30')
      expect(page1.nextCursor).toBe('2026-04-30')

      const page2 = getEvents(db, { limit: 1, cursor: page1.nextCursor })
      expect(page2.days).toHaveLength(1)
      expect(page2.days[0].day).toBe('2026-04-29')
      expect(page2.nextCursor).toBe('2026-04-29')

      const page3 = getEvents(db, { limit: 1, cursor: page2.nextCursor })
      expect(page3.days).toHaveLength(1)
      expect(page3.days[0].day).toBe('2026-04-28')
      expect(page3.nextCursor).toBeUndefined()
    })

    it('filters by date range', () => {
      const result = getEvents(db, { from: '2026-04-28', to: '2026-04-29' })
      expect(result.days).toHaveLength(2)
      expect(result.days[0].day).toBe('2026-04-29')
      expect(result.days[1].day).toBe('2026-04-28')
    })

    it('filters by project', () => {
      const result = getEvents(db, { project: 'project-a' })
      expect(result.days).toHaveLength(2)
      for (const day of result.days) {
        for (const group of day.projectGroups) {
          expect(group.project).toBe('project-a')
        }
      }
    })
  })

  describe('getSession', () => {
    it('returns session with tools and skills', () => {
      const session = getSession(db, 's1')
      expect(session).not.toBeNull()
      expect(session!.session_id).toBe('s1')
      expect(session!.tools).toHaveLength(2)
      expect(session!.tools.map(t => t.tool_name)).toContain('Read')
      expect(session!.tools.map(t => t.tool_name)).toContain('Write')
      expect(session!.skills).toHaveLength(1)
      expect(session!.skills[0].skill_name).toBe('design-consultation')
    })

    it('returns null for missing session', () => {
      const session = getSession(db, 'nonexistent')
      expect(session).toBeNull()
    })
  })

  describe('getProjects', () => {
    it('returns distinct projects sorted', () => {
      const projects = getProjects(db)
      expect(projects).toEqual(['project-a', 'project-b'])
    })
  })

  describe('getYears', () => {
    it('returns distinct years with sessions', () => {
      const years = getYears(db)
      expect(years).toEqual([2026])
    })
  })

  describe('getStatus', () => {
    it('returns session count', () => {
      const status = getStatus(db)
      expect(status.sessionCount).toBe(4)
    })

    it('returns lastSyncAt when present', () => {
      db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('last_sync_at', ?)").run(String(1_234_567_890))
      const status = getStatus(db)
      expect(status.lastSyncAt).toBe(1_234_567_890)
    })

    it('returns undefined lastSyncAt when absent', () => {
      const status = getStatus(db)
      expect(status.lastSyncAt).toBeUndefined()
    })
  })
})
