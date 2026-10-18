import { useEffect, useState } from 'react';
import { useOptionalTenant } from '../../core/access/TenantProvider';
import { getEntitlementsForTenant } from '../../core/usage/usage-service';
import { getTrialStatus, type TrialStatus } from '../../core/billing/trial';
import type { BillingAccountKind } from '../../core/billing/billingAccount';

export interface AccountStatus {
  trial: TrialStatus | null;
  /** `null` = noch nicht geladen oder nicht ladbar — dann keine Konditionen-Aussage. */
  kind: BillingAccountKind | null;
}

const UNKNOWN: AccountStatus = { trial: null, kind: null };

/**
 * Testphase und Art des Vertragsverhältnisses des aktiven Mandanten. Rein
 * informativ: Bei Fehlern gibt es keinen Hinweis statt eines falschen.
 * Lädt nach `tenant.refresh()` neu (z. B. nach frischer Beta-Anmeldung).
 */
export function useAccountStatus(): AccountStatus {
  const tenant = useOptionalTenant();
  const activeTenantId = tenant?.activeTenantId ?? null;
  const entitlements = tenant?.entitlements ?? null;
  const [status, setStatus] = useState<AccountStatus>(UNKNOWN);

  useEffect(() => {
    let cancelled = false;
    if (!activeTenantId) {
      setStatus(UNKNOWN);
      return;
    }
    (async () => {
      try {
        const decision = await getEntitlementsForTenant(activeTenantId);
        if (!cancelled) setStatus({ trial: getTrialStatus(decision), kind: decision.accountKind ?? null });
      } catch {
        if (!cancelled) setStatus(UNKNOWN);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTenantId, entitlements]);

  return status;
}
