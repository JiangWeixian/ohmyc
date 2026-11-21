import { render } from '@testing-library/react'
import {
  describe,
  expect,
  it,
} from 'vitest'

import { AgentGlyph } from '@/components/agent-glyph'

describe('AgentGlyph', () => {
  it.each(['grok', 'kimi', 'zcode'])('renders a glyph for %s sessions', (name) => {
    const { container } = render(<AgentGlyph name={name} />)

    expect(container.querySelector('svg')).not.toBeNull()
  })
})
