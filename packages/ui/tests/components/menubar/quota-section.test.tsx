import {
  fireEvent,
  screen,
  waitFor,
} from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import { renderWithProviders } from '../../test/render-with-providers'
import { MenubarQuotaFocus, MenubarQuotaSection } from '@/components/menubar/quota-section'
import { __setTransportForTests } from '@/lib/transport'
import { resetMock, setMockHandler } from '@/lib/transport/mock'
import {
  quotaSnapshots,
  quotaSnapshotsLoggedOut,
  quotaSnapshotsStale,
} from '@/stories/fixtures/quota'

describe('MenubarQuotaSection', () => {
  beforeEach(() => {
    __setTransportForTests('mock')
  })
  afterEach(() => {
    resetMock()
  })

  it('labels each provider block with its name and window rows', async () => {
    setMockHandler('quota.list', async () => quotaSnapshots())
    renderWithProviders(<MenubarQuotaSection nowMs={Date.now()} />)

    // Top-3 by constraint: GLM 98% week, Codex 92% 5h, Claude 61% week.
    await waitFor(() => expect(screen.getByText('GLM')).toBeInTheDocument())
    expect(screen.getByText('Codex')).toBeInTheDocument()
    expect(screen.getByText('Claude')).toBeInTheDocument()
    // Claude's sonnet weekly is model-specific — never enters the popover.
    expect(screen.queryByText('sonnet')).not.toBeInTheDocument()
    // The remaining displayable providers collapse into a count row.
    expect(screen.getByText(/\+ \d+ more/)).toBeInTheDocument()
    // Pressure strips above the list: label left, percentage + meta at the
    // bar's right end.
    expect(screen.getByText('avg')).toBeInTheDocument()
    expect(screen.getByText('peak')).toBeInTheDocument()
    expect(screen.getByText(/6 CLIs/)).toBeInTheDocument()
    expect(screen.getByText(/GLM WK · /)).toBeInTheDocument()
  })

  it('renders nothing when no provider has displayable data', async () => {
    setMockHandler('quota.list', async () => quotaSnapshotsLoggedOut())
    const { container } = renderWithProviders(<MenubarQuotaSection nowMs={Date.now()} />)

    await waitFor(() => expect(container.querySelector('.menubar-title')).toBeNull())
  })

  it('keeps stale-carrying providers dimmed instead of hiding them', async () => {
    setMockHandler('quota.list', async () => quotaSnapshotsStale())
    renderWithProviders(<MenubarQuotaSection nowMs={Date.now()} />)

    await waitFor(() => expect(screen.getByText('Kimi')).toBeInTheDocument())
    // The whole block dims to mark the data as stale, bars still readable.
    expect(screen.getByText('Kimi').closest('div.opacity-50')).not.toBeNull()
    expect(screen.getByText('41%')).toBeInTheDocument()
  })
})

describe('MenubarQuotaFocus', () => {
  beforeEach(() => {
    __setTransportForTests('mock')
  })
  afterEach(() => {
    resetMock()
  })

  it('renders four providers in constraint order with a keyboard-scrollable region', async () => {
    setMockHandler('quota.list', async () => quotaSnapshots())
    renderWithProviders(<MenubarQuotaFocus nowMs={Date.now()} />)

    const region = await screen.findByRole('region', { name: 'Quota providers, scrollable' })
    const providers = [...region.querySelectorAll('[data-quota-provider]')].map(el => el.dataset.quotaProvider)
    expect(providers).toEqual(['glm', 'codex', 'claude', 'cursor'])
    expect(screen.getByText(/\+ 2 more/)).toBeInTheDocument()
    expect(region).toHaveAttribute('tabindex', '0')
    region.focus()
    fireEvent.keyDown(region, { key: 'PageDown' })
    expect(region.scrollTop).toBeGreaterThan(0)
  })

  it('shows a labeled loading state', async () => {
    setMockHandler('quota.list', async () => new Promise(() => {}))
    renderWithProviders(<MenubarQuotaFocus nowMs={Date.now()} />)
    expect(await screen.findByText('Loading quota…')).toBeInTheDocument()
  })

  it('shows an empty state when no provider has displayable data', async () => {
    setMockHandler('quota.list', async () => quotaSnapshotsLoggedOut())
    renderWithProviders(<MenubarQuotaFocus nowMs={Date.now()} />)
    expect(await screen.findByText('No quota data yet')).toBeInTheDocument()
  })

  it('shows an error state when the request fails without stale data', async () => {
    setMockHandler('quota.list', async () => {
      throw new Error('network unavailable')
    })
    renderWithProviders(<MenubarQuotaFocus nowMs={Date.now()} />)
    expect(await screen.findByText('Quota unavailable')).toBeInTheDocument()
  })

  it('renders peak and an unknown average independently', async () => {
    const claude = quotaSnapshots()[0]
    setMockHandler('quota.list', async () => [{ ...claude, windows: claude.windows.slice(0, 1) }])
    renderWithProviders(<MenubarQuotaFocus nowMs={Date.now()} />)

    expect(await screen.findByTestId('quota-avg')).toHaveTextContent('—')
    expect(screen.getByTestId('quota-peak')).toHaveTextContent('34%')
  })
})
