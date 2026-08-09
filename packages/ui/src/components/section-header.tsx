// Generic section header with "Overview" overline, title, and optional description.
import React from 'react'

/** Properties for the {@link SectionHeader} component. */
interface SectionHeaderProperties {
  title: string
  description?: React.ReactNode
}

/** Renders a section header with an "Overview" overline, title, and optional
 *  description paragraph. Used at the top of config/entity list pages. */
export function SectionHeader({ title, description }: SectionHeaderProperties) {
  return (
    <div className="mb-10 border-b border-[var(--border-default)] pb-6">
      <div className="mb-1 text-[11px] font-[510] tracking-[0.04em] uppercase text-[var(--text-tertiary)]">
        Overview
      </div>
      <h1 className="deco-title-shadow font-display text-[24px] font-[590] leading-[1.33] tracking-normal text-[var(--text-primary)]">
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
