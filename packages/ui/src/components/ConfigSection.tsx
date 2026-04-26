import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { SectionHeader } from './SectionHeader';
import { SourceBadge } from './SourceBadge';
import type { IconType } from './icons';
import type { ConfigEntry } from '../hooks/useConfigs';

interface ConfigEntryCardProps {
  name: string;
  data: Record<string, unknown>;
  icon: IconType;
  iconColor: string;
  source?: 'local' | 'plugin' | 'project';
  scope?: 'global' | 'project';
  pluginId?: string;
}

function ConfigEntryCard({ name, data, icon: Icon, iconColor, source = 'local', pluginId }: ConfigEntryCardProps) {
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
  );
}

interface ConfigSectionProps {
  title: string;
  description: ReactNode;
  data: ConfigEntry[] | undefined;
  isLoading: boolean;
  isError: boolean;
  icon: IconType;
  iconColor: string;
  emptyMessage: string;
}

export function ConfigSection({
  title,
  description,
  data,
  isLoading,
  isError,
  icon,
  iconColor,
  emptyMessage,
}: ConfigSectionProps) {
  return (
    <div>
      <SectionHeader title={title} description={description} />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={20} className="animate-spin text-[var(--text-tertiary)]" />
        </div>
      ) : isError ? (
        <div className="panel-subtle flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-panel)]">
            <Loader2 size={20} className="text-[var(--accent-red)]" />
          </div>
          <h3 className="text-[16px] font-medium text-[var(--text-primary)]">Failed to load {title.toLowerCase()}</h3>
          <p className="mt-2 max-w-sm text-[14px] text-[var(--text-tertiary)]">
            Something went wrong while fetching your {title.toLowerCase()}. Try refreshing the page.
          </p>
        </div>
      ) : data && data.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {data.map((entry) => (
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
      ) : (
        <div className="panel-subtle flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-panel)]">
            <div className="size-5 rounded-full border-2 border-dashed border-[var(--text-tertiary)]" />
          </div>
          <h3 className="text-[16px] font-medium text-[var(--text-primary)]">No {title.toLowerCase()} configured</h3>
          <p className="mt-2 max-w-sm text-[14px] text-[var(--text-tertiary)]">
            {emptyMessage}
          </p>
        </div>
      )}
    </div>
  );
}
