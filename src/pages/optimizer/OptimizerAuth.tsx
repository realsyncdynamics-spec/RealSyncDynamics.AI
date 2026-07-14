/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SEITE 5 — /optimizer/auth  (Anmeldung / Registrierung)
 * Typ: ACTION. Tabs Einloggen/Registrieren, OAuth-Provider, Reminder,
 * dass das Scan-Ergebnis erhalten bleibt.
 *
 * Wiederverwendung: `useSupabaseAuth` (login/register) + der bestehende
 * `OAuthProviderButtons`. Kein neuer Auth-Stack.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertTriangle, ArrowRight, ShieldCheck, Mail, Lock, User } from 'lucide-react';

import { OptimizerLayout } from './OptimizerLayout';
import { useSupabaseAuth } from '../../features/supabase/SupabaseAuthContext';
import { OAuthProviderButtons } from '../../features/auth/OAuthProviderButtons';
import { getScanResult, setPendingEmail } from '../../lib/optimizer/state';

type Mode = 'login' | 'register';

export function OptimizerAuth() {
  const navigate = useNavigate();
  const { login, register, isAuthenticated } = useSupabaseAuth();

  const [mode, setMode] = useState<Mode>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const result = getScanResult();

  // Bereits eingeloggt → direkt zum Bericht.
  useEffect(() => {
    if (isAuthenticated) navigate('/optimizer/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
        navigate('/optimizer/dashboard');
      } else {
        await register(email.trim(), password);
        setPendingEmail(email.trim());
        // Bei aktivierter E-Mail-Bestätigung existiert noch keine Session —
        // die Verify-Seite leitet automatisch weiter, sobald bestätigt.
        navigate('/optimizer/auth/verify');
      }
    } catch (e) {
      setError((e as Error).message || 'Anmeldung fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <OptimizerLayout
      step={4}
      pageType="action"
      backTo="/optimizer/results"
      metaTitle="Anmelden oder Konto erstellen — Cloud Code Optimizer"
      metaDescription="Melde dich an, um deinen vollständigen Optimierungsbericht zu erhalten."
    >
      <h1 className="text-2xl sm:text-3xl font-display font-bold text-titanium-50 tracking-tight mb-6">
        Anmelden oder Konto erstellen
      </h1>

      {/* Reminder: Scan-Ergebnis bleibt erhalten */}
      {result && (
        <div className="flex items-start gap-2 text-sm text-titanium-200 bg-security-900/20 border border-security-800 rounded-none p-3 mb-6">
          <ShieldCheck className="h-4 w-4 text-security-400 shrink-0 mt-0.5" aria-hidden />
          <span>
            Dein Scan-Ergebnis für <span className="font-mono">{result.domain}</span> bleibt gespeichert und
            wird nach der Anmeldung freigeschaltet.
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border border-titanium-900 rounded-none mb-6 overflow-hidden" role="tablist">
        {(['login', 'register'] as Mode[]).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            type="button"
            onClick={() => { setMode(m); setError(null); }}
            className={
              'flex-1 py-2.5 text-sm font-bold transition-colors ' +
              (mode === m ? 'bg-obsidian-800 text-titanium-50' : 'bg-obsidian-900 text-titanium-400 hover:text-titanium-200')
            }
          >
            {m === 'login' ? 'Einloggen' : 'Registrieren'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="bg-obsidian-900 border border-titanium-900 rounded-none p-6 space-y-4">
        {mode === 'register' && (
          <FormField id="opt-name" label="Name" icon={<User className="h-3.5 w-3.5" />}>
            <input
              id="opt-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="w-full bg-obsidian-950 border border-titanium-700 focus:border-security-500 focus:outline-none rounded-none px-3 py-2.5 text-titanium-50"
            />
          </FormField>
        )}
        <FormField id="opt-email" label="E-Mail" icon={<Mail className="h-3.5 w-3.5" />} required>
          <input
            id="opt-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full bg-obsidian-950 border border-titanium-700 focus:border-security-500 focus:outline-none rounded-none px-3 py-2.5 text-titanium-50"
          />
        </FormField>
        <FormField id="opt-password" label="Passwort" icon={<Lock className="h-3.5 w-3.5" />} required>
          <input
            id="opt-password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="w-full bg-obsidian-950 border border-titanium-700 focus:border-security-500 focus:outline-none rounded-none px-3 py-2.5 text-titanium-50"
          />
        </FormField>

        {error && (
          <div role="alert" className="flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2 bg-security-500 hover:bg-security-400 disabled:opacity-60 text-white font-bold px-6 py-3 rounded-none transition-colors"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {mode === 'login' ? 'Einloggen' : 'Konto erstellen'}
        </button>
      </form>

      {/* OAuth */}
      <div className="mt-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="h-px flex-1 bg-titanium-900" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">oder</span>
          <span className="h-px flex-1 bg-titanium-900" />
        </div>
        <OAuthProviderButtons redirectAfterAuthTo="/optimizer/dashboard" />
      </div>
    </OptimizerLayout>
  );
}

function FormField({
  id, label, icon, required, children,
}: {
  id: string; label: string; icon: React.ReactNode; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-titanium-400 mb-1.5">
        {icon} {label}{required && <span className="text-security-400">*</span>}
      </label>
      {children}
    </div>
  );
}
