import path from 'node:path'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { getBanner, printBanner } from '@/banner'

let logSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  logSpy.mockRestore()
})

describe('banner', () => {
  describe('getBanner', () => {
    it('returns the OhMyC ASCII wordmark', () => {
      const banner = getBanner()
      expect(banner).toContain('OhMyC')
      expect(banner).toContain('___')
      expect(banner).toContain('/ _ \\')
    })

    it('includes the version from package.json', () => {
      const banner = getBanner()
      expect(banner).toMatch(/v\d+\.\d+\.\d+/)
    })

    it('has exactly 7 lines (5 wordmark + 1 blank + 1 tagline)', () => {
      const banner = getBanner()
      const lines = banner.split('\n')
      expect(lines.length).toBe(7)
    })
  })

  describe('printBanner', () => {
    it('prints the banner when stdout is a TTY', () => {
      const originalIsTTY = process.stdout.isTTY
      Object.defineProperty(process.stdout, 'isTTY', { value: true, writable: true })

      try {
        printBanner()

        expect(logSpy).toHaveBeenCalledTimes(1)
        const printed = logSpy.mock.calls[0][0] as string
        expect(printed).toContain('OhMyC')
      } finally {
        Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, writable: true })
      }
    })

    it('does not print when stdout is not a TTY', () => {
      const originalIsTTY = process.stdout.isTTY
      Object.defineProperty(process.stdout, 'isTTY', { value: false, writable: true })

      try {
        printBanner()

        expect(logSpy).not.toHaveBeenCalled()
      } finally {
        Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, writable: true })
      }
    })
  })
})

describe('CLI integration', () => {
  it('prints banner on startup when TTY is available', async () => {
    const originalIsTTY = process.stdout.isTTY
    Object.defineProperty(process.stdout, 'isTTY', { value: true, writable: true })

    // Clear module cache to re-run module-level code
    const modulePath = path.resolve(import.meta.dirname, '../src/index.ts')
    vi.resetModules()

    await import(modulePath)

    // Banner should have been printed
    expect(logSpy).toHaveBeenCalled()
    const calls = logSpy.mock.calls.map((args: any[]) => args.join(' '))
    const hasBanner = calls.some((msg: string) => msg.includes('OhMyC'))
    expect(hasBanner).toBe(true)

    Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, writable: true })
  })
})
