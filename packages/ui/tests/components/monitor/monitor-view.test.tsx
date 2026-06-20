import { screen, waitFor } from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { renderWithProviders } from '../../test/render-with-providers'
import { MonitorView } from '@/components/monitor/monitor-view'
import { __setTransportForTests, resetTransportForTests } from '@/lib/transport'
import { resetMock, setMockHandler } from '@/lib/transport/mock'

beforeEach(() => {
  __setTransportForTests('mock')
  Object.defineProperty(globalThis, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  resetMock()
  resetTransportForTests()
})

describe('MonitorView', () => {
  it('renders display stats from one timeline events window plus status sync time', async () => {
    const now = Date.now()
    setMockHandler('timeline.status', async () => ({ sessionCount: 842, lastSyncAt: now - 180_000 }))
    setMockHandler('timeline.events', async () => ({
      days: [
        { day: '2026-06-17', session_count: 2, turn_count: 10, token_count: 18_400_000, project_groups: [] },
      ],
    }))

    const { container } = renderWithProviders(<MonitorView />)

    await waitFor(() => {
      expect(container.textContent).toContain('Coding Monitor')
      expect(container.textContent).toContain('sessions')
      expect(container.textContent).toContain('tokens')
      expect(container.textContent).toContain('last sync')
      expect(container.textContent).toContain('latest timeline window')
      expect(container.textContent).toContain('2')
      expect(container.textContent).toContain('18.4M')
      expect(container.textContent).toContain('3m')
    })
  })

  it('keeps the identity surface usable when timeline has no sessions', async () => {
    setMockHandler('timeline.status', async () => ({ sessionCount: 0, lastSyncAt: null }))
    setMockHandler('timeline.events', async () => ({ days: [] }))

    renderWithProviders(<MonitorView />)

    expect(await screen.findByText('Run a Claude Code session and your activity will appear here.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Coding Monitor' })).toBeInTheDocument()
    expect(screen.getByText('never')).toBeInTheDocument()
  })

  it('shows a quiet status message when timeline data is unavailable', async () => {
    setMockHandler('timeline.status', async () => {
      throw new Error('timeline unavailable')
    })
    setMockHandler('timeline.events', async () => ({ days: [] }))

    renderWithProviders(<MonitorView />)

    expect(
      await screen.findByText('Timeline signal unavailable. Monitor will update after the next successful sync.'),
    ).toBeInTheDocument()
  })

  it('renders final stat values when reduced motion is requested', async () => {
    const now = Date.now()
    setMockHandler('timeline.status', async () => ({ sessionCount: 3, lastSyncAt: now }))
    setMockHandler('timeline.events', async () => ({
      days: [
        { day: '2026-06-19', session_count: 3, turn_count: 12, token_count: 42_000, project_groups: [] },
      ],
    }))

    renderWithProviders(<MonitorView />)

    expect(await screen.findByText('42.0k')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})
