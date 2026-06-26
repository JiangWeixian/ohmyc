// Extracted setup gate so routing logic is unit-testable without mounting
// the full toaster/provider shell from app.tsx.
import { Navigate, useLocation } from 'react-router-dom'

import { AppCommandPalette, AppLayout } from './app-shell'
import { OnboardingGate } from './components/onboarding/onboarding-gate'
import { useSetupStatus } from './hooks/use-setup-status'

const ONBOARD_PATH = '/onboard'
const READY_DEFAULT_PATH = '/explore/timeline'

function ReadyShell() {
  return (
    <>
      <AppLayout />
      <AppCommandPalette />
    </>
  )
}

/** Minimal checking state while setup readiness is loading. */
export function CheckingSetup() {
  return <div className="h-dvh overflow-hidden bg-[var(--surface-base)] text-[var(--text-primary)]" />
}

/**
 * Setup gate. Loading → checking state. Main app not ready → hidden /onboard
 * route. Ready → normal shell. /menubar is its own compact surface (gated
 * internally by MenubarPage) and bypasses this main-window gate.
 */
export function SetupGate() {
  const { data, isLoading } = useSetupStatus()
  const location = useLocation()

  if (location.pathname === '/menubar') {
    return <ReadyShell />
  }

  if (isLoading || !data) {
    return <CheckingSetup />
  }
  if (data.state !== 'ready') {
    if (location.pathname !== ONBOARD_PATH) {
      return <Navigate to={ONBOARD_PATH} replace state={{ from: location }} />
    }
    return <OnboardingGate />
  }
  if (location.pathname === ONBOARD_PATH) {
    return <Navigate to={READY_DEFAULT_PATH} replace />
  }
  return <ReadyShell />
}
