import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  rows?: number;
}

export function Skeleton({ className, rows = 3 }: SkeletonProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.05, duration: 0.2 }}
          className="space-y-3"
        >
          <div
            className={cn(
              'h-3 bg-[var(--surface-overlay)] rounded-[var(--radius-md)]',
              'animate-pulse'
            )}
            style={{ width: '60%' }}
          />
          <div
            className={cn(
              'h-4 bg-[var(--surface-overlay)] rounded-[var(--radius-md)]',
              'animate-pulse'
            )}
            style={{ width: '100%' }}
          />
          <div
            className={cn(
              'h-3 bg-[var(--surface-overlay)] rounded-[var(--radius-md)]',
              'animate-pulse'
            )}
            style={{ width: '40%' }}
          />
        </motion.div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="p-5 bg-[var(--surface-raised)] border border-[var(--border-default)] rounded-[var(--radius-lg)]"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="size-10 bg-[var(--surface-overlay)] rounded-[var(--radius-md)] animate-pulse" />
      </div>
      <div className="flex-1 space-y-3">
        <div className="h-3 bg-[var(--surface-overlay)] rounded-[var(--radius-md)] animate-pulse" style={{ width: '70%' }} />
        <div className="h-4 bg-[var(--surface-overlay)] rounded-[var(--radius-md)] animate-pulse" style={{ width: '100%' }} />
      </div>
    </motion.div>
  );
}

export function ListItemSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-3 px-3 py-2.5"
    >
      <div className="size-8 bg-[var(--surface-overlay)] rounded-[var(--radius-md)] animate-pulse" />
      <div className="flex-1 h-3 bg-[var(--surface-overlay)] rounded-[var(--radius-md)] animate-pulse" />
    </motion.div>
  );
}

export function AnimatedList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      className={className}
    >
      {React.Children.map((child, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: i * 0.05, duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
