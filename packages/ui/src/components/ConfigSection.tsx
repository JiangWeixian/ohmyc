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
    <Card className="panel p-5 transition-smooth hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-sm)]">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-panel)]">
          <Icon size={16} className={iconColor} />
        </div>
        <h3 className="text-[14px] font-medium text-[var(--text-primary)]">{name}</h3>
        <SourceBadge source={source} pluginId={pluginId} />
      </div>
      <pre className="panel-subtle max-h-48 overflow-x-auto p-4 text-[12px] text-[var(--text-secondary)]">
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
        <div className="panel-subtle py-16 text-center text-[var(--text-tertiary)]">
          Failed to load {title.toLowerCase()}.
        </div>
      ) : data && data.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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
        <div className="panel-subtle py-16 text-center text-[var(--text-tertiary)]">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}
