import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('renders fallback UI when a child throws during render', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    function Boom(): React.ReactNode {
      throw new Error('boom-test');
    }

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveAttribute('data-error-boundary', 'page');
    expect(screen.getByRole('alert')).toHaveTextContent('Darstellung fehlgeschlagen');
  });
});
