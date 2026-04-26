import React from 'react';

interface SectionHeaderProps {
  title: string;
  description?: React.ReactNode;
}

export function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div className="mb-10 border-b border-[var(--border-default)] pb-6">
      <div className="mb-2 text-[11px] font-medium tracking-[0.04em] text-[var(--text-tertiary)]">
        Overview
      </div>
      <h1 className="text-balance text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] text-[var(--text-primary)]">
        {title}
      </h1>
      {description && (
        <p className="text-pretty mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--text-secondary)]">
          {description}
        </p>
      )}
    </div>
  );
}
