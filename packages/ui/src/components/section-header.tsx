import React from 'react'

interface SectionHeaderProperties {
  title: string
  description?: React.ReactNode
}

export function SectionHeader({ title, description }: SectionHeaderProperties) {
  return (
    <div className="mb-10 border-b border-[var(--border-default)] pb-6">
      <div className="mb-1 text-[11px] font-[510] tracking-[0.04em] uppercase text-[var(--text-tertiary)]">
        Overview
      </div>
      <h1 className="text-[24px] font-[590] leading-[1.33] tracking-[-0.2px] text-[var(--text-primary)]">
        {title}
      </h1>
      {description && (
        <p className="text-pretty mt-1 max-w-2xl text-[14px] text-[var(--text-tertiary)]">
          {description}
        </p>
      )}
    </div>
  )
}
