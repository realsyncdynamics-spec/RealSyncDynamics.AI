import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, AlertTriangle, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';
import { Logo } from '../components/Logo';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';

/**
 * /reset — neues Passwort setzen nach „Passwort vergessen".
 *
 * Flow: AuthPage.forgotPassword → resetPasswordForEmail(redirectTo=/reset).
 * Der Recovery-Link aus der E-Mail öffnet diese Seite; Supabase erkennt das
 * Token in der URL (detectSessionInUrl) und feuert PASSWORD_RECOVERY → es
 * besteht eine kurzlebige Recovery-Session, mit der updateUser({ password })
 * erlaubt ist. Danach → /app.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // Recovery-Session vorhanden? Bestimmt, ob das Formular nutzbar ist.
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setChecking(false);
      return;
    }
    const sb = getSupabase();
    let cancelled = false;

    sb.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session?.user) setReady(true);
      setChecking(false);
    });

    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session?.user)) {
        setReady(true);
        setChecking(false);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }
    if (password !== confirm) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }
    if (!isSupabaseConfigured()) {
      setError('Auth ist nicht konfiguriert (VITE_SUPABASE_URL fehlt).');
      return;
    }
    setBusy(true);
    try {
      const { error: updErr } = await getSupabase().auth.updateUser({ password });
      if (updErr) throw updErr;
      setDone(true);
      setTimeout(() => navigate('/app', { replace: true }), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Passwort konnte nicht gesetzt werden.');
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    'mt-2 w-full bg-obsidian-900 border border-titanium-800 text-titanium-50 px-4 py-3 text-sm rounded-none focus:border-ai-cyan-500 outline-none placeholder:text-titanium-600';
  const labelClass = 'text-[10px] font-mono uppercase tracking-[0.2em] text-titanium-500';

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex flex-col">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center gap-1 px-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Zurück"
          title="Zurück"
          className="p-2 text-titanium-400 hover:text-titanium-100 hover:bg-obsidian-800 rounded-none transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => navigate(1)}
          aria-label="Vor"
          title="Vor"
          className="p-2 text-titanium-400 hover:text-titanium-100 hover:bg-obsidian-800 rounded-none transition-colors"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
        <Link to="/" className="flex items-center ml-2">
          <Logo size={24} />
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-display font-bold text-titanium-50 tracking-tight">
              Neues Passwort
            </h1>
            <p className="text-titanium-500 text-sm mt-1.5">
              Wähle ein neues Passwort für dein Konto.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-950/30 border border-red-900 rounded-none flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          {done ? (
            <div className="p-4 bg-emerald-950/30 border border-emerald-800 rounded-none flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-200">
                Passwort aktualisiert. Du wirst weitergeleitet …
              </p>
            </div>
          ) : checking ? (
            <div className="flex items-center justify-center gap-2 py-8 text-titanium-500 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Recovery-Link wird geprüft …
            </div>
          ) : !ready ? (
            <div className="space-y-4">
              <div className="p-3 bg-amber-950/20 border border-amber-900 rounded-none flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-200">
                  Kein gültiger Recovery-Link erkannt. Der Link ist eventuell abgelaufen
                  oder wurde bereits verwendet.
                </p>
              </div>
              <Link
                to="/login"
                className="block w-full text-center bg-white text-obsidian-950 hover:bg-titanium-200 px-6 py-3 text-sm font-semibold rounded-none transition-colors"
              >
                Zurück zur Anmeldung
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className={labelClass} htmlFor="reset-password">
                  Neues Passwort
                </label>
                <input
                  id="reset-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mindestens 8 Zeichen"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="reset-confirm">
                  Passwort bestätigen
                </label>
                <input
                  id="reset-confirm"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Passwort wiederholen"
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={!password || !confirm || busy}
                className="w-full inline-flex items-center justify-center gap-2 bg-white text-obsidian-950 hover:bg-titanium-200 disabled:bg-titanium-800 disabled:text-titanium-600 disabled:cursor-not-allowed px-6 py-3 text-sm font-semibold rounded-none transition-colors"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Wird gespeichert …
                  </>
                ) : (
                  <>
                    Passwort speichern <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
