import { useState, useMemo } from 'react';
import {
  FileText,
  Anchor,
  Server,
  Terminal,
  Users,
  Zap,
  Blocks,
  Search,
  Info,
  Code,
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { SettingsLayout } from './components/settings/SettingsLayout';
import { useAgents, useAgent, type ItemLocator } from './hooks/useAgents';
import { useSkills, useSkill } from './hooks/useSkills';
import { useCommands, useCommand } from './hooks/useCommands';
import { useMcpServers, useHooks, useLspServers, type ConfigEntry, type HookEntry } from './hooks/useConfigs';
import { usePlugins, useMarketplaces } from './hooks/usePlugins';
import { useProfiles } from './hooks/useProfiles';
import { cn } from '@/lib/utils';
import { EntityCard, Badge, MonoBadge } from './components/EntityCard';
import { EntityDetail } from './components/EntityDetail';
import { SectionHeader } from './components/SectionHeader';
import { Sidebar, StatusIndicator, type SidebarSection } from './components/Sidebar';
import { ConfigSection } from './components/ConfigSection';
import { SourceBadge } from './components/SourceBadge';
import { AnimatedList } from './components/ui/Skeleton';
import { CardSkeleton } from './components/ui/Skeleton';

const SECTIONS: SidebarSection[] = [
  { id: 'agents', label: 'Agents', icon: Users },
  { id: 'skills', label: 'Skills', icon: Zap },
  { id: 'commands', label: 'Commands', icon: Terminal },
  { id: 'plugins', label: 'Plugins', icon: Blocks },
  { id: 'hooks', label: 'Hooks', icon: Anchor },
  { id: 'mcp', label: 'MCP Servers', icon: Server },
  { id: 'lsp', label: 'LSP Servers', icon: Code },
];

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
};

// Entity card configurations
const ENTITY_CONFIG = {
  agents: {
    iconAccentVar: '--accent-blue',
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
    iconAccentVar: '--accent-amber',
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
    iconAccentVar: '--accent-green',
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
} as const;

interface ExplorerProps {
  viewSwitcher?: React.ReactNode;
}

export default function Explorer({ viewSwitcher }: ExplorerProps) {
  const { tab } = useParams<{ tab: string }>();
  const navigate = useNavigate();
  const activeSection = tab && SECTIONS.some((s) => s.id === tab) ? tab : 'agents';
  const [selectedItem, setSelectedItem] = useState<ItemLocator | null>(null);

  // Data hooks
  const { data: agents, isLoading: agentsLoading, isError: agentsError } = useAgents();
  const { data: selectedAgent } = useAgent(activeSection === 'agents' ? selectedItem : null);

  const { data: skills, isLoading: skillsLoading, isError: skillsError } = useSkills();
  const { data: selectedSkill } = useSkill(activeSection === 'skills' ? selectedItem : null);

  const { data: commands, isLoading: commandsLoading, isError: commandsError } = useCommands();
  const { data: selectedCommand } = useCommand(activeSection === 'commands' ? selectedItem : null);

  const { data: mcpServers, isLoading: mcpLoading, isError: mcpError } = useMcpServers();
  const { data: hooks, isLoading: hooksLoading, isError: hooksError } = useHooks();
  const { data: lspServers, isLoading: lspLoading, isError: lspError } = useLspServers();
  const { data: plugins, isLoading: pluginsLoading, isError: pluginsError } = usePlugins();
  const { data: marketplaces } = useMarketplaces();
  const { data: profilesData } = useProfiles();

  const hookCount = (hooks ?? []).length;
  const mcpCount = (mcpServers ?? []).length;
  const lspCount = (lspServers ?? []).length;

  const allProfiles = profilesData?.profiles ?? [];
  const pluginRefMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of allProfiles) {
      for (const pluginId of p.plugins) {
        const existing = map.get(pluginId) ?? [];
        existing.push(p.name);
        map.set(pluginId, existing);
      }
    }
    return map;
  }, [allProfiles]);

  const renderEnvironmentSummary = () => (
    <section className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] p-5">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">Current environment</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-[var(--radius-md)] bg-[var(--surface-overlay)] px-4 py-3">
          <div className="text-[12px] text-[var(--text-tertiary)]">Hooks</div>
          <div className="text-base font-semibold text-[var(--text-primary)]">{hookCount}</div>
        </div>
        <div className="rounded-[var(--radius-md)] bg-[var(--surface-overlay)] px-4 py-3">
          <div className="text-[12px] text-[var(--text-tertiary)]">MCP servers</div>
          <div className="text-base font-semibold text-[var(--text-primary)]">{mcpCount}</div>
        </div>
        <div className="rounded-[var(--radius-md)] bg-[var(--surface-overlay)] px-4 py-3">
          <div className="text-[12px] text-[var(--text-tertiary)]">LSP servers</div>
          <div className="text-base font-semibold text-[var(--text-primary)]">{lspCount}</div>
        </div>
      </div>
    </section>
  );

  // Get current section config
  const getSectionConfig = (sectionId: string) => {
    if (sectionId === 'agents')
      return {
        data: agents,
        isLoading: agentsLoading,
        isError: agentsError,
        icon: Users,
        emptyMessage: 'No agents found in ',
        emptyPath: '~/.claude/agents/',
      };
    if (sectionId === 'skills')
      return {
        data: skills,
        isLoading: skillsLoading,
        isError: skillsError,
        icon: Zap,
        emptyMessage: 'No skills found in ',
        emptyPath: '~/.claude/skills/',
      };
    if (sectionId === 'commands')
      return {
        data: commands,
        isLoading: commandsLoading,
        isError: commandsError,
        icon: Terminal,
        emptyMessage: 'No commands found in ',
        emptyPath: '~/.claude/commands/',
      };
    return null;
  };

  // Render entity list view
  const renderEntityList = (sectionId: 'agents' | 'skills' | 'commands') => {
    const config = getSectionConfig(sectionId);
    const entityConfig = ENTITY_CONFIG[sectionId];
    const selectedEntity =
      sectionId === 'agents'
        ? selectedAgent
        : sectionId === 'skills'
          ? selectedSkill
          : selectedCommand;

    if (!config) return null;

    const description =
      sectionId === 'commands' ? (
        <>
          {SECTION_DESCRIPTIONS['commands']}
          <code className="text-[var(--accent-cyan)] text-[13px]">/command-name</code>.
        </>
      ) : (
        SECTION_DESCRIPTIONS[sectionId]
      );

    if (selectedItem && selectedEntity) {
      return (
        <EntityDetail
          title={sectionId}
          content={selectedEntity.content}
          onBack={() => setSelectedItem(null)}
          scope={selectedEntity.scope}
        />
      );
    }

    return (
      <div>
        <SectionHeader title={sectionId.charAt(0).toUpperCase() + sectionId.slice(1)} description={description} />
        {config.isLoading ? (
          <AnimatedList className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }, (_, i) => (
              <CardSkeleton key={i} />
            ))}
          </AnimatedList>
        ) : config.isError ? (
          <div className="text-center py-20 text-[var(--text-tertiary)]">
            Failed to load {sectionId}.
          </div>
        ) : config.data && config.data.length > 0 ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={sectionId}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {config.data.map((entity, index) => (
                <motion.div
                  key={entity.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: index * 0.03,
                    duration: 0.2,
                    ease: [0.16, 1, 0.3, 1]
                  }}
                >
                  <EntityCard
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
                      })
                    }
                  />
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="text-center py-20 text-[var(--text-tertiary)]">
            {config.emptyMessage}
            <code className="text-[var(--text-secondary)]">{config.emptyPath}</code>
          </div>
        )}
      </div>
    );
  };

  // Render under construction placeholder
  const renderPlaceholder = () => (
    <div className="panel-subtle flex flex-col items-center justify-center py-16">
      <div className="mb-4 flex size-14 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-panel)]">
        <Info size={24} className="text-[var(--text-tertiary)]" />
      </div>
      <h2 className="text-[20px] font-medium text-[var(--text-primary)]">
        Section Under Construction
      </h2>
      <p className="text-pretty mt-3 max-w-md text-center text-[15px] text-[var(--text-tertiary)]">
        The{' '}
        <span className="text-[var(--accent-blue)] capitalize">
          {activeSection.replace('-', ' ')}
        </span>{' '}
        viewer is currently being implemented. Check back soon!
      </p>
    </div>
  );

  const renderPlugins = () => {
    return (
    <div className="space-y-6">
      {renderEnvironmentSummary()}

      <section>
        <SectionHeader
          title="Plugins"
          description="Inspect installed plugins, enabled state, and bundled component counts for the current environment."
        />
        {pluginsLoading ? (
          <AnimatedList className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Array.from({ length: 2 }, (_, index) => (
              <CardSkeleton key={index} />
            ))}
          </AnimatedList>
        ) : pluginsError ? (
          <div className="text-center py-20 text-[var(--text-tertiary)]">Failed to load plugins.</div>
        ) : plugins && plugins.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {plugins.map((plugin) => {
              const installCount = plugin.installs.length;
              const marketplace = marketplaces?.find((entry) => entry.id === plugin.marketplace);
              const refNames = pluginRefMap.get(plugin.id) ?? [];
              const refCount = refNames.length;

              return (
                <div
                  key={plugin.id}
                  className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-[var(--text-primary)]">
                        {plugin.name}
                      </h3>
                      <p className="text-[13px] text-[var(--text-tertiary)]">
                        {plugin.id}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'rounded-[var(--radius-sm)] px-2 py-1 text-[11px] font-semibold uppercase',
                        plugin.enabled
                          ? 'bg-[var(--accent-green)]/10 text-[var(--accent-green)]'
                          : 'bg-[var(--surface-overlay)] text-[var(--text-tertiary)]',
                      )}
                    >
                      {plugin.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-[13px] text-[var(--text-secondary)]">
                    <div>Agents: {plugin.componentCounts.agents}</div>
                    <div>Skills: {plugin.componentCounts.skills}</div>
                    <div>Commands: {plugin.componentCounts.commands}</div>
                    <div>Installs: {installCount}</div>
                  </div>
                  <div className="mt-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">profiles</div>
                    {refCount === 0 ? (
                      <span className="text-[13px] tabular-nums text-[var(--text-tertiary)]">0</span>
                    ) : refCount <= 2 ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] tabular-nums text-[var(--text-primary)]">{refCount}</span>
                        {refNames.map(name => (
                          <span
                            key={name}
                            className="inline-block rounded bg-[var(--accent-blue)]/8 px-1.5 py-0.5 text-[11px] text-[var(--accent-blue)] border border-[var(--accent-blue)]/15"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span
                        className="text-[13px] text-[var(--accent-blue)]"
                        title={refNames.join(', ')}
                      >
                        Used by {refCount} profiles
                      </span>
                    )}
                  </div>
                  {marketplace ? (
                    <p className="mt-3 text-[12px] text-[var(--text-tertiary)]">
                      Marketplace: {marketplace.id}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 text-[var(--text-tertiary)]">
            No plugins installed in the current environment.
          </div>
        )}
      </section>
    </div>
    );
  };

  const renderConfigSection = (
    id: 'mcp' | 'hooks' | 'lsp',
    config: {
      title: string;
      description: string;
      data: ConfigEntry[] | undefined;
      isLoading: boolean;
      isError: boolean;
      icon: typeof Server;
      iconColor: string;
      emptyMessage: string;
    },
  ) => (
    <div className="space-y-6">
      {renderEnvironmentSummary()}
      <ConfigSection {...config} />
    </div>
  );

  return (
    <div className="flex h-full min-w-0 text-[var(--text-primary)] font-sans">
      <Sidebar
        sections={SECTIONS}
        activeSection={activeSection}
        onSectionChange={(id) => {
          navigate(`/explore/${id}`);
          setSelectedItem(null);
        }}
        statusIndicator={<StatusIndicator />}
        headerSlot={viewSwitcher}
      />

      {/* Main Content */}
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(94,106,210,0.08),_transparent_26%),_var(--surface-base)]">
        <header className="flex h-16 items-center justify-between border-b border-[var(--border-default)] px-6">
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-[var(--text-tertiary)]">Explorer</span>
            <span className="text-[var(--border-default)]">/</span>
            <span className="text-[13px] font-medium capitalize text-[var(--text-primary)]">
              {selectedItem
                ? `${activeSection.replace('-', ' ')} Detail`
                : activeSection.replace('-', ' ')}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
              />
              <input
                type="text"
                placeholder="Search..."
                className={cn(
                  'w-44 rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-panel)] py-1.5 pl-8 pr-3 text-[12px]',
                  'text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]',
                  'focus:outline-none focus:border-[var(--accent-blue)]',
                  'transition-smooth'
                )}
              />
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl px-8 py-8">
            {activeSection === 'agents' && renderEntityList('agents')}
            {activeSection === 'skills' && renderEntityList('skills')}
            {activeSection === 'commands' && renderEntityList('commands')}
            {activeSection === 'mcp' && (
              renderConfigSection('mcp', {
                title: 'MCP Servers',
                description: SECTION_DESCRIPTIONS['mcp-servers'],
                data: mcpServers,
                isLoading: mcpLoading,
                isError: mcpError,
                icon: Server,
                iconColor: 'text-[var(--accent-blue)]',
                emptyMessage: 'No MCP servers configured in .mcp.json',
              })
            )}
            {activeSection === 'hooks' && (
              renderConfigSection('hooks', {
                title: 'Hooks',
                description: SECTION_DESCRIPTIONS['hooks'],
                data: hooks?.map((h: HookEntry) => ({ ...h, config: h.data })),
                isLoading: hooksLoading,
                isError: hooksError,
                icon: Anchor,
                iconColor: 'text-[var(--accent-purple)]',
                emptyMessage: 'No hooks configured in settings.json',
              })
            )}
            {activeSection === 'lsp' && (
              renderConfigSection('lsp', {
                title: 'LSP Servers',
                description: SECTION_DESCRIPTIONS['lsp-servers'],
                data: lspServers,
                isLoading: lspLoading,
                isError: lspError,
                icon: Code,
                iconColor: 'text-[var(--accent-cyan)]',
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
  );
}
