import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '../../features/supabase/SupabaseAuthContext';
import { OAuthProviderButtons } from '../../features/auth/OAuthProviderButtons';

/**
 * Wenn der E-Mail-Anbieter im Projekt abgeschaltet ist, antwortet Supabase mit
 * einem englischen Fehlercode. Am 2026-08-29 gegen die Live-Instanz gemessen:
 *
 *   POST /auth/v1/signup                 400  email_provider_disabled
 *   POST /auth/v1/token?grant_type=…     422  email_provider_disabled
 *   POST /auth/v1/otp                    422  otp_disabled
 *
 * Der Rohtext („Email signups are disabled") stand bisher als Fehlermeldung
 * unter einem deutschen Formular — für den Besucher sieht das nach einem
 * Fehler seiner Eingabe aus, dabei ist es eine Projekteinstellung. Diese
 * Übersetzung nennt die Ursache und den Weg, der funktioniert.
 */
function explainAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : '';
  const code = (err as { code?: string })?.code ?? '';
  const disabled =
    code === 'email_provider_disabled' ||
    code === 'otp_disabled' ||
    /provider_disabled|signups? (are |not )?(disabled|allowed)|logins are disabled/i.test(raw);

  if (disabled) {
    return 'Die Registrierung per E-Mail und Passwort ist derzeit deaktiviert. ' +
      'Nutzen Sie die Anmeldung über einen Anbieter oben — damit legen Sie Ihr ' +
      'Konto in einem Schritt an.';
  }
  return raw || 'Ein Fehler ist aufgetreten';
}

export function RegisterPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, register, isLoading: authLoading } = useSupabaseAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'signup' | 'confirm' | 'verify-email'>('signup');

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate('/unified-entry/onboarding', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Bitte geben Sie eine E-Mail ein');
      return;
    }

    if (password !== passwordConfirm) {
      setError('Passwörter stimmen nicht überein');
      return;
    }

    if (password.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen lang sein');
      return;
    }

    setLoading(true);

    try {
      // `register()` legt das Konto an. Bis zum 2026-08-29 stand hier
      // `login()` mit dem Kommentar „login will also register if needed" —
      // das stimmt nicht: `signInWithPassword` erstellt kein Konto. Ein neuer
      // Besucher bekam „Invalid login credentials" auf einer Seite, die
      // „Konto erstellen" verspricht.
      const { needsEmailConfirmation } = await register(email.trim(), password);
      // Ohne Session gibt es keinen Weg nach vorn: `/unified-entry/onboarding`
      // verlangt einen angemeldeten Nutzer und schickt sonst hierher zurück.
      // Der Besucher liefe im Kreis, während die Seite „erfolgreich erstellt"
      // behauptet.
      setStep(needsEmailConfirmation ? 'verify-email' : 'confirm');
    } catch (err) {
      setError(explainAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-petrol-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-titanium-50">
          {step === 'signup'
            ? 'Konto erstellen'
            : step === 'verify-email'
              ? 'E-Mail bestätigen'
              : 'Bestätigung'}
        </h1>
        <p className="text-titanium-300">
          {step === 'signup'
            ? 'Registrieren Sie sich, um 14 Tage kostenlos Zugriff zu erhalten'
            : step === 'verify-email'
              ? 'Noch ein Schritt: Bitte bestätigen Sie Ihre E-Mail-Adresse.'
              : 'Ihr Konto wurde erstellt. Weiter gehts!'}
        </p>
      </div>

      {step === 'signup' ? (
        <>
          {/* Der einzige Weg, der zurzeit durchläuft. Er stand auf dieser
              Seite bisher gar nicht zur Wahl, obwohl die Komponente im Repo
              liegt und auf /welcome, im Checkout und unter /optimizer/auth
              schon eingebunden ist. Sie zeigt nur Anbieter, die im Projekt
              eingerichtet sind, und rendert nichts, wenn keiner übrig ist. */}
          <OAuthProviderButtons redirectAfterAuthTo="/unified-entry/onboarding" />

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-titanium-700" />
            <span className="text-xs uppercase tracking-wider text-titanium-500">
              oder mit E-Mail
            </span>
            <span className="h-px flex-1 bg-titanium-700" />
          </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-titanium-200 mb-2">
              E-Mail
            </label>
            <input
              id="email"
              type="email"
              placeholder="ihre@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
              className="w-full px-4 py-2 bg-obsidian-800 border border-titanium-700 rounded-lg text-titanium-50 placeholder-titanium-500 focus:outline-none focus:border-petrol-600 disabled:opacity-50"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-titanium-200 mb-2">
              Passwort
            </label>
            <input
              id="password"
              type="password"
              placeholder="Mindestens 8 Zeichen"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
              className="w-full px-4 py-2 bg-obsidian-800 border border-titanium-700 rounded-lg text-titanium-50 placeholder-titanium-500 focus:outline-none focus:border-petrol-600 disabled:opacity-50"
            />
          </div>

          <div>
            <label htmlFor="passwordConfirm" className="block text-sm font-medium text-titanium-200 mb-2">
              Passwort wiederholen
            </label>
            <input
              id="passwordConfirm"
              type="password"
              placeholder="Passwort wiederholen"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              disabled={loading}
              required
              className="w-full px-4 py-2 bg-obsidian-800 border border-titanium-700 rounded-lg text-titanium-50 placeholder-titanium-500 focus:outline-none focus:border-petrol-600 disabled:opacity-50"
            />
          </div>

          {error && (
            <div className="px-4 py-3 bg-red-900/20 border border-red-700 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-2 bg-petrol-600 hover:bg-petrol-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {loading ? 'Wird erstellt...' : 'Konto erstellen'}
          </button>

          <p className="text-center text-sm text-titanium-400">
            Bereits Mitglied?{' '}
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-petrol-500 hover:text-petrol-400 transition-colors"
            >
              Jetzt anmelden
            </button>
          </p>
        </form>
        </>
      ) : step === 'verify-email' ? (
        <div className="space-y-4 text-center">
          <div className="text-5xl">✉️</div>
          <p className="text-titanium-300">
            Ihr Konto <strong>{email}</strong> wurde angelegt. Wir haben Ihnen einen
            Bestätigungslink geschickt — bitte öffnen Sie ihn, um fortzufahren.
          </p>
          <p className="text-sm text-titanium-400">
            Ohne Bestätigung ist die Einrichtung noch nicht freigeschaltet. Der Link
            landet gelegentlich im Spam-Ordner.
          </p>
        </div>
      ) : (
        <div className="space-y-4 text-center">
          <div className="text-5xl">✓</div>
          <p className="text-titanium-300">
            Ihr Account <strong>{email}</strong> wurde erfolgreich erstellt.
          </p>
          <button
            onClick={() => navigate('/unified-entry/onboarding')}
            className="w-full px-6 py-2 bg-petrol-600 hover:bg-petrol-700 text-white font-medium rounded-lg transition-colors"
          >
            Nächster Schritt
          </button>
        </div>
      )}
    </div>
  );
}
