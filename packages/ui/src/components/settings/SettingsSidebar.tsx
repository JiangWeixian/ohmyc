import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Shield, ShieldCheck, Anchor, FileText, Plug, Blocks, Leaf } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type CategoryId =
  | 'general'
  | 'permissions'
  | 'sandbox'
  | 'hooks'
  | 'attribution'
  | 'mcp'
  | 'plugins'
  | 'environment';

interface Category {
  id: CategoryId;
  label: string;
  icon: LucideIcon;
}

const categories: Category[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'permissions', label: 'Permissions', icon: Shield },
  { id: 'sandbox', label: 'Sandbox', icon: ShieldCheck },
  { id: 'hooks', label: 'Hooks', icon: Anchor },
  { id: 'attribution', label: 'Attribution', icon: FileText },
  { id: 'mcp', label: 'MCP', icon: Plug },
  { id: 'plugins', label: 'Plugins', icon: Blocks },
  { id: 'environment', label: 'Environment', icon: Leaf },
];

interface SettingsSidebarProps {
  activeCategory: CategoryId;
  onCategoryChange: (category: CategoryId) => void;
}

export function SettingsSidebar({
  activeCategory,
  onCategoryChange,
}: SettingsSidebarProps) {
  return (
    <aside className="w-60 border-r border-[var(--border-default)] bg-[var(--surface-raised)]">
      <nav className="p-2">
        <Tabs
          value={activeCategory}
          onValueChange={(v) => onCategoryChange(v as CategoryId)}
        >
          <TabsList className="flex flex-col gap-1 bg-transparent p-0 border-0">
            {categories.map((category) => {
              const isActive = activeCategory === category.id;
              return (
                <TabsTrigger
                  key={category.id}
                  value={category.id}
                  className={cn(
                    "relative w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-[13px] font-medium tracking-[-0.01em] transition-all duration-200",
                    isActive
                      ? "text-[var(--accent-blue)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-overlay)]"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="settings-sidebar-active"
                      className="absolute inset-0 rounded-[var(--radius-md)] bg-[var(--accent-blue)]/15 border border-[var(--accent-blue)]/30"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className={cn("relative z-10", isActive ? "text-[var(--accent-blue)]" : "text-[var(--text-tertiary)]")}>
                    <category.icon size={16} />
                  </span>
                  <span className="relative z-10">{category.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </nav>
    </aside>
  );
}
