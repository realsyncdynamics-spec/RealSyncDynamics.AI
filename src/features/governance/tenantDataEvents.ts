import { useEffect, useState } from 'react';

/**
 * Gate 2 · Mandantendaten neu laden, nachdem eine Mutation sie verändert hat.
 *
 * Ein Scan oder ein Statuswechsel schreibt Findings, Evidence und Scan-Läufe.
 * Vorher lud danach nur die auslösende Ansicht neu; Dashboard und Cockpit
 * zeigten bis zum manuellen Reload den alten Zustand. Mutationen melden sich
 * hier, Loader hängen `useTenantDataVersion(tenantId)` in ihre Effekt-Deps.
 */
const EVENT = 'realsync:tenant-data-changed';

export function notifyTenantDataChanged(tenantId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<{ tenantId: string }>(EVENT, { detail: { tenantId } }));
}

/** Zählt Änderungen am Mandanten `tenantId`; ändert sich bei jeder Meldung. */
export function useTenantDataVersion(tenantId: string | null): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!tenantId || typeof window === 'undefined') return;
    const onChange = (e: Event) => {
      if ((e as CustomEvent<{ tenantId?: string }>).detail?.tenantId === tenantId) {
        setVersion((v) => v + 1);
      }
    };
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, [tenantId]);
  return version;
}
