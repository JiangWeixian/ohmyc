// Compact menubar onboarding state — a shrunk version of the full OnboardingGate
// (mini RetroComputerAtropos, no LetterGlitch/gradients, highlight off) reflowed
// vertically into the 360px popover. Shown by MenubarPage when setup is not ready.
import { ExternalLink } from 'lucide-react'

import { menubarOnboardStyles, menubarPopoverStyles } from './styles'
import { RetroComputerAtropos } from '@/components/onboarding/retro-computer-atropos'
import { Button } from '@/components/ui/button'
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'

const PLUGIN_REPO = 'https://github.com/JiangWeixian/ohmyc-plugins'

export interface MenubarOnboardProps {
  /** Optional unreadable/internal status line under the body. */
  statusLine?: string
}

export function MenubarOnboard({ statusLine }: MenubarOnboardProps) {
  const reduced = usePrefersReducedMotion()

  return (
    <>
      <style>{menubarPopoverStyles + menubarOnboardStyles}</style>
      <div className="relative mx-auto w-full max-w-sm overflow-hidden px-5 py-[18px] text-[var(--text-primary)] menubar-popover" data-menubar-page>
        <span className="menubar-popover-corner" aria-hidden="true" />
        <div className="relative z-[1] menubar-content">
          <header className="mb-2 flex items-center justify-between gap-3">
            <span className="menubar-title">Activity</span>
          </header>

          <div className="menubar-onboard-scene">
            <RetroComputerAtropos className="menubar-onboard-computer" inactive={reduced} highlight={false} />
          </div>

          <p className="menubar-onboard-head">Monitor not connected</p>
          <p className="menubar-onboard-sub">Install the OhMyC plugin to collect activity.</p>
          {statusLine ? <p className="menubar-onboard-status">{statusLine}</p> : null}

          <div className="mt-2.5 flex flex-col gap-2 border-t border-[var(--border-subtle)] pt-2.5">
            <Button asChild variant="default" size="sm" className="w-full">
              <a href={PLUGIN_REPO} target="_blank" rel="noreferrer">
                <ExternalLink /> Open plugin repo
              </a>
            </Button>
            <button
              type="button"
              className="menubar-label menubar-open transition-colors"
              onClick={async () => {
                // Tauri supplies this module at runtime in the desktop shell.
                // eslint-disable-next-line import/no-extraneous-dependencies
                const { invoke } = await import('@tauri-apps/api/core')
                await invoke('open_main_window')
                await invoke('hide_popover')
              }}
            >
              Open OhMyC →
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
