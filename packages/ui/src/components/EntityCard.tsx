import React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import type { IconType } from './icons';

interface EntityCardProps {
  icon: IconType;
  iconAccentVar: string;
  title: string;
  description: string;
  badges?: React.ReactNode;
  onClick: () => void;
}

export function EntityCard({
  icon: Icon,
  iconAccentVar,
  title,
  description,
  badges,
  onClick,
}: EntityCardProps) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        "panel group relative cursor-pointer text-left transition-smooth",
        "hover:border-[var(--border-hover)] hover:bg-[var(--surface-overlay)] hover:shadow-[var(--shadow-sm)]",
        "py-0 p-5"
      )}
    >
      <CardHeader className="mb-0 pb-0">
        <div className="flex items-start justify-between gap-4">
          <div
            className="flex size-10 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-panel)] transition-colors"
            style={iconAccentVar ? { '--icon-accent': `var(${iconAccentVar})` } as React.CSSProperties : undefined}
          >
            <Icon
              size={18}
              className="text-[var(--text-secondary)] group-hover:text-[var(--icon-accent,var(--accent-blue))]"
            />
          </div>
          {badges && <div className="flex flex-wrap justify-end gap-1.5">{badges}</div>}
        </div>
      </CardHeader>
      <CardContent className="mt-5">
        <h3 className="text-[15px] font-medium text-[var(--text-primary)]">{title}</h3>
        <p className="text-pretty mt-2 min-h-[40px] text-[13px] leading-5 text-[var(--text-secondary)] line-clamp-2">
          {description}
        </p>
      </CardContent>
      <CardFooter className="mt-5 border-0 bg-transparent p-0">
        <div className="flex items-center text-[12px] font-medium text-[var(--accent-blue)]">
          View Details
          <ChevronRight size={12} className="ml-1" />
        </div>
      </CardFooter>
    </Card>
  );
}

// Re-export Badge and MonoBadge from dedicated file for backward compatibility
export { Badge, MonoBadge } from './Badge';
