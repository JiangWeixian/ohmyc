import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { ViewSwitch } from './view-switch'

describe('ViewSwitch', () => {
  it('renders both view buttons', () => {
    render(<ViewSwitch value="line" onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: /line view/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /heatmap view/i })).toBeInTheDocument()
  })

  it('marks the active button with aria-pressed=true', () => {
    render(<ViewSwitch value="line" onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: /line view/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('tab', { name: /heatmap view/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onChange with "heatmap" when the heatmap button is clicked', async () => {
    const onChange = vi.fn()
    render(<ViewSwitch value="line" onChange={onChange} />)
    await userEvent.click(screen.getByRole('tab', { name: /heatmap view/i }))
    expect(onChange).toHaveBeenCalledWith('heatmap')
  })

  it('calls onChange with "line" when the line button is clicked', async () => {
    const onChange = vi.fn()
    render(<ViewSwitch value="heatmap" onChange={onChange} />)
    await userEvent.click(screen.getByRole('tab', { name: /line view/i }))
    expect(onChange).toHaveBeenCalledWith('line')
  })

  it('applies secondary color to inactive button on hover', () => {
    render(<ViewSwitch value="line" onChange={() => {}} />)
    const heatmapBtn = screen.getByRole('tab', { name: /heatmap view/i })
    fireEvent.mouseEnter(heatmapBtn)
    expect(heatmapBtn).toHaveStyle({ color: 'var(--text-secondary)' })
  })
})
