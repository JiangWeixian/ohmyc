import {
  describe,
  expect,
  it,
} from 'vitest'

import { formatTokens } from '../src/components/menubar/format-tokens'

describe('menu bar token units', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1000, '1K'],
    [128_400, '128.4K'],
    [999_999, '1M'],
    [4_487_865, '4.5M'],
    [999_999_999, '1B'],
    [2_722_942_212, '2.7B'],
    [999_999_999_999, '1T'],
    [1_250_000_000_000, '1.3T'],
  ])('formats %i as %s', (value, expected) => {
    expect(formatTokens(value)).toBe(expected)
  })
})
