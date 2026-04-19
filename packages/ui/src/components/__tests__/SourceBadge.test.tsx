import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { SourceBadge } from '../SourceBadge';
import { renderWithProviders } from '../../test/renderWithProviders';

describe('SourceBadge', () => {
  it('renders a local source label', () => {
    renderWithProviders(<SourceBadge source="local" />);

    expect(screen.getByText('local')).toBeInTheDocument();
  });

  it('renders a profile source label', () => {
    renderWithProviders(<SourceBadge source="profile" />);

    expect(screen.getByText('profile')).toBeInTheDocument();
  });

  it('renders plugin-provided rows as plugin items with plugin context', () => {
    renderWithProviders(<SourceBadge source="plugin" pluginId="review-pack@marketplace" />);

    expect(screen.getByText('plugin')).toBeInTheDocument();
    expect(screen.getByText('review-pack')).toBeInTheDocument();
  });

  it('renders a project source label with green styling', () => {
    renderWithProviders(<SourceBadge source="project" />);

    const badge = screen.getByText('project');
    expect(badge).toBeInTheDocument();
    // D-09: green color via CSS var (replaces hardcoded #22c55e)
    expect(badge.className).toContain('[var(--accent-green)]/10');
    expect(badge.className).toContain('text-[var(--accent-green)]');
    // D-07: uppercase label (applied via Tailwind class)
    expect(badge.className).toContain('uppercase');
  });

  it('does not render pluginId sub-label for project variant', () => {
    renderWithProviders(<SourceBadge source="project" />);

    // project variant should not show any secondary label
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });
});
