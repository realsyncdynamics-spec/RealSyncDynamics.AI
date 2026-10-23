import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Loader2, MessageSquare, RefreshCw } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { AuthGate } from '../kodee/connections/AuthGate';
import {
  isForbiddenError,
  listBetaFeedbackAdmin,
  type BetaFeedbackRow,
} from '../beta/betaFeedbackApi';

/**
 * Team-Ansicht für Beta-Feedback (WP-4): `/admin/beta-feedback`.
 *
 * Liest ausschliesslich über die RPC `admin_beta_feedback` (Migration
 * 20261022090000). Die Datenbank prüft `is_platform_operator()`; der Router
 * sichert nichts. Ein Nicht-Operator sieht „Kein Zugriff“, keine Zeilen.
 */
export function BetaFeedbackView() {
  return <AuthGate>{(session) => <Inner session={session} />}</AuthGate>;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'forbidden' }
  | { status: 'error'; message: string }
  | { status: 'ready'; rows: BetaFeedbackRow[] };

function Inner({ session }: { session: Session }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [tenantFilter, setTenantFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const rows = await listBetaFeedbackAdmin({ limit: 500 });
      setState({ status: 'ready', rows });
    } catch (e) {
      const message = (e as Error).message;
      setState(isForbiddenError(message) ? { status: 'forbidden' } : { status: 'error', message });
    }
  }, []);

  useEffect(() => { void load(); }, [load, session.user.id]);

  const rows = state.status === 'ready' ? state.rows : [];
  const tenants = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) map.set(r.tenant_id, r.tenant_name ?? r.tenant_id.slice(0, 8));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);
  const filtered = useMemo(
    () => rows.filter((r) => tenantFilter === 'all' || r.tenant_id === tenantFilter),
    [rows, tenantFilter],
  );

  if (state.status === 'forbidden') {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-obsidian-900 border border-titanium-900 p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-3" />
          <h1 className="font-display text-xl font-bold text-titanium-50 mb-2">Kein Zugriff</h1>
          <p className="text-sm text-titanium-400 mb-5">Nur für Plattform-Operatoren.</p>
          <Link to="/app/dashboard" className="text-sm text-security-400 hover:underline">→ Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/admin" className="p-1.5 hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3" aria-label="Zurück">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-700 flex items-center justify-center">
            <MessageSquare className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Beta-Feedback</div>
            <div className="text-[11px] text-titanium-400 font-medium">Meldungen aus der App-Shell · Mandant · Route</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-titanium-800 hover:border-security-500 text-titanium-300 hover:text-titanium-50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Neu laden
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {state.status === 'loading' && (
          <div className="flex items-center gap-2 text-sm text-titanium-400"><Loader2 className="h-4 w-4 animate-spin" /> Lade …</div>
        )}
        {state.status === 'error' && (
          <div role="alert" className="border border-rose-800 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">{state.message}</div>
        )}
        {state.status === 'ready' && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3 text-xs">
              <span className="text-titanium-400">{filtered.length} von {rows.length} Meldungen</span>
              <label className="ml-auto flex items-center gap-2">
                <span className="text-titanium-400">Mandant</span>
                <select
                  value={tenantFilter}
                  onChange={(e) => setTenantFilter(e.target.value)}
                  className="bg-obsidian-900 border border-titanium-800 px-2 py-1 text-titanium-100"
                >
                  <option value="all">Alle</option>
                  {tenants.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
              </label>
            </div>
            {filtered.length === 0 ? (
              <p className="text-sm text-titanium-400 border border-titanium-900 bg-obsidian-900 px-4 py-6 text-center" data-testid="beta-feedback-empty">
                Noch kein Feedback. Beta-Tester melden über den Knopf „Beta-Feedback“ in der App.
              </p>
            ) : (
              <ul className="space-y-2">
                {filtered.map((r) => (
                  <li key={r.id} className="border border-titanium-900 bg-obsidian-900 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-titanium-400">
                      <time dateTime={r.created_at}>{new Date(r.created_at).toLocaleString('de-DE')}</time>
                      <span className="text-titanium-200">{r.tenant_name ?? r.tenant_id}</span>
                      <span>{r.user_email ?? r.user_id}</span>
                      <code className="ml-auto text-amber-300">{r.route}</code>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-titanium-100">{r.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}
