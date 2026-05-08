import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, AlertTriangle, Loader2, CheckCircle2, Clock, Filter,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { AuthGate } from '../kodee/connections/AuthGate';
import { getSupabase } from '../../lib/supabase';
import { EmptyStateGraphic } from '../../components/visual/EmptyStateGraphic';

interface OnboardingRow {
  id: string;
  email: string;
  product_label: string | null;
  amount_cents: number | null;
  currency: string | null;
  mode: string | null;
  step: number;
  api_key_id: string | null;
  domain_connected: string | null;
  completed_at: string | null;
  created_at: string;
}

type StepFilter = 'all' | 'stuck' | 'completed';

export function OnboardingView() {
  return <AuthGate>{(session) => <Inner session={session} />}</AuthGate>;
}

function Inner({ session }: { session: Session }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<OnboardingRow[]>([]);
  const [filter, setFilter] = useState<StepFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    void (async () => {
      const { data: prof } = await sb.from('profiles')
        .select('is_super_admin').eq('id', session.user.id).maybeSingle();
      const isAdmin = !!prof?.is_super_admin;
      setAllowed(isAdmin);
      if (isAdmin) await load();
      else setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.user.id]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const sb = getSupabase();
      const { data, error: qerr } = await sb.from('customer_onboarding')
        .select('id, email, product_label, amount_cents, currency, mode, step, api_key_id, domain_connected, completed_at, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (qerr) throw qerr;
      setRows(data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }

  const filtered = rows.filter((r) => {
    if (filter === 'stuck')     return r.step < 4 && !r.completed_at;
    if (filter === 'completed') return r.step >= 4 || !!r.completed_at;
    return true;
  });

  const counts = {
    all: rows.length,
    stuck: rows.filter((r) => r.step < 4 && !r.completed_at).length,
    completed: rows.filter((r) => r.step >= 4 || !!r.completed_at).length,
  };

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="font-display font-bold text-sm tracking-tight text-titanium-50">
          Admin · Onboarding
        </div>
      </header>

      <main className="px-4 sm:px-6 py-8 sm:py-12">
        <div className="max-w-6xl mx-auto">
          {allowed === false && (
            <div className="p-6 bg-obsidian-900 border border-amber-700 rounded-none flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-display font-bold text-titanium-50 mb-1">Kein Zugriff</div>
                <p className="text-sm text-titanium-300">
                  Diese Seite ist nur für Super-Admins. Wende dich an{' '}
                  <Link to="/contact-sales" className="text-security-400 hover:underline">Sales</Link>.
                </p>
              </div>
            </div>
          )}

          {allowed === null && (
            <div className="flex items-center gap-2 text-sm text-titanium-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Prüfe Berechtigung …
            </div>
          )}

          {allowed && (
            <>
              <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
                <div>
                  <h1 className="font-display font-bold text-titanium-50 text-2xl tracking-tight">
                    Customer Onboarding
                  </h1>
                  <p className="text-xs text-titanium-500 mt-1">
                    Stripe-Checkout → Welcome-Wizard-State pro zahlendem Kunden.
                  </p>
                </div>
                <button
                  onClick={load}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-titanium-800 hover:border-titanium-600 text-titanium-300 hover:text-titanium-100 text-xs font-mono uppercase tracking-wider rounded-none"
                >
                  <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Reload
                </button>
              </div>

              <div className="flex items-center gap-2 mb-5 text-xs">
                <Filter className="h-3.5 w-3.5 text-titanium-500" />
                {(['all', 'stuck', 'completed'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-2.5 py-1 border rounded-none transition-colors ${
                      filter === f
                        ? 'border-ai-cyan-500 text-ai-cyan-300 bg-ai-cyan-500/10'
                        : 'border-titanium-800 text-titanium-400 hover:border-titanium-600 hover:text-titanium-200'
                    }`}
                  >
                    {f === 'all' ? 'Alle' : f === 'stuck' ? 'Hängen' : 'Abgeschlossen'} ({counts[f]})
                  </button>
                ))}
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-950/40 border border-red-900 rounded-none text-sm text-red-300 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> <span>{error}</span>
                </div>
              )}

              {loading
                ? (
                  <div className="flex items-center gap-2 text-sm text-titanium-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Lade …
                  </div>
                )
                : filtered.length === 0
                  ? <Empty msg={filter === 'all' ? 'Noch keine Onboarding-Rows.' : `Keine Rows im "${filter === 'stuck' ? 'Hängen' : 'Abgeschlossen'}"-Filter.`} />
                  : (
                    <div className="overflow-x-auto border border-titanium-900">
                      <table className="w-full text-sm">
                        <thead className="bg-obsidian-900 text-[11px] uppercase tracking-wider text-titanium-400">
                          <tr>
                            <Th>Datum</Th>
                            <Th>Email</Th>
                            <Th>Produkt</Th>
                            <Th>Step</Th>
                            <Th>Key</Th>
                            <Th>Domain</Th>
                            <Th>Status</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((r) => {
                            const done = r.step >= 4 || !!r.completed_at;
                            return (
                              <tr key={r.id} className="border-t border-titanium-900 hover:bg-obsidian-900/40">
                                <Td>{new Date(r.created_at).toLocaleDateString('de-DE')}</Td>
                                <Td>{r.email}</Td>
                                <Td>{r.product_label ?? '—'}</Td>
                                <Td>
                                  <StepBadge step={r.step} done={done} />
                                </Td>
                                <Td>{r.api_key_id ? '✓' : '—'}</Td>
                                <Td>{r.domain_connected ?? '—'}</Td>
                                <Td>
                                  {done
                                    ? <span className="inline-flex items-center gap-1 text-emerald-400"><CheckCircle2 className="h-3 w-3" /> done</span>
                                    : <span className="inline-flex items-center gap-1 text-amber-400"><Clock className="h-3 w-3" /> stuck</span>}
                                </Td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

const STEP_LABELS = { 1: 'Account', 2: 'API-Key', 3: 'Setup', 4: 'Done' } as const;

function StepBadge({ step, done }: { step: number; done: boolean }) {
  const label = STEP_LABELS[step as 1 | 2 | 3 | 4] ?? `Step ${step}`;
  const color = done
    ? 'border-brass-700 text-brass-300 bg-brass-950/30'
    : step === 1
      ? 'border-titanium-800 text-titanium-400'
      : 'border-ai-cyan-700 text-ai-cyan-300 bg-ai-cyan-950/30';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border ${color}`}>
      {step} · {label}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left font-bold">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2.5 text-titanium-200">{children}</td>;
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="bg-obsidian-900 border border-titanium-900 border-l-2 border-l-brass-700/50 rounded-none p-10 flex flex-col items-center gap-4">
      <EmptyStateGraphic size={88} />
      <div className="text-sm text-titanium-500 text-center">{msg}</div>
    </div>
  );
}
