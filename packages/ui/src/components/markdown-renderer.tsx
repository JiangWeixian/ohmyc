import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { cn } from '@/lib/utils'

interface MarkdownRendererProperties {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProperties) {
  return (
    <div className={cn('prose prose-ohmyc mx-auto', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}
