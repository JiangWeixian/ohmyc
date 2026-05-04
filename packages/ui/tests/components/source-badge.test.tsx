import { screen } from '@testing-library/react'
import React from 'react'
import {
  describe,
  expect,
  it,
} from 'vitest'

import { renderWithProviders } from '../test/render-with-providers'
import { SourceBadge } from '@/components/source-badge'

describe('SourceBadge', () => {
  it('renders a local source label', () => {
    renderWithProviders(<SourceBadge source="local" />)

    expect(screen.getByText('local')).toBeInTheDocument()
  })

  it('renders a profile source label', () => {
    renderWithProviders(<SourceBadge source="profile" />)

    expect(screen.getByText('profile')).toBeInTheDocument()
  })

  it('renders plugin-provided rows as plugin items with plugin context', () => {
    renderWithProviders(<SourceBadge source="plugin" pluginId="review-pack@marketplace" />)

    expect(screen.getByText('plugin')).toBeInTheDocument()
    expect(screen.getByText('review-pack')).toBeInTheDocument()
  })

  it('renders a project source label with green styling', () => {
    renderWithProviders(<SourceBadge source="project" />)

    const badge = screen.getByText('project')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('[var(--accent-green)]/10')
    expect(badge.className).toContain('text-[var(--accent-green)]')
    expect(badge.className).toContain('uppercase')
  })

  it('does not render pluginId sub-label for project variant', () => {
    renderWithProviders(<SourceBadge source="project" />)

    expect(screen.queryByText(/@/)).not.toBeInTheDocument()
  })
})
