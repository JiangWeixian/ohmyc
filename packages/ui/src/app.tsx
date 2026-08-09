// Root application component — sets up the command palette provider, setup gate,
// and global toast host. Routing/palette shell lives in app-shell.tsx; setup
// readiness gating lives in app-setup-gate.tsx.
import { Toaster } from 'sonner'

import { SetupGate } from './app-setup-gate'
import { CommandPaletteProvider } from './components/command-palette'

/** Root exported component — wraps the app in the command palette provider and toaster. */
export function App() {
  return (
    <CommandPaletteProvider>
      <SetupGate />
      <Toaster theme="dark" position="bottom-right" toastOptions={{ style: { background: 'var(--surface-overlay)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderRadius: 'var(--radius-lg)' } }} />
    </CommandPaletteProvider>
  )
}
