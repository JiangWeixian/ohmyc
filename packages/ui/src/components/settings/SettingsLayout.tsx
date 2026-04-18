import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SettingsSidebar, type CategoryId } from './SettingsSidebar';
import { SettingsContent } from './SettingsContent';

export function SettingsLayout() {
  const [activeCategory, setActiveCategory] = useState<CategoryId>('general');

  return (
    <div className="flex h-dvh bg-[var(--surface-base)] text-[var(--text-primary)]">
      <SettingsSidebar
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={activeCategory}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 overflow-hidden"
        >
          <SettingsContent category={activeCategory} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
