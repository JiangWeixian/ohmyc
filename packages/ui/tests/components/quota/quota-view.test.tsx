import { screen, waitFor } from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import { renderWithProviders } from '../../test/render-with-providers'
import { QuotaView } from '@/components/quota/quota-view'
import { __setTransportForTests } from '@/lib/transport'
import { resetMock, setMockHandler } from '@/lib/transport/mock'
import { quotaSnapshots, quotaSnapshotsLoggedOut } from '@/stories/fixtures/quota'

describe('QuotaView', () => {
  beforeEach(() => {
    __setTransportForTests('mock')
  })
  afterEach(() => {
    resetMock()
  })

  it('renders a card per provider with windows, meters, and states', async () => {
    setMockHandler('quota.list', async () => quotaSnapshots())
    renderWithProviders(<QuotaView />)

    await waitFor(() => expect(screen.getByText('OpenCode Go')).toBeInTheDocument())
    expect(screen.getByText('Claude')).toBeInTheDocument()
    expect(screen.getByText('Codex')).toBeInTheDocument()

    // ok cards: window rows (percentage + countdown), meters with currency.
    expect(screen.getByText('92%')).toBeInTheDocument()
    expect(screen.getByText('$766.76')).toBeInTheDocument()
    expect(screen.getByText('¥48.50')).toBeInTheDocument()

    // state cards: token expired + not logged in recovery hints.
    expect(screen.getByText('Credentials expired')).toBeInTheDocument()
    expect(screen.getByText('No credentials found')).toBeInTheDocument()
    expect(screen.getByText('grok')).toBeInTheDocument()
    expect(screen.getByText('gemini')).toBeInTheDocument()

    // provenance markers render only on ok cards: one official (OpenCode Go),
    // the other five healthy providers experimental; state cards show badges.
    expect(screen.getByText('official')).toBeInTheDocument()
    expect(screen.getAllByText('experimental')).toHaveLength(5)

    // header meta + legend.
    expect(screen.getByText(/updated .*· every 5 min/)).toBeInTheDocument()
    expect(screen.getByText('pace = time elapsed')).toBeInTheDocument()

    // pressure band: big number = avg, bar caption = peak with its owner.
    // Fixture maxima: GLM 98, Kimi 41, Cursor 53, Codex 92, Claude 61,
    // OpenCode 4 → avg ≈ 57.8, peak 98 @ GLM.
    expect(screen.getByText('58%')).toBeInTheDocument()
    expect(screen.getByText(/avg across \d+ CLIs/)).toBeInTheDocument()
    expect(screen.getByText(/peak 98% · GLM WEEK/)).toBeInTheDocument()
  })

  it('shows the empty-state note when every provider is logged out', async () => {
    setMockHandler('quota.list', async () => quotaSnapshotsLoggedOut())
    renderWithProviders(<QuotaView />)

    await waitFor(() => expect(screen.getByText(/sign in to a CLI to see its quota/)).toBeInTheDocument())
    expect(screen.getAllByText('not logged in')).toHaveLength(8)
  })

  it('quota.refresh re-fetches and replaces the snapshots', async () => {
    let served = quotaSnapshotsLoggedOut()
    setMockHandler('quota.list', async () => served)
    setMockHandler('quota.refresh', async () => {
      served = quotaSnapshots()
      return served
    })
    renderWithProviders(<QuotaView />)

    await waitFor(() => expect(screen.getAllByText('not logged in')).toHaveLength(8))
    screen.getByRole('button', { name: /refresh/i }).click()
    await waitFor(() => expect(screen.getByText('OpenCode Go')).toBeInTheDocument())
  })

  it('surfaces a failed refresh in the banner instead of swallowing it', async () => {
    setMockHandler('quota.list', async () => quotaSnapshots())
    setMockHandler('quota.refresh', async () => {
      throw new Error('boom')
    })
    renderWithProviders(<QuotaView />)

    await waitFor(() => expect(screen.getByText('OpenCode Go')).toBeInTheDocument())
    screen.getByRole('button', { name: /refresh/i }).click()
    await waitFor(() => expect(screen.getByText(/Couldn’t load quota snapshots/)).toBeInTheDocument())
    // A later successful refresh clears the banner again.
    setMockHandler('quota.refresh', async () => quotaSnapshots())
    screen.getByRole('button', { name: /refresh/i }).click()
    await waitFor(() => expect(screen.queryByText(/Couldn’t load quota snapshots/)).not.toBeInTheDocument())
  })
})
