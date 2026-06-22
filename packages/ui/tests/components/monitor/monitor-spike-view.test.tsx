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
import { MonitorSpikeView } from '@/components/monitor-spike/monitor-spike-view'
import { __setTransportForTests, resetTransportForTests } from '@/lib/transport'
import { resetMock, setMockHandler } from '@/lib/transport/mock'

const backdropSpy = vi.hoisted(() => vi.fn())

vi.mock('@/components/monitor-spike/computer-backdrop', () => ({
  ComputerBackdrop: (props: { stats: { sessions: string; tokens: string; turns: string } }) => {
    backdropSpy(props)
    return <div data-testid="computer-backdrop">{JSON.stringify(props.stats)}</div>
  },
}))

beforeEach(() => {
  __setTransportForTests('mock')
  vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 5, 20, 12, 0, 0))
  backdropSpy.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
  resetMock()
  resetTransportForTests()
})

describe('MonitorSpikeView', () => {
  it('renders the WebGL scene stats from timeline data instead of spike constants', async () => {
    setMockHandler('timeline.status', async () => ({
      sessionCount: 842,
      lastSyncAt: Date.UTC(2026, 5, 20, 11, 57, 0),
    }))
    setMockHandler('timeline.events', async () => ({
      days: [
        { day: '2026-06-20', session_count: 4, turn_count: 18, token_count: 123_456, project_groups: [] },
      ],
    }))

    renderWithProviders(<MonitorSpikeView />)

    await waitFor(() => {
      expect(backdropSpy).toHaveBeenLastCalledWith({
        stats: {
          sessions: '4',
          tokens: '123.5k',
          turns: '18',
        },
      })
    })

    expect(screen.getByText('Personal Coding Monitor')).toBeInTheDocument()
    expect(screen.getByText('sessions').nextSibling?.textContent).toBe('4')
    expect(screen.getByText('tokens').nextSibling?.textContent).toBe('123.5k')
    expect(screen.getByText('turns').nextSibling?.textContent).toBe('18')
    expect(screen.getByTestId('computer-backdrop')).not.toHaveTextContent('18.4M')
  })
})
