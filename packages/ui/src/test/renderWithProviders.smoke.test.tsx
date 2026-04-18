import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from './renderWithProviders';

function SmokeComponent() {
  return <div>provider smoke test</div>;
}

describe('renderWithProviders', () => {
  it('renders a component through the shared test wrapper', () => {
    renderWithProviders(<SmokeComponent />);

    expect(screen.getByText('provider smoke test')).toBeInTheDocument();
  });
});
