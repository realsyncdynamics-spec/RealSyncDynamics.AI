import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SuspenseFallback } from '../../src/components/SuspenseBoundary';

describe('SuspenseFallback', () => {
  it('renders page fallback with status role', () => {
    render(<SuspenseFallback />);
    const el = screen.getByRole('status');
    expect(el).toHaveAttribute('data-suspense-fallback', 'page');
    expect(el).toHaveTextContent('Lade');
  });

  it('renders panel variant', () => {
    render(<SuspenseFallback variant="panel" label="Modul lädt …" />);
    expect(screen.getByRole('status')).toHaveAttribute('data-suspense-fallback', 'panel');
    expect(screen.getByRole('status')).toHaveTextContent('Modul');
  });
});
