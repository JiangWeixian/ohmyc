import { render, screen } from '@testing-library/react'
import { Bot } from 'lucide-react'
import {
  describe,
  expect,
  it,
} from 'vitest'

import { EntityCard } from '@/components/entity-card'

describe('EntityCard', () => {
  it('renders origin chip from origins prop', () => {
    render(
      <EntityCard
        icon={Bot}
        iconAccentVar="--text-primary"
        title="reviewer"
        description="desc"
        origins={['claude', 'opencode']}
        renderBadges={[]}
        onClick={() => {}}
      />,
    )
    expect(screen.getByText('claude · opencode')).toBeInTheDocument()
  })

  it('renders provider badges verbatim', () => {
    render(
      <EntityCard
        icon={Bot}
        iconAccentVar="--text-primary"
        title="x"
        description=""
        origins={['opencode']}
        renderBadges={[{ kind: 'mono', label: 'primary' }]}
        onClick={() => {}}
      />,
    )
    expect(screen.getByText('primary')).toBeInTheDocument()
  })
})
