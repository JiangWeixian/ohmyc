// Production onboarding setup gate. Renders when the monitor store is not
// ready. Reuses the spike-validated RetroComputerAtropos + LetterGlitch visuals.
// Copy + actions follow the spec; Retry refetches useSetupStatus (installs nothing).
import { ExternalLink, RotateCw } from 'lucide-react'

import { LetterGlitch } from './letter-glitch'
import { RetroComputerAtropos } from './retro-computer-atropos'
import { onboardingStyles } from './styles'
import { Button } from '@/components/ui/button'
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'
import { useSetupStatus } from '@/hooks/use-setup-status'
import { cn } from '@/lib/utils'

import type { SetupStatus } from '@/hooks/use-setup-status'

const PLUGIN_REPO = 'https://github.com/JiangWeixian/ohmyc-plugins'

/** Extra status line for non-missing states (spec: unreadable / internal_error). */
function statusLine(state: SetupStatus['state']): string | null {
  switch (state) {
    case 'unreadable_store': {
      return 'Local monitor store exists but could not be opened.'
    }
    case 'internal_error': {
      return 'OhMyC could not confirm the monitor connection. Install the plugin, then check again.'
    }
    default: {
      return null
    }
  }
}

export function OnboardingGate() {
  const { data, refetch, isFetching } = useSetupStatus()
  const reduced = usePrefersReducedMotion()
  const state = data?.state ?? 'missing_store'
  const line = statusLine(state)

  return (
    <>
      <style>{onboardingStyles}</style>
      <section className={cn('onboarding-spike')}>
        {/* Ambient letter-glitch field — bottom layer, never intercepts pointer. */}
        <div className="onboard-letter-field" aria-hidden>
          <LetterGlitch disabled={reduced} glitchSpeed={140} />
        </div>

        <RetroComputerAtropos className="retro-computer-atropos" inactive={reduced} />

        <div className="onboard-text">
          <div className="onboard-copy">
            <h1 className="onboard-title">Monitor not connected</h1>
            <p className="onboard-body">
              Install the OhMyC plugin to start collecting local AI coding activity.
            </p>
            {line ? <p className="onboard-status-line">{line}</p> : null}
          </div>

          <div className="onboard-actions">
            <Button asChild variant="default" size="lg">
              <a href={PLUGIN_REPO} target="_blank" rel="noreferrer">
                <ExternalLink /> Open install instructions
              </a>
            </Button>
            <Button
              variant="outline"
              size="lg"
              disabled={isFetching}
              onClick={() => {
                void refetch()
              }}
            >
              <RotateCw /> Check again
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
