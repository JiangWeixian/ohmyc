import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { ViewSwitch } from '@/components/menubar/view-switch'

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

  it('exposes the tokenized button class and active data attribute for styling', () => {
    render(<ViewSwitch value="line" onChange={() => {}} />)
    const lineBtn = screen.getByRole('tab', { name: /line view/i })
    const heatmapBtn = screen.getByRole('tab', { name: /heatmap view/i })
    expect(lineBtn).toHaveClass('menubar-view-button')
    expect(lineBtn).toHaveAttribute('data-active', 'true')
    expect(heatmapBtn).toHaveClass('menubar-view-button')
    expect(heatmapBtn).toHaveAttribute('data-active', 'false')
  })
})
