import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Loader2, MessageSquare, RefreshCw } from 'lucide-react';
import { AuthGate } from '../kodee/connections/AuthGate';
import { getSupabase } from '../../lib/supabase';
import { isPlatformOperator, listBetaFeedback, type BetaFeedbackRow } from '../beta/betaFeedback';

/**
 * /admin/beta-feedback — Rückmeldungen aus der App (WP-4).
 * Zugriff prüft die Datenbank: RLS liefert fremde Einträge nur an
 * `is_platform_operator()`. Die Abfrage hier spart nur den leeren Bildschirm.
 */
export function BetaFeedbackView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' });

function Inner() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<BetaFeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listBetaFeedback(getSupabase()));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    isPlatformOperator(getSupabase())
      .catch(() => false)
      .then((ok) => {
        if (cancelled) return;
        setAllowed(ok);
        if (ok) void load();
        else setLoading(false);
      });
    return () => { cancelled = true; };
  }, [load]);

  if (allowed === false) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex items-center justify-center p-6">
        <p className="text-sm text-titanium-300">Kein Zugriff. Diese Seite ist dem Plattform-Betrieb vorbehalten.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/admin" aria-label="Zurück zur Admin-Übersicht" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <MessageSquare className="h-4 w-4 text-titanium-300" aria-hidden="true" />
          <div className="leading-tight">
            <h1 className="font-display font-bold text-sm tracking-tight text-titanium-50">Beta-Feedback</h1>
            <div className="text-[11px] text-titanium-400 font-medium">Rückmeldungen aus der App, neueste zuerst</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-titanium-800 hover:border-security-500 text-titanium-300 hover:text-titanium-50 rounded-none"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Neu laden
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {error && (
          <div role="alert" className="flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-none p-3 mb-4">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" /><span>{error}</span>
          </div>
        )}
        {loading || allowed === null ? (
          <div className="flex items-center gap-2 text-titanium-400 text-sm py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Lade …
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-titanium-400 py-12 text-center">Noch kein Feedback eingegangen.</p>
        ) : (
          <ul className="space-y-3" data-testid="beta-feedback-list">
            {rows.map((row) => (
              <li key={row.id} className="border border-titanium-900 bg-obsidian-900 p-4">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-titanium-400 mb-2">
                  <time dateTime={row.created_at}>{dateFormat.format(new Date(row.created_at))}</time>
                  <span>Seite <code className="text-titanium-200">{row.route}</code></span>
                  <span>Workspace <code title={row.tenant_id}>{row.tenant_id.slice(0, 8)}</code></span>
                  <span>Konto <code title={row.user_id}>{row.user_id.slice(0, 8)}</code></span>
                </div>
                <p className="text-sm text-titanium-100 whitespace-pre-wrap break-words">{row.text}</p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
