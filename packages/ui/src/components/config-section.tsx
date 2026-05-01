import { AlertCircle } from 'lucide-react'

import { SectionHeader } from './section-header'
import { SourceBadge } from './source-badge'
import { Card } from '@/components/ui/card'

import type { ReactNode } from 'react'
import type { ConfigEntry } from '../hooks/use-configs'
import type { IconType } from './icons'

interface ConfigEntryCardProperties {
  name: string
  data: Record<string, unknown>
  icon: IconType
  iconColor: string
  source?: 'local' | 'plugin' | 'project'
  scope?: 'global' | 'project'
  pluginId?: string
}

function ConfigEntryCard({ name, data, icon: Icon, iconColor, source = 'local', pluginId }: ConfigEntryCardProperties) {
  return (
    <Card className="panel p-6 transition-smooth hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-sm)]">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-panel)] transition-all duration-300 hover:border-[var(--border-hover)]">
          <Icon size={16} className={iconColor} />
        </div>
        <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">{name}</h3>
        <SourceBadge source={source} pluginId={pluginId} />
      </div>
      <pre className="panel-subtle max-h-48 overflow-x-auto p-4 text-[12px] leading-relaxed text-[var(--text-secondary)]">
        {JSON.stringify(data, null, 2)}
      </pre>
    </Card>
  )
}

interface ConfigSectionProperties {
  title: string
  description: ReactNode
  data: ConfigEntry[] | undefined
  isError: boolean
  icon: IconType
  iconColor: string
  emptyMessage: string
}

export function ConfigSection({
  title,
  description,
  data,
  isError,
  icon,
  iconColor,
  emptyMessage,
}: ConfigSectionProperties) {
  function renderContent() {
    if (isError) {
      return (
        <div className="panel-subtle flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-panel)]">
            <AlertCircle size={20} className="text-[var(--text-tertiary)]" />
          </div>
          <h3 className="text-[16px] font-medium text-[var(--text-primary)]">Failed to load {title.toLowerCase()}</h3>
          <p className="mt-2 max-w-sm text-[14px] text-[var(--text-tertiary)]">
            Something went wrong while fetching your {title.toLowerCase()}. Try refreshing the page.
          </p>
        </div>
      )
    }

    if (data && data.length > 0) {
      return (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {data.map(entry => (
            <ConfigEntryCard
              key={`${entry.source}-${entry.name}-${entry.scope ?? 'global'}`}
              name={entry.name}
              data={entry.config}
              icon={icon}
              iconColor={iconColor}
              source={entry.source}
              scope={entry.scope}
              pluginId={entry.pluginId}
            />
          ))}
        </div>
      )
    }

    return (
      <div className="panel-subtle flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-3 flex size-12 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-panel)]">
          <div className="size-5 rounded-full border-2 border-dashed border-[var(--text-tertiary)]" />
        </div>
        <h3 className="text-[16px] font-medium text-[var(--text-primary)]">No {title.toLowerCase()} configured</h3>
        <p className="mt-2 max-w-sm text-[14px] text-[var(--text-tertiary)]">
          {emptyMessage}
        </p>
      </div>
    )
  }

  return (
    <div>
      <SectionHeader title={title} description={description} />
      {renderContent()}
    </div>
  )
}
