// Shared presentational component for entity list pages (agents, skills,
// commands). Renders the section header, card grid, and detail panel.
// Data hooks and selection state are owned by the consuming route page.
import {
  Bot,
  Info,
  Search,
  Sparkles,
  TerminalSquare,
} from 'lucide-react'

import { EntityCard } from './entity-card'
import {
  ENTITY_CONFIG,
  type EntitySection,
  SECTION_DESCRIPTIONS,
} from './entity-config'
import { EntityDetail } from './entity-detail'
import { SectionHeader } from './section-header'

import type { ItemLocator } from '@/hooks/use-agents'
import type {
  Agent,
  Command,
  Skill,
} from '@ohmyc/shared'
import type { ReactNode } from 'react'

interface EntityListProperties {
  section: EntitySection
  data: readonly Agent[] | readonly Command[] | readonly Skill[] | undefined
  isError: boolean
  /** The fully-resolved entity for the currently selected item, or null/undefined when no selection. */
  selectedEntity: Agent | Command | Skill | null | undefined
  /** Called when a card is clicked; the page stores this in its selection state. */
  onSelectItem: (item: ItemLocator) => void
  /** Called when the detail panel's back button is clicked. */
  onBack: () => void
}

const SECTION_ICONS: Record<EntitySection, typeof Bot> = {
  agents: Bot,
  skills: Sparkles,
  commands: TerminalSquare,
}

const SECTION_EMPTY_MESSAGES: Record<EntitySection, { body: string }> = {
  agents: {
    body: 'OhMyC did not find agents in the enabled local sources. Check your local source directories or enable another source.',
  },
  skills: {
    body: 'OhMyC did not find skills in the enabled local sources. Check your local source directories or enable another source.',
  },
  commands: {
    body: 'OhMyC did not find commands in the enabled local sources. Check your local source directories or enable another source.',
  },
}

/** Builds the metadata rows for the detail panel by flattening frontmatter. */
function buildMeta(entity: Agent | Command | Skill): { label: string; value: string }[] {
  const fm = entity.frontmatter as Record<string, unknown>
  const meta: { label: string; value: string }[] = []

  if (entity.scope) {
    meta.push({ label: 'scope', value: entity.scope })
  }
  if (entity.source) {
    meta.push({ label: 'source', value: entity.source })
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
  if (entity.provenance?.importPath) {
    const date = entity.provenance.importedAt
      ? new Date(entity.provenance.importedAt).toISOString().slice(0, 10)
      : null
    meta.push({
      label: 'imported',
      value: date ? `${date} from ${entity.provenance.importPath}` : entity.provenance.importPath,
    })
  }

  return meta
}

export function EntityList({
  section,
  data,
  isError,
  selectedEntity,
  onSelectItem,
  onBack,
}: EntityListProperties) {
  const entityConfig = ENTITY_CONFIG[section]
  const icon = SECTION_ICONS[section]
  const empty = SECTION_EMPTY_MESSAGES[section]
  const sectionTitle = section.charAt(0).toUpperCase() + section.slice(1)
  const description: ReactNode
    = section === 'commands'
      ? (
          <>
            {SECTION_DESCRIPTIONS.commands}
            <code className="text-[13px] text-[var(--text-secondary)]">/command-name</code>.
          </>
        )
      : SECTION_DESCRIPTIONS[section]

  // Detail panel: a resolved entity is selected.
  if (selectedEntity) {
    const fm = selectedEntity.frontmatter as Record<string, unknown>
    const displayName = (typeof fm.name === 'string' && fm.name) || selectedEntity.id
    const entityDescription = typeof fm.description === 'string' ? fm.description : undefined

    return (
      <EntityDetail
        title={section}
        name={displayName}
        description={entityDescription}
        content={selectedEntity.content}
        meta={buildMeta(selectedEntity)}
        onBack={onBack}
        scope={selectedEntity.scope}
      />
    )
  }

  return (
    <div>
      <SectionHeader title={sectionTitle} description={description} />
      {/* eslint-disable unicorn/no-nested-ternary */}
      {isError
        ? (
        <div className="panel-subtle flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-md border border-[var(--border-standard)] bg-[var(--surface-raised)]">
            <Info size={20} className="text-[var(--text-tertiary)]" />
          </div>
          <h3 className="text-[16px] font-medium text-[var(--text-primary)]">Failed to load {section}</h3>
          <p className="mt-2 max-w-sm text-[14px] text-[var(--text-tertiary)]">
            OhMyC could not read local {section}. Refresh, then check that the source directories are readable.
          </p>
        </div>
          )
        : data && data.length > 0
          ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {data.map(entity => (
            <EntityCard
              key={entity.id}
              icon={icon}
              iconAccentVar={entityConfig.iconAccentVar}
              title={entityConfig.getTitle(entity as never) || ''}
              description={entityConfig.getDescription(entity as never) || ''}
              origins={entity.origins}
              renderBadges={entity.badges}
              onClick={() =>
                onSelectItem({
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
          <div className="mb-3 flex size-12 items-center justify-center rounded-md border border-[var(--border-standard)] bg-[var(--surface-raised)]">
            <Search size={20} className="text-[var(--text-tertiary)]" />
          </div>
          <h3 className="text-[16px] font-medium text-[var(--text-primary)]">No {section} found</h3>
          <p className="mt-2 max-w-sm text-[14px] text-[var(--text-tertiary)]">
            {empty.body}
          </p>
        </div>
            )}
      {/* eslint-enable unicorn/no-nested-ternary */}
    </div>
  )
}
