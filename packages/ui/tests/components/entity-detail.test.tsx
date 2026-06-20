import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react'
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { EntityDetail } from '@/components/entity-detail'

describe('EntityDetail', () => {
  it('renders a motion handoff surface with content and back action', () => {
    const onBack = vi.fn()

    render(
      <EntityDetail
        title="agents"
        name="reviewer"
        description="Reviews changes"
        content="# Notes\n\nUse carefully."
        meta={[{ label: 'scope', value: 'global' }]}
        onBack={onBack}
      />,
    )

    expect(screen.getByTestId('entity-detail-motion')).toHaveAttribute('data-motion-role', 'entity-detail')
    expect(screen.getByRole('heading', { name: 'reviewer' })).toBeInTheDocument()
    expect(screen.getByText('Reviews changes')).toBeInTheDocument()
    expect(screen.getByText('scope')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Back to agents/ }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
