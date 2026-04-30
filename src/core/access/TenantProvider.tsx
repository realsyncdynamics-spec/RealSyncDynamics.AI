import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { listMyTenants, loadEntitlements, type TenantSummary } from './load-entitlements';
import { canUseFeature } from './access-policy';
import type { EntitlementDecision, FeatureKey } from '../billing/types';
import { isSupabaseConfigured } from '../../lib/supabase';

interface TenantState {
  loading: boolean;
  error: string | null;
  tenants: TenantSummary[];
  activeTenantId: string | null;
  entitlements: EntitlementDecision | null;
  setActiveTenant: (id: string) => void;
  refresh: () => Promise<void>;
  hasFeature: (f: FeatureKey) => boolean;
}

const Ctx = createContext<TenantState | null>(null);

const ACTIVE_KEY = 'realsync.activeTenantId';

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [activeTenantId, setActiveTenantIdState] = useState<string | null>(null);
  const [entitlements, setEntitlements] = useState<EntitlementDecision | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setActiveTenant = useCallback((id: string) => {
    setActiveTenantIdState(id);
    try { localStorage.setItem(ACTIVE_KEY, id); } catch { /* ignore */ }
  }, []);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await listMyTenants();
      setTenants(list);
      const stored = (() => { try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; } })();
      const stillValid = stored ? list.find((t) => t.tenantId === stored)?.tenantId : null;
      const next = stillValid ?? list[0]?.tenantId ?? null;
      setActiveTenantIdState(next);
      if (next) {
        const ent = await loadEntitlements(next);
        setEntitlements(ent);
      } else {
        setEntitlements(null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Tenant-Daten konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // Reload entitlements when the active tenant changes (without reloading the tenant list).
  useEffect(() => {
    if (!activeTenantId || !isSupabaseConfigured()) return;
    let cancelled = false;
    loadEntitlements(activeTenantId)
      .then((ent) => { if (!cancelled) setEntitlements(ent); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [activeTenantId]);

  const value = useMemo<TenantState>(() => ({
    loading,
    error,
    tenants,
    activeTenantId,
    entitlements,
    setActiveTenant,
    refresh,
    hasFeature: (f) => (entitlements ? canUseFeature(entitlements, f) : false),
  }), [loading, error, tenants, activeTenantId, entitlements, setActiveTenant, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTenant(): TenantState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTenant must be used inside <TenantProvider>');
  return v;
}

export function useEntitlements(): EntitlementDecision | null {
  return useTenant().entitlements;
}
