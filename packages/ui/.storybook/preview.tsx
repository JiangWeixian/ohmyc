/* eslint-disable import/no-default-export */

import '../src/globals.css'

import type { Preview } from '@storybook/react-vite'

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'OhMyC dark',
      values: [
        { name: 'OhMyC dark', value: '#08090a' },
        { name: 'Panel', value: '#0f1011' },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: 'centered',
    options: {
      storySort: {
        order: ['Design System', 'Product', 'Menubar', 'Test'],
      },
    },
  },
  decorators: [
    Story => (
      <div className="min-h-screen bg-[var(--bg-marketing)] p-8 font-sans text-[var(--text-primary)]">
        <Story />
      </div>
    ),
  ],
}

export default preview
