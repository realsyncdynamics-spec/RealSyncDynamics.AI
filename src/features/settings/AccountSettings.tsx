import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ShieldCheck, Download, Trash2, AlertTriangle,
  Loader2, CheckCircle2, Mail, User as UserIcon,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { AuthGate } from '../kodee/connections/AuthGate';
import { getSupabase } from '../../lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const CONFIRM_PHRASE = 'DELETE-MY-ACCOUNT';

export function AccountSettings() {
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
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center shadow-sm">
            <UserIcon className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Account</div>
            <div className="text-[11px] text-titanium-400 font-medium">Daten + DSGVO-Rechte</div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <Section title="Profil">
          <Field label="E-Mail" value={session.user.email ?? '–'} icon={<Mail className="h-3.5 w-3.5" />} />
          <Field label="User-ID" value={session.user.id} mono />
          <Field label="Erstellt" value={new Date(session.user.created_at).toLocaleString('de-DE')} />
        </Section>

        <Section title="Datenexport (DSGVO Art. 15)"
          subtitle="Lade alle personenbezogenen Daten herunter, die wir über deinen Account haben — Profil, Memberships, Workflows, Audit-Logs, Subscriptions.">
          <ExportButton session={session} />
        </Section>

        <Section title="Account löschen (DSGVO Art. 17)"
          subtitle="Endgültig. Audit-Logs werden anonymisiert (für Cost-Tracking + Steuer-Pflicht), alles andere wird gelöscht."
          danger>
          <DeleteButton session={session} />
        </Section>
      </main>
    </div>
  );
}

// ─── Export ──────────────────────────────────────────────────────────────────

function ExportButton({ session }: { session: Session }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleExport() {
    setLoading(true); setError(null); setDone(false);
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/gdpr-export`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error?.message ?? `HTTP ${resp.status}`);
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const filename = resp.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1]
        ?? `gdpr-export-${session.user.id}.json`;
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button onClick={handleExport} disabled={loading}
        className="flex items-center gap-2 px-4 py-2.5 bg-security-500 hover:bg-security-600 disabled:opacity-50 text-white text-sm font-semibold rounded-none">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {loading ? 'Exportiere…' : 'Meine Daten herunterladen'}
      </button>
      {done && (
        <div className="flex items-center gap-2 text-xs text-emerald-300">
          <CheckCircle2 className="h-3.5 w-3.5" /> Download gestartet.
        </div>
      )}
      {error && <ErrorBox msg={error} />}
    </div>
  );
}

// ─── Delete ──────────────────────────────────────────────────────────────────

function DeleteButton({ session }: { session: Session }) {
  const [step, setStep] = useState<'idle' | 'confirming' | 'deleting' | 'done' | 'error'>('idle');
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<unknown>(null);

  async function handleDelete() {
    setStep('deleting'); setError(null);
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/gdpr-delete`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confirm: CONFIRM_PHRASE }),
      });
      const body = await resp.json();
      if (!resp.ok) {
        setError(body.error?.message ?? `HTTP ${resp.status}`);
        setDetails(body.error?.details ?? null);
        setStep('error');
        return;
      }
      setStep('done');
      // Sign out + redirect after short delay
      setTimeout(async () => {
        await getSupabase().auth.signOut();
        window.location.href = '/';
      }, 3000);
    } catch (e) {
      setError((e as Error).message);
      setStep('error');
    }
  }

  if (step === 'idle') {
    return (
      <button onClick={() => setStep('confirming')}
        className="flex items-center gap-2 px-4 py-2.5 bg-red-950/40 hover:bg-red-950/60 border border-red-900 text-red-300 text-sm font-semibold rounded-none">
        <Trash2 className="h-4 w-4" /> Account endgültig löschen…
      </button>
    );
  }

  if (step === 'confirming') {
    const canConfirm = confirmText === CONFIRM_PHRASE;
    return (
      <div className="space-y-3 p-4 bg-red-950/20 border border-red-900 rounded-none">
        <div className="flex items-start gap-2 text-sm text-red-300">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <strong className="block mb-1">Das löscht deinen Account unwiderruflich.</strong>
            <span>Tipp <code className="bg-red-950/60 px-1.5 py-0.5 text-red-200">{CONFIRM_PHRASE}</code> exakt unten ein, um zu bestätigen.</span>
          </div>
        </div>
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={CONFIRM_PHRASE}
          className="w-full bg-obsidian-950 border border-red-900 px-3 py-2 text-sm rounded-none outline-none focus:border-red-500 font-mono"
        />
        <div className="flex gap-2">
          <button onClick={handleDelete} disabled={!canConfirm}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-bold rounded-none">
            <Trash2 className="h-3.5 w-3.5" /> Ja, jetzt löschen
          </button>
          <button onClick={() => { setStep('idle'); setConfirmText(''); }}
            className="px-4 py-2 text-titanium-400 hover:text-titanium-200 text-sm">
            Abbrechen
          </button>
        </div>
      </div>
    );
  }

  if (step === 'deleting') {
    return (
      <div className="flex items-center gap-2 text-sm text-red-300">
        <Loader2 className="h-4 w-4 animate-spin" /> Lösche Account…
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="p-4 bg-emerald-950/20 border border-emerald-900 rounded-none text-sm text-emerald-300">
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle2 className="h-4 w-4" /> <strong>Account gelöscht.</strong>
        </div>
        <span className="text-emerald-400/80">Du wirst gleich abgemeldet und zur Startseite weitergeleitet…</span>
      </div>
    );
  }

  // error
  return (
    <div className="space-y-3">
      <ErrorBox msg={error ?? 'Unbekannter Fehler'} />
      {details ? (
        <pre className="text-xs bg-obsidian-950 border border-titanium-900 p-3 overflow-x-auto rounded-none text-titanium-300">
          {JSON.stringify(details, null, 2)}
        </pre>
      ) : null}
      <button onClick={() => { setStep('idle'); setError(null); setDetails(null); setConfirmText(''); }}
        className="px-3 py-1.5 text-titanium-400 hover:text-titanium-200 text-xs">
        Zurück
      </button>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function Section({
  title, subtitle, danger, children,
}: { title: string; subtitle?: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <section className={`bg-obsidian-900 border rounded-none p-5 ${danger ? 'border-red-900/60' : 'border-titanium-900'}`}>
      <h2 className={`font-display font-bold tracking-tight ${danger ? 'text-red-300' : 'text-titanium-50'}`}>{title}</h2>
      {subtitle && <p className="text-xs text-titanium-400 mt-1 mb-4 leading-relaxed">{subtitle}</p>}
      {!subtitle && <div className="mt-3" />}
      {children}
    </section>
  );
}

function Field({ label, value, mono, icon }: { label: string; value: string; mono?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 py-1.5 text-sm">
      <span className="text-xs font-bold text-titanium-400 uppercase tracking-wider w-24 shrink-0 flex items-center gap-1.5">
        {icon} {label}
      </span>
      <span className={`text-titanium-200 ${mono ? 'font-mono text-xs' : ''} truncate`}>{value}</span>
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
