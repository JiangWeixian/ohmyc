// Profile editor — 5-section form (Basics, Components, Plugins & model,
// Runtime config, Settings overlay) with scroll-spy navigation, live JSON
// validation, and Cmd+S save support.

import {
  ChevronDown,
  Plus,
  Search,
  Sparkles,
  Terminal,
  User,
  X,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { usePlugins } from '../../hooks/use-plugins'
import { useCreateProfile, useUpdateProfile } from '../../hooks/use-profiles'
import {
  useStoreAgents,
  useStoreCommands,
  useStoreModelConfigs,
  useStoreSkills,
} from '../../hooks/use-store'
import { JsonEditor } from '../json-editor'
import { cn } from '@/lib/utils'

import type {
  CreateProfileBody,
  Profile,
  UpdateProfileBody,
} from '@ohmyc/shared'

interface ProfileEditorProperties {
  profile?: Profile
  onSaved: (name: string) => void
  onCancel: () => void
}

type SectionId = 'basics' | 'components' | 'plugins-model' | 'runtime' | 'settings'

// Ordered section metadata used by the left nav and scroll-spy
const SECTIONS: { id: SectionId; number: string; label: string }[] = [
  { id: 'basics', number: '01', label: 'Basics' },
  { id: 'components', number: '02', label: 'Components' },
  { id: 'plugins-model', number: '03', label: 'Plugins & model' },
  { id: 'runtime', number: '04', label: 'Runtime config' },
  { id: 'settings', number: '05', label: 'Settings overlay' },
]

/** Safe JSON parser returning a discriminated union instead of throwing. */
function tryParseJson(value: string): { ok: false; error: string } | { ok: true; data: unknown } {
  const trimmed = value.trim()
  if (!trimmed) {
    return { ok: true, data: undefined }
  }
  try {
    return { ok: true, data: JSON.parse(trimmed) }
  } catch {
    return { ok: false, error: 'must be valid JSON' }
  }
}

function SectionHeading({ number, title, meta }: { number: string; title: string; meta?: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 mb-1.5">
      <span className="font-mono text-[11px] tracking-[0.04em] text-[var(--text-quaternary)] w-[18px] shrink-0">
        {number}
      </span>
      <h2 className="text-[20px] font-[590] tracking-[-0.15px] text-[var(--text-primary)] m-0">
        {title}
      </h2>
      {meta && <div className="ml-auto">{meta}</div>}
    </div>
  )
}

function SectionSubtitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] text-[var(--text-tertiary)] m-0 mb-6 ml-7">
      {children}
    </p>
  )
}

function SectionBody({ children }: { children: React.ReactNode }) {
  return <div className="ml-7">{children}</div>
}

// ---------------------------------------------------------------------------
// PickerCard — searchable add/remove chip picker for store items
// ---------------------------------------------------------------------------

/**
 * Generic picker card with a search-triggered dropdown. Renders selected items
 * as removable chips and shows an "Add" flow that filters the unselected pool.
 * Closes on outside-click via a document mousedown listener.
 */
function PickerCard({
  icon: Icon,
  label,
  singular,
  available,
  selected,
  onChange,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  singular: string
  available: { id: string }[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const unselected = useMemo(() => {
    const set = new Set(selected)
    const q = search.trim().toLowerCase()
    return available
      .filter(it => !set.has(it.id))
      .filter(it => !q || it.id.toLowerCase().includes(q))
  }, [available, selected, search])

  useEffect(() => {
    if (!open) {
      return
    }
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const remove = (id: string) => onChange(selected.filter(x => x !== id))
  const add = (id: string) => {
    onChange([...selected, id])
    setSearch('')
  }

  const isEmpty = selected.length === 0

  return (
    <div
      ref={containerRef}
      className={cn(
        'rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]',
        'overflow-hidden',
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between gap-3 px-3.5 py-3',
          !isEmpty && 'border-b border-[rgba(255,255,255,0.05)]',
        )}
      >
        <div className="flex items-center gap-2.5">
          <Icon size={14} className="text-[var(--text-secondary)]" />
          <span className="text-[13px] font-[510] text-[var(--text-primary)]">{label}</span>
          <span className="font-mono text-[11px] text-[var(--text-tertiary)]">
            {available.length === 0 ? 'none' : `${selected.length} / ${available.length}`}
          </span>
        </div>

        {isEmpty
          ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              disabled={available.length === 0}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1',
                'border-[rgba(255,255,255,0.12)] text-[12px] text-[var(--text-tertiary)]',
                'hover:border-[rgba(255,255,255,0.2)] hover:text-[var(--text-secondary)]',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors duration-150',
              )}
            >
              <Plus size={11} />
              {' '}
              Add
              {' '}
              {singular}
            </button>
            )
          : (
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 w-[200px]',
                'border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]',
                'focus-within:border-[rgba(255,255,255,0.14)]',
                'transition-colors duration-150',
              )}
            >
              <Search size={12} className="text-[var(--text-tertiary)] shrink-0" />
              <input
                aria-label={`Search ${label.toLowerCase()}`}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onFocus={() => setOpen(true)}
                placeholder={`Search ${label.toLowerCase()}…`}
                className="flex-1 min-w-0 bg-transparent text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
              />
            </div>
            )}
      </div>

      {!isEmpty && (
        <div className="flex flex-wrap gap-1.5 px-3.5 py-3">
          {selected.map(id => (
            <span
              key={id}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full pl-2.5 pr-1 py-[5px]',
                'bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)]',
                'text-[12px] font-[510] text-[var(--text-primary)]',
              )}
            >
              {id}
              <button
                type="button"
                aria-label={`Remove ${id}`}
                onClick={() => remove(id)}
                className={cn(
                  'inline-flex items-center justify-center w-4 h-4 rounded-full',
                  'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]',
                  'hover:bg-[rgba(255,255,255,0.08)] transition-colors duration-150',
                )}
              >
                <X size={10} />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            disabled={unselected.length === 0 && !search}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-[5px]',
              'border-[rgba(255,255,255,0.12)] text-[12px] text-[var(--text-tertiary)]',
              'hover:border-[rgba(255,255,255,0.2)] hover:text-[var(--text-secondary)]',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors duration-150',
            )}
          >
            <Plus size={11} />
            {' '}
            Add
            {' '}
            {singular}
          </button>
        </div>
      )}

      {open && available.length > 0 && (
        <div className="border-t border-[rgba(255,255,255,0.05)] max-h-[180px] overflow-y-auto">
          {unselected.length === 0
            ? (
              <div className="px-3.5 py-3 text-[12px] text-[var(--text-tertiary)] font-mono">
                {search ? `No ${label.toLowerCase()} match "${search}"` : 'All added'}
              </div>
              )
            : unselected.map(it => (
              <button
                key={it.id}
                type="button"
                onClick={() => add(it.id)}
                className={cn(
                  'flex w-full items-center gap-2 px-3.5 py-2 text-left',
                  'text-[12px] text-[var(--text-secondary)]',
                  'hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--text-primary)]',
                  'transition-colors duration-150',
                )}
              >
                <Plus size={11} className="text-[var(--text-quaternary)]" />
                {it.id}
              </button>
              ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CodePanel — JSON editor panel with live validation indicator
// ---------------------------------------------------------------------------

/**
 * Dark-themed JSON editor card. Shows a header with the field name, a hint,
 * and a live valid/invalid badge, then delegates to JsonEditor for editing.
 */
function CodePanel({
  name,
  hint,
  value,
  onChange,
  error,
}: {
  name: string
  hint?: string
  value: string
  onChange: (v: string) => void
  error?: string | null
}) {
  return (
    <div
      className={cn(
        'rounded-lg overflow-hidden bg-[#08090a]',
        error
          ? 'border border-[rgba(255,255,255,0.18)]'
          : 'border border-[rgba(255,255,255,0.08)]',
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between gap-3 px-3.5 py-2.5',
          'bg-[rgba(255,255,255,0.02)] border-b border-[rgba(255,255,255,0.05)]',
        )}
      >
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[11px] text-[var(--text-quaternary)]">{'{ }'}</span>
          <span className="text-[12px] font-[510] text-[var(--text-primary)]">{name}</span>
          {hint && <span className="font-mono text-[11px] text-[var(--text-tertiary)]">{hint}</span>}
        </div>
        {error
          ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--text-primary)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-primary)]" />
              {error}
            </span>
            )
          : (
            <span className="font-mono text-[11px] text-[var(--text-tertiary)]">valid</span>
            )}
      </div>
      <JsonEditor value={value} onChange={onChange} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProfileEditor — main exported component
// ---------------------------------------------------------------------------

/**
 * Full-screen profile editor with a sticky save bar, scroll-spy section nav,
 * and live JSON validation. Supports both create and edit modes (the presence
 * of the `profile` prop determines which).
 */
export function ProfileEditor({ profile, onSaved, onCancel }: ProfileEditorProperties) {
  const isEdit = !!profile

  const [name, setName] = useState(profile?.name ?? '')
  const [description, setDescription] = useState(profile?.description ?? '')
  const [agents, setAgents] = useState<string[]>(profile?.agents ?? [])
  const [skills, setSkills] = useState<string[]>(profile?.skills ?? [])
  const [commands, setCommands] = useState<string[]>(profile?.commands ?? [])
  const [plugins, setPlugins] = useState<string[]>(profile?.plugins ?? [])
  const [modelConfig, setModelConfig] = useState<string | undefined>(profile?.modelConfig)
  const [hooksText, setHooksText] = useState(
    profile?.hooks ? JSON.stringify(profile.hooks, null, 2) : '',
  )
  const [mcpText, setMcpText] = useState(
    profile?.mcpServers ? JSON.stringify(profile.mcpServers, null, 2) : '',
  )
  const [lspText, setLspText] = useState(
    profile?.lspServers ? JSON.stringify(profile.lspServers, null, 2) : '',
  )
  const [settingsText, setSettingsText] = useState(
    profile?.settings ? JSON.stringify(profile.settings, null, 2) : '',
  )
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({})
  const [dirty, setDirty] = useState(false)
  const [activeSection, setActiveSection] = useState<SectionId>('basics')

  const createMut = useCreateProfile()
  const updateMut = useUpdateProfile()
  const agentsQ = useStoreAgents()
  const skillsQ = useStoreSkills()
  const commandsQ = useStoreCommands()
  const modelConfigsQ = useStoreModelConfigs()
  const pluginsQ = usePlugins()

  const isSaving = createMut.isPending || updateMut.isPending

  // Mark dirty whenever any tracked field changes
  const markDirty = () => {
    if (!dirty) {
      setDirty(true)
    }
  }
  // Wrap setters so any change flips dirty
  const wrap = <Value,>(setter: (v: Value) => void) => (v: Value) => {
    setter(v)
    markDirty()
  }

  // Live-validate JSON fields for the section-nav dot
  const liveJsonErrors = useMemo(() => {
    const errors: { runtime: boolean; settings: boolean } = { runtime: false, settings: false }
    if (!tryParseJson(hooksText).ok) {
      errors.runtime = true
    }
    if (!tryParseJson(mcpText).ok) {
      errors.runtime = true
    }
    if (!tryParseJson(lspText).ok) {
      errors.runtime = true
    }
    if (!tryParseJson(settingsText).ok) {
      errors.settings = true
    }
    return errors
  }, [hooksText, mcpText, lspText, settingsText])

  // isValid gates the save button; canSave also requires dirty state and no pending mutation
  const isValid = !liveJsonErrors.runtime && !liveJsonErrors.settings && (isEdit || name.trim().length > 0)
  const canSave = dirty && isValid && !isSaving

  // Collects all form state, validates JSON fields, and dispatches either
  // createMut or updateMut depending on mode.
  const handleSave = useCallback(() => {
    if (!isEdit && !name.trim()) {
      setError('Name is required')
      return
    }

    // Parse and validate every JSON text field
    const hooksResult = tryParseJson(hooksText)
    const mcpResult = tryParseJson(mcpText)
    const lspResult = tryParseJson(lspText)
    const settingsResult = tryParseJson(settingsText)

    const newFieldErrors: Record<string, string | null> = {}
    if (!hooksResult.ok) {
      newFieldErrors.hooks = `Hooks ${hooksResult.error}`
    }
    if (!mcpResult.ok) {
      newFieldErrors.mcp = `MCP Servers ${mcpResult.error}`
    }
    if (!lspResult.ok) {
      newFieldErrors.lsp = `LSP Servers ${lspResult.error}`
    }
    if (!settingsResult.ok) {
      newFieldErrors.settings = `Settings Overlay ${settingsResult.error}`
    }
    setFieldErrors(newFieldErrors)
    if (Object.keys(newFieldErrors).length > 0) {
      return
    }

    setError(null)

    const hooks = hooksResult.ok ? hooksResult.data : undefined
    const mcpServers = mcpResult.ok ? mcpResult.data : undefined
    const lspServers = lspResult.ok ? lspResult.data : undefined
    const settings = settingsResult.ok ? settingsResult.data as Record<string, unknown> | undefined : undefined

    // Branch: update existing profile vs. create new one
    if (isEdit) {
      const body: UpdateProfileBody = {
        description: description || undefined,
        agents,
        skills,
        commands,
        plugins,
        modelConfig,
        hooks,
        mcpServers,
        lspServers,
        settings,
      }
      updateMut.mutate(
        { name: profile!.name, body },
        {
          onSuccess: () => onSaved(profile!.name),
          onError: error_ => setError(error_.message),
        },
      )
      return
    }

    const body: CreateProfileBody = {
      name: name.trim(),
      description: description || undefined,
      agents,
      skills,
      commands,
      plugins,
      modelConfig,
      hooks,
      mcpServers,
      lspServers,
      settings,
    }
    createMut.mutate(body, {
      onSuccess: () => onSaved(name.trim()),
      onError: error_ => setError(error_.message),
    })
  }, [
    isEdit, name, description, agents, skills, commands, plugins, modelConfig,
    hooksText, mcpText, lspText, settingsText, profile, createMut, updateMut, onSaved,
  ])

  // ⌘S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (canSave) {
          handleSave()
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [canSave, handleSave])

  // Scroll-spy
  const sectionElementsRef = useRef<Record<SectionId, HTMLElement | null>>({
    basics: null,
    components: null,
    'plugins-model': null,
    runtime: null,
    settings: null,
  })
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = scrollContainerRef.current
    if (!root || typeof IntersectionObserver === 'undefined') {
      return
    }
    // rootMargin biases the trigger zone toward the top of the viewport so
    // the section you're actually reading is the one highlighted
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .toSorted((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visible) {
          const id = (visible.target as HTMLElement).dataset.sectionId as SectionId | undefined
          if (id) {
            setActiveSection(id)
          }
        }
      },
      { root, rootMargin: '-20% 0px -60% 0px', threshold: 0 },
    )
    for (const el of Object.values(sectionElementsRef.current)) {
      if (el) {
        observer.observe(el)
      }
    }
    return () => observer.disconnect()
  }, [])

  const scrollTo = (id: SectionId) => {
    const el = sectionElementsRef.current[id]
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const setSectionReference = useCallback((id: SectionId) => (el: HTMLElement | null) => {
    sectionElementsRef.current[id] = el
  }, [])

  const breadcrumb = isEdit
    ? <>Profiles<span className="mx-2 text-[rgba(255,255,255,0.08)]">/</span><span className="text-[var(--text-secondary)]">{profile!.name}</span><span className="mx-2 text-[rgba(255,255,255,0.08)]">/</span><span className="font-[510] text-[var(--text-primary)]">Edit</span></>
    : <>Profiles<span className="mx-2 text-[rgba(255,255,255,0.08)]">/</span><span className="font-[510] text-[var(--text-primary)]">New profile</span></>

  const sectionDots: Partial<Record<SectionId, boolean>> = {
    runtime: liveJsonErrors.runtime,
    settings: liveJsonErrors.settings,
  }

  // Hidden test-mode title (kept for backward compatibility w/ legacy assertions)
  const a11yTitle = isEdit ? `Edit ${profile!.name}` : 'New Profile'

  const componentMeta = (
    <span className="font-mono text-[11px] text-[var(--text-tertiary)]">
      {(agentsQ.data?.length ?? 0)}
      {' '}
      agents ·
      {' '}
      {(skillsQ.data?.length ?? 0)}
      {' '}
      skills ·
      {' '}
      {(commandsQ.data?.length ?? 0)}
      {' '}
      commands
    </span>
  )

  return (
    <div className="flex h-full min-w-0 flex-col">
      {/* Sticky save bar */}
      <header
        className={cn(
          'h-16 shrink-0 px-6 flex items-center justify-between',
          'bg-[#0f1011] border-b border-[rgba(255,255,255,0.05)]',
        )}
      >
        <span className="sr-only">{a11yTitle}</span>
        <nav className="flex items-center text-[13px] tracking-[-0.01em] text-[var(--text-tertiary)]">
          {breadcrumb}
        </nav>
        <div className="flex items-center gap-3">
          {dirty && (
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--text-tertiary)]">
              <span
                className="w-1.5 h-1.5 rounded-full bg-[var(--text-primary)]"
                style={{ boxShadow: '0 0 0 3px rgba(247,248,248,0.12)' }}
              />
              Unsaved changes
            </span>
          )}
          <button
            type="button"
            onClick={onCancel}
            className={cn(
              'h-9 px-3 rounded-md text-[13px] font-[510]',
              'border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]',
              'text-[var(--text-secondary)]',
              'hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--text-primary)] hover:border-[rgba(255,255,255,0.14)]',
              'transition-colors duration-150',
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className={cn(
              'h-9 px-3 inline-flex items-center gap-2 rounded-md text-[13px] font-[510]',
              'bg-[var(--text-primary)] text-[var(--bg-marketing)]',
              'hover:bg-[var(--text-secondary)]',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[var(--text-primary)]',
              'transition-colors duration-150',
            )}
          >
            {isSaving ? 'Saving…' : (isEdit ? 'Save profile' : 'Create profile')}
            <span
              className={cn(
                'font-mono text-[10px] font-[510] px-1 py-px rounded-sm',
                'bg-[rgba(0,0,0,0.25)] text-[var(--bg-marketing)]/80',
              )}
            >
              ⌘S
            </span>
          </button>
        </div>
      </header>

      {/* 2-pane body */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left section nav */}
        <aside className="w-[200px] shrink-0 border-r border-[rgba(255,255,255,0.05)] overflow-y-auto">
          <nav className="flex flex-col gap-0.5 px-4 py-8 pl-8">
            <div className="px-2.5 pb-3 pt-1 text-[11px] font-[510] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
              Sections
            </div>
            {SECTIONS.map((s) => {
              const isActive = activeSection === s.id
              const hasError = sectionDots[s.id]
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => scrollTo(s.id)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left',
                    'text-[13px] transition-colors duration-150',
                    isActive
                      ? 'bg-[rgba(255,255,255,0.06)] text-[var(--text-primary)] font-[510]'
                      : 'text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.03)]',
                  )}
                >
                  <span
                    className={cn(
                      'font-mono text-[11px] w-[18px] shrink-0',
                      isActive ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-quaternary)]',
                    )}
                  >
                    {s.number}
                  </span>
                  <span className="flex-1 truncate">{s.label}</span>
                  {hasError && (
                    <span
                      title="invalid JSON in this section"
                      className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)] shrink-0"
                    />
                  )}
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Scrollable content */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto min-w-0">
          <div className="max-w-[760px] mx-auto px-14 py-9 pb-24">

            {error && (
              <div className="mb-6 rounded-md border border-[rgba(255,255,255,0.18)] bg-[rgba(255,255,255,0.04)] px-3.5 py-2.5 text-[13px] text-[var(--text-primary)]">
                {error}
              </div>
            )}

            {/* Section 01: Basics */}
            <section
              ref={setSectionReference('basics')}
              data-section-id="basics"
              className="mb-14"
            >
              <SectionHeading number="01" title="Basics" />
              <SectionSubtitle>Name and description for this profile.</SectionSubtitle>
              <SectionBody>
                <div className="flex flex-col gap-5">
                  <div>
                    <label
                      htmlFor="profile-name"
                      className="block text-[11px] font-[510] uppercase tracking-[0.04em] text-[var(--text-tertiary)] mb-2"
                    >
                      Name
                    </label>
                    <input
                      id="profile-name"
                      value={name}
                      onChange={e => wrap(setName)(e.target.value)}
                      disabled={isEdit}
                      placeholder="my-profile"
                      className={cn(
                        'w-full h-9 px-3 font-mono rounded-md text-[13px]',
                        'border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]',
                        'text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]',
                        'focus:outline-none focus:border-[rgba(255,255,255,0.2)]',
                        'disabled:opacity-70 disabled:cursor-not-allowed',
                        'transition-colors duration-150',
                      )}
                    />
                    {isEdit && (
                      <p className="mt-1.5 text-[11px] text-[var(--text-quaternary)] m-0">
                        Cannot be changed after creation.
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor="profile-description"
                      className="block text-[11px] font-[510] uppercase tracking-[0.04em] text-[var(--text-tertiary)] mb-2"
                    >
                      Description
                    </label>
                    <input
                      id="profile-description"
                      value={description}
                      onChange={e => wrap(setDescription)(e.target.value)}
                      placeholder="What this profile is for…"
                      className={cn(
                        'w-full h-9 px-3 rounded-md text-[13px]',
                        'border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]',
                        'text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]',
                        'focus:outline-none focus:border-[rgba(255,255,255,0.2)]',
                        'transition-colors duration-150',
                      )}
                    />
                  </div>
                </div>
              </SectionBody>
            </section>

            {/* Section 02: Components */}
            <section
              ref={setSectionReference('components')}
              data-section-id="components"
              className="mb-14"
            >
              <SectionHeading number="02" title="Components" meta={componentMeta} />
              <SectionSubtitle>
                Pick from the canonical store. Click a chip to remove; type in the search to add.
              </SectionSubtitle>
              <SectionBody>
                <div className="flex flex-col gap-4">
                  <PickerCard
                    icon={User}
                    label="Agents"
                    singular="agent"
                    available={(agentsQ.data ?? []).map(it => ({ id: it.id }))}
                    selected={agents}
                    onChange={wrap(setAgents)}
                  />
                  <PickerCard
                    icon={Sparkles}
                    label="Skills"
                    singular="skill"
                    available={(skillsQ.data ?? []).map(it => ({ id: it.id }))}
                    selected={skills}
                    onChange={wrap(setSkills)}
                  />
                  <PickerCard
                    icon={Terminal}
                    label="Commands"
                    singular="command"
                    available={(commandsQ.data ?? []).map(it => ({ id: it.id }))}
                    selected={commands}
                    onChange={wrap(setCommands)}
                  />
                </div>
              </SectionBody>
            </section>

            {/* Section 03: Plugins & model */}
            <section
              ref={setSectionReference('plugins-model')}
              data-section-id="plugins-model"
              className="mb-14"
            >
              <SectionHeading number="03" title="Plugins & model" />
              <SectionSubtitle>
                Marketplace plugins to enable, and which model config drives the runtime.
              </SectionSubtitle>
              <SectionBody>
                <div className="flex flex-col gap-4">
                  <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-3.5">
                    <div className="text-[11px] font-[510] uppercase tracking-[0.04em] text-[var(--text-tertiary)] mb-3">
                      Plugins
                      {' '}
                      (
                      {pluginsQ.data?.length ?? 0}
                      )
                    </div>
                    {pluginsQ.isLoading
                      ? (
                        <div className="text-[13px] text-[var(--text-tertiary)]">Loading…</div>
                        )
                      : ((pluginsQ.data?.length ?? 0) === 0
                          ? (
                            <div className="text-[13px] text-[var(--text-tertiary)]">No plugins installed.</div>
                            )
                          : (
                            <div className="flex flex-col gap-1.5">
                              {pluginsQ.data!.map((p) => {
                                const checked = plugins.includes(p.id)
                                return (
                                  <label
                                    key={p.id}
                                    className={cn(
                                      'flex items-center gap-2.5 rounded-md px-2.5 py-2 cursor-pointer',
                                      checked && 'bg-[rgba(255,255,255,0.04)]',
                                      'hover:bg-[rgba(255,255,255,0.04)] transition-colors duration-150',
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        'flex items-center justify-center w-3.5 h-3.5 rounded-[3px] shrink-0',
                                        checked
                                          ? 'bg-[var(--text-primary)]'
                                          : 'border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]',
                                      )}
                                    >
                                      {checked && (
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--bg-marketing)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                          <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                      )}
                                    </span>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => wrap(setPlugins)(
                                        checked ? plugins.filter(x => x !== p.id) : [...plugins, p.id],
                                      )}
                                      className="sr-only"
                                    />
                                    <span
                                      className={cn(
                                        'text-[13px]',
                                        checked
                                          ? 'text-[var(--text-primary)] font-[510]'
                                          : 'text-[var(--text-secondary)]',
                                      )}
                                    >
                                      {p.name}
                                    </span>
                                    <span className="ml-auto font-mono text-[11px] text-[var(--text-tertiary)]">
                                      @
                                      {p.marketplace}
                                    </span>
                                  </label>
                                )
                              })}
                            </div>
                            ))}
                  </div>

                  <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-3.5">
                    <div className="text-[11px] font-[510] uppercase tracking-[0.04em] text-[var(--text-tertiary)] mb-3">
                      Model Config
                    </div>
                    {modelConfigsQ.isLoading
                      ? (
                        <div className="text-[13px] text-[var(--text-tertiary)]">Loading…</div>
                        )
                      : (
                        <div className="relative">
                          <select
                            aria-label="Model config"
                            value={modelConfig ?? '__none__'}
                            onChange={e => wrap(setModelConfig)(
                              e.target.value === '__none__' ? undefined : e.target.value,
                            )}
                            className={cn(
                              'appearance-none w-full h-9 pl-3 pr-9 rounded-md font-mono text-[13px]',
                              'border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]',
                              'text-[var(--text-primary)]',
                              'focus:outline-none focus:border-[rgba(255,255,255,0.2)]',
                              'transition-colors duration-150',
                            )}
                          >
                            <option value="__none__">none</option>
                            {[...(modelConfigsQ.data ?? [])]
                              .toSorted((a, b) => a.name.localeCompare(b.name))
                              .map(mc => (
                                <option key={mc.name} value={mc.name}>{mc.name}</option>
                              ))}
                          </select>
                          <ChevronDown
                            size={12}
                            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
                          />
                          {modelConfig && (
                            <div className="mt-2.5 flex items-center gap-1.5 font-mono text-[11px] text-[var(--text-tertiary)]">
                              <span>provider</span>
                              <span className="text-[var(--text-quaternary)]">·</span>
                              <span className="text-[var(--text-secondary)]">
                                {modelConfigsQ.data?.find(m => m.name === modelConfig)?.provider ?? 'custom'}
                              </span>
                            </div>
                          )}
                        </div>
                        )}
                  </div>
                </div>
              </SectionBody>
            </section>

            {/* Section 04: Runtime config — code mode */}
            <section
              ref={setSectionReference('runtime')}
              data-section-id="runtime"
              className="mb-14"
            >
              <SectionHeading
                number="04"
                title="Runtime config"
                meta={liveJsonErrors.runtime && (
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--text-tertiary)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)]" />
                    invalid JSON
                  </span>
                )}
              />
              <SectionSubtitle>
                Hooks, MCP, and LSP servers. Raw JSON — keys validated on save.
              </SectionSubtitle>
              <SectionBody>
                <div className="flex flex-col gap-3.5">
                  <CodePanel
                    name="hooks"
                    hint="preToolUse, postToolUse"
                    value={hooksText}
                    onChange={wrap(setHooksText)}
                    error={fieldErrors.hooks || (tryParseJson(hooksText).ok ? null : 'Hooks must be valid JSON')}
                  />
                  <CodePanel
                    name="mcpServers"
                    value={mcpText}
                    onChange={wrap(setMcpText)}
                    error={fieldErrors.mcp || (tryParseJson(mcpText).ok ? null : 'MCP Servers must be valid JSON')}
                  />
                  <CodePanel
                    name="lspServers"
                    value={lspText}
                    onChange={wrap(setLspText)}
                    error={fieldErrors.lsp || (tryParseJson(lspText).ok ? null : 'LSP Servers must be valid JSON')}
                  />
                </div>
              </SectionBody>
            </section>

            {/* Section 05: Settings overlay — code mode */}
            <section
              ref={setSectionReference('settings')}
              data-section-id="settings"
              className="mb-14"
            >
              <SectionHeading
                number="05"
                title="Settings overlay"
                meta={liveJsonErrors.settings && (
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--text-tertiary)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)]" />
                    invalid JSON
                  </span>
                )}
              />
              <SectionSubtitle>
                Override Claude runtime settings like model and effort level.
              </SectionSubtitle>
              <SectionBody>
                <CodePanel
                  name="settings"
                  value={settingsText}
                  onChange={wrap(setSettingsText)}
                  error={fieldErrors.settings || (tryParseJson(settingsText).ok ? null : 'Settings Overlay must be valid JSON')}
                />
              </SectionBody>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
