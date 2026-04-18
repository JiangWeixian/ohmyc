import { motion } from 'framer-motion';
import { cn } from '../cn';
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
        {categories.map((category, index) => (
          <motion.button
            key={category.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03, duration: 0.15 }}
            onClick={() => onCategoryChange(category.id)}
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] text-[13px] font-medium transition-colors duration-150',
              activeCategory === category.id
                ? 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-overlay)]'
            )}
          >
            <motion.span
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
              <category.icon size={16} />
            </motion.span>
            <span>{category.label}</span>
          </motion.button>
        ))}
      </nav>
    </aside>
  );
}
