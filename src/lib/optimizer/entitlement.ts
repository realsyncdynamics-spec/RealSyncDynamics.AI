/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Reale Tier-/Entitlement-Anbindung für den Optimizer (Phase 3).
 *
 * Ersetzt die Phase-2-Platzhalterlogik (`tier = 'gratis'`) durch den
 * tatsächlichen Plan des eingeloggten Nutzers. Wiederverwendung statt
 * Duplikat: Tenant kommt aus `memberships` (wie im kanonischen
 * CheckoutPage), der aktive Plan aus `getActivePlanForTenant` (kanonische
 * planAccess-Logik über die `subscriptions`-Tabelle). Die
 * Optimizer-Fähigkeiten werden aus der realen Feature-Matrix abgeleitet —
 * keine erfundene Tier-Zuordnung.
 */

import { useEffect, useState } from 'react';

import { getSupabase } from '../supabase';
import { getActivePlanForTenant, hasFeature, type PlanKey } from '../billing/planAccess';
import { useSupabaseAuth } from '../../features/supabase/SupabaseAuthContext';

export interface OptimizerCapabilities {
  /** Vollständiger Bericht (ab erstem bezahlten Tier). */
  fullReport: boolean;
  /** Fix-Snippets / geführte & automatisierte Optimierung (growth+). */
  autoOptimize: boolean;
  /** Kontinuierliches Monitoring (growth+). */
  monitoring: boolean;
}

export interface OptimizerEntitlement {
  loading: boolean;
  /** Realer Plan; null = kein aktives Abo (= faktisch „free"). */
  planKey: PlanKey | null;
  tenantId: string | null;
  capabilities: OptimizerCapabilities;
}

export function capabilitiesForPlan(plan: PlanKey | null): OptimizerCapabilities {
  return {
    // monthly_scan ist das erste bezahlte Feature (starter+).
    fullReport: hasFeature(plan, 'monthly_scan'),
    // fix_snippets = geführte/automatisierte Fixes (growth+).
    autoOptimize: hasFeature(plan, 'fix_snippets'),
    monitoring: hasFeature(plan, 'daily_monitoring'),
  };
}

const EMPTY_CAPS: OptimizerCapabilities = { fullReport: false, autoOptimize: false, monitoring: false };

/**
 * Lädt den realen Plan des Nutzers. Ohne Session oder ohne Tenant gilt
 * `planKey = null` (= free) — der Aufrufer zeigt dann Upsell/Anmeldung.
 */
export function useOptimizerEntitlement(): OptimizerEntitlement {
  const { isAuthenticated, isLoading: authLoading } = useSupabaseAuth();
  const [state, setState] = useState<OptimizerEntitlement>({
    loading: true, planKey: null, tenantId: null, capabilities: EMPTY_CAPS,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setState({ loading: false, planKey: null, tenantId: null, capabilities: EMPTY_CAPS });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const sb = getSupabase();
        const { data: memberships } = await sb
          .from('memberships')
          .select('tenant_id, role')
          .in('role', ['owner', 'admin'])
          .limit(1);
        const tenantId = (memberships?.[0]?.tenant_id as string | undefined) ?? null;
        const planKey = tenantId ? await getActivePlanForTenant(tenantId) : null;
        if (cancelled) return;
        setState({ loading: false, planKey, tenantId, capabilities: capabilitiesForPlan(planKey) });
      } catch {
        if (cancelled) return;
        // Fail-closed: im Zweifel free (kein Über-Grant von Features).
        setState({ loading: false, planKey: null, tenantId: null, capabilities: EMPTY_CAPS });
      }
    })();

    return () => { cancelled = true; };
  }, [authLoading, isAuthenticated]);

  return state;
}
