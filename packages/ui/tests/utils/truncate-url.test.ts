import {
  describe,
  expect,
  it,
} from 'vitest'

import { truncateUrl } from '@/utils/truncate-url'

describe('truncateUrl', () => {
  it('returns short strings unchanged', () => {
    expect(truncateUrl('https://example.com/docs')).toBe('https://example.com/docs')
  })

  it('keeps the first and last slices for long strings', () => {
    expect(truncateUrl('https://example.com/some/really/long/path/to/resource')).toBe(
      'https://example.com/...ath/to/resource',
    )
  })

  it('uses the provided maximum length as the cutoff', () => {
    expect(truncateUrl('abcdefghijklmnopqrstuvwxyz0123456789', 10)).toBe(
      'abcdefghijklmnopqrst...vwxyz0123456789',
    )
  })
})
