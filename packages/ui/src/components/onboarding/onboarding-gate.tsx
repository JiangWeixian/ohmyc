// Production onboarding setup gate. Renders when the monitor store is not
// ready. Reuses the spike-validated RetroComputerAtropos + LetterGlitch visuals.
//
// The primary action installs the plugin in place. The old external link stays
// as a fallback: agent detection can come back empty, and an install can fail,
// and in both cases the user still needs somewhere to go.
//
// A successful install does NOT make the store ready — the plugin creates it
// when the next session ends. So the gate switches to its own "installed, now
// go code" state rather than leaving the user staring at "Monitor not
// connected" after a click that actually worked.
import {
  CheckCircle2,
  ExternalLink,
  RotateCw,
  Terminal,
} from 'lucide-react'

import { LetterGlitch } from './letter-glitch'
import { RetroComputerAtropos } from './retro-computer-atropos'
import { onboardingStyles } from './styles'
import { Button } from '@/components/ui/button'
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'
import {
  AGENT_LABELS,
  anyInstalled,
  installableAgents,
  useDetectAgents,
  useSetupInstall,
} from '@/hooks/use-setup-install'
import { useSetupStatus } from '@/hooks/use-setup-status'
import { cn } from '@/lib/utils'

import type { AgentInstallResult } from '@/hooks/use-setup-install'
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

/** One line per agent we tried, so a partial success reads as a partial success. */
function resultLine(result: AgentInstallResult): string {
  const label = AGENT_LABELS[result.agent]
  switch (result.state) {
    case 'installed': {
      return `${label}: installed`
    }
    case 'already_installed': {
      return `${label}: already installed`
    }
    case 'not_present': {
      return `${label}: not on this machine`
    }
    case 'manual': {
      return `${label}: run this yourself`
    }
    case 'failed': {
      return `${label}: ${result.reason}`
    }
  }
}

export function OnboardingGate() {
  const { data, refetch, isFetching } = useSetupStatus()
  const agents = useDetectAgents()
  const install = useSetupInstall()
  const reduced = usePrefersReducedMotion()
  const state = data?.state ?? 'missing_store'
  const line = statusLine(state)

  const results = install.data
  const connected = anyInstalled(results)
  // Detection failing must not remove the user's way forward — it only removes
  // the shortcut, and the manual link below covers that.
  const targets = installableAgents(agents.data)
  const showInstall = targets.length > 0 && !connected

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
            <h1 className="onboard-title">
              {connected ? 'Plugin installed' : 'Monitor not connected'}
            </h1>
            <p className="onboard-body">
              {connected
                ? 'Nothing to show yet — recording starts with your next coding session. Run one, then check again.'
                : 'Install the OhMyC plugin to start collecting local AI coding activity.'}
            </p>
            {line && !connected ? <p className="onboard-status-line">{line}</p> : null}
            {install.isError
              ? (
                  <p className="onboard-status-line">
                    Install failed. Use the instructions below.
                  </p>
                )
              : null}
          </div>

          {results?.length
            ? (
                <ul className="onboard-results">
                  {results.map(result => (
                    <li className="onboard-result" key={result.agent}>
                      {result.state === 'installed' || result.state === 'already_installed'
                        ? <CheckCircle2 aria-hidden />
                        : <Terminal aria-hidden />}
                      <span>{resultLine(result)}</span>
                      {result.state === 'manual'
                        ? <code className="onboard-result-hint">{result.hint}</code>
                        : null}
                    </li>
                  ))}
                </ul>
              )
            : null}

          <div className="onboard-actions">
            {showInstall
              ? (
                  <Button
                    variant="default"
                    size="lg"
                    disabled={install.isPending}
                    onClick={() => {
                      install.mutate(targets)
                    }}
                  >
                    {install.isPending ? 'Installing…' : 'Install plugin'}
                  </Button>
                )
              : null}
            <Button
              variant={showInstall ? 'outline' : 'default'}
              size="lg"
              disabled={isFetching}
              onClick={() => {
                void refetch()
              }}
            >
              <RotateCw />
              {' '}
              Check again
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href={PLUGIN_REPO} target="_blank" rel="noreferrer">
                <ExternalLink />
                {' '}
                Open install instructions
              </a>
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
