import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  listMyTenants, loadEntitlements,
  hasFeature as hasFeatureRaw, getLimit as getLimitRaw,
  type TenantSummary, type EntitlementSet,
} from './load-entitlements';
import { isSupabaseConfigured, getSupabase } from '../../lib/supabase';

interface TenantState {
  loading: boolean;
  error: string | null;
  tenants: TenantSummary[];
  activeTenantId: string | null;
  entitlements: EntitlementSet | null;
  setActiveTenant: (id: string) => void;
  refresh: () => Promise<void>;
  hasFeature: (key: string) => boolean;
  getLimit: (key: string) => number | null;
}

const Ctx = createContext<TenantState | null>(null);

const ACTIVE_KEY = 'realsync.activeTenantId';

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [activeTenantId, setActiveTenantIdState] = useState<string | null>(null);
  const [entitlements, setEntitlements] = useState<EntitlementSet | null>(null);
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

  useEffect(() => {
    void refresh();
    if (!isSupabaseConfigured()) return;
    // Nach einem MFA-Step-up (AAL1 → AAL2) gilt ein neues Access-Token mit
    // höherem AAL. Ohne Neuladen behält der Provider die alten Tenant-/
    // Entitlement-Daten und nachgelagerte Views (z. B. Billing) warten
    // dauerhaft auf Daten, die nie kommen.
    //
    // Bewusst NICHT auf `TOKEN_REFRESHED` reagieren: das feuert periodisch
    // (~stündlich) ohne Änderung an Rechten und würde die gesamte App in den
    // Ladezustand zurückwerfen. `INITIAL_SESSION` ist ebenfalls ausgenommen,
    // da der direkte `refresh()`-Aufruf oben diesen Fall bereits abdeckt.
    const RELOAD_ON: string[] = ['MFA_CHALLENGE_VERIFIED', 'SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'];
    // Defensiv: Der Provider umschließt die gesamte App — ein fehlender oder
    // eingeschränkter Auth-Client darf hier niemals werfen, sonst reißt es den
    // kompletten Baum mit. Im Zweifel lieber ohne Live-Reload weiterlaufen.
    const sub = getSupabase().auth?.onAuthStateChange((event) => {
      if (RELOAD_ON.includes(event)) void refresh();
    });
    return () => { sub?.data?.subscription?.unsubscribe(); };
  }, [refresh]);

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
    hasFeature: (k) => hasFeatureRaw(entitlements, k),
    getLimit: (k) => getLimitRaw(entitlements, k),
  }), [loading, error, tenants, activeTenantId, entitlements, setActiveTenant, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTenant(): TenantState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTenant must be used inside <TenantProvider>');
  return v;
}

export function useEntitlements(): EntitlementSet | null {
  return useTenant().entitlements;
}
