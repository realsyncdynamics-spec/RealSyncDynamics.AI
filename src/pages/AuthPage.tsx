import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, AlertTriangle, ArrowRight, Mail, CheckCircle2 } from 'lucide-react';
import { OAuthProviderButtons } from '../features/auth/OAuthProviderButtons';
import { Logo } from '../components/Logo';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { getAuthRedirectUrl } from '../lib/auth-redirect';

/**
 * /login + /register — vertraute, professionelle Auth-Seite.
 *
 * Ersetzt den früheren Redirect auf den /welcome-Onboarding-Wizard. Der
 * Nutzer sieht beim Klick auf „Login" jetzt eine erwartbare Anmeldemaske:
 * Google (OAuth) oben, darunter E-Mail + Passwort, „Passwort vergessen".
 *
 * Auth-Methoden (Supabase):
 *   - signInWithOAuth  → OAuthProviderButtons (Google zuerst)
 *   - signInWithPassword (Login)
 *   - signUp            (Registrierung, mit E-Mail-Bestätigung falls aktiv)
 *   - resetPasswordForEmail (Passwort vergessen → Recovery-Link)
 *
 * Nach erfolgreicher Anmeldung → /app (bzw. sicherer ?next=-Pfad).
 */

type Mode = 'login' | 'register';

/** Open-Redirect-Schutz: nur interne Pfade (/… ohne //) zulassen. */
function safeNext(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return '/app';
}

export function AuthPage({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const isRegister = mode === 'register';

  // Bereits eingeloggt? → direkt weiter. Fängt auch die OAuth-Rückkehr ab
  // (Browser landet nach dem Provider wieder hier, dann SIGNED_IN).
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const sb = getSupabase();
    let cancelled = false;

    sb.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session?.user) navigate(next, { replace: true });
    });

    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) navigate(next, { replace: true });
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [navigate, next]);

  const ensureConfigured = (): boolean => {
    if (isSupabaseConfigured()) return true;
    setError('Auth ist nicht konfiguriert (VITE_SUPABASE_URL fehlt).');
    return false;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email || !password) return;
    if (!ensureConfigured()) return;

    setBusy(true);
    try {
      const sb = getSupabase();
      if (isRegister) {
        const { data, error: signUpErr } = await sb.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: getAuthRedirectUrl(next) },
        });
        if (signUpErr) throw signUpErr;
        // Wenn E-Mail-Bestätigung aktiv ist, gibt es noch keine Session.
        if (data.session) {
          navigate(next, { replace: true });
        } else {
          setInfo(
            `Wir haben eine Bestätigungs-Mail an ${email} gesendet. Bestätige deine Adresse, um fortzufahren.`,
          );
        }
      } else {
        const { error: signInErr } = await sb.auth.signInWithPassword({ email, password });
        if (signInErr) throw signInErr;
        navigate(next, { replace: true });
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isRegister
            ? 'Registrierung fehlgeschlagen.'
            : 'Anmeldung fehlgeschlagen.',
      );
    } finally {
      setBusy(false);
    }
  };

  const forgotPassword = async () => {
    setError(null);
    setInfo(null);
    if (!email) {
      setError('Bitte zuerst die E-Mail-Adresse eingeben.');
      return;
    }
    if (!ensureConfigured()) return;
    setBusy(true);
    try {
      const sb = getSupabase();
      const { error: resetErr } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: getAuthRedirectUrl(next),
      });
      if (resetErr) throw resetErr;
      setInfo(`Wir haben einen Link zum Zurücksetzen an ${email} gesendet.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Link konnte nicht gesendet werden.');
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    'mt-2 w-full bg-obsidian-900 border border-titanium-800 text-titanium-50 px-4 py-3 text-sm rounded-none focus:border-ai-cyan-500 outline-none placeholder:text-titanium-600';
  const labelClass =
    'text-[10px] font-mono uppercase tracking-[0.2em] text-titanium-500';

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex flex-col">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="flex items-center">
          <Logo size={24} />
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-display font-bold text-titanium-50 tracking-tight">
              {isRegister ? 'Konto erstellen' : 'Willkommen zurück'}
            </h1>
            <p className="text-titanium-500 text-sm mt-1.5">
              {isRegister
                ? 'Starte mit RealSync Dynamics AI.'
                : 'Melde dich bei deinem Governance OS an.'}
            </p>
          </div>

          {/* OAuth — Google zuerst (siehe OAuthProviderButtons) */}
          <OAuthProviderButtons redirectAfterAuthTo={next} variant="compact" />

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-titanium-800" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-600">
              oder mit E-Mail
            </span>
            <div className="flex-1 h-px bg-titanium-800" />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-950/30 border border-red-900 rounded-none flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}
          {info && (
            <div className="mb-4 p-3 bg-emerald-950/30 border border-emerald-800 rounded-none flex items-start gap-2.5">
              {isRegister ? (
                <Mail className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <p className="text-sm text-emerald-200">{info}</p>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className={labelClass} htmlFor="auth-email">
                E-Mail
              </label>
              <input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vorname.name@firma.de"
                className={inputClass}
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className={labelClass} htmlFor="auth-password">
                  Passwort
                </label>
                {!isRegister && (
                  <button
                    type="button"
                    onClick={forgotPassword}
                    disabled={busy}
                    className="text-[11px] text-ai-cyan-400 hover:text-ai-cyan-300 disabled:opacity-50"
                  >
                    Passwort vergessen?
                  </button>
                )}
              </div>
              <input
                id="auth-password"
                type="password"
                required
                minLength={isRegister ? 8 : undefined}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isRegister ? 'Mindestens 8 Zeichen' : '••••••••'}
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={!email || !password || busy}
              className="w-full inline-flex items-center justify-center gap-2 bg-white text-obsidian-950 hover:bg-titanium-200 disabled:bg-titanium-800 disabled:text-titanium-600 disabled:cursor-not-allowed px-6 py-3 text-sm font-semibold rounded-none transition-colors"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isRegister ? 'Konto wird erstellt …' : 'Anmelden …'}
                </>
              ) : (
                <>
                  {isRegister ? 'Konto erstellen' : 'Anmelden'}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-titanium-500">
            {isRegister ? (
              <>
                Bereits ein Konto?{' '}
                <Link
                  to={`/login${params.toString() ? `?${params.toString()}` : ''}`}
                  className="text-titanium-200 hover:text-white font-medium"
                >
                  Anmelden
                </Link>
              </>
            ) : (
              <>
                Noch kein Konto?{' '}
                <Link
                  to={`/register${params.toString() ? `?${params.toString()}` : ''}`}
                  className="text-titanium-200 hover:text-white font-medium"
                >
                  Konto erstellen
                </Link>
              </>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
