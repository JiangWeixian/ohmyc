import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  rows?: number;
}

export function Skeleton({ className, rows = 3 }: SkeletonProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-3">
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
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="p-5 bg-[var(--surface-raised)] border border-[var(--border-default)] rounded-[var(--radius-lg)]">
      <div className="flex items-start justify-between mb-4">
        <div className="size-10 bg-[var(--surface-overlay)] rounded-[var(--radius-md)] animate-pulse" />
      </div>
      <div className="flex-1 space-y-3">
        <div className="h-3 bg-[var(--surface-overlay)] rounded-[var(--radius-md)] animate-pulse" style={{ width: '70%' }} />
        <div className="h-4 bg-[var(--surface-overlay)] rounded-[var(--radius-md)] animate-pulse" style={{ width: '100%' }} />
      </div>
    </div>
  );
}

export function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <div className="size-8 bg-[var(--surface-overlay)] rounded-[var(--radius-md)] animate-pulse" />
      <div className="flex-1 h-3 bg-[var(--surface-overlay)] rounded-[var(--radius-md)] animate-pulse" />
    </div>
  );
}

export function AnimatedList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}
