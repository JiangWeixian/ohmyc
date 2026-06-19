// Explorer view — browse timeline activity plus agents, commands, skills, and plugins.
import {
  Blocks,
  Bot,
  Info,
  Search,
  Sparkles,
  TerminalSquare,
} from 'lucide-react'
import { useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'

import { EntityCard } from './components/entity-card'
import { EntityDetail } from './components/entity-detail'
import { MonitorView } from './components/monitor/monitor-view'
import { NavigationIsland } from './components/navigation-island'
import { SectionHeader } from './components/section-header'
import { TimelineView } from './components/timeline/timeline-view'
import {
  type ItemLocator,
  useAgent,
  useAgents,
} from './hooks/use-agents'
import { useCommand, useCommands } from './hooks/use-commands'
import { useMarketplaces, usePlugins } from './hooks/use-plugins'
import { useSkill, useSkills } from './hooks/use-skills'
import { cn } from '@/lib/utils'

import type {
  Agent,
  Command,
  Skill,
} from '@ohmyc/shared'
import type { ReactNode } from 'react'

// Section descriptions
const SECTION_DESCRIPTIONS: Record<'agents' | 'commands' | 'skills', string> = {
  agents:
    'Discover and manage your autonomous team. Each agent has unique capabilities tailored for different development tasks.',
  commands: 'Custom slash commands you can invoke with ',
  skills:
    "Extend Claude's capabilities with custom skills. Each skill provides specialized instructions for specific tasks.",
}

// ═══════════ Entity Card Configurations ═══════════

const ENTITY_CONFIG = {
  agents: {
    iconAccentVar: '--text-primary',
    getTitle: (entity: Agent) => entity.frontmatter.name,
    getDescription: (entity: Agent) => entity.frontmatter.description,
  },
  skills: {
    iconAccentVar: '--text-secondary',
    getTitle: (entity: Skill) => entity.frontmatter.name,
    getDescription: (entity: Skill) => entity.frontmatter.description,
  },
  commands: {
    iconAccentVar: '--text-tertiary',
    getTitle: (entity: Command) => `/${entity.frontmatter.name}`,
    getDescription: (entity: Command) => entity.frontmatter.description,
  },
} as const

// ═══════════ Explorer Component ═══════════

/** Props for the {@link Explorer} component. */
interface ExplorerProperties {
  viewSwitcher?: ReactNode
}

/**
 * Main explorer view — renders Timeline plus the core resource tabs:
 * agents, commands, skills, and plugins.
 */
export function Explorer({ viewSwitcher: _viewSwitcher }: ExplorerProperties) {
  const { tab } = useParams<{ tab: string }>()
  const location = useLocation()
  type ResourceSectionId = 'agents' | 'commands' | 'plugins' | 'skills'
  type ExplorerTab = ResourceSectionId | 'monitor' | 'timeline'

  const VALID_TABS = new Set<ExplorerTab>(['monitor', 'timeline', 'agents', 'commands', 'skills', 'plugins'])
  const activeSection: ExplorerTab = tab && VALID_TABS.has(tab as ExplorerTab) ? (tab as ExplorerTab) : 'timeline'
  const [selectedItemState, setSelectedItemState] = useState<{
    item: ItemLocator
    locationKey: string
  } | null>(null)
  const selectedItem = selectedItemState?.locationKey === location.key ? selectedItemState.item : null

  // Data hooks
  const { data: agents, isError: agentsError } = useAgents()
  const { data: selectedAgent } = useAgent(activeSection === 'agents' ? selectedItem : null)

  const { data: skills, isError: skillsError } = useSkills()
  const { data: selectedSkill } = useSkill(activeSection === 'skills' ? selectedItem : null)

  const { data: commands, isError: commandsError } = useCommands()
  const { data: selectedCommand } = useCommand(activeSection === 'commands' ? selectedItem : null)

  const { data: plugins, isError: pluginsError } = usePlugins()
  const { data: marketplaces } = useMarketplaces()

  // Get current section config
  const getSectionConfig = (sectionId: string) => {
    if (sectionId === 'agents') {
      return {
        data: agents,
        isError: agentsError,
        icon: Bot,
        emptyMessage: 'No agents found in ',
        emptyPath: '~/.claude/agents/',
      }
    }
    if (sectionId === 'skills') {
      return {
        data: skills,
        isError: skillsError,
        icon: Sparkles,
        emptyMessage: 'No skills found in ',
        emptyPath: '~/.claude/skills/',
      }
    }
    if (sectionId === 'commands') {
      return {
        data: commands,
        isError: commandsError,
        icon: TerminalSquare,
        emptyMessage: 'No commands found in ',
        emptyPath: '~/.claude/commands/',
      }
    }
    return null
  }

  // Render entity list view
  const renderEntityList = (sectionId: 'agents' | 'commands' | 'skills') => {
    const config = getSectionConfig(sectionId)
    const entityConfig = ENTITY_CONFIG[sectionId]
    const selectedEntity
      = sectionId === 'agents'
        ? selectedAgent
        : (sectionId === 'skills'
            ? selectedSkill
            : selectedCommand)

    if (!config) {
      return null
    }

    const description
      = sectionId === 'commands'
        ? (
        <>
          {SECTION_DESCRIPTIONS.commands}
          <code className="text-[13px] text-[var(--text-secondary)]">/command-name</code>.
        </>
          )
        : (
            SECTION_DESCRIPTIONS[sectionId]
          )

    // Selected entity: harvest frontmatter fields for the detail panel metadata list.
    if (selectedItem && selectedEntity) {
      const fm = selectedEntity.frontmatter as Record<string, unknown>
      const meta: { label: string; value: string }[] = []
      if (selectedEntity.scope) {
        meta.push({ label: 'scope', value: selectedEntity.scope })
      }
      if (selectedEntity.source) {
        meta.push({ label: 'source', value: selectedEntity.source })
      }
      if (typeof fm.model === 'string') {
        meta.push({ label: 'model', value: fm.model })
      }
      if (typeof fm.mode === 'string') {
        meta.push({ label: 'mode', value: fm.mode })
      }
      if (Array.isArray(fm.tools) && fm.tools.length > 0) {
        meta.push({ label: 'tools', value: (fm.tools as string[]).join(', ') })
      }
      // Flatten one-level objects so opencode's permission: { edit, bash } shows
      // as permission.edit / permission.bash rows. Skip hooks/mcpServers — those
      // are nested config blobs the detail panel surfaces elsewhere.
      for (const [key, value] of Object.entries(fm)) {
        if (
          value
          && typeof value === 'object'
          && !Array.isArray(value)
          && key !== 'hooks'
          && key !== 'mcpServers'
        ) {
          for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
            if (typeof subValue === 'string' || typeof subValue === 'number' || typeof subValue === 'boolean') {
              meta.push({ label: `${key}.${subKey}`, value: String(subValue) })
            }
          }
        }
      }
      if (selectedEntity.provenance?.importPath) {
        const date = selectedEntity.provenance.importedAt
          ? new Date(selectedEntity.provenance.importedAt).toISOString().slice(0, 10)
          : null
        meta.push({
          label: 'imported',
          value: date ? `${date} from ${selectedEntity.provenance.importPath}` : selectedEntity.provenance.importPath,
        })
      }
      const displayName = (typeof fm.name === 'string' && fm.name) || selectedEntity.id
      const description = typeof fm.description === 'string' ? fm.description : undefined

      return (
        <EntityDetail
          title={sectionId}
          name={displayName}
          description={description}
          content={selectedEntity.content}
          meta={meta}
          onBack={() => setSelectedItemState(null)}
          scope={selectedEntity.scope}
        />
      )
    }

    return (
      <div>
        <SectionHeader title={sectionId.charAt(0).toUpperCase() + sectionId.slice(1)} description={description} />
        {/* eslint-disable unicorn/no-nested-ternary */}
        {config.isError
          ? (
          <div className="panel-subtle flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-md border border-[var(--border-standard)] bg-[rgba(255,255,255,0.02)]">
              <Info size={20} className="text-[var(--text-tertiary)]" />
            </div>
            <h3 className="text-[16px] font-medium text-[var(--text-primary)]">Failed to load {sectionId}</h3>
            <p className="mt-2 max-w-sm text-[14px] text-[var(--text-tertiary)]">
              Something went wrong while fetching your {sectionId}. Try refreshing the page.
            </p>
          </div>
            )
          : config.data && config.data.length > 0
            ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {config.data.map((entity, _index) => (
              <EntityCard
                key={entity.id}
                icon={config.icon}
                iconAccentVar={entityConfig.iconAccentVar}
                title={entityConfig.getTitle(entity as never) || ''}
                description={entityConfig.getDescription(entity as never) || ''}
                origins={entity.origins}
                renderBadges={entity.badges}
                onClick={() =>
                  setSelectedItemState({
                    item: {
                      name: entity.id,
                      source: entity.source,
                      pluginId: entity.pluginId,
                      scope: entity.scope,
                    },
                    locationKey: location.key,
                  })}
              />
            ))}
          </div>
              )
            : (
          <div className="panel-subtle flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-md border border-[var(--border-standard)] bg-[rgba(255,255,255,0.02)]">
              <Search size={20} className="text-[var(--text-tertiary)]" />
            </div>
            <h3 className="text-[16px] font-medium text-[var(--text-primary)]">No {sectionId} found</h3>
            <p className="mt-2 max-w-sm text-[14px] text-[var(--text-tertiary)]">
              {config.emptyMessage}<code className="text-[var(--text-secondary)]">{config.emptyPath}</code>
            </p>
          </div>
              )}
        {/* eslint-enable unicorn/no-nested-ternary */}
      </div>
    )
  }

  const renderPlugins = () => {
    return (
    <section>
        <SectionHeader
          title="Plugins"
          description="Inspect installed plugins, enabled state, and bundled component counts for the current environment."
        />
        {/* eslint-disable unicorn/no-nested-ternary */}
        {pluginsError
          ? (
          <div className="panel-subtle flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-md border border-[var(--border-standard)] bg-[rgba(255,255,255,0.02)]">
              <Info size={20} className="text-[var(--text-tertiary)]" />
            </div>
            <h3 className="text-[16px] font-medium text-[var(--text-primary)]">Failed to load plugins</h3>
            <p className="mt-2 max-w-sm text-[14px] text-[var(--text-tertiary)]">
              Something went wrong while fetching your plugins. Try refreshing the page.
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
                          : 'bg-[rgba(255,255,255,0.02)] text-[var(--text-tertiary)] border border-[var(--border-standard)]',
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
            <div className="mb-3 flex size-12 items-center justify-center rounded-md border border-[var(--border-standard)] bg-[rgba(255,255,255,0.02)]">
              <Blocks size={20} className="text-[var(--text-tertiary)]" />
            </div>
            <h3 className="text-[16px] font-medium text-[var(--text-primary)]">No plugins installed</h3>
            <p className="mt-2 max-w-sm text-[14px] text-[var(--text-tertiary)]">
              There are no plugins in the current environment.
            </p>
          </div>
              )}
        {/* eslint-enable unicorn/no-nested-ternary */}
    </section>
    )
  }

  return (
    <div className="relative h-full min-w-0 overflow-hidden font-sans text-[var(--text-primary)]">
      <NavigationIsland />

      <main className="relative h-full min-w-0 overflow-hidden bg-[var(--bg-marketing)]">
        {activeSection === 'monitor'
          ? (
              <MonitorView />
            )
          : (
              <div className="h-full overflow-y-auto">
                <div className="mx-auto w-full max-w-6xl p-10 pl-[280px] max-lg:pl-[260px] max-md:px-5 max-md:pt-24">
                  {activeSection === 'timeline' && <TimelineView />}
                  {activeSection === 'agents' && renderEntityList('agents')}
                  {activeSection === 'skills' && renderEntityList('skills')}
                  {activeSection === 'commands' && renderEntityList('commands')}
                  {activeSection === 'plugins' && renderPlugins()}
                </div>
              </div>
            )}
      </main>
    </div>
  )
}
