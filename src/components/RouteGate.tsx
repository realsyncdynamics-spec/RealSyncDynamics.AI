import type { ReactNode } from 'react';
import { ErrorBoundary, type ErrorBoundaryVariant } from './ErrorBoundary';
import { SuspenseBoundary, type SuspenseVariant } from './SuspenseBoundary';

type Props = {
  children: ReactNode;
  label?: string;
  variant?: Extract<SuspenseVariant, ErrorBoundaryVariant>;
};

/** ErrorBoundary außen, Suspense innen — Lazy-Chunk-Fail isoliert die Route. */
export function RouteGate({ children, label = 'Lade …', variant = 'page' }: Props) {
  return (
    <ErrorBoundary variant={variant}>
      <SuspenseBoundary label={label} variant={variant}>
        {children}
      </SuspenseBoundary>
    </ErrorBoundary>
  );
}
