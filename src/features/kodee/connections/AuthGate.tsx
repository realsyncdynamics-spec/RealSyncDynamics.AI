import React, { useEffect, useState } from 'react';
import { LogIn, Mail, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase';
import type { Session } from '@supabase/supabase-js';

interface Props {
  children: (session: Session) => React.ReactNode;
}

export function AuthGate({ children }: Props) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const sb = getSupabase();
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_evt, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured()) {
    return (
      <CenteredCard
        icon={<AlertCircle className="h-6 w-6 text-amber-600" />}
        title="Supabase nicht konfiguriert"
        body={
          <p className="text-sm text-slate-600 leading-relaxed">
            Setze <code className="px-1 py-0.5 bg-slate-100 rounded text-xs">VITE_SUPABASE_URL</code> und{' '}
            <code className="px-1 py-0.5 bg-slate-100 rounded text-xs">VITE_SUPABASE_ANON_KEY</code> in{' '}
            <code className="px-1 py-0.5 bg-slate-100 rounded text-xs">.env.local</code> und starte den Dev-Server neu.
          </p>
        }
      />
    );
  }

  if (session === undefined) {
    return <div className="flex items-center justify-center h-screen text-slate-400 text-sm">Lade Session…</div>;
  }

  if (session) return <>{children(session)}</>;

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const sb = getSupabase();
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.href },
      });
      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      setError(err?.message ?? 'Senden fehlgeschlagen');
    } finally {
      setSending(false);
    }
  };

  return (
    <CenteredCard
      icon={<LogIn className="h-6 w-6 text-emerald-600" />}
      title="Bei Kodee anmelden"
      body={
        sent ? (
          <div className="flex items-start gap-2.5 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Magic Link verschickt.</div>
              <div className="text-emerald-600/80 mt-0.5">
                Schau in dein Postfach ({email}) und klicke auf den Link, um dich einzuloggen.
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={sendMagicLink} className="space-y-3">
            <p className="text-sm text-slate-600 leading-relaxed">
              Einmal-Login per E-Mail. Wir schicken dir einen Magic Link.
            </p>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dein@email.de"
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                disabled={sending}
              />
            </div>
            {error && (
              <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            <button
              type="submit"
              disabled={sending || !email}
              className="w-full py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {sending ? 'Sende…' : 'Magic Link senden'}
            </button>
          </form>
        )
      }
    />
  );
}

function CenteredCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">{icon}</div>
          <h1 className="font-display text-lg font-bold tracking-tight text-slate-900">{title}</h1>
        </div>
        {body}
      </div>
    </div>
  );
}
