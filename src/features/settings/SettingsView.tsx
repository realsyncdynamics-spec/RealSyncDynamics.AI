import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Settings as SettingsIcon, User as UserIcon, Shield,
  Cookie, Key, Loader2, CheckCircle2, AlertTriangle, ExternalLink,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { AuthGate } from '../kodee/connections/AuthGate';
import { getSupabase } from '../../lib/supabase';

const BYOK_STORAGE_KEY = 'realsync.byok-keys.v1';

interface ProfileRow {
  full_name: string | null;
  organization_name: string | null;
  role: string | null;
  eu_compliance_mode: boolean | null;
  ai_data_residency: 'cloud' | 'eu_local' | null;
}

export function SettingsView() {
  return (
    <AuthGate>
      {(session) => <Inner session={session} />}
    </AuthGate>
  );
}

function Inner({ session }: { session: Session }) {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/dashboard" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center">
            <SettingsIcon className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Einstellungen</div>
            <div className="text-[11px] text-titanium-400 font-medium">Profil · BYOK · Datenschutz</div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <ProfileSection session={session} />
        <ByokSection />
        <ShortcutsSection />
      </main>
    </div>
  );
}

// ─── Profil ────────────────────────────────────────────────────────────────

function ProfileSection({ session }: { session: Session }) {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: e } = await getSupabase()
        .from('profiles')
        .select('full_name, organization_name, role, eu_compliance_mode, ai_data_residency')
        .eq('id', session.user.id).maybeSingle();
      if (cancelled) return;
      if (e) { setError(e.message); return; }
      const p = (data as ProfileRow | null) ?? {
        full_name: null, organization_name: null, role: null,
        eu_compliance_mode: null, ai_data_residency: null,
      };
      setProfile(p);
      setFullName(p.full_name ?? '');
      setOrgName(p.organization_name ?? '');
    })();
    return () => { cancelled = true; };
  }, [session.user.id]);

  async function save() {
    setSaving(true); setError(null); setSaved(false);
    try {
      const { error: e } = await getSupabase()
        .from('profiles')
        .update({
          full_name: fullName.trim() || null,
          organization_name: orgName.trim() || null,
        })
        .eq('id', session.user.id);
      if (e) throw e;
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title="Profil" icon={<UserIcon className="h-4 w-4" />}>
      {!profile ? (
        <Loading />
      ) : (
        <div className="space-y-3">
          <Field label="E-Mail" value={session.user.email ?? '–'} disabled />
          <FieldEditable label="Voller Name" value={fullName} onChange={setFullName} placeholder="Vor- + Nachname" />
          <FieldEditable label="Organisation" value={orgName} onChange={setOrgName} placeholder="z. B. RealSync Corp" />
          <Field label="Rolle" value={profile.role ?? 'user'} disabled />
          <div className="flex items-center gap-2 pt-2">
            <button onClick={save} disabled={saving}
              className="px-4 py-2 bg-security-500 hover:bg-security-600 disabled:opacity-50 text-white text-sm font-semibold rounded-none flex items-center gap-2">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Speichern
            </button>
            {saved && (
              <span className="text-xs text-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Gespeichert
              </span>
            )}
          </div>
          {error && <ErrorBox msg={error} />}
        </div>
      )}
    </Section>
  );
}

// ─── BYOK (localStorage) ──────────────────────────────────────────────────

interface ByokKeys { openai: string; anthropic: string; gemini: string; }

function ByokSection() {
  const [keys, setKeys] = useState<ByokKeys>({ openai: '', anthropic: '', gemini: '' });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BYOK_STORAGE_KEY);
      if (raw) setKeys(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  function save() {
    try {
      localStorage.setItem(BYOK_STORAGE_KEY, JSON.stringify(keys));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
  }

  function clear() {
    try { localStorage.removeItem(BYOK_STORAGE_KEY); } catch { /* ignore */ }
    setKeys({ openai: '', anthropic: '', gemini: '' });
  }

  return (
    <Section title="Bring Your Own Key (BYOK)" icon={<Key className="h-4 w-4" />}
      subtitle="Optional eigene API-Keys, ausschließlich im Browser-localStorage gespeichert. Server sieht sie nie. Werden nur in Frontend-internen Tools genutzt — die Backend-Edge-Functions verwenden ohnehin die in Supabase hinterlegten Server-Keys.">
      <div className="space-y-3">
        <FieldEditable label="OpenAI"     value={keys.openai}    onChange={(v) => setKeys({ ...keys, openai: v })}    placeholder="sk-..." secret />
        <FieldEditable label="Anthropic"  value={keys.anthropic} onChange={(v) => setKeys({ ...keys, anthropic: v })} placeholder="sk-ant-..." secret />
        <FieldEditable label="Gemini"     value={keys.gemini}    onChange={(v) => setKeys({ ...keys, gemini: v })}    placeholder="AIza..." secret />
        <div className="flex items-center gap-2 pt-2">
          <button onClick={save}
            className="px-4 py-2 bg-security-500 hover:bg-security-600 text-white text-sm font-semibold rounded-none">
            Im Browser speichern
          </button>
          <button onClick={clear}
            className="px-4 py-2 bg-obsidian-950 border border-titanium-900 hover:bg-obsidian-800 text-titanium-300 text-sm rounded-none">
            Löschen
          </button>
          {saved && (
            <span className="text-xs text-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Gespeichert (localStorage)
            </span>
          )}
        </div>
      </div>
    </Section>
  );
}

// ─── Shortcuts ────────────────────────────────────────────────────────────

function ShortcutsSection() {
  return (
    <Section title="Datenschutz + Account-Aktionen" icon={<Shield className="h-4 w-4" />}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ShortcutLink to="/settings/ai-residency" title="AI-Datenstandort"
          desc="Cloud (Anthropic/Google/OpenAI) vs. EU-lokal (Ollama auf Hostinger DE) toggeln." />
        <ShortcutLink to="/settings/account" title="Mein Account · DSGVO"
          desc="Datenexport (Art. 15) + Account-Löschung (Art. 17) Selfservice." />
        <ShortcutLink to="/legal/privacy" title="Datenschutzerklärung"
          desc="Welche Daten wir verarbeiten + Deine Rechte." />
        <ShortcutLink to="/legal/sub-processors" title="Sub-Prozessoren"
          desc="Liste aller Auftragsverarbeiter (Art. 28 DSGVO) mit DPAs." />
        <ShortcutLink to="/billing/usage" title="Verbrauch & Limits"
          desc="Aktuelle Quotas: AI-Calls, Tokens, Workflows, Cost." />
        <ShortcutCookie />
      </div>
    </Section>
  );
}

function ShortcutLink({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link to={to}
      className="block p-3 bg-obsidian-950 border border-titanium-900 hover:bg-obsidian-800 hover:border-security-700 rounded-none transition-colors">
      <div className="flex items-center justify-between">
        <span className="font-display font-bold text-titanium-50 text-sm">{title}</span>
        <ExternalLink className="h-3.5 w-3.5 text-titanium-500" />
      </div>
      <p className="text-xs text-titanium-400 mt-1 leading-relaxed">{desc}</p>
    </Link>
  );
}

function ShortcutCookie() {
  function reset() {
    try { localStorage.removeItem('realsync.cookie-consent.v1'); window.location.reload(); }
    catch { /* ignore */ }
  }
  return (
    <button onClick={reset}
      className="text-left p-3 bg-obsidian-950 border border-titanium-900 hover:bg-obsidian-800 hover:border-security-700 rounded-none transition-colors">
      <div className="flex items-center justify-between">
        <span className="font-display font-bold text-titanium-50 text-sm flex items-center gap-2">
          <Cookie className="h-3.5 w-3.5 text-amber-400" /> Cookie-Einstellungen
        </span>
      </div>
      <p className="text-xs text-titanium-400 mt-1 leading-relaxed">
        Banner zurücksetzen, Auswahl neu treffen.
      </p>
    </button>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function Section({
  title, icon, subtitle, children,
}: { title: string; icon?: React.ReactNode; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="bg-obsidian-900 border border-titanium-900 rounded-none p-5">
      <h2 className="font-display font-bold text-titanium-50 tracking-tight flex items-center gap-2">
        {icon}{title}
      </h2>
      {subtitle && <p className="text-xs text-titanium-400 mt-1 mb-4 leading-relaxed">{subtitle}</p>}
      {!subtitle && <div className="mt-3" />}
      {children}
    </section>
  );
}

function Field({ label, value, disabled }: { label: string; value: string; disabled?: boolean }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-bold text-titanium-400 uppercase tracking-wider">{label}</label>
      <input type="text" value={value} disabled={disabled} readOnly
        className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2 text-sm rounded-none text-titanium-300 cursor-not-allowed" />
    </div>
  );
}

function FieldEditable({
  label, value, onChange, placeholder, secret,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; secret?: boolean }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-bold text-titanium-400 uppercase tracking-wider">{label}</label>
      <input type={secret ? 'password' : 'text'}
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2 text-sm rounded-none outline-none focus:border-security-500" />
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center gap-2 text-titanium-500 text-sm py-4">
      <Loader2 className="h-4 w-4 animate-spin" /> Lade…
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-none p-3">
      <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" /><span>{msg}</span>
    </div>
  );
}
