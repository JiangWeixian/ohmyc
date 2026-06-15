import {
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import { REGISTERED_ORIGINS, useSources } from '@/state/sources'

describe('useSources', () => {
  beforeEach(() => {
    globalThis.localStorage.clear()
    useSources.setState({ selected: new Set(REGISTERED_ORIGINS) })
  })

  it('defaults to all registered origins', () => {
    const { selected } = useSources.getState()
    expect([...selected].toSorted()).toEqual([...REGISTERED_ORIGINS].toSorted())
  })

  it('toggle removes an origin and persists', () => {
    useSources.getState().toggle('opencode')
    expect(useSources.getState().selected.has('opencode')).toBe(false)
    expect(JSON.parse(globalThis.localStorage.getItem('ohmyc.sources')!)).toEqual(['claude'])
  })

  it('last-on guard: cannot uncheck the final origin', () => {
    useSources.setState({ selected: new Set(['claude']) })
    useSources.getState().toggle('claude')
    expect(useSources.getState().selected.has('claude')).toBe(true)
  })

  it('hydrates from localStorage on creation', () => {
    globalThis.localStorage.setItem('ohmyc.sources', JSON.stringify(['opencode']))
    useSources.getState().hydrate()
    expect([...useSources.getState().selected]).toEqual(['opencode'])
  })

  it('ignores unknown origins in stored value', () => {
    globalThis.localStorage.setItem('ohmyc.sources', JSON.stringify(['claude', 'bogus']))
    useSources.getState().hydrate()
    expect([...useSources.getState().selected]).toEqual(['claude'])
  })

  it('falls back to defaults if stored value parses to empty after filtering', () => {
    globalThis.localStorage.setItem('ohmyc.sources', JSON.stringify(['bogus']))
    useSources.getState().hydrate()
    expect([...useSources.getState().selected].toSorted()).toEqual([...REGISTERED_ORIGINS].toSorted())
  })
})
