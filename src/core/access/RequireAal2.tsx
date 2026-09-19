// RequireAal2 (P0a Observe-Mode, ADR 0006) — Hinweis-Guard ohne Hardlock.
//
// Beobachtet AAL2-Bedarf (Supabase-native TOTP) für privilegierte Rollen/Tenants. KEIN
// Eigenbau-MFA — nutzt ausschließlich `core/access/mfa.ts`. Entscheidungslogik
// liegt rein in `aal2-policy.ts` (testbar). Dieser Guard rendert nur die UI.
//
// Komposition: sitzt INNERHALB des Login-Pfads. Ohne Session → `allow`
// (der vorhandene AuthGate der Views zeigt den Login). Dadurch keine
// Verwechslung „nicht eingeloggt" ↔ „MFA fehlt" und keine Endlosschleife.
import React, { useCallback, useEffect, useState } from 'react';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import { useTenant } from './TenantProvider';
import { getMfaStatus } from './mfa';
import { requiresAal2, type Aal } from './aal2-policy';

interface Props {
  /** Aktionslabel für Anzeige + Telemetrie (z. B. "Team-Verwaltung"). */
  action?: string;
  children: React.ReactNode;
}

export function RequireAal2({ action, children }: Props) {
  const { tenants, activeTenantId, loading: tenantLoading } = useTenant();
  const activeTenant = tenants.find((t) => t.tenantId === activeTenantId) ?? null;
  const role = activeTenant?.role ?? null;
  const isPublicSector = activeTenant?.isPublicSector ?? false;

  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [currentLevel, setCurrentLevel] = useState<Aal>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured()) { setReady(true); return; }
    const sb = getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    setHasSession(!!session);
    if (session) {
      const st = await getMfaStatus();
      setCurrentLevel((st.currentLevel as Aal) ?? null);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    let active = true;
    void refresh();
    if (!isSupabaseConfigured()) return;
    // Reagiert auf MFA-Bestätigung / Login-Wechsel → Level neu lesen.
    const { data: sub } = getSupabase().auth.onAuthStateChange(() => { if (active) void refresh(); });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [refresh]);

  // Solange Tenant-/AAL-Daten laden: nicht voreilig blocken.
  if (tenantLoading || !ready) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-titanium-500 text-sm gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Sicherheitsstufe wird geprüft…
      </div>
    );
  }

  const required = requiresAal2(role, isPublicSector);
  const observeOnlyRequiredSoon = hasSession && required && currentLevel !== 'aal2';

  if (!observeOnlyRequiredSoon) return <>{children}</>;

  return (
    <div className="space-y-4">
      <div className="border border-amber-500/40 bg-amber-500/10 text-amber-100 p-4 flex items-start gap-3">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-amber-400 shrink-0" />
          <div>
            <h1 className="font-display font-bold text-sm text-titanium-50">Observe-Modus: MFA bald verpflichtend</h1>
            <p className="text-sm text-amber-100">
              Dieser Bereich{action ? ` (${action})` : ''} wird für Ihre Rolle zeitnah AAL2 verlangen.
              Richten Sie MFA unter <a href="/settings/security" className="underline">/settings/security</a> ein.
            </p>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
