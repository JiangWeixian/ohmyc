import React from 'react';
import { motion } from 'framer-motion';

interface SectionHeaderProps {
  title: string;
  description?: React.ReactNode;
}

export function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="mb-8 border-b border-[var(--border-default)] pb-5"
    >
      <div className="mb-2 text-[9px] font-medium uppercase text-[var(--text-tertiary)]">
        Overview
      </div>
      <motion.h1 className="text-balance text-[32px] font-semibold leading-[1.1] text-[var(--text-primary)]">
        {title}
      </motion.h1>
      {description && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05, duration: 0.18 }}
          className="text-pretty mt-3 max-w-3xl text-[15px] text-[var(--text-secondary)]"
        >
          {description}
        </motion.p>
      )}
    </motion.div>
  );
}
