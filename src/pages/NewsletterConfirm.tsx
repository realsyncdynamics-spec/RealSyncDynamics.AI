import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ShieldCheck, CheckCircle2, AlertTriangle, Loader2, ArrowLeft, ArrowRight } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export function NewsletterConfirm() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState<'loading' | 'success' | 'already' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (!token) { setState('error'); setErrorMsg('Kein Token in der URL.'); return; }
    (async () => {
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/newsletter-confirm?token=${encodeURIComponent(token)}`);
        const data = await resp.json();
        if (!resp.ok || !data.ok) {
          setState('error');
          setErrorMsg(data.error?.message ?? `HTTP ${resp.status}`);
          return;
        }
        setState(data.already_confirmed ? 'already' : 'success');
      } catch (e) {
        setState('error');
        setErrorMsg((e as Error).message);
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Newsletter-Bestätigung</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-16">
        <div className="max-w-lg mx-auto text-center">
          {state === 'loading' && (
            <div className="flex items-center justify-center gap-3 py-12 text-titanium-400">
              <Loader2 className="h-5 w-5 animate-spin" /> Bestätige Anmeldung …
            </div>
          )}

          {state === 'success' && (
            <>
              <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-titanium-50 mb-3">Du bist dabei!</h1>
              <p className="text-titanium-300 mb-6 leading-relaxed">
                Anmeldung bestätigt. Du bekommst ab jetzt unseren DSGVO + AI-Act Newsletter (1× monatlich, jederzeit kündbar).
              </p>
              <Link to="/audit" className="inline-flex items-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Erstes Audit jetzt machen <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          )}

          {state === 'already' && (
            <>
              <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-titanium-50 mb-3">Schon bestätigt</h1>
              <p className="text-titanium-300 mb-6 leading-relaxed">
                Diese Email-Adresse ist bereits aktiv im Newsletter eingetragen. Nichts mehr zu tun.
              </p>
              <Link to="/" className="inline-flex items-center gap-2 px-5 py-2.5 bg-obsidian-900 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                Zur Startseite
              </Link>
            </>
          )}

          {state === 'error' && (
            <>
              <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-titanium-50 mb-3">Bestätigung fehlgeschlagen</h1>
              <p className="text-titanium-300 mb-1 leading-relaxed">{errorMsg || 'Token ungültig oder abgelaufen.'}</p>
              <p className="text-titanium-500 text-sm mb-6">
                Tipp: Anmeldung-Email-Link wird nach 7 Tagen ungültig — einfach erneut anmelden.
              </p>
              <Link to="/" className="inline-flex items-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Zur Startseite
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
