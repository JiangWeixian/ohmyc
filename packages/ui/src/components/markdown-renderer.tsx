// Lightweight Markdown renderer using react-markdown with GitHub-Flavored Markdown support.
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { cn } from '@/lib/utils'

const proseStyles = `
.prose-ohmyc {
  --tw-prose-body: var(--text-secondary);
  --tw-prose-headings: var(--text-primary);
  --tw-prose-lead: var(--text-secondary);
  --tw-prose-links: var(--text-primary);
  --tw-prose-bold: var(--text-primary);
  --tw-prose-counters: var(--text-tertiary);
  --tw-prose-bullets: var(--text-quaternary);
  --tw-prose-hr: var(--border-default);
  --tw-prose-quotes: var(--text-secondary);
  --tw-prose-quote-borders: var(--border-default);
  --tw-prose-captions: var(--text-tertiary);
  --tw-prose-code: var(--text-primary);
  --tw-prose-pre-code: var(--text-primary);
  --tw-prose-pre-bg: #08090a;
  --tw-prose-th-borders: var(--border-default);
  --tw-prose-td-borders: var(--border-default);
  font-size: 1rem;
  line-height: 1.7;
  max-width: 72ch;
}
.prose-ohmyc :where(code):not(:where([class~="not-prose"] *)) {
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.9em;
  background: rgba(255, 255, 255, 0.06);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-weight: 500;
}
.prose-ohmyc :where(code):not(:where([class~="not-prose"] *))::before,
.prose-ohmyc :where(code):not(:where([class~="not-prose"] *))::after {
  content: none;
}
.prose-ohmyc :where(pre):not(:where([class~="not-prose"] *)) {
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.875rem;
  line-height: 1.6;
  padding: 1rem 1.25rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
}
.prose-ohmyc :where(pre code):not(:where([class~="not-prose"] *)) {
  background: transparent;
  padding: 0;
  border-radius: 0;
  font-weight: 400;
}
.prose-ohmyc :where(h2):not(:where([class~="not-prose"] *)) {
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.0125rem;
  margin-top: 2em;
  margin-bottom: 0.6em;
}
.prose-ohmyc :where(h3):not(:where([class~="not-prose"] *)) {
  font-size: 1.125rem;
  font-weight: 600;
  letter-spacing: -0.01rem;
  margin-top: 1.6em;
  margin-bottom: 0.5em;
}
.prose-ohmyc :where(a):not(:where([class~="not-prose"] *)) {
  text-decoration: underline;
  text-underline-offset: 0.1875rem;
  text-decoration-color: color-mix(in oklab, var(--text-primary) 40%, transparent);
  font-weight: 500;
}
.prose-ohmyc :where(blockquote):not(:where([class~="not-prose"] *)) {
  border-left: 2px solid var(--border-default);
  font-style: normal;
  font-weight: 400;
  quotes: none;
}
.prose-ohmyc :where(blockquote p):not(:where([class~="not-prose"] *))::before,
.prose-ohmyc :where(blockquote p):not(:where([class~="not-prose"] *))::after {
  content: none;
}
.prose-ohmyc :where(table):not(:where([class~="not-prose"] *)) {
  font-size: 0.875rem;
}
`

/** Properties for the {@link MarkdownRenderer} component. */
interface MarkdownRendererProperties {
  /** Raw markdown string to render. */
  content: string
  /** Additional CSS classes applied to the wrapper div. */
  className?: string
}

/** Renders markdown content with GFM (tables, strikethrough, task lists)
 *  using the OhMyC prose typography styles. */
export function MarkdownRenderer({ content, className }: MarkdownRendererProperties) {
  return (
    <>
      <style>{proseStyles}</style>
      <div className={cn('prose prose-ohmyc mx-auto', className)}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </>
  )
}
