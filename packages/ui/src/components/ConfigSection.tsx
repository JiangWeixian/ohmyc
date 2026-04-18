import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { SectionHeader } from './SectionHeader';
import { SourceBadge } from './SourceBadge';
import type { IconType } from './icons';
import type { ConfigEntry } from '../hooks/useConfigs';

interface ConfigEntryCardProps {
  name: string;
  data: Record<string, unknown>;
  icon: IconType;
  iconColor: string;
  index: number;
  source?: 'local' | 'plugin' | 'project';
  scope?: 'global' | 'project';
  pluginId?: string;
}

function ConfigEntryCard({ name, data, icon: Icon, iconColor, index, source = 'local', pluginId }: ConfigEntryCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -1 }}
      className="panel p-5 transition-smooth hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-sm)]"
    >
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
    </motion.div>
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <SectionHeader title={title} description={description} />

      {isLoading ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center py-20">
          <Loader2 size={20} className="animate-spin text-[var(--text-tertiary)]" />
        </motion.div>
      ) : isError ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel-subtle py-16 text-center text-[var(--text-tertiary)]"
        >
          Failed to load {title.toLowerCase()}.
        </motion.div>
      ) : data && data.length > 0 ? (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
          }}
          className="grid grid-cols-1 gap-4 xl:grid-cols-2"
        >
          {data.map((entry, index) => (
            <ConfigEntryCard
              key={`${entry.source}-${entry.name}-${entry.scope ?? 'global'}`}
              name={entry.name}
              data={entry.config}
              icon={icon}
              iconColor={iconColor}
              index={index}
              source={entry.source}
              scope={entry.scope}
              pluginId={entry.pluginId}
            />
          ))}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="panel-subtle py-16 text-center text-[var(--text-tertiary)]"
        >
          {emptyMessage}
        </motion.div>
      )}
    </motion.div>
  );
}
