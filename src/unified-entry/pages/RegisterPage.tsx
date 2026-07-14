import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '../../features/supabase/SupabaseAuthContext';

export function RegisterPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, login, isLoading: authLoading } = useSupabaseAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'signup' | 'confirm'>('signup');

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
      // Use Supabase auth - login will also register if needed
      await login(email.trim(), password);
      setStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
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
          {step === 'signup' ? 'Konto erstellen' : 'Bestätigung'}
        </h1>
        <p className="text-titanium-300">
          {step === 'signup'
            ? 'Registrieren Sie sich, um 14 Tage kostenlos Zugriff zu erhalten'
            : 'Ihr Konto wurde erstellt. Weiter gehts!'}
        </p>
      </div>

      {step === 'signup' ? (
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
