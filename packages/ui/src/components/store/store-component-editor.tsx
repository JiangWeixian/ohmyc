// Store component editor — unified markdown editor with frontmatter validation,
// or a dedicated form for model-configs. Handles create and update flows.
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  useCreateStoreAgent,
  useCreateStoreCommand,
  useCreateStoreSkill,
  useStoreAgent,
  useStoreCommand,
  useStoreSkill,
  useUpdateStoreAgent,
  useUpdateStoreCommand,
  useUpdateStoreSkill,
} from '../../hooks/use-store'
import { parseMarkdownDocument } from '../../lib/markdown-frontmatter'
import { MarkdownEditor } from '../markdown-editor'
import { DeleteConfirmDialog } from './delete-confirm-dialog'
import { ModelConfigEditor } from './model-config-editor'
import { cn } from '@/lib/utils'

// ═══════════ Types & Constants ═══════════

interface StoreComponentEditorProperties {
  category: 'agents' | 'commands' | 'model-configs' | 'skills'
  editName?: string
  onSaved: () => void
  onCancel: () => void
}

/** Scaffold templates shown when creating a new component. */
const SCAFFOLDS: Record<'agents' | 'commands' | 'skills', string> = {
  agents: `---
name:
description:
model: sonnet
---

You are…
`,
  skills: `---
name:
description:
---

# Overview

Describe what this skill does.
`,
  commands: `---
name:
description:
---

Slash command body — executed when the user types /name.
`,
}

/** Returns a human-readable singular noun for a category key. */
function singularize(category: 'agents' | 'commands' | 'skills'): string {
  return category === 'agents' ? 'agent' : (category === 'skills' ? 'skill' : 'command')
}

// ═══════════ Public Router Component ═══════════

/**
 * Top-level editor that delegates to the markdown editor for agents/skills/commands
 * or to ModelConfigEditor for model-configs.
 */
export function StoreComponentEditor({ category, editName, onSaved, onCancel }: StoreComponentEditorProperties) {
  if (category === 'model-configs') {
    return <ModelConfigEditor editName={editName} onSaved={onSaved} onCancel={onCancel} />
  }
  return (
    <MarkdownDocEditor
      category={category}
      editName={editName}
      onSaved={onSaved}
      onCancel={onCancel}
    />
  )
}

// ═══════════ Markdown Document Editor ═══════════

/**
 * Internal markdown-based editor for agents, skills, and commands.
 * Manages frontmatter parsing, validation, and the create/update lifecycle.
 */
function MarkdownDocEditor({
  category,
  editName,
  onSaved,
  onCancel,
}: {
  category: 'agents' | 'commands' | 'skills'
  editName?: string
  onSaved: () => void
  onCancel: () => void
}) {
  const isEdit = !!editName

  const agentQ = useStoreAgent(category === 'agents' ? (editName ?? null) : null)
  const skillQ = useStoreSkill(category === 'skills' ? (editName ?? null) : null)
  const commandQ = useStoreCommand(category === 'commands' ? (editName ?? null) : null)

  const existing = category === 'agents' ? agentQ.data : (category === 'skills' ? skillQ.data : commandQ.data)

  const [filename, setFilename] = useState('')
  const [buffer, setBuffer] = useState<string>(() => SCAFFOLDS[category])
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Hydrate editor buffer from the server response. Prefers the raw markdown
  // string; falls back to reconstructing via stringifyFrontmatterFallback.
  useEffect(() => {
    if (!existing) {
      return
    }
    const initial = existing.raw && existing.raw.length > 0
      ? existing.raw
      : `---\n${stringifyFrontmatterFallback(existing.frontmatter)}---\n\n${existing.content}`
    /* eslint-disable react-hooks/set-state-in-effect, react/set-state-in-effect, react-hooks-extra/set-state-in-effect, react-naming-convention/set-state-in-effect */
    setBuffer(prev => (prev === initial ? prev : initial))
    setDirty(false)
    /* eslint-enable react-hooks/set-state-in-effect, react/set-state-in-effect, react-hooks-extra/set-state-in-effect, react-naming-convention/set-state-in-effect */
  }, [existing])

  const createAgent = useCreateStoreAgent()
  const updateAgent = useUpdateStoreAgent()
  const createSkill = useCreateStoreSkill()
  const updateSkill = useUpdateStoreSkill()
  const createCommand = useCreateStoreCommand()
  const updateCommand = useUpdateStoreCommand()

  const isSaving = [createAgent, updateAgent, createSkill, updateSkill, createCommand, updateCommand].some(m => m.isPending)

  // Parsed frontmatter state — used to drive validation pills and save gating.
  const parsed = useMemo(() => parseMarkdownDocument(buffer), [buffer])
  const lineCount = useMemo(() => buffer.split('\n').length, [buffer])

  const frontmatterName = parsed.ok ? (parsed.frontmatter.name as string | undefined) : undefined
  const frontmatterDescription = parsed.ok ? (parsed.frontmatter.description as string | undefined) : undefined
  const hasName = !!(frontmatterName && String(frontmatterName).trim())
  const requiresDescription = category === 'agents'
  const hasDescription = !!(frontmatterDescription && String(frontmatterDescription).trim())

  const fileSlug = isEdit ? editName! : (filename.trim() || (hasName ? String(frontmatterName).trim() : 'untitled'))

  // Save is gated on: valid frontmatter, required name present, (description for agents),
  // no in-flight mutation, and either dirty or creating new.
  const canSave = parsed.ok && hasName && (!requiresDescription || hasDescription) && !isSaving && (dirty || !isEdit)

  const handleBufferChange = useCallback((next: string) => {
    setBuffer(next)
    setDirty(true)
    setError(null)
  }, [])

  // ═══════════ Save & Delete Flow ═══════════

  const handleSave = useCallback(() => {
    setError(null)
    if (!parsed.ok) {
      setError(`Frontmatter: ${parsed.message}${parsed.line ? ` (line ${parsed.line})` : ''}`)
      return
    }
    if (!hasName) {
      setError('Frontmatter `name` is required')
      return
    }
    if (requiresDescription && !hasDescription) {
      setError('Frontmatter `description` is required for agents')
      return
    }
    if (!isEdit && !filename.trim() && !hasName) {
      setError('Filename is required')
      return
    }

    // On create, use the filename input if provided; otherwise derive from frontmatter name.
    const slug = isEdit
      ? null
      : (filename.trim() || String((parsed.frontmatter as { name?: string }).name ?? '').trim())
    const frontmatter = slug
      ? { ...parsed.frontmatter, name: slug }
      : parsed.frontmatter
    const body = { frontmatter: frontmatter as any, content: parsed.content }
    const onSuccess = () => onSaved()
    const onError = (error_: any) => setError(error_?.message ?? 'Save failed')

    if (category === 'agents') {
      if (isEdit) {
        updateAgent.mutate({ name: editName!, body }, { onSuccess, onError })
      } else {
        createAgent.mutate(body, { onSuccess, onError })
      }
    } else if (category === 'skills') {
      if (isEdit) {
        updateSkill.mutate({ name: editName!, body }, { onSuccess, onError })
      } else {
        createSkill.mutate(body, { onSuccess, onError })
      }
    } else {
      if (isEdit) {
        updateCommand.mutate({ name: editName!, body }, { onSuccess, onError })
      } else {
        createCommand.mutate(body, { onSuccess, onError })
      }
    }
  }, [
    parsed, hasName, hasDescription, requiresDescription, isEdit, filename,
    category, editName, createAgent, updateAgent, createSkill, updateSkill,
    createCommand, updateCommand, onSaved,
  ])

  // ═══════════ Keyboard Shortcut ═══════════

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

  // ═══════════ Render ═══════════

  const breadcrumb = (
    <>
      <span>Store</span>
      <span className="mx-2 text-[var(--border-standard)]">/</span>
      <span className="capitalize">{category}</span>
      <span className="mx-2 text-[var(--border-standard)]">/</span>
      <span className="font-[510] text-[var(--text-primary)]">
        {isEdit ? editName : `New ${singularize(category)}`}
      </span>
    </>
  )

  // Hidden a11y title kept for legacy assertions
  const a11yTitle = isEdit ? `Edit ${editName}` : `New ${singularize(category)}`

  return (
    <div className="flex h-full min-w-0 flex-col">
      {/* Sticky save bar */}
      <header
        className={cn(
          'h-16 shrink-0 px-6 flex items-center justify-between',
          'bg-[var(--bg-panel)] border-b border-[var(--border-subtle)]',
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
                className="size-1.5 rounded-full bg-[var(--text-primary)]"
                style={{ boxShadow: '0 0 0 3px color-mix(in srgb, var(--text-primary) 12%, transparent)' }}
              />
              Unsaved changes
            </span>
          )}
          {isEdit && (
            <button
              type="button"
              onClick={() => setShowDeleteDialog(true)}
              className={cn(
                'h-9 px-3 rounded-md text-[13px] font-[510]',
                'border border-[var(--border-standard)] bg-transparent',
                'text-[var(--text-tertiary)]',
                'hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
                'transition-colors duration-150',
              )}
            >
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            className={cn(
              'h-9 px-3 rounded-md text-[13px] font-[510]',
              'border border-[var(--border-standard)] bg-[var(--surface-raised)]',
              'text-[var(--text-secondary)]',
              'hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)]',
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
            {isSaving ? 'Saving…' : 'Save'}
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

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[880px] px-14 pb-16 pt-7">
          {/* Filename row */}
          <div className="mb-4 flex items-center gap-3.5">
            <div className="flex items-center font-mono text-[13px]">
              <span
                className={cn(
                  'px-3 py-[9px] rounded-l-md',
                  'border border-[var(--border-default)] border-r-0',
                  'bg-[var(--surface-raised)] text-[var(--text-tertiary)]',
                )}
              >
                {category}
                /
              </span>
              <input
                aria-label="Filename"
                value={isEdit ? editName! : filename}
                disabled={isEdit}
                onChange={(e) => {
                  setFilename(e.target.value)
                  setDirty(true)
                }}
                placeholder={hasName ? String(frontmatterName) : `my-${singularize(category)}`}
                className={cn(
                  'min-w-[280px] px-3 py-[9px] outline-none',
                  'border border-[var(--border-default)]',
                  'bg-[var(--surface-raised)] text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)]',
                  'focus:border-[var(--border-hover)]',
                  'disabled:opacity-80 disabled:cursor-not-allowed',
                  'transition-colors duration-150',
                )}
              />
              <span
                className={cn(
                  'px-3 py-[9px] rounded-r-md',
                  'border border-[var(--border-default)] border-l-0',
                  'bg-[var(--surface-raised)] text-[var(--text-tertiary)]',
                )}
              >
                .md
              </span>
            </div>
            {isEdit && (
              <span className="text-[11px] text-[var(--text-quaternary)]">
                Disabled while editing.
              </span>
            )}
          </div>

          {/* The unified .md editor card */}
          <div
            className={cn(
              'rounded-[10px] overflow-hidden bg-[var(--bg-marketing)]',
              parsed.ok
                ? 'border border-[var(--border-default)]'
                : 'border border-[var(--border-hover)]',
            )}
          >
            {/* Card header chrome */}
            <div
              className={cn(
                'flex items-center justify-between gap-3 px-4 py-[11px]',
                'border-b border-[var(--border-subtle)] bg-[var(--surface-raised)]',
              )}
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] text-[var(--text-quaternary)]">.md</span>
                <span className="text-[12px] font-[510] text-[var(--text-primary)]">
                  {fileSlug}
                  .md
                </span>
                <span className="font-mono text-[11px] text-[var(--text-tertiary)]">
                  markdown · with frontmatter
                </span>
              </div>
              <div className="flex items-center gap-3.5 font-mono text-[11px] text-[var(--text-tertiary)]">
                <span>
                  {lineCount}
                  {' '}
                  lines
                </span>
                <span className="text-[var(--text-quaternary)]">·</span>
                <span>
                  {buffer.length}
                  {' '}
                  chars
                </span>
              </div>
            </div>

            {/* Code area */}
            <MarkdownEditor
              value={buffer}
              onChange={handleBufferChange}
              onSaveShortcut={() => canSave && handleSave()}
              placeholder="Edit the .md file directly — frontmatter between --- fences, body below."
            />

            {/* Footer parse status */}
            <div
              className={cn(
                'flex items-center justify-between gap-4 px-4 py-2.5',
                'border-t border-[var(--border-subtle)] bg-[var(--surface-raised)]',
                'font-mono text-[11px]',
              )}
            >
              <div className="flex items-center gap-[18px]">
                <StatusPill
                  ok={parsed.ok}
                  label={parsed.ok
                    ? 'frontmatter valid'
                    : `frontmatter invalid${parsed.line ? ` — line ${parsed.line}` : ''}`}
                />
                {parsed.ok
                  ? (
                    <StatusPill
                      ok={hasName}
                      label={hasName ? `name: ${frontmatterName}` : 'name missing'}
                    />
                    )
                  : (
                    <span className="text-[var(--text-secondary)]">{parsed.message}</span>
                    )}
                {parsed.ok && requiresDescription && (
                  <StatusPill
                    ok={hasDescription}
                    label={hasDescription ? 'description set' : 'description missing'}
                  />
                )}
              </div>
              <span className="text-[var(--text-quaternary)]">
                {canSave ? '⌘S to save' : 'save disabled'}
              </span>
            </div>
          </div>

          {error && parsed.ok && (
            <div className="mt-4 rounded-md border border-[var(--border-hover)] bg-[var(--bg-hover)] px-3.5 py-2.5 text-[13px] text-[var(--text-primary)]">
              {error}
            </div>
          )}
        </div>
      </div>

      {showDeleteDialog
        ? (
        <DeleteConfirmDialog
          name={editName ?? fileSlug}
          onConfirm={() => setShowDeleteDialog(false)}
          onCancel={() => setShowDeleteDialog(false)}
        />
          )
        : null}
    </div>
  )
}

/** Green/grey status indicator pill used in the editor footer. */
function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          ok ? 'bg-[var(--accent-signal)]' : 'bg-[var(--text-tertiary)]',
        )}
      />
      <span className={ok ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'}>{label}</span>
    </span>
  )
}

/**
 * Naive frontmatter serializer used only when `existing.raw` is missing.
 * Produces `key: value` lines for string values and `key: JSON` for others.
 */
function stringifyFrontmatterFallback(fm: Record<string, unknown>): string {
  const lines: string[] = []
  for (const [k, v] of Object.entries(fm)) {
    if (v === undefined || v === null) {
      continue
    }
    if (typeof v === 'string') {
      lines.push(`${k}: ${v}`)
    } else {
      try {
        lines.push(`${k}: ${JSON.stringify(v)}`)
      } catch {
        // skip
      }
    }
  }
  return lines.join('\n') + (lines.length > 0 ? '\n' : '')
}
