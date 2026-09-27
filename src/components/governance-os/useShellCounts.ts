import { useEffect, useState } from 'react';
import { useTenant } from '../../core/access/TenantProvider';
import {
  countTenantEvidence,
  fetchTenantAssets,
  fetchTenantPolicies,
} from '../../features/governance/governanceApi';

/**
 * Echte Zähler für die Badges der Seitenleiste. `null` = unbekannt (Laden
 * läuft oder ist fehlgeschlagen) — dann zeigt die Leiste KEIN Badge, statt
 * eine Null zu behaupten.
 */
export interface ShellCounts {
  systems: number | null;
  unclassified: number | null;
  policies: number | null;
  evidence: number | null;
  /** Erstes KI-System — Ziel des Nav-Punkts „Klassifizierung". */
  firstSystemId: string | null;
}

const UNKNOWN: ShellCounts = {
  systems: null,
  unclassified: null,
  policies: null,
  evidence: null,
  firstSystemId: null,
};

export function useShellCounts(): ShellCounts {
  const { activeTenantId } = useTenant();
  const [counts, setCounts] = useState<ShellCounts>(UNKNOWN);

  useEffect(() => {
    setCounts(UNKNOWN);
    if (!activeTenantId) return;
    let cancelled = false;
    void Promise.allSettled([
      fetchTenantAssets(activeTenantId),
      fetchTenantPolicies(activeTenantId),
      countTenantEvidence(activeTenantId),
    ]).then(([assets, policies, evidence]) => {
      if (cancelled) return;
      const ai = assets.status === 'fulfilled' ? assets.value.filter((a) => a.asset_type === 'ai_system') : null;
      setCounts({
        systems: ai ? ai.length : null,
        unclassified: ai ? ai.filter((a) => a.ai_act_class === 'unknown').length : null,
        policies: policies.status === 'fulfilled' ? policies.value.filter((p) => p.enabled).length : null,
        evidence: evidence.status === 'fulfilled' ? evidence.value : null,
        firstSystemId: ai && ai.length > 0 ? ai[0].id : null,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [activeTenantId]);

  return counts;
}
