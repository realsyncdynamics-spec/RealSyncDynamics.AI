/**
 * Zustand der Fläche „Mein Plan": lädt die Auflistung, bucht, kündigt.
 *
 * Nach jeder Änderung kommt die vollständige Auflistung von der Function
 * zurück — es gibt keinen lokal gerechneten Zwischenstand, der vom Server
 * abweichen könnte. Danach werden die Entitlements des TenantProviders neu
 * geladen, damit Navigation und Gates dasselbe sehen wie diese Fläche.
 */
import { useCallback, useEffect, useState } from 'react';
import { useTenant } from '../../core/access/TenantProvider';
import { isSupabaseConfigured } from '../../lib/supabase';
import type { AddOnId } from '@/shared/pricing';
import {
  invokeSubscriptionAddons,
  type AddonApiError,
  type AddonListing,
} from './subscriptionAddons';
import { isBillingSandbox, sandboxApply, sandboxListing } from './billingSandbox';

export interface SubscriptionAddonsState {
  listing: AddonListing | null;
  loading: boolean;
  /** Add-on, an dem gerade eine Buchung oder Kündigung läuft. */
  busy: AddOnId | null;
  error: AddonApiError['error'] | null;
  canManage: boolean;
  sandbox: boolean;
  reload: () => Promise<void>;
  add: (addonId: AddOnId, quantity?: number) => Promise<boolean>;
  remove: (addonId: AddOnId) => Promise<boolean>;
}

export function useSubscriptionAddons(): SubscriptionAddonsState {
  const { activeTenantId, tenants, refresh } = useTenant();
  const [listing, setListing] = useState<AddonListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<AddOnId | null>(null);
  const [error, setError] = useState<AddonApiError['error'] | null>(null);
  const [sandboxBooked, setSandboxBooked] = useState<{ id: AddOnId; quantity: number }[]>([]);
  const sandbox = isBillingSandbox();

  const rolle = tenants.find((t) => t.tenantId === activeTenantId)?.role;
  const canManage = rolle === 'owner' || rolle === 'admin';

  const reload = useCallback(async () => {
    if (sandbox) {
      setListing(sandboxListing(sandboxBooked));
      setError(null);
      setLoading(false);
      return;
    }
    if (!activeTenantId || !isSupabaseConfigured()) { setLoading(false); return; }
    setLoading(true);
    const result = await invokeSubscriptionAddons(activeTenantId, 'list');
    if (result.ok) { setListing(result); setError(null); }
    else setError(result.error);
    setLoading(false);
  }, [activeTenantId, sandbox, sandboxBooked]);

  useEffect(() => { void reload(); }, [reload]);

  const change = useCallback(async (action: 'add' | 'remove', addonId: AddOnId, quantity?: number) => {
    if (sandbox) {
      setBusy(addonId);
      const next = sandboxApply(sandboxBooked, action, addonId, quantity ?? 1);
      setSandboxBooked(next);
      setListing(sandboxListing(next));
      setBusy(null);
      return true;
    }
    if (!activeTenantId) return false;
    setBusy(addonId);
    setError(null);
    const result = await invokeSubscriptionAddons(activeTenantId, action, addonId, quantity);
    setBusy(null);
    if (!result.ok) { setError(result.error); return false; }
    setListing(result);
    // Berechtigungen des Providers nachziehen — Gates und Navigation lesen
    // von dort, nicht aus dieser Auflistung.
    void refresh();
    return true;
  }, [activeTenantId, refresh, sandbox, sandboxBooked]);

  return {
    listing,
    loading,
    busy,
    error,
    canManage: sandbox || canManage,
    sandbox,
    reload,
    add: (addonId, quantity) => change('add', addonId, quantity),
    remove: (addonId) => change('remove', addonId),
  };
}
