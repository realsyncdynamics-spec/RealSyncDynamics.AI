import { useEffect, useState } from 'react';

export type LoadState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; message: string };

/**
 * Lädt mandantenbezogene Daten. Ohne Mandant bleibt der Zustand `idle` —
 * nie ein leeres Ergebnis, das wie „keine Daten" aussähe.
 */
export function useTenantLoad<T>(
  tenantId: string | null,
  loader: (tenantId: string) => Promise<T>,
  deps: readonly unknown[] = [],
): [LoadState<T>, () => void] {
  const [state, setState] = useState<LoadState<T>>({ status: 'idle' });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!tenantId) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    loader(tenantId)
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ status: 'error', message: (err as Error)?.message ?? String(err) });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, nonce, ...deps]);

  return [state, () => setNonce((n) => n + 1)];
}

/** `Promise.allSettled`-Wert oder Rückfall; Fehler landen in `failures`. */
export function settled<T>(
  result: PromiseSettledResult<T>,
  fallback: T,
  name: string,
  failures: string[],
): T {
  if (result.status === 'fulfilled') return result.value;
  failures.push(`${name}: ${(result.reason as Error)?.message ?? 'fehlgeschlagen'}`);
  return fallback;
}
