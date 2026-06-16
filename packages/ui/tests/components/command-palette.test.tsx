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

import {
  CommandPalette,
  CommandPaletteProvider,
  KeyboardShortcut,
  useCommandPalette,
} from '@/components/command-palette'

function OpenButton() {
  const { open, isOpen } = useCommandPalette()
  return (
    <button type="button" onClick={open}>
      {isOpen ? 'Open state' : 'Closed state'}
    </button>
  )
}

describe('CommandPalette', () => {
  it('opens with provider state, groups commands, runs an action, and closes', async () => {
    const user = userEvent.setup()
    const action = vi.fn()
    render(
      <CommandPaletteProvider>
        <OpenButton />
        <CommandPalette
          placeholder="Find anything"
          commands={[
            { id: 'agents', label: 'Open Agents', category: 'Go to', shortcut: 'g a', action },
            { id: 'settings', label: 'Open Settings', action: vi.fn() },
          ]}
        />
      </CommandPaletteProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Closed state' }))
    expect(screen.getByPlaceholderText('Find anything')).toBeInTheDocument()
    expect(screen.getByText('Go to')).toBeInTheDocument()
    expect(screen.getByText('Commands')).toBeInTheDocument()

    await user.click(screen.getByText('Open Agents'))
    expect(action).toHaveBeenCalledTimes(1)
    expect(screen.queryByPlaceholderText('Find anything')).not.toBeInTheDocument()
  })

  it('toggles from the keyboard shortcut and closes on Escape', () => {
    render(
      <CommandPaletteProvider>
        <CommandPalette commands={[{ id: 'one', label: 'One', action: vi.fn() }]} />
      </CommandPaletteProvider>,
    )

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    expect(screen.getByPlaceholderText('Search commands...')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByPlaceholderText('Search commands...')).not.toBeInTheDocument()
  })

  it('renders shortcut labels with platform glyphs', () => {
    render(<KeyboardShortcut shortcut="meta+shift+k" />)

    expect(screen.getByText('⌘')).toBeInTheDocument()
    expect(screen.getByText('⇧')).toBeInTheDocument()
    expect(screen.getByText('k')).toBeInTheDocument()
  })
})
