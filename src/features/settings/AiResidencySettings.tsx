import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ShieldCheck, Cloud, Server, AlertTriangle, Loader2,
  CheckCircle2, Lock,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { getSupabase } from '../../lib/supabase';

type Residency = 'cloud' | 'eu_local';
type Policy    = 'user_choice' | 'enforce_eu_local' | 'enforce_cloud';

export function AiResidencySettings() {
  return (
    <AuthGate>
      {(session) => <Inner session={session} />}
    </AuthGate>
  );
}

function Inner({ session }: { session: Session }) {
  const { tenants, activeTenantId, setActiveTenant, loading: tenantLoading } = useTenant();

  const [userPref,     setUserPref]     = useState<Residency | null>(null);
  const [tenantPolicy, setTenantPolicy] = useState<Policy   | null>(null);
  const [savingUser,   setSavingUser]   = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [saved,        setSaved]        = useState<'user' | 'policy' | null>(null);

  const activeTenant = tenants.find((t) => t.tenantId === activeTenantId) ?? null;
  // Mirrors the `tenants owner-update` RLS policy — only the owner can change
  // workspace-wide policy. Admins and below get a read-only view.
  const canEditPolicy = activeTenant?.role === 'owner';

  // Fetch profile + tenant policy
  useEffect(() => {
    const sb = getSupabase();
    let cancelled = false;
    setError(null);
    (async () => {
      const { data: profile, error: pErr } = await sb
        .from('profiles')
        .select('ai_data_residency')
        .eq('id', session.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (pErr) { setError(pErr.message); return; }
      setUserPref((profile?.ai_data_residency as Residency) ?? 'cloud');

      if (activeTenantId) {
        const { data: tenant, error: tErr } = await sb
          .from('tenants')
          .select('ai_data_residency_policy')
          .eq('id', activeTenantId)
          .maybeSingle();
        if (cancelled) return;
        if (tErr) { setError(tErr.message); return; }
        setTenantPolicy((tenant?.ai_data_residency_policy as Policy) ?? 'user_choice');
      } else {
        setTenantPolicy(null);
      }
    })();
    return () => { cancelled = true; };
  }, [session.user.id, activeTenantId]);

  // Effective residency mirrors the DB-side resolve_ai_residency() logic.
  const effective: Residency =
    tenantPolicy === 'enforce_eu_local' ? 'eu_local' :
    tenantPolicy === 'enforce_cloud'    ? 'cloud'    :
    userPref ?? 'cloud';

  const overriddenByTenant =
    tenantPolicy === 'enforce_eu_local' || tenantPolicy === 'enforce_cloud';

  async function saveUserPref(next: Residency) {
    setSavingUser(true); setError(null); setSaved(null);
    try {
      const { error: e } = await getSupabase()
        .from('profiles')
        .update({ ai_data_residency: next })
        .eq('id', session.user.id);
      if (e) throw e;
      setUserPref(next);
      setSaved('user');
      setTimeout(() => setSaved((s) => (s === 'user' ? null : s)), 2000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingUser(false);
    }
  }

  async function saveTenantPolicy(next: Policy) {
    if (!activeTenantId) return;
    setSavingPolicy(true); setError(null); setSaved(null);
    try {
      const { error: e } = await getSupabase()
        .from('tenants')
        .update({ ai_data_residency_policy: next })
        .eq('id', activeTenantId);
      if (e) throw e;
      setTenantPolicy(next);
      setSaved('policy');
      setTimeout(() => setSaved((s) => (s === 'policy' ? null : s)), 2000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingPolicy(false);
    }
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">AI-Datenstandort</div>
              <div className="text-[11px] text-titanium-400 font-medium">Cloud vs. EU-lokal (Ollama)</div>
            </div>
          </div>
        </div>

        {tenants.length > 1 && (
          <select
            value={activeTenantId ?? ''}
            onChange={(e) => setActiveTenant(e.target.value)}
            className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer font-medium hover:bg-obsidian-800 max-w-[200px]"
          >
            {tenants.map((t) => (
              <option key={t.tenantId} value={t.tenantId}>{t.name}</option>
            ))}
          </select>
        )}
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {error && (
          <div className="flex items-start gap-2 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {tenantLoading || userPref === null ? (
          <div className="flex items-center gap-2 text-titanium-500 text-sm py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade Einstellungen…
          </div>
        ) : (
          <>
            <EffectiveBadge residency={effective} overridden={overriddenByTenant} />

            <Section
              title="Persönliche Einstellung"
              subtitle="Gilt für alle AI-Aufrufe, die du in deinem Account auslöst."
            >
              {overriddenByTenant && (
                <div className="flex items-start gap-2 text-xs text-amber-300 bg-amber-950/30 border border-amber-900/50 rounded-none p-2.5 mb-4">
                  <Lock className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Workspace-Admin hat eine Policy gesetzt — deine persönliche Wahl
                    wird für diesen Workspace ignoriert.
                  </span>
                </div>
              )}

              <div className="space-y-2">
                <ResidencyOption
                  active={userPref === 'cloud'}
                  disabled={savingUser}
                  onSelect={() => saveUserPref('cloud')}
                  icon={<Cloud className="h-4 w-4" />}
                  title="Cloud (Standard)"
                  body="Anthropic Claude / Google Gemini / OpenAI. Schnellste Antworten, höchste Qualität, Daten verlassen die EU."
                />
                <ResidencyOption
                  active={userPref === 'eu_local'}
                  disabled={savingUser}
                  onSelect={() => saveUserPref('eu_local')}
                  icon={<Server className="h-4 w-4" />}
                  title="EU-lokal (Datenschutz-Modus)"
                  body="Lokales Open-Source-Modell auf RealSync-Infrastruktur in der EU. 30–60 Sek pro Antwort, reduzierte Qualität, einige Tools nicht verfügbar."
                  badge="🇪🇺"
                />
              </div>

              {saved === 'user' && (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Gespeichert.
                </div>
              )}
            </Section>

            {activeTenantId && tenantPolicy !== null && (
              <Section
                title="Workspace-Policy"
                subtitle={
                  canEditPolicy
                    ? 'Als Owner kannst du eine Policy für alle Workspace-Mitglieder erzwingen.'
                    : 'Nur der Workspace-Owner kann diese Policy ändern.'
                }
              >
                <div className="space-y-2">
                  <PolicyOption
                    active={tenantPolicy === 'user_choice'}
                    disabled={!canEditPolicy || savingPolicy}
                    onSelect={() => saveTenantPolicy('user_choice')}
                    title="Mitglieder entscheiden selbst"
                    body="Jedes Workspace-Mitglied wählt seine persönliche Einstellung."
                  />
                  <PolicyOption
                    active={tenantPolicy === 'enforce_eu_local'}
                    disabled={!canEditPolicy || savingPolicy}
                    onSelect={() => saveTenantPolicy('enforce_eu_local')}
                    title="EU-lokal erzwingen"
                    body="Alle AI-Aufrufe in diesem Workspace gehen an das lokale Modell. Persönliche Einstellungen werden ignoriert."
                  />
                  <PolicyOption
                    active={tenantPolicy === 'enforce_cloud'}
                    disabled={!canEditPolicy || savingPolicy}
                    onSelect={() => saveTenantPolicy('enforce_cloud')}
                    title="Cloud erzwingen"
                    body="Alle AI-Aufrufe in diesem Workspace gehen an die Cloud-Provider. Datenschutz-Modus deaktiviert."
                  />
                </div>

                {saved === 'policy' && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Policy aktualisiert.
                  </div>
                )}
              </Section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function EffectiveBadge({
  residency, overridden,
}: { residency: Residency; overridden: boolean }) {
  const isLocal = residency === 'eu_local';
  return (
    <div
      className={`flex items-center gap-3 p-4 border rounded-none ${
        isLocal
          ? 'bg-emerald-950/30 border-emerald-900/60'
          : 'bg-security-900/30 border-security-800'
      }`}
    >
      {isLocal ? (
        <Server className="h-5 w-5 text-emerald-400 shrink-0" />
      ) : (
        <Cloud className="h-5 w-5 text-security-300 shrink-0" />
      )}
      <div className="flex-1">
        <div className="text-sm font-bold text-titanium-50">
          Aktiv: {isLocal ? 'EU-lokal 🇪🇺' : 'Cloud'}
        </div>
        <div className="text-xs text-titanium-400 mt-0.5">
          {overridden
            ? 'Durch Workspace-Policy gesetzt.'
            : 'Aus deiner persönlichen Einstellung.'}
        </div>
      </div>
    </div>
  );
}

function Section({
  title, subtitle, children,
}: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="bg-obsidian-900 border border-titanium-900 rounded-none p-5">
      <h2 className="font-display font-bold text-titanium-50 tracking-tight">{title}</h2>
      {subtitle && <p className="text-xs text-titanium-400 mt-1 mb-4">{subtitle}</p>}
      {children}
    </section>
  );
}

function ResidencyOption({
  active, disabled, onSelect, icon, title, body, badge,
}: {
  active: boolean; disabled?: boolean; onSelect: () => void;
  icon: React.ReactNode; title: string; body: string; badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`w-full text-left p-3 border rounded-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        active
          ? 'bg-security-900/30 border-security-500'
          : 'bg-obsidian-950 border-titanium-900 hover:bg-obsidian-800'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="text-titanium-300 mt-0.5">{icon}</div>
        <div className="flex-1">
          <div className="text-sm font-bold text-titanium-50 flex items-center gap-2">
            {title}
            {badge && <span>{badge}</span>}
            {active && <CheckCircle2 className="h-3.5 w-3.5 text-security-300" />}
          </div>
          <div className="text-xs text-titanium-400 mt-1 leading-relaxed">{body}</div>
        </div>
      </div>
    </button>
  );
}

function PolicyOption({
  active, disabled, onSelect, title, body,
}: {
  active: boolean; disabled?: boolean; onSelect: () => void;
  title: string; body: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`w-full text-left p-3 border rounded-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        active
          ? 'bg-security-900/30 border-security-500'
          : 'bg-obsidian-950 border-titanium-900 hover:bg-obsidian-800'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-1 w-3 h-3 rounded-full border-2 shrink-0 ${
          active ? 'bg-security-400 border-security-300' : 'bg-transparent border-titanium-700'
        }`} />
        <div className="flex-1">
          <div className="text-sm font-bold text-titanium-50">{title}</div>
          <div className="text-xs text-titanium-400 mt-1 leading-relaxed">{body}</div>
        </div>
      </div>
    </button>
  );
}
