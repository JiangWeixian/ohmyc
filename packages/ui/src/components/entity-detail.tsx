import { motion } from 'framer-motion'
import { ChevronLeft, Pencil, Trash2 } from 'lucide-react'

import { MarkdownRenderer } from './markdown-renderer'

interface MetaItem {
  label: string
  value: string
}

interface EntityDetailProperties {
  title: string
  name: string
  description?: string
  content: string
  meta?: MetaItem[]
  onBack: () => void
  onEdit?: () => void
  onDelete?: () => void
  scope?: 'global' | 'project'
}

export function EntityDetail({
  title,
  name,
  description,
  content,
  meta = [],
  onBack,
  onEdit,
  onDelete,
  scope,
}: EntityDetailProperties) {
  const isReadOnly = scope === 'project'

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="mx-auto h-full w-full max-w-[920px]"
    >
      <button
        onClick={onBack}
        type="button"
        className="-ml-2 mb-5 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] transition-smooth hover:bg-white/[0.03] hover:text-[var(--text-primary)]"
      >
        <ChevronLeft size={14} />
        <span>Back to {title}</span>
      </button>

      {isReadOnly && (
        <div className="mb-4 rounded-[var(--radius-md)] border border-[#22c55e]/20 bg-[#22c55e]/5 px-4 py-2 text-[13px] text-[#22c55e]">
          From project directory — view only.
        </div>
      )}

      {/* Document header — frontmatter strip */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="mb-6 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white/[0.02] px-7 py-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-[28px] font-semibold tracking-[-0.4px] text-[var(--text-primary)]">{name}</h1>
            {description
              ? (
              <p className="mt-1.5 max-w-[62ch] text-[15px] leading-[1.55] text-[var(--text-secondary)]">{description}</p>
                )
              : null}
          </div>
          {!isReadOnly && (onEdit || onDelete)
            ? (
            <div className="flex shrink-0 gap-1.5">
              {onEdit
                ? (
                <button
                  type="button"
                  onClick={onEdit}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-white/[0.04] px-2.5 py-1.5 text-[12px] font-medium text-[var(--text-primary)] transition-smooth hover:bg-white/[0.08]"
                >
                  <Pencil size={12} />
                  Edit
                </button>
                  )
                : null}
              {onDelete
                ? (
                <button
                  type="button"
                  onClick={onDelete}
                  aria-label="Delete"
                  className="inline-flex size-[28px] items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-white/[0.04] text-[var(--text-tertiary)] transition-smooth hover:bg-white/[0.08] hover:text-[var(--text-primary)]"
                >
                  <Trash2 size={12} />
                </button>
                  )
                : null}
            </div>
              )
            : null}
        </div>

        {meta.length > 0
          ? (
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-[var(--border-subtle)] pt-3.5 font-mono text-[11px] text-[var(--text-tertiary)]">
            {meta.map(item => (
              <span key={item.label} className="inline-flex items-center gap-1.5">
                <span className="text-[var(--text-quaternary)]">{item.label}</span>
                <span>·</span>
                <span>{item.value}</span>
              </span>
            ))}
          </div>
            )
          : null}
      </motion.div>

      {/* Prose body */}
      <motion.article
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18, delay: 0.05, ease: 'easeOut' }}
        className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white/[0.02] px-9 py-9"
      >
        <MarkdownRenderer content={content} />
      </motion.article>
    </motion.div>
  )
}
