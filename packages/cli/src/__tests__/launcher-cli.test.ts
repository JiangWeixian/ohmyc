import { readFileSync } from 'node:fs'
import path from 'node:path'

import open from 'open'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { launchApp } from '../launcher'
import { startServer } from '../server/index'

// Mock the server module
vi.mock('../server/index', () => ({
  startServer: vi.fn(),
}))

// Mock the open package
vi.mock('open', () => ({
  default: vi.fn(),
}))

describe('CLI launcher', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
    errorSpy.mockRestore()
  })

  describe('default launch flow', () => {
    it('prints "starting server" status before waiting for startServer()', async () => {
      const startServerMock = vi.mocked(startServer)
      const openMock = vi.mocked(open)

      let startServerCalled = false
      startServerMock.mockImplementation(async () => {
        startServerCalled = true
        return {
          port: 3000,
          address: 'http://0.0.0.0:3000',
          staticRoot: '/fake/ui',
          fallback: false,
          close: async () => {},
        }
      })
      openMock.mockResolvedValue({} as any)

      await launchApp({ defaultPort: 3000 })

      // The "starting" message must be logged before startServer resolves
      expect(startServerCalled).toBe(true)

      // Check that a "starting" status was logged
      const logCalls = logSpy.mock.calls.map((arguments_: any[]) => arguments_.join(' '))
      const hasStartingMessage = logCalls.some(message =>
        /starting/i.test(message) && /server/i.test(message),
      )
      expect(hasStartingMessage).toBe(true)
    })

    it('prints "opening browser" status and calls browser opener with the resolved URL', async () => {
      const startServerMock = vi.mocked(startServer)
      const openMock = vi.mocked(open)

      startServerMock.mockResolvedValue({
        port: 3000,
        address: 'http://0.0.0.0:3000',
        staticRoot: '/fake/ui',
        fallback: false,
        close: async () => {},
      })
      openMock.mockResolvedValue({} as any)

      await launchApp({ defaultPort: 3000 })

      // Verify browser opener was called with the correct URL
      expect(openMock).toHaveBeenCalledTimes(1)
      expect(openMock).toHaveBeenCalledWith('http://localhost:3000')

      // Verify "opening browser" status was logged
      const logCalls = logSpy.mock.calls.map((arguments_: any[]) => arguments_.join(' '))
      const hasOpeningMessage = logCalls.some(message =>
        /opening|browser/i.test(message),
      )
      expect(hasOpeningMessage).toBe(true)
    })

    it('opens browser to fallback port when startServer reports fallback', async () => {
      const startServerMock = vi.mocked(startServer)
      const openMock = vi.mocked(open)

      startServerMock.mockResolvedValue({
        port: 3001,
        address: 'http://0.0.0.0:3001',
        staticRoot: '/fake/ui',
        fallback: true,
        close: async () => {},
      })
      openMock.mockResolvedValue({} as any)

      await launchApp({ defaultPort: 3000 })

      // Browser should open to the actual port, not the requested one
      expect(openMock).toHaveBeenCalledWith('http://localhost:3001')

      // Status output should reflect success (not failure)
      const logCalls = logSpy.mock.calls.map((arguments_: any[]) => arguments_.join(' '))
      const hasSuccessMessage = logCalls.some(message =>
        /ready|listening|started/i.test(message),
      )
      expect(hasSuccessMessage).toBe(true)
    })

    it('throws an actionable error when startup fails', async () => {
      const startServerMock = vi.mocked(startServer)
      const openMock = vi.mocked(open)

      startServerMock.mockRejectedValue(new Error('Port 3000 is in use'))

      await expect(launchApp({ defaultPort: 3000 })).rejects.toThrow(
        /failed to start claudeui/i,
      )

      // Browser opener should NOT have been called
      expect(openMock).not.toHaveBeenCalled()
    })
  })

  describe('package metadata', () => {
    it('exposes a "cui" bin entry that resolves to the launcher entrypoint', () => {
      const packagePath = path.resolve(import.meta.dirname, '../../package.json')
      const package_ = JSON.parse(readFileSync(packagePath, 'utf8'))

      expect(package_.bin).toBeDefined()
      expect(package_.bin.cui).toBeDefined()
      expect(package_.bin.cui).toMatch(/^dist\//)
    })
  })
})
