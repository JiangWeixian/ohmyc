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
  globalTypes: {
    theme: {
      name: 'Theme',
      defaultValue: 'phosphor',
      toolbar: {
        icon: 'paintbrush',
        items: [
          { value: 'monitor', title: 'Monitor' },
          { value: 'phosphor', title: 'Phosphor Mono' },
          { value: 'amber', title: 'Amber CRT' },
          { value: 'retro', title: 'Retro Wave' },
          { value: 'cyberpunk', title: 'Cyberpunk' },
        ],
      },
    },
    intensity: {
      name: 'Intensity',
      defaultValue: 'expressive',
      toolbar: {
        icon: 'photo',
        items: [
          { value: 'calm', title: 'Calm' },
          { value: 'expressive', title: 'Expressive' },
        ],
      },
    },
  },
  decorators: [
    (Story, context) => (
      <div
        data-theme={context.globals.theme}
        data-intensity={context.globals.intensity}
        className="min-h-screen bg-[var(--bg-marketing)] p-8 text-[var(--text-primary)]"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        <Story />
      </div>
    ),
  ],
}

export default preview
