import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown,
  Edit2,
  Info,
  Loader2,
  Plus,
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
import { StoreComponentEditor } from './store-component-editor'
import { cn } from '@/lib/utils'

function ProfileReferences({
  itemType,
  itemId,
  referencedByMap,
}: {
  itemType: string
  itemId: string
  referencedByMap: Map<string, string[]>
}) {
  const referenceNames = referencedByMap.get(`${itemType}:${itemId}`) ?? []
  const referenceCount = referenceNames.length

  if (referenceCount === 0) {
    return <span className="text-[13px] tabular-nums text-[var(--text-tertiary)]">0</span>
  }

  if (referenceCount <= 2) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[13px] tabular-nums text-[var(--text-primary)]">{referenceCount}</span>
        {referenceNames.map(name => (
          <span
            key={name}
            aria-label={`${name} profile`}
            className="inline-block rounded bg-[var(--accent-blue)]/8 px-1.5 py-0.5 text-[11px] text-[var(--accent-blue)] border border-[var(--accent-blue)]/15"
          >
            {name}
          </span>
        ))}
      </div>
    )
  }

  return (
    <span
      className="text-[13px] text-[var(--accent-blue)]"
      title={referenceNames.join(', ')}
    >
      Used by {referenceCount} profiles
    </span>
  )
}

interface StoreComponentListProperties {
  category: 'agents' | 'all' | 'commands' | 'model-configs' | 'skills'
}

export function StoreComponentList({ category }: StoreComponentListProperties) {
  const [editing, setEditing] = useState<{ category: 'agents' | 'commands' | 'model-configs' | 'skills'; name?: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ category: 'agents' | 'commands' | 'model-configs' | 'skills'; name: string; referencedBy: string[] } | null>(null)
  const [showImportDialog, setShowImportDialog] = useState(false)

  const agentsQ = useStoreAgents()
  const skillsQ = useStoreSkills()
  const commandsQ = useStoreCommands()
  const modelConfigsQ = useStoreModelConfigs()

  const deleteAgentMut = useDeleteStoreAgent()
  const deleteSkillMut = useDeleteStoreSkill()
  const deleteCommandMut = useDeleteStoreCommand()
  const deleteModelConfigMut = useDeleteStoreModelConfig()

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'agents' | 'all' | 'commands' | 'model-configs' | 'skills'>(
    category === 'all' ? 'all' : category,
  )

  const items = useMemo(() => {
    const agentItems = (agentsQ.data ?? []).map(item => ({
      id: item.id,
      type: 'agents' as const,
      name: item.frontmatter.name || item.id,
      description: item.frontmatter.description || '',
      provenance: item.provenance,
    }))
    const skillItems = (skillsQ.data ?? []).map(item => ({
      id: item.id,
      type: 'skills' as const,
      name: item.frontmatter.name || item.id,
      description: item.frontmatter.description || '',
      provenance: item.provenance,
    }))
    const commandItems = (commandsQ.data ?? []).map(item => ({
      id: item.id,
      type: 'commands' as const,
      name: item.frontmatter.name || item.id,
      description: item.frontmatter.description || '',
      provenance: item.provenance,
    }))

    const modelConfigItems = (modelConfigsQ.data ?? []).map(item => ({
      id: item.name,
      type: 'model-configs' as const,
      name: item.name,
      description: '',
      provider: item.provider,
      baseUrl: item.baseUrl,
      apiKey: item.apiKey,
      provenance: undefined as any,
    }))

    const baseItems = [...agentItems, ...skillItems, ...commandItems, ...modelConfigItems]

    return baseItems.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase())
      const matchesType = typeFilter === 'all' || item.type === typeFilter
      return matchesSearch && matchesType
    })
  }, [agentsQ.data, category, commandsQ.data, modelConfigsQ.data, search, skillsQ.data, typeFilter])

  /* eslint-disable unicorn/no-nested-ternary */
  const isLoading = category === 'all'
    ? agentsQ.isLoading || skillsQ.isLoading || commandsQ.isLoading || modelConfigsQ.isLoading
    : category === 'agents'
      ? agentsQ.isLoading
      : category === 'skills'
        ? skillsQ.isLoading
        : category === 'commands'
          ? commandsQ.isLoading
          : modelConfigsQ.isLoading
  /* eslint-enable unicorn/no-nested-ternary */

  const { data: profilesData } = useProfiles()
  const allProfiles = profilesData?.profiles ?? []

  const referencedByMap = new Map<string, string[]>()
  for (const p of allProfiles) {
    for (const reference of p.agents) {
      const key = `agents:${reference}`
      const existing = referencedByMap.get(key) ?? []
      existing.push(p.name)
      referencedByMap.set(key, existing)
    }
    for (const reference of p.skills) {
      const key = `skills:${reference}`
      const existing = referencedByMap.get(key) ?? []
      existing.push(p.name)
      referencedByMap.set(key, existing)
    }
    for (const reference of p.commands) {
      const key = `commands:${reference}`
      const existing = referencedByMap.get(key) ?? []
      existing.push(p.name)
      referencedByMap.set(key, existing)
    }
    if (p.modelConfig) {
      const key = `model-configs:${p.modelConfig}`
      const existing = referencedByMap.get(key) ?? []
      existing.push(p.name)
      referencedByMap.set(key, existing)
    }
  }

  function getDeleteMutation(itemCategory: 'agents' | 'commands' | 'model-configs' | 'skills') {
    if (itemCategory === 'agents') {
      return deleteAgentMut
    }
    if (itemCategory === 'skills') {
      return deleteSkillMut
    }
    if (itemCategory === 'commands') {
      return deleteCommandMut
    }
    return deleteModelConfigMut
  }

  const handleDelete = (itemCategory: 'agents' | 'commands' | 'model-configs' | 'skills', name: string) => {
    const deleteMut = getDeleteMutation(itemCategory)
    deleteMut.mutate({ name, force: false }, {
      onSuccess: () => setDeleteTarget(null),
      onError: (error: any) => {
        const references = error.data?.referencedBy
        if (references) {
          setDeleteTarget({ category: itemCategory, name, referencedBy: references })
        }
      },
    })
  }

  const handleForceDelete = () => {
    if (!deleteTarget) {
      return
    }
    const deleteMut = getDeleteMutation(deleteTarget.category)
    deleteMut.mutate({ name: deleteTarget.name, force: true }, {
      onSuccess: () => setDeleteTarget(null),
    })
  }

  if (editing !== null) {
    return (
      <StoreComponentEditor
        category={editing.category}
        editName={editing.name}
        onSaved={() => setEditing(null)}
        onCancel={() => setEditing(null)}
      />
    )
  }

  const createCategory = typeFilter === 'all' ? 'agents' : typeFilter
  const createLabel = createCategory === 'model-configs' ? 'New model config' : `New ${createCategory.slice(0, -1)}`

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Store Components</h1>
          <p className="text-[13px] text-[var(--text-tertiary)] mt-0.5">
            Browse agents, skills, and commands in your canonical store. Profiles reference these components.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowImportDialog(true)}
            className={cn(
              'rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-overlay)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-primary)]',
              'hover:border-[var(--border-hover)] hover:bg-[var(--surface-panel)]',
              'transition-colors duration-150',
            )}
          >
            Import Components
          </button>
          <button
            onClick={() => setEditing({ category: createCategory })}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-medium rounded-[var(--radius-md)]',
              'bg-[var(--text-primary)] text-[var(--bg-marketing)]',
              'hover:bg-[var(--text-secondary)]',
              'transition-colors duration-150',
            )}
          >
            <Plus size={14} /> {createLabel}
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <input
          aria-label="Search store components"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search by name"
          className={cn(
            'w-full rounded-[var(--radius-md)] px-3 py-2 text-[13px] md:max-w-sm',
            'bg-[var(--surface-base)] border border-[var(--border-default)]',
            'text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]',
            'focus:outline-none focus:border-[var(--accent-blue)]',
            'transition-colors duration-150',
          )}
        />
        <label className="flex items-center gap-2 text-[12px] text-[var(--text-tertiary)]">
          Type
          <select
            aria-label="Filter by type"
            value={typeFilter}
            onChange={event => setTypeFilter(event.target.value as typeof typeFilter)}
            className={cn(
              'rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-[13px] text-[var(--text-primary)]',
              'focus:outline-none focus:border-[var(--accent-blue)]',
              'transition-colors duration-150',
            )}
          >
            <option value="all">all</option>
            <option value="agents">agents</option>
            <option value="skills">skills</option>
            <option value="commands">commands</option>
            <option value="model-configs">model-configs</option>
          </select>
        </label>
      </div>

      {/* eslint-disable unicorn/no-nested-ternary */}
      {isLoading
        ? (
        <div className="flex justify-center py-20">
          <Loader2 size={20} className="animate-spin text-[var(--text-tertiary)]" />
        </div>
          )
        : items.length === 0
          ? (
              typeFilter === 'model-configs'
                ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-6 py-20 text-center"
          >
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              No model configs yet
            </h2>
            <p className="mt-2 text-[13px] text-[var(--text-tertiary)]">
              Create a model config to define an API connection preset for your profiles.
            </p>
            <button
              type="button"
              onClick={() => setEditing({ category: 'model-configs' })}
              className={cn(
                'mt-4 rounded-[var(--radius-md)] bg-[var(--text-primary)] px-3 py-1.5 text-[13px] font-medium text-[var(--bg-marketing)]',
                'hover:bg-[var(--text-secondary)]',
                'transition-colors duration-150',
              )}
            >
              New Model Config
            </button>
          </motion.div>
                  )
                : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-6 py-20 text-center"
        >
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            No components in this store yet
          </h2>
          <p className="mt-2 text-[13px] text-[var(--text-tertiary)]">
            Import agents, skills, or commands from an existing Claude-compatible directory to start building a canonical local store.
          </p>
          <button
            type="button"
            onClick={() => setShowImportDialog(true)}
            className={cn(
              'mt-4 rounded-[var(--radius-md)] bg-[var(--text-primary)] px-3 py-1.5 text-[13px] font-medium text-[var(--bg-marketing)]',
              'hover:bg-[var(--text-secondary)]',
              'transition-colors duration-150',
            )}
          >
            Import Components
          </button>
        </motion.div>
                  )
            )
          : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {items.map((item, index) => (
              <motion.div
                key={`${item.type}:${item.id}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20, scale: 0.95 }}
                transition={{ delay: index * 0.03, duration: 0.2 }}
                whileHover={{ x: 4 }}
                className={cn(
                  'rounded-[var(--radius-md)] px-4 py-4',
                  'bg-[var(--surface-raised)] border border-[var(--border-default)]',
                  'hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-sm)]',
                  'transition-all duration-150',
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-3">
                    {item.type === 'model-configs'
                      ? (
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.2fr)_100px_80px]">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">name</div>
                          <div className="text-[13px] font-medium text-[var(--text-primary)]">{item.name}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">provider</div>
                          <div className="text-[13px] text-[var(--text-secondary)]">{(item as any).provider || '-'}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">base url</div>
                          <div className="text-[13px] text-[var(--text-secondary)] truncate">{(item as any).baseUrl}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">api key</div>
                          <div className="text-[13px] font-mono text-[var(--text-secondary)]">{maskApiKey((item as any).apiKey)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">profiles</div>
                          <ProfileReferences itemType={item.type} itemId={item.id} referencedByMap={referencedByMap} />
                        </div>
                      </div>
                        )
                      : (
                    <div className="grid gap-3 md:grid-cols-[minmax(0,120px)_minmax(0,1fr)_minmax(0,1.4fr)_140px]">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">type</div>
                        <div className="text-[13px] font-medium text-[var(--text-primary)]">{item.type}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">name</div>
                        <div className="text-[13px] font-medium text-[var(--text-primary)]">{item.name}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">description</div>
                        <div className="text-[13px] text-[var(--text-secondary)]">{item.description || 'No description'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">profiles</div>
                        <ProfileReferences itemType={item.type} itemId={item.id} referencedByMap={referencedByMap} />
                      </div>
                    </div>
                        )}
                    {item.type !== 'model-configs' && item.provenance
                      ? (
                      <details className="group rounded-[var(--radius-md)] border border-[var(--border-default)]/80 bg-[var(--surface-overlay)]/40 px-3 py-2">
                        <summary className="flex cursor-pointer list-none items-center gap-2 text-[12px] text-[var(--text-tertiary)]">
                          <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
                          <Info size={14} />
                          Source details
                        </summary>
                        <div className="mt-2 space-y-1 text-[12px] text-[var(--text-secondary)]">
                          <div><span className="font-medium text-[var(--text-primary)]">importPath</span>: {item.provenance.importPath}</div>
                          <div><span className="font-medium text-[var(--text-primary)]">importedAt</span>: {new Date(item.provenance.importedAt).toLocaleString()}</div>
                        </div>
                      </details>
                        )
                      : null}
                  </div>
                  <div className="flex gap-0.5">
                  <motion.button
                    onClick={() => setEditing({ category: item.type, name: item.id })}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded-[var(--radius-sm)] hover:bg-[var(--surface-overlay)] transition-colors"
                  >
                    <Edit2 size={14} />
                  </motion.button>
                  <motion.button
                    onClick={() => handleDelete(item.type, item.id)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--accent-red)] rounded-[var(--radius-sm)] hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={14} />
                  </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
            )}

      {deleteTarget && (
        <DeleteConfirmDialog
          name={deleteTarget.name}
          referencedBy={deleteTarget.referencedBy}
          onConfirm={handleForceDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {showImportDialog
        ? (
        <ImportComponentsDialog onClose={() => setShowImportDialog(false)} />
          )
        : null}
    </div>
  )
}
