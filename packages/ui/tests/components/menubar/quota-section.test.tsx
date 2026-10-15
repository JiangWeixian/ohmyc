import { screen, waitFor } from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import { renderWithProviders } from '../../test/render-with-providers'
import { MenubarQuotaSection } from '@/components/menubar/quota-section'
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
