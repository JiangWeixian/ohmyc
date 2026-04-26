import {
  describe,
  expect,
  it,
} from 'vitest'

import { isMaskedValue, maskApiKey } from '../mask-api-key'

describe('maskApiKey', () => {
  it('masks a standard key showing last 4 chars', () => {
    expect(maskApiKey('sk-ant-api1234')).toBe('****1234')
  })

  it('returns **** for short key (< 4 chars)', () => {
    expect(maskApiKey('ab')).toBe('****')
  })

  it('returns **** for empty string', () => {
    expect(maskApiKey('')).toBe('****')
  })

  it('returns ****1234 for exactly 4 chars', () => {
    expect(maskApiKey('1234')).toBe('****1234')
  })
})

describe('isMaskedValue', () => {
  it('returns true for masked value', () => {
    expect(isMaskedValue('****1234')).toBe(true)
  })

  it('returns false for real key', () => {
    expect(isMaskedValue('real-key')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isMaskedValue('')).toBe(false)
  })
})
