// Detail view for a single entity — renders frontmatter meta strip + markdown body
// with back navigation and optional edit/delete actions.
import { motion, useReducedMotion } from 'framer-motion'
import {
  ChevronLeft,
  Pencil,
  Trash2,
} from 'lucide-react'

import { MarkdownRenderer } from './markdown-renderer'
import { Button } from '@/components/ui/button'

const motionEaseOut = [0.23, 1, 0.32, 1] as const

/** A single key-value metadata row shown in the frontmatter strip. */
interface MetaItem {
  label: string
  value: string
}

/** Properties for the {@link EntityDetail} component. */
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

/** Full-page detail view for an entity. Renders a frontmatter header with
 *  metadata, action buttons (edit/delete), and a markdown-rendered body.
 *  Project-scoped entities are read-only. */
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
  // Project-scoped entities cannot be edited from this UI
  const isReadOnly = scope === 'project'
  const reduceMotion = useReducedMotion() ?? false
  const pageMotion = reduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.12, ease: motionEaseOut },
      }
    : {
        initial: { opacity: 0, transform: 'translateX(8px)' },
        animate: { opacity: 1, transform: 'translateX(0px)' },
        exit: { opacity: 0, transform: 'translateX(-8px)' },
        transition: { duration: 0.18, ease: motionEaseOut },
      }
  const blockMotion = reduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.12, ease: motionEaseOut },
      }
    : {
        initial: { opacity: 0, transform: 'translateY(6px)' },
        animate: { opacity: 1, transform: 'translateY(0px)' },
        transition: { duration: 0.16, ease: motionEaseOut },
      }

  return (
    <motion.div
      {...pageMotion}
      data-testid="entity-detail-motion"
      data-motion-role="entity-detail"
      className="size-full max-w-[920px]"
    >
      <button
        onClick={onBack}
        type="button"
        className="transition-smooth -ml-2 mb-5 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
      >
        <ChevronLeft size={14} />
        <span>Back to {title}</span>
      </button>

      {isReadOnly && (
        <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--accent-signal)]/20 bg-[var(--accent-signal)]/5 px-4 py-2 text-[13px] text-[var(--accent-signal)]">
          From project directory — view only.
        </div>
      )}

      {/* Document header — frontmatter strip */}
      <motion.div
        {...blockMotion}
        className="mb-6 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-7 py-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="deco-title-shadow font-display text-[28px] font-semibold tracking-normal text-[var(--text-primary)]">{name}</h1>
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
                <Button
                  type="button"
                  onClick={onEdit}
                  variant="outline"
                  size="sm"
                  className="rounded-[var(--radius-sm)] border-[var(--border-default)] bg-[var(--bg-hover)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                >
                  <Pencil size={12} />
                  Edit
                </Button>
                  )
                : null}
              {onDelete
                ? (
                <Button
                  type="button"
                  onClick={onDelete}
                  aria-label="Delete"
                  variant="outline"
                  size="icon-sm"
                  className="rounded-[var(--radius-sm)] border-[var(--border-default)] bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                >
                  <Trash2 size={12} />
                </Button>
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
        transition={{ duration: 0.16, delay: reduceMotion ? 0 : 0.04, ease: motionEaseOut }}
        className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-raised)] p-9"
      >
        <MarkdownRenderer content={content} />
      </motion.article>
    </motion.div>
  )
}
