// RequireAal2 (P0c, ADR 0006) — Hard-Enforce-Guard für privilegierte Bereiche.
//
// Erzwingt AAL2 (Supabase-native TOTP) für privilegierte Rollen/Tenants. KEIN
// Eigenbau-MFA — nutzt ausschließlich `core/access/mfa.ts`. Entscheidungslogik
// liegt rein in `aal2-policy.ts` (testbar). Dieser Guard rendert nur die UI.
//
// Komposition: sitzt INNERHALB des Login-Pfads. Ohne Session → `allow`
// (der vorhandene AuthGate der Views zeigt den Login). Dadurch keine
// Verwechslung „nicht eingeloggt" ↔ „MFA fehlt" und keine Endlosschleife.
import React, { useCallback, useEffect, useState } from 'react';
import { ShieldAlert, KeyRound, Loader2, AlertTriangle } from 'lucide-react';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import { useTenant } from './TenantProvider';
import { getMfaStatus, stepUpTotp } from './mfa';
import { requiresAal2, aal2Decision, type Aal, type Aal2Outcome } from './aal2-policy';

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
  const [nextLevel, setNextLevel] = useState<Aal>(null);

  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured()) { setReady(true); return; }
    const sb = getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    setHasSession(!!session);
    if (session) {
      const st = await getMfaStatus();
      setCurrentLevel((st.currentLevel as Aal) ?? null);
      setNextLevel((st.nextLevel as Aal) ?? null);
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
  const outcome: Aal2Outcome = aal2Decision({ hasSession, required, currentLevel, nextLevel });

  if (outcome === 'allow') return <>{children}</>;

  const confirmStepUp = async () => {
    setBusy(true); setError(null);
    try {
      await stepUpTotp(otp);
      setOtp('');
      await refresh();
    } catch (e) {
      setError((e as Error)?.message ?? 'Bestätigung fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md border border-amber-500/40 bg-obsidian-900 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-7 w-7 text-amber-400 shrink-0" />
          <div>
            <h1 className="font-display font-bold text-lg text-titanium-50">MFA erforderlich</h1>
            <p className="text-sm text-titanium-400">
              Dieser Bereich{action ? ` (${action})` : ''} verlangt für Ihre Rolle eine
              Zwei-Faktor-Authentifizierung (AAL2).
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-rose-200 bg-rose-500/10 border border-rose-500/40 p-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {outcome === 'step-up' ? (
          <div className="space-y-3">
            <p className="text-sm text-titanium-300">
              Geben Sie den 6-stelligen Code Ihrer Authenticator-App ein, um fortzufahren.
            </p>
            <div className="flex gap-2">
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                inputMode="numeric"
                autoFocus
                placeholder="123456"
                className="bg-obsidian-950 border border-titanium-700 px-3 py-2 text-sm font-mono w-32 outline-none focus:border-cyan-400"
              />
              <button
                onClick={confirmStepUp}
                disabled={busy || otp.trim().length < 6}
                className="inline-flex items-center gap-2 bg-cyan-400 text-obsidian-950 px-4 py-2 text-sm font-semibold hover:bg-cyan-300 disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} MFA bestätigen
              </button>
            </div>
            <a href="/settings/security" className="inline-block text-xs text-titanium-500 hover:text-titanium-300">
              Gerät verloren? Recovery-Code einlösen
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-titanium-300">
              Sie haben noch keine MFA eingerichtet. Richten Sie sie ein, um diesen Bereich zu nutzen.
            </p>
            <a
              href="/settings/security"
              className="inline-flex items-center gap-2 bg-cyan-400 text-obsidian-950 px-5 py-3 text-sm font-semibold hover:bg-cyan-300"
            >
              <KeyRound className="h-4 w-4" /> MFA einrichten
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
