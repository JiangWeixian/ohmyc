import { fireEvent, within } from 'storybook/test'

import { CommandPalette, CommandPaletteProvider } from '@/components/command-palette'
import { commandPaletteCommands } from '@/stories/fixtures/commands'

import type { CommandItem } from '@/components/command-palette'
import type { Meta, StoryObj } from '@storybook/react-vite'

function OpenPalette({ commands = commandPaletteCommands }: { commands?: CommandItem[] }) {
  return (
    <CommandPaletteProvider>
      <button type="button" className="sr-only" data-testid="open-command-palette">
        Open command palette
      </button>
      <CommandPalette commands={commands} />
    </CommandPaletteProvider>
  )
}

const meta = {
  title: 'Product/CommandPalette',
  component: CommandPalette,
  tags: ['test', 'autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CommandPalette>

export default meta

type Story = StoryObj<typeof meta>

export const OpenWithCommands: Story = {
  args: {
    commands: commandPaletteCommands,
  },
  render: ({ commands }) => <OpenPalette commands={commands} />,
  play: async ({ canvasElement }) => {
    fireEvent.keyDown(canvasElement.ownerDocument, { key: 'k', metaKey: true })
    await within(canvasElement.ownerDocument.body).findByPlaceholderText('Search commands...')
  },
}

export const Empty: Story = {
  args: {
    commands: [],
  },
  render: ({ commands }) => <OpenPalette commands={commands} />,
  play: async ({ canvasElement }) => {
    fireEvent.keyDown(canvasElement.ownerDocument, { key: 'k', metaKey: true })
    await within(canvasElement.ownerDocument.body).findByText('No matching actions or resources')
  },
}
