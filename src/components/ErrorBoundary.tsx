import React, { type ReactNode } from 'react';
import * as Sentry from '@sentry/react';

export type ErrorBoundaryVariant = 'page' | 'panel';

type Props = {
  children: ReactNode;
  variant?: ErrorBoundaryVariant;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onError?: (error: Error, info: React.ErrorInfo) => void;
};

type State = {
  error: Error | null;
};

const PAGE_WRAP =
  'min-h-screen flex flex-col items-center justify-center gap-4 bg-obsidian-950 text-titanium-200 px-6';
const PANEL_WRAP =
  'grid min-h-[40vh] place-items-center bg-obsidian-950 text-titanium-200 px-6';

function DefaultFallback({
  error,
  reset,
  variant,
}: {
  error: Error;
  reset: () => void;
  variant: ErrorBoundaryVariant;
}) {
  const prod = import.meta.env.PROD;
  return (
    <div className={variant === 'panel' ? PANEL_WRAP : PAGE_WRAP} role="alert" data-error-boundary={variant}>
      <p className="font-display text-lg text-titanium-50">Darstellung fehlgeschlagen</p>
      <p className="text-sm text-titanium-400 max-w-md text-center">
        Dieser Bereich konnte nicht geladen werden. Der Rest der Seite bleibt nutzbar.
      </p>
      {!prod && (
        <pre className="max-w-lg overflow-auto text-xs text-red-400 bg-obsidian-900 border border-titanium-800 p-3">
          {error.message}
        </pre>
      )}
      <button
        type="button"
        onClick={reset}
        className="px-4 py-2 text-sm bg-security-500 text-white hover:bg-security-400"
      >
        Erneut versuchen
      </button>
    </div>
  );
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary:', error, errorInfo);
    try {
      Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
    } catch {
      /* Sentry optional */
    }
    this.props.onError?.(error, errorInfo);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { fallback, variant = 'page' } = this.props;
    if (typeof fallback === 'function') return fallback(error, this.reset);
    if (fallback) return fallback;
    return <DefaultFallback error={error} reset={this.reset} variant={variant} />;
  }
}
