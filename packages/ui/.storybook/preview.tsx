import '../src/globals.css'
import '@fontsource/chakra-petch'
import '@fontsource/ibm-plex-mono'
import '@fontsource/inter'
import '@fontsource/jetbrains-mono'
import '@fontsource/press-start-2p'
import '@fontsource/rajdhani'
import '@fontsource/share-tech-mono'
import '@fontsource/silkscreen'
import '@fontsource/vt323'

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
    (Story, context) => {
      const theme = context.globals.theme
      const intensity = context.globals.intensity
      document.documentElement.dataset.theme = theme
      document.documentElement.dataset.intensity = intensity

      return (
        <div
          data-theme={theme}
          data-intensity={intensity}
          className="min-h-screen bg-[var(--bg-marketing)] p-8 text-[var(--text-primary)]"
          style={{ fontFamily: 'var(--font-body)' }}
        >
        <Story />
        </div>
      )
    },
  ],
}

export default preview
