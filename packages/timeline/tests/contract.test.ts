// Slice-2 contract test (TS side). Mirrors crates/ohmyc-core/tests/timeline_contract.rs:
// both impls must produce identical JSON after the comparable-projection step.
// See tests/fixtures/timeline-contract/README.md.

import { readFileSync } from 'node:fs'
import path from 'node:path'

import Database from 'better-sqlite3'
import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  getEvents,
  getHeatmap,
  getProjects,
  getStatus,
  getYears,
} from '../src/query.js'

const fixturesDir = path.resolve(import.meta.dirname, '../../../tests/fixtures/timeline-contract')

function loadSeedDb() {
  const db = new Database(':memory:')
  const sql = readFileSync(path.resolve(fixturesDir, 'seed.sql'), 'utf8')
  db.exec(sql)
  return db
}

function expected(name: string) {
  return JSON.parse(readFileSync(path.resolve(fixturesDir, 'expected', name), 'utf8'))
}

describe('timeline contract (TS side)', () => {
  it('heatmap tokens matches fixture', () => {
    const db = loadSeedDb()
    const data = getHeatmap(db, {
      from: '2026-01-01', to: '2026-01-03', metric: 'tokens',
    })
    expect({ data }).toEqual(expected('heatmap-tokens.json'))
    db.close()
  })

  it('years matches fixture', () => {
    const db = loadSeedDb()
    expect({ years: getYears(db) }).toEqual(expected('years.json'))
    db.close()
  })

  it('projects matches fixture', () => {
    const db = loadSeedDb()
    expect({ projects: getProjects(db) }).toEqual(expected('projects.json'))
    db.close()
  })

  it('status matches fixture', () => {
    const db = loadSeedDb()
    const s = getStatus(db)
    expect({ sessionCount: s.sessionCount, lastSyncAt: s.lastSyncAt }).toEqual(
      expected('status.json'),
    )
    db.close()
  })

  it('events aggregates match fixture', () => {
    const db = loadSeedDb()
    const result = getEvents(db, {})
    const days = result.days.map(d => ({
      day: d.day,
      projectGroups: d.projectGroups.map(g => ({
        project: g.project,
        sessionCount: g.session_count,
        turnCount: g.turn_count,
        tokenCount: g.token_count,
        toolCount: g.tool_count,
        skillCount: g.skill_count,
        agents: g.agents,
      })),
      sessionCount: d.session_count,
      turnCount: d.turn_count,
      tokenCount: d.token_count,
    }))
    expect({ days }).toEqual(expected('events-page1.json'))
    db.close()
  })
})
