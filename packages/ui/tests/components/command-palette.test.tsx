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

  it('uses instant motion for the high-frequency keyboard palette', () => {
    render(
      <CommandPaletteProvider>
        <CommandPalette commands={[{ id: 'one', label: 'One', action: vi.fn() }]} />
      </CommandPaletteProvider>,
    )

    fireEvent.keyDown(document, { key: 'k', metaKey: true })

    const input = screen.getByPlaceholderText('Search commands...')
    const dialog = input.closest('[data-motion-preset]')
    expect(dialog).toHaveAttribute('data-motion-preset', 'instant')
  })

  it('uses a wider responsive dialog width and truncates long command labels', () => {
    render(
      <CommandPaletteProvider>
        <CommandPalette
          commands={[
            {
              id: 'long',
              label: 'Open the very long generated command name without squeezing the shortcut column',
              shortcut: 'meta+shift+p',
              action: vi.fn(),
            },
          ]}
        />
      </CommandPaletteProvider>,
    )

    fireEvent.keyDown(document, { key: 'k', metaKey: true })

    const input = screen.getByPlaceholderText('Search commands...')
    const dialog = input.closest('[data-motion-preset]')
    expect(dialog).toHaveClass('w-[calc(100vw-32px)]')
    expect(dialog).toHaveClass('max-w-[720px]')
    expect(dialog).toHaveClass('lg:w-[720px]')

    expect(screen.getByText('Open the very long generated command name without squeezing the shortcut column')).toHaveClass('min-w-0', 'truncate')
    expect(screen.getByText('meta+shift+p')).toHaveClass('shrink-0')
  })
})
