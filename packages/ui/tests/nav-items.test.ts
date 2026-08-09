import {
  describe,
  expect,
  it,
} from 'vitest'

import { NAV_ITEMS, type NavItem } from '@/components/nav-items'

describe('NAV_ITEMS', () => {
  it('exports exactly the six first-class explorer destinations', () => {
    const ids = NAV_ITEMS.map(item => item.id)
    expect(ids).toEqual(['monitor', 'timeline', 'agents', 'commands', 'skills', 'plugins'])
  })

  it('maps each id to a /explore/<id> path', () => {
    for (const item of NAV_ITEMS) {
      expect(item.path).toBe(`/explore/${item.id}`)
    }
  })

  it('gives every item a single-letter keycap and a non-empty label', () => {
    for (const item of NAV_ITEMS) {
      expect(item.keycap).toMatch(/^[A-Z]$/)
      expect(item.label.length).toBeGreaterThan(0)
    }
  })

  it('uses a distinct keycap per item', () => {
    const keycaps = NAV_ITEMS.map(item => item.keycap)
    expect(new Set(keycaps).size).toBe(keycaps.length)
  })

  it('attaches a lucide icon component to every item', () => {
    for (const item of NAV_ITEMS) {
      expect(typeof item.icon).toBe('object')
    }
  })

  it('satisfies the NavItem type for every entry', () => {
    for (const item of NAV_ITEMS) {
      const _check: NavItem = item
      expect(_check).toBeDefined()
    }
  })
})
