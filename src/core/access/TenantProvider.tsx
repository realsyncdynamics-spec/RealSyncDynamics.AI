import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  listMyTenants, loadEntitlements,
  hasFeature as hasFeatureRaw, getLimit as getLimitRaw,
  type TenantSummary, type EntitlementSet,
} from './load-entitlements';
import { isSupabaseConfigured, getSupabase } from '../../lib/supabase';
import type { TenantRole } from '../billing/types';
import type { PlanKey } from '@/shared/pricing';
import {
  DEFAULT_THEME_MODE,
  FIXTURE_ACTIVE_KEY,
  FIXTURE_TENANTS,
  pathRequestsFixtures,
  type ThemeModeId,
} from './fixtureTenants';

interface TenantState {
  loading: boolean;
  error: string | null;
  tenants: TenantSummary[];
  activeTenantId: string | null;
  activeTenant: TenantSummary | null;
  entitlements: EntitlementSet | null;
  /** Rolle des aktiven Mandanten. */
  role: TenantRole | null;
  /** Plan nur für Fixture-Mandanten belegt. Live bleibt null, bis der Bestand ihn liefert. */
  plan: PlanKey | null;
  featureFlags: Readonly<Record<string, boolean>>;
  /** Verweis auf einen semantischen Theme-Modus. Basis ist light-cream. */
  themeId: ThemeModeId;
  fixturePreview: boolean;
  setActiveTenant: (id: string) => void;
  setFixturePreview: (on: boolean) => void;
  refresh: () => Promise<void>;
  hasFeature: (key: string) => boolean;
  hasFlag: (key: string) => boolean;
  getLimit: (key: string) => number | null;
}

const Ctx = createContext<TenantState | null>(null);

const ACTIVE_KEY = 'realsync.activeTenantId';
const EMPTY_FLAGS: Readonly<Record<string, boolean>> = Object.freeze({});

export function TenantProvider({
  children,
  initialFixturePreview = false,
}: {
  children: React.ReactNode;
  initialFixturePreview?: boolean;
}) {
  const initialFixture = initialFixturePreview || pathRequestsFixtures();
  const fixtureRef = useRef(initialFixture);
  const [fixturePreview, setFixturePreviewState] = useState(initialFixture);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [activeTenantId, setActiveTenantIdState] = useState<string | null>(null);
  const [entitlements, setEntitlements] = useState<EntitlementSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyFixtures = useCallback(() => {
    const list = [...FIXTURE_TENANTS];
    setTenants(list);
    const stored = (() => { try { return localStorage.getItem(FIXTURE_ACTIVE_KEY); } catch { return null; } })();
    const stillValid = stored && list.some((tenant) => tenant.tenantId === stored) ? stored : list[0]?.tenantId ?? null;
    setActiveTenantIdState(stillValid);
    setEntitlements(null);
    setError(null);
    setLoading(false);
  }, []);

  const setActiveTenant = useCallback((id: string) => {
    setActiveTenantIdState(id);
    const key = fixtureRef.current ? FIXTURE_ACTIVE_KEY : ACTIVE_KEY;
    try { localStorage.setItem(key, id); } catch { /* ignore */ }
  }, []);

  const refresh = useCallback(async () => {
    if (fixtureRef.current || pathRequestsFixtures()) {
      fixtureRef.current = true;
      setFixturePreviewState(true);
      applyFixtures();
      return;
    }
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
  }, [applyFixtures]);

  const setFixturePreview = useCallback((on: boolean) => {
    fixtureRef.current = on;
    setFixturePreviewState(on);
    if (on) applyFixtures();
    else void refresh();
  }, [applyFixtures, refresh]);

  useEffect(() => {
    void refresh();
    if (!isSupabaseConfigured() || fixtureRef.current) return;
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
      if (fixtureRef.current) return;
      if (RELOAD_ON.includes(event)) void refresh();
    });
    return () => { sub?.data?.subscription?.unsubscribe(); };
  }, [refresh]);

  // Reload entitlements when the active tenant changes (without reloading the tenant list).
  useEffect(() => {
    if (fixturePreview) return;
    if (!activeTenantId || !isSupabaseConfigured()) return;
    let cancelled = false;
    loadEntitlements(activeTenantId)
      .then((ent) => { if (!cancelled) setEntitlements(ent); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [activeTenantId, fixturePreview]);

  const activeTenant = tenants.find((tenant) => tenant.tenantId === activeTenantId) ?? null;
  const fixture = FIXTURE_TENANTS.find((tenant) => tenant.tenantId === activeTenantId) ?? null;
  const featureFlags = fixture?.featureFlags ?? EMPTY_FLAGS;

  const value = useMemo<TenantState>(() => ({
    loading,
    error,
    tenants,
    activeTenantId,
    activeTenant,
    entitlements,
    role: activeTenant?.role ?? null,
    plan: fixture?.plan ?? null,
    featureFlags,
    themeId: fixture?.themeId ?? DEFAULT_THEME_MODE,
    fixturePreview,
    setActiveTenant,
    setFixturePreview,
    refresh,
    hasFeature: (k) => hasFeatureRaw(entitlements, k),
    hasFlag: (k) => featureFlags[k] === true,
    getLimit: (k) => getLimitRaw(entitlements, k),
  }), [
    loading, error, tenants, activeTenantId, activeTenant, entitlements,
    fixture, featureFlags, fixturePreview, setActiveTenant, setFixturePreview, refresh,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTenant(): TenantState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTenant must be used inside <TenantProvider>');
  return v;
}

/**
 * Wie `useTenant`, wirft aber außerhalb von `<TenantProvider>` nicht,
 * sondern liefert `null` — für Komponenten, die auch isoliert (Tests,
 * öffentliche Seiten) gerendert werden.
 */
export function useOptionalTenant(): TenantState | null {
  return useContext(Ctx);
}

export function useEntitlements(): EntitlementSet | null {
  return useTenant().entitlements;
}
