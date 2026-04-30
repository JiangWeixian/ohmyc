import {
  Download,
  Edit2,
  Loader2,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { useProfiles } from '../../hooks/use-profiles'
import {
  useDeleteStoreAgent,
  useDeleteStoreCommand,
  useDeleteStoreModelConfig,
  useDeleteStoreSkill,
  useStoreAgents,
  useStoreCommands,
  useStoreModelConfigs,
  useStoreSkills,
} from '../../hooks/use-store'
import { maskApiKey } from '../../utils/mask-api-key'
import { DeleteConfirmDialog } from './delete-confirm-dialog'
import { ImportComponentsDialog } from './import-components-dialog'
import { cn } from '@/lib/utils'

type Category = 'agents' | 'commands' | 'model-configs' | 'skills'

const CATEGORY_LABEL: Record<Category, { plural: string; singular: string }> = {
  agents: { plural: 'agents', singular: 'agent' },
  skills: { plural: 'skills', singular: 'skill' },
  commands: { plural: 'commands', singular: 'command' },
  'model-configs': { plural: 'model configs', singular: 'model config' },
}

const CATEGORY_HEADING: Record<Category, { title: string; description: string }> = {
  agents: {
    title: 'Agents',
    description: 'Canonical library of agent components. Profiles reference these — edit here changes them everywhere.',
  },
  skills: {
    title: 'Skills',
    description: 'Canonical library of skill components. Profiles reference these — edit here changes them everywhere.',
  },
  commands: {
    title: 'Commands',
    description: 'Canonical library of slash commands. Profiles reference these — edit here changes them everywhere.',
  },
  'model-configs': {
    title: 'Model configs',
    description: 'Canonical library of API connection presets. Profiles reference these — edit here changes them everywhere.',
  },
}

function makeInitials(name: string): string {
  const cleaned = name.replaceAll(/[^a-z0-9]/gi, ' ').trim()
  if (!cleaned) {
    return '··'
  }
  const parts = cleaned.split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return cleaned.slice(0, 2).toUpperCase()
}

function UsedBy({ names }: { names: string[] }) {
  const count = names.length
  if (count === 0) {
    return (
      <span className="font-mono text-[11px] italic text-[var(--text-quaternary)]">
        Unused
      </span>
    )
  }
  if (count <= 2) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[11px] text-[var(--text-tertiary)]">Used by</span>
        {names.map(n => (
          <span
            key={n}
            className={cn(
              'inline-flex items-center rounded-full px-2 py-[2px]',
              'border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]',
              'text-[11px] font-[510] text-[var(--text-secondary)]',
            )}
          >
            {n}
          </span>
        ))}
      </div>
    )
  }
  return (
    <span
      title={names.join(', ')}
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-[3px]',
        'border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)]',
        'font-mono text-[11px] text-[var(--text-secondary)]',
      )}
    >
      Used by {count} profiles
    </span>
  )
}

interface StoreComponentListProperties {
  category: Category
  onEdit?: (category: Category, name?: string) => void
}

export function StoreComponentList({ category, onEdit }: StoreComponentListProperties) {
  const [deleteTarget, setDeleteTarget] = useState<{ category: Category; name: string; referencedBy: string[] } | null>(null)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [search, setSearch] = useState('')

  const agentsQ = useStoreAgents()
  const skillsQ = useStoreSkills()
  const commandsQ = useStoreCommands()
  const modelConfigsQ = useStoreModelConfigs()

  const deleteAgentMut = useDeleteStoreAgent()
  const deleteSkillMut = useDeleteStoreSkill()
  const deleteCommandMut = useDeleteStoreCommand()
  const deleteModelConfigMut = useDeleteStoreModelConfig()

  const { data: profilesData } = useProfiles()

  const referencedByMap = useMemo(() => {
    const allProfiles = profilesData?.profiles ?? []
    const m = new Map<string, string[]>()
    for (const p of allProfiles) {
      for (const r of p.agents) {
        const k = `agents:${r}`
        m.set(k, [...(m.get(k) ?? []), p.name])
      }
      for (const r of p.skills) {
        const k = `skills:${r}`
        m.set(k, [...(m.get(k) ?? []), p.name])
      }
      for (const r of p.commands) {
        const k = `commands:${r}`
        m.set(k, [...(m.get(k) ?? []), p.name])
      }
      if (p.modelConfig) {
        const k = `model-configs:${p.modelConfig}`
        m.set(k, [...(m.get(k) ?? []), p.name])
      }
    }
    return m
  }, [profilesData])

  const items = useMemo(() => {
    if (category === 'agents') {
      return (agentsQ.data ?? []).map(it => ({
        id: it.id,
        name: it.frontmatter.name || it.id,
        description: it.frontmatter.description || '',
        meta: [
          (it as any).scope || (it as any).source,
          it.frontmatter.model,
          it.provenance?.importPath ? `imported from ${it.provenance.importPath}` : null,
        ],
      }))
    }
    if (category === 'skills') {
      return (skillsQ.data ?? []).map(it => ({
        id: it.id,
        name: it.frontmatter.name || it.id,
        description: it.frontmatter.description || '',
        meta: [
          (it as any).scope || (it as any).source,
          it.provenance?.importPath ? `imported from ${it.provenance.importPath}` : null,
        ],
      }))
    }
    if (category === 'commands') {
      return (commandsQ.data ?? []).map(it => ({
        id: it.id,
        name: it.frontmatter.name || it.id,
        description: it.frontmatter.description || '',
        meta: [
          (it as any).scope || (it as any).source,
          it.provenance?.importPath ? `imported from ${it.provenance.importPath}` : null,
        ],
      }))
    }
    return (modelConfigsQ.data ?? []).map(it => ({
      id: it.name,
      name: it.name,
      description: `${it.provider ?? 'custom'} · ${it.baseUrl}`,
      meta: [
        it.provider,
        `key ${maskApiKey(it.apiKey)}`,
      ],
    }))
  }, [category, agentsQ.data, skillsQ.data, commandsQ.data, modelConfigsQ.data])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) {
      return items
    }
    return items.filter(it => it.name.toLowerCase().includes(q) || it.description.toLowerCase().includes(q))
  }, [items, search])

  const isLoading = (() => {
    if (category === 'agents') {
      return agentsQ.isLoading
    }
    if (category === 'skills') {
      return skillsQ.isLoading
    }
    if (category === 'commands') {
      return commandsQ.isLoading
    }
    return modelConfigsQ.isLoading
  })()

  const labels = CATEGORY_LABEL[category]
  const heading = CATEGORY_HEADING[category]

  const totalCount = items.length
  const referencedCount = items.filter(it => (referencedByMap.get(`${category}:${it.id}`) ?? []).length > 0).length
  const unusedCount = totalCount - referencedCount

  function getDeleteMutation(c: Category) {
    if (c === 'agents') {
      return deleteAgentMut
    }
    if (c === 'skills') {
      return deleteSkillMut
    }
    if (c === 'commands') {
      return deleteCommandMut
    }
    return deleteModelConfigMut
  }

  const handleDelete = (name: string) => {
    const mut = getDeleteMutation(category)
    mut.mutate({ name, force: false }, {
      onSuccess: () => setDeleteTarget(null),
      onError: (error: any) => {
        const references = error.data?.referencedBy
        if (references) {
          setDeleteTarget({ category, name, referencedBy: references })
        }
      },
    })
  }

  const handleForceDelete = () => {
    if (!deleteTarget) {
      return
    }
    const mut = getDeleteMutation(deleteTarget.category)
    mut.mutate({ name: deleteTarget.name, force: true }, {
      onSuccess: () => setDeleteTarget(null),
    })
  }

  return (
    <div>
      <div className="mb-1">
        <h1 className="text-[24px] font-[510] tracking-[-0.2px] text-[var(--text-primary)]">
          {heading.title}
        </h1>
        <p className="mt-1 text-[13px] text-[var(--text-tertiary)]">
          {heading.description}
        </p>
      </div>

      {/* Toolbar */}
      <div className="mt-6 flex items-center gap-3">
        <div
          className={cn(
            'flex h-9 flex-1 items-center gap-2 rounded-md px-3',
            'border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]',
            'focus-within:border-[rgba(255,255,255,0.14)]',
            'transition-colors duration-150',
          )}
        >
          <Search size={14} className="shrink-0 text-[var(--text-tertiary)]" />
          <input
            aria-label="Search store components"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${labels.plural} by name…`}
            className={cn(
              'flex-1 bg-transparent text-[13px] outline-none',
              'text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]',
            )}
          />
        </div>
        <button
          type="button"
          onClick={() => setShowImportDialog(true)}
          className={cn(
            'flex h-9 items-center gap-1.5 rounded-md px-3',
            'border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]',
            'text-[13px] font-[510] text-[var(--text-secondary)]',
            'hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--text-primary)] hover:border-[rgba(255,255,255,0.14)]',
            'transition-colors duration-150',
          )}
        >
          <Download size={14} />
          Import
        </button>
        <button
          type="button"
          onClick={() => onEdit?.(category)}
          className={cn(
            'flex h-9 items-center gap-1.5 rounded-md px-3',
            'bg-[var(--text-primary)] text-[var(--bg-marketing)]',
            'text-[13px] font-[510]',
            'hover:bg-[var(--text-secondary)]',
            'transition-colors duration-150',
          )}
        >
          <Plus size={14} />
          New {labels.singular}
        </button>
      </div>

      {/* Counter line */}
      <div
        className={cn(
          'mt-4 mb-3 font-mono text-[12px] text-[var(--text-tertiary)]',
          'tracking-[0.01em]',
        )}
      >
        {totalCount} {labels.plural}
        <span className="mx-1.5 text-[var(--text-quaternary)]">·</span>
        {referencedCount} referenced
        <span className="mx-1.5 text-[var(--text-quaternary)]">·</span>
        {unusedCount} unused
      </div>

      {isLoading
        ? (
          <div className="flex justify-center py-20">
            <Loader2 size={20} className="animate-spin text-[var(--text-tertiary)]" />
          </div>
          )
        : (filteredItems.length === 0
            ? (
            <div
              className={cn(
                'rounded-lg border border-[rgba(255,255,255,0.08)]',
                'bg-[rgba(255,255,255,0.02)] px-6 py-20 text-center',
              )}
            >
              <h2 className="text-[18px] font-[510] text-[var(--text-primary)]">
                {search ? `No ${labels.plural} match "${search}"` : `No ${labels.plural} in your store yet`}
              </h2>
              {!search && (
                <>
                  <p className="mt-2 text-[13px] text-[var(--text-tertiary)]">
                    Import {labels.plural} from an existing Claude-compatible directory to start building a canonical local store.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowImportDialog(true)}
                    className={cn(
                      'mt-4 inline-flex h-9 items-center gap-1.5 rounded-md px-3',
                      'bg-[var(--text-primary)] text-[var(--bg-marketing)]',
                      'text-[13px] font-[510]',
                      'hover:bg-[var(--text-secondary)] transition-colors duration-150',
                    )}
                  >
                    Import components
                  </button>
                </>
              )}
            </div>
              )
            : (
            <div className="space-y-1.5">
              {filteredItems.map((item) => {
                const refs = referencedByMap.get(`${category}:${item.id}`) ?? []
                const isUnused = refs.length === 0
                const metaParts = item.meta.filter(Boolean) as string[]
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'group relative flex items-center gap-3 px-4 py-3.5',
                      'rounded-lg border border-[rgba(255,255,255,0.08)]',
                      'bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)]',
                      'transition-colors duration-150',
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
                        'border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)]',
                        'font-mono text-[11px] font-[510]',
                        isUnused ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-secondary)]',
                      )}
                    >
                      {makeInitials(item.name)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          'truncate text-[14px] font-[510]',
                          isUnused ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]',
                        )}
                      >
                        {item.name}
                      </div>
                      {item.description && (
                        <div className="mt-0.5 line-clamp-1 text-[12px] leading-[1.4] text-[var(--text-secondary)]">
                          {item.description}
                        </div>
                      )}
                      {metaParts.length > 0 && (
                        <div className="mt-1 truncate font-mono text-[11px] text-[var(--text-tertiary)]">
                          {metaParts.map((part, i) => (
                            <span key={`${part}-${i}`}>
                              {i > 0 && <span className="mx-1.5 text-[var(--text-quaternary)]">·</span>}
                              {part}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0">
                      <UsedBy names={refs} />
                    </div>

                    <div
                      className={cn(
                        'flex shrink-0 items-center gap-0.5 opacity-0',
                        'group-hover:opacity-100 focus-within:opacity-100',
                        'transition-opacity duration-150',
                      )}
                    >
                      <button
                        type="button"
                        aria-label={`Edit ${item.name}`}
                        onClick={() => onEdit?.(category, item.id)}
                        className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-sm',
                          'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]',
                          'hover:bg-[rgba(255,255,255,0.04)]',
                          'transition-colors duration-150',
                        )}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${item.name}`}
                        onClick={() => handleDelete(item.id)}
                        className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-sm',
                          'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]',
                          'hover:bg-[rgba(255,255,255,0.04)]',
                          'transition-colors duration-150',
                        )}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
              ))}

      {deleteTarget && (
        <DeleteConfirmDialog
          name={deleteTarget.name}
          referencedBy={deleteTarget.referencedBy}
          onConfirm={handleForceDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {showImportDialog && (
        <ImportComponentsDialog onClose={() => setShowImportDialog(false)} />
      )}
    </div>
  )
}
