import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';

function Boom() {
  throw new Error('boom-test');
}

describe('ErrorBoundary', () => {
  it('renders fallback instead of crashing', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveAttribute('data-error-boundary', 'page');
    expect(screen.getByRole('alert')).toHaveTextContent('Darstellung fehlgeschlagen');
  });
});
