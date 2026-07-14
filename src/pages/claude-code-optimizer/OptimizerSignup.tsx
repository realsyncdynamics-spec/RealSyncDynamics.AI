import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Mail, Loader2, AlertTriangle, CheckCircle2, LogIn, FileText } from 'lucide-react';
import { usePageMeta } from '../../lib/usePageMeta';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import { getAuthRedirectUrl } from '../../lib/auth-redirect';
import {
  OptimizerShell,
  IntroBanner,
  PrimaryButton,
  stepById,
  loadScanResult,
} from './OptimizerKit';

/**
 * Schritt 4 — Anmeldung (Aktionsseite).
 *
 * Erklärt, dass nach der Anmeldung der ausführliche Bericht freigeschaltet
 * wird. Anmeldung per Magic Link (Supabase OTP), der Redirect führt zurück
 * zum Bericht (Schritt 5). Besteht bereits eine Session, geht es direkt weiter.
 */

export function OptimizerSignup() {
  const navigate = useNavigate();
  usePageMeta({
    title: 'Anmelden — Claude Code Optimizer',
    description: 'Melde dich per Magic Link an und schalte deinen ausführlichen Optimierungs-Bericht frei.',
    url: 'https://RealSyncDynamicsAI.de/claude-code-optimizer/anmelden',
  });

  const scan = loadScanResult();
  const berichtPath = stepById('bericht').path;

  const [email, setEmail] = useState(scan?.email ?? '');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // Bereits eingeloggt? → direkt zum Bericht.
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setCheckingSession(false);
      return;
    }
    const sb = getSupabase();
    sb.auth.getSession().then(({ data }) => {
      if (data.session) navigate(berichtPath, { replace: true });
      else setCheckingSession(false);
    });
  }, [navigate, berichtPath]);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      if (!isSupabaseConfigured()) {
        // Fallback: ohne Supabase-Konfiguration direkt zum Bericht (Demo/Dev).
        navigate(berichtPath);
        return;
      }
      const sb = getSupabase();
      const { error } = await sb.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: getAuthRedirectUrl(berichtPath) },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  if (checkingSession) {
    return (
      <OptimizerShell step="anmeldung" backTo={stepById('ergebnis').path}>
        <div className="flex items-center justify-center py-16 text-titanium-500 text-sm gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Session wird geprüft …
        </div>
      </OptimizerShell>
    );
  }

  return (
    <OptimizerShell step="anmeldung" backTo={stepById('ergebnis').path}>
      <IntroBanner
        kind="aktion"
        eyebrow="Schritt 4 von 5"
        title="Anmelden & Bericht freischalten"
        nextActionLabel="Nach der Anmeldung landest du automatisch auf deinem ausführlichen Bericht — dort wählst du dein Paket."
      >
        <p>
          Damit wir dir deinen persönlichen Optimierungs-Bericht zeigen und speichern können, meldest
          du dich einmalig per E-Mail an. Wir schicken dir einen <span className="text-titanium-200">Magic
          Link</span> — kein Passwort nötig.
        </p>
        {scan && (
          <p className="text-titanium-400">
            Dein Scan von <span className="font-mono text-titanium-100">{scan.domain}</span> wird deinem
            Konto automatisch zugeordnet.
          </p>
        )}
      </IntroBanner>

      <div className="bg-obsidian-900 border border-titanium-900 p-6 sm:p-8 rounded-none max-w-lg">
        {sent ? (
          <div className="flex items-start gap-2.5 text-sm text-emerald-300 bg-emerald-950/40 border border-emerald-900 rounded-none p-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Magic Link verschickt.</div>
              <div className="text-emerald-400/80 mt-0.5">
                Öffne dein Postfach ({email}) und klicke auf den Link. Danach landest du direkt auf
                deinem Bericht.
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={sendMagicLink} className="space-y-4">
            <label className="block">
              <span className="text-xs font-bold text-titanium-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> E-Mail-Adresse <span className="text-red-400">*</span>
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dein@unternehmen.de"
                autoComplete="email"
                className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2.5 text-base sm:text-sm rounded-none outline-none focus:border-cyan-500"
                disabled={sending}
              />
            </label>

            {error && (
              <div className="flex items-start gap-2 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <PrimaryButton type="submit" disabled={sending || !email} className="w-full">
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Sende Magic Link …
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" /> Anmelden & Bericht öffnen <ArrowRight className="h-4 w-4" />
                </>
              )}
            </PrimaryButton>

            <p className="text-[11px] text-titanium-500 flex items-center gap-1.5 leading-relaxed">
              <FileText className="h-3 w-3 shrink-0" />
              Mit der Anmeldung stimmst du der Verarbeitung gemäß Datenschutzerklärung zu.
            </p>
          </form>
        )}
      </div>
    </OptimizerShell>
  );
}
