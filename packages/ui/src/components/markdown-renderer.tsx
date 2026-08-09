// Lightweight Markdown renderer using react-markdown with GitHub-Flavored Markdown support.
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { cn } from '@/lib/utils'

/** Properties for the {@link MarkdownRenderer} component. */
interface MarkdownRendererProperties {
  /** Raw markdown string to render. */
  content: string
  /** Additional CSS classes applied to the wrapper div. */
  className?: string
}

/** Renders markdown content with GFM (tables, strikethrough, task lists). */
export function MarkdownRenderer({ content, className }: MarkdownRendererProperties) {
  return (
    <div className={cn('prose prose-sm prose-invert mx-auto max-w-none', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}
