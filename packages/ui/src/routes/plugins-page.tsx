// Route page for /explore/plugins — plugin inventory grid.
import { Blocks, Info } from 'lucide-react'

import { SectionHeader } from '@/components/section-header'
import { useMarketplaces, usePlugins } from '@/hooks/use-plugins'
import { cn } from '@/lib/utils'

export function PluginsPage() {
  const { data: plugins, isError: pluginsError } = usePlugins()
  const { data: marketplaces } = useMarketplaces()

  return (
    <section>
      <SectionHeader
        title="Plugins"
        description="Installed local plugins, their enabled state, and the agents, skills, and commands they add."
      />
      {/* eslint-disable unicorn/no-nested-ternary */}
      {pluginsError
        ? (
        <div className="panel-subtle flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-md border border-[var(--border-standard)] bg-[var(--surface-raised)]">
            <Info size={20} className="text-[var(--text-tertiary)]" />
          </div>
          <h3 className="text-[16px] font-medium text-[var(--text-primary)]">Failed to load plugins</h3>
          <p className="mt-2 max-w-sm text-[14px] text-[var(--text-tertiary)]">
            OhMyC could not read local plugins. Refresh, then check that the plugin registry is readable.
          </p>
        </div>
          )
        : plugins && plugins.length > 0
          ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {plugins.map((plugin) => {
            const installCount = plugin.installs.length
            const marketplace = marketplaces?.find(entry => entry.id === plugin.marketplace)

            return (
              <div
                key={plugin.id}
                className="panel transition-smooth p-7 hover:border-[var(--border-hover)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
                      {plugin.name}
                    </h3>
                    <p className="mt-0.5 text-[13px] text-[var(--text-tertiary)]">
                      {plugin.id}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'rounded-md px-2.5 py-1 text-[11px] font-medium tracking-[0.02em]',
                      plugin.enabled
                        ? 'bg-[var(--text-primary)] text-[var(--bg-marketing)]'
                        : 'bg-[var(--surface-raised)] text-[var(--text-tertiary)] border border-[var(--border-standard)]',
                    )}
                  >
                    {plugin.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 text-[13px] text-[var(--text-secondary)]">
                  <div>Agents: {plugin.componentCounts.agents}</div>
                  <div>Skills: {plugin.componentCounts.skills}</div>
                  <div>Commands: {plugin.componentCounts.commands}</div>
                  <div>Installs: {installCount}</div>
                </div>
                {marketplace
                  ? (
                  <p className="mt-4 text-[12px] text-[var(--text-tertiary)]">
                    Marketplace: {marketplace.id}
                  </p>
                    )
                  : null}
              </div>
            )
          })}
        </div>
            )
          : (
        <div className="panel-subtle flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-md border border-[var(--border-standard)] bg-[var(--surface-raised)]">
            <Blocks size={20} className="text-[var(--text-tertiary)]" />
          </div>
          <h3 className="text-[16px] font-medium text-[var(--text-primary)]">No plugins installed</h3>
          <p className="mt-2 max-w-sm text-[14px] text-[var(--text-tertiary)]">
            OhMyC did not find installed plugins in the local registry.
          </p>
        </div>
            )}
      {/* eslint-enable unicorn/no-nested-ternary */}
    </section>
  )
}
