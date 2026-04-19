import React from 'react';

interface SectionHeaderProps {
  title: string;
  description?: React.ReactNode;
}

export function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div className="mb-8 border-b border-[var(--border-default)] pb-5">
      <div className="mb-2 text-[9px] font-medium uppercase text-[var(--text-tertiary)]">
        Overview
      </div>
      <h1 className="text-balance text-[32px] font-semibold leading-[1.1] text-[var(--text-primary)]">
        {title}
      </h1>
      {description && (
        <p className="text-pretty mt-3 max-w-3xl text-[15px] text-[var(--text-secondary)]">
          {description}
        </p>
      )}
    </div>
  );
}
