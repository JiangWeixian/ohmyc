// Explorer view — browse agents, skills, commands, plugins, hooks, MCP/LSP configs via sidebar tabs.
import {
  Anchor,
  Blocks,
  Bot,
  Code,
  Info,
  Search,
  Server,
  Sparkles,
  TerminalSquare,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { Badge, MonoBadge } from './components/badge'
import { ConfigSection } from './components/config-section'
import { EntityCard } from './components/entity-card'
import { EntityDetail } from './components/entity-detail'
import { Header } from './components/header'
import { SectionHeader } from './components/section-header'
import { SettingsLayout } from './components/settings/settings-layout'
import { Sidebar, type SidebarSection } from './components/sidebar'
import { SourceBadge } from './components/source-badge'
import {
  type ItemLocator,
  useAgent,
  useAgents,
} from './hooks/use-agents'
import { useCommand, useCommands } from './hooks/use-commands'
import {
  type ConfigEntry,
  type HookEntry,
  useHooks,
  useLspServers,
  useMcpServers,
} from './hooks/use-configs'
import { useMarketplaces, usePlugins } from './hooks/use-plugins'
import { useProfiles } from './hooks/use-profiles'
import { useSkill, useSkills } from './hooks/use-skills'
import { cn } from '@/lib/utils'

import type {
  Agent,
  Command,
  Skill,
} from '@ohmyc/shared'

const SECTIONS: SidebarSection[] = [
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'skills', label: 'Skills', icon: Sparkles },
  { id: 'commands', label: 'Commands', icon: TerminalSquare },
  { id: 'plugins', label: 'Plugins', icon: Blocks },
  { id: 'hooks', label: 'Hooks', icon: Anchor },
  { id: 'mcp', label: 'MCP Servers', icon: Server },
  { id: 'lsp', label: 'LSP Servers', icon: Code },
]

// Section descriptions
const SECTION_DESCRIPTIONS: Record<string, string> = {
  agents:
    'Discover and manage your autonomous team. Each agent has unique capabilities tailored for different development tasks.',
  skills:
    "Extend Claude's capabilities with custom skills. Each skill provides specialized instructions for specific tasks.",
  commands: 'Custom slash commands you can invoke with ',
  'mcp-servers': 'Model Context Protocol servers providing external tools and services.',
  hooks: 'Event handlers that respond to Claude Code lifecycle events.',
  'lsp-servers': 'Language Server Protocol servers providing code intelligence.',
}

// Entity card configurations
const ENTITY_CONFIG = {
  agents: {
    iconAccentVar: '--text-primary',
    getTitle: (entity: Agent) => entity.frontmatter.name,
    getDescription: (entity: Agent) => entity.frontmatter.description,
    getBadges: (entity: Agent) => (
      <>
        {entity.frontmatter.model && <MonoBadge>{entity.frontmatter.model}</MonoBadge>}
        <SourceBadge source={entity.source} pluginId={entity.pluginId} />
      </>
    ),
  },
  skills: {
    iconAccentVar: '--text-secondary',
    getTitle: (entity: Skill) => entity.frontmatter.name,
    getDescription: (entity: Skill) => entity.frontmatter.description,
    getBadges: (entity: Skill) => (
      <>
        {entity.frontmatter.context === 'fork' && <Badge variant="default">fork</Badge>}
        {entity.frontmatter['disable-model-invocation'] && (
          <Badge variant="default">manual</Badge>
        )}
        <SourceBadge source={entity.source} pluginId={entity.pluginId} />
      </>
    ),
  },
  commands: {
    iconAccentVar: '--text-tertiary',
    getTitle: (entity: Command) => `/${entity.frontmatter.name}`,
    getDescription: (entity: Command) => entity.frontmatter.description,
    getBadges: (entity: Command) => (
      <>
        {entity.frontmatter['argument-hint'] && (
          <MonoBadge>{entity.frontmatter['argument-hint']}</MonoBadge>
        )}
        <SourceBadge source={entity.source} pluginId={entity.pluginId} />
      </>
    ),
  },
} as const

/** Props for the {@link Explorer} component. */
interface ExplorerProperties {
  viewSwitcher?: React.ReactNode
}

/**
 * Main explorer view — renders a sidebar with section tabs and a detail panel
 * for the selected agent, skill, command, plugin, hook, MCP server, or LSP server.
 */
export function Explorer({ viewSwitcher }: ExplorerProperties) {
  const { tab } = useParams<{ tab: string }>()
  const navigate = useNavigate()
  const activeSection = tab && SECTIONS.some(s => s.id === tab) ? tab : 'agents'
  const [selectedItem, setSelectedItem] = useState<ItemLocator | null>(null)

  // Data hooks
  const { data: agents, isError: agentsError } = useAgents()
  const { data: selectedAgent } = useAgent(activeSection === 'agents' ? selectedItem : null)

  const { data: skills, isError: skillsError } = useSkills()
  const { data: selectedSkill } = useSkill(activeSection === 'skills' ? selectedItem : null)

  const { data: commands, isError: commandsError } = useCommands()
  const { data: selectedCommand } = useCommand(activeSection === 'commands' ? selectedItem : null)

  const { data: mcpServers, isError: mcpError } = useMcpServers()
  const { data: hooks, isError: hooksError } = useHooks()
  const { data: lspServers, isError: lspError } = useLspServers()
  const { data: plugins, isError: pluginsError } = usePlugins()
  const { data: marketplaces } = useMarketplaces()
  const { data: profilesData } = useProfiles()

  const hookCount = (hooks ?? []).length
  const mcpCount = (mcpServers ?? []).length
  const lspCount = (lspServers ?? []).length

  const pluginReferenceMap = useMemo(() => {
    const allProfiles = profilesData?.profiles ?? []
    const map = new Map<string, string[]>()
    for (const p of allProfiles) {
      for (const pluginId of p.plugins) {
        const existing = map.get(pluginId) ?? []
        existing.push(p.name)
        map.set(pluginId, existing)
      }
    }
    return map
  }, [profilesData])

  const renderEnvironmentSummary = () => (
    <section className="panel p-7">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">Environment</h2>
        <span className="text-[12px] text-[var(--text-tertiary)]">Current workspace</span>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="panel-subtle transition-smooth px-5 py-4 hover:border-[var(--border-hover)]">
          <div className="text-[12px] font-medium tracking-[0.02em] text-[var(--text-tertiary)]">Hooks</div>
          <div className="mt-1 text-[24px] font-semibold tabular-nums tracking-[-0.03em] text-[var(--text-primary)]">{hookCount}</div>
        </div>
        <div className="panel-subtle transition-smooth px-5 py-4 hover:border-[var(--border-hover)]">
          <div className="text-[12px] font-medium tracking-[0.02em] text-[var(--text-tertiary)]">MCP servers</div>
          <div className="mt-1 text-[24px] font-semibold tabular-nums tracking-[-0.03em] text-[var(--text-primary)]">{mcpCount}</div>
        </div>
        <div className="panel-subtle transition-smooth px-5 py-4 hover:border-[var(--border-hover)]">
          <div className="text-[12px] font-medium tracking-[0.02em] text-[var(--text-tertiary)]">LSP servers</div>
          <div className="mt-1 text-[24px] font-semibold tabular-nums tracking-[-0.03em] text-[var(--text-primary)]">{lspCount}</div>
        </div>
      </div>
    </section>
  )

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
      if (Array.isArray(fm.tools) && fm.tools.length > 0) {
        meta.push({ label: 'tools', value: (fm.tools as string[]).join(', ') })
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
          onBack={() => setSelectedItem(null)}
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
                badges={entityConfig.getBadges(entity as never)}
                onClick={() =>
                  setSelectedItem({
                    name: entity.id,
                    source: entity.source,
                    pluginId: entity.pluginId,
                    scope: entity.scope,
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

  // Render under construction placeholder
  const renderPlaceholder = () => (
    <div className="panel-subtle flex flex-col items-center justify-center py-20">
      <div className="mb-5 flex size-14 items-center justify-center rounded-xl border border-[var(--border-standard)] bg-[rgba(255,255,255,0.02)]">
        <Info size={22} className="text-[var(--text-tertiary)]" />
      </div>
      <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
        Coming soon
      </h2>
      <p className="mt-3 max-w-md text-pretty text-center text-[15px] leading-relaxed text-[var(--text-tertiary)]">
        The{' '}
        <span className="capitalize text-[var(--text-primary)]">
          {activeSection.replace('-', ' ')}
        </span>{' '}
        section is still in development. It will be available in a future release.
      </p>
    </div>
  )

  const renderPlugins = () => {
    return (
    <div className="space-y-6">
      {renderEnvironmentSummary()}

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
              const referenceNames = pluginReferenceMap.get(plugin.id) ?? []
              const referenceCount = referenceNames.length

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
                  <div className="mt-5">
                    <div className="text-[10px] font-medium tracking-[0.04em] text-[var(--text-tertiary)]">Profiles</div>
                    {referenceCount === 0
                      ? (
                      <span className="text-[13px] tabular-nums text-[var(--text-tertiary)]">0</span>
                        )
                      : (referenceCount <= 2
                          ? (
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="text-[13px] tabular-nums text-[var(--text-primary)]">{referenceCount}</span>
                        {referenceNames.map(name => (
                          <span
                            key={name}
                            className="inline-block rounded border border-[var(--border-standard)] bg-[rgba(255,255,255,0.08)] px-1.5 py-0.5 text-[11px] text-[var(--text-secondary)]"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                            )
                          : (
                      <span
                        className="mt-1 block text-[13px] text-[var(--text-secondary)]"
                        title={referenceNames.join(', ')}
                      >
                        Used by {referenceCount} profiles
                      </span>
                            ))}
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
    </div>
    )
  }

  const renderConfigSection = (
    id: 'hooks' | 'lsp' | 'mcp',
    config: {
      title: string
      description: string
      data: ConfigEntry[] | undefined
      isError: boolean
      icon: typeof Server
      iconColor: string
      emptyMessage: string
    },
  ) => <ConfigSection {...config} />

  return (
    <div className="flex h-full min-w-0 font-sans text-[var(--text-primary)]">
      <Sidebar
        title="Explorer"
        sections={SECTIONS}
        activeSection={activeSection}
        onSectionChange={(id) => {
          navigate(`/explore/${id}`)
          setSelectedItem(null)
        }}
        headerSlot={viewSwitcher}
      />

      {/* Main Content */}
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--bg-marketing)]">
        <Header />
        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl p-10">
            {activeSection === 'agents' && renderEntityList('agents')}
            {activeSection === 'skills' && renderEntityList('skills')}
            {activeSection === 'commands' && renderEntityList('commands')}
            {activeSection === 'mcp' && (
              renderConfigSection('mcp', {
                title: 'MCP Servers',
                description: SECTION_DESCRIPTIONS['mcp-servers'],
                data: mcpServers,
                isError: mcpError,
                icon: Server,
                iconColor: 'text-[var(--text-primary)]',
                emptyMessage: 'No MCP servers configured in .mcp.json',
              })
            )}
            {activeSection === 'hooks' && (
              renderConfigSection('hooks', {
                title: 'Hooks',
                description: SECTION_DESCRIPTIONS.hooks,
                data: hooks?.map((h: HookEntry) => ({ ...h, config: h.data })),
                isError: hooksError,
                icon: Anchor,
                iconColor: 'text-[var(--text-secondary)]',
                emptyMessage: 'No hooks configured in settings.json',
              })
            )}
            {activeSection === 'lsp' && (
              renderConfigSection('lsp', {
                title: 'LSP Servers',
                description: SECTION_DESCRIPTIONS['lsp-servers'],
                data: lspServers,
                isError: lspError,
                icon: Code,
                iconColor: 'text-[var(--text-tertiary)]',
                emptyMessage: 'No LSP servers configured in .lsp.json',
              })
            )}
            {activeSection === 'settings' && <SettingsLayout />}
            {activeSection === 'plugins' && renderPlugins()}
            {activeSection === 'claude-md' && renderPlaceholder()}
          </div>
        </div>
      </main>
    </div>
  )
}
