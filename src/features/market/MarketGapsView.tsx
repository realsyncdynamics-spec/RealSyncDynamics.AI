import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Sparkles, Filter, RefreshCw, AlertTriangle, Loader2,
  TrendingUp, Building2, X, FileText, ExternalLink,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { AuthGate } from '../kodee/connections/AuthGate';
import { getSupabase } from '../../lib/supabase';

interface MarketGap {
  id: string;
  industry: string;
  sector: string;
  job_category: string;
  audience: 'employer' | 'employee' | 'both';
  gap_description: string;
  saas_solution: string;
  stripe_model: string;
  tam_estimate: string | null;
  urgency_score: number;
  revenue_potential: 'low' | 'medium' | 'high' | 'very_high';
  build_complexity: 'low' | 'medium' | 'high';
  ceo_profile: string | null;
  status: string;
  sources: Array<{ title?: string; url?: string; note?: string }>;
  scanned_at: string;
}

type RevenueFilter = 'all' | 'low' | 'medium' | 'high' | 'very_high';

export function MarketGapsView() {
  return <AuthGate>{(session) => <Inner session={session} />}</AuthGate>;
}

function Inner({ session }: { session: Session }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [gaps, setGaps] = useState<MarketGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [industryFilter, setIndustryFilter] = useState<string>('all');
  const [revenueFilter, setRevenueFilter] = useState<RevenueFilter>('all');
  const [minUrgency, setMinUrgency] = useState<number>(0);
  const [selected, setSelected] = useState<MarketGap | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    let cancelled = false;
    (async () => {
      const { data: prof } = await sb.from('profiles').select('is_super_admin').eq('id', session.user.id).maybeSingle();
      if (cancelled) return;
      const isAdmin = !!prof?.is_super_admin;
      setAllowed(isAdmin);
      if (!isAdmin) { setLoading(false); return; }
      await loadGaps();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.user.id]);

  async function loadGaps() {
    setLoading(true); setError(null);
    try {
      const sb = getSupabase();
      const { data, error } = await sb
        .from('market_gaps')
        .select('id, industry, sector, job_category, audience, gap_description, saas_solution, stripe_model, tam_estimate, urgency_score, revenue_potential, build_complexity, ceo_profile, status, sources, scanned_at')
        .order('urgency_score', { ascending: false })
        .limit(500);
      if (error) throw error;
      setGaps((data ?? []) as MarketGap[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const industries = useMemo(() => {
    const s = new Set(gaps.map((g) => g.industry));
    return ['all', ...Array.from(s).sort()];
  }, [gaps]);

  const filtered = useMemo(() => {
    return gaps.filter((g) => {
      if (industryFilter !== 'all' && g.industry !== industryFilter) return false;
      if (revenueFilter !== 'all' && g.revenue_potential !== revenueFilter) return false;
      if (g.urgency_score < minUrgency) return false;
      return true;
    });
  }, [gaps, industryFilter, revenueFilter, minUrgency]);

  if (allowed === null) {
    return <div className="min-h-screen bg-obsidian-950 flex items-center justify-center text-titanium-500 text-sm">Lade…</div>;
  }
  if (!allowed) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-obsidian-900 border border-titanium-900 p-8 text-center rounded-none">
          <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-3" />
          <h1 className="font-display text-xl font-bold text-titanium-50 mb-2">Kein Zugriff</h1>
          <p className="text-sm text-titanium-400 mb-5">
            Diese Seite ist nur für Plattform-Admins (RealSync-internes Intel).
          </p>
          <Link to="/dashboard" className="text-sm text-security-400 hover:underline">→ Zum Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/dashboard" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-fuchsia-500 to-purple-700 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Markt-Lücken</div>
            <div className="text-[11px] text-titanium-400 font-medium">Daily-Scanner · Super-Admin</div>
          </div>
        </div>
        <button
          onClick={loadGaps}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-titanium-800 hover:border-security-500 text-titanium-300 hover:text-titanium-50 rounded-none"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Reload
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-2 text-xs text-titanium-400 mr-2">
            <Filter className="h-3.5 w-3.5" /> Filter:
          </div>

          <select
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value)}
            className="bg-obsidian-900 border border-titanium-900 px-2.5 py-1.5 text-xs rounded-none outline-none focus:border-security-500"
          >
            {industries.map((i) => <option key={i} value={i}>{i === 'all' ? 'Alle Branchen' : i}</option>)}
          </select>

          <select
            value={revenueFilter}
            onChange={(e) => setRevenueFilter(e.target.value as RevenueFilter)}
            className="bg-obsidian-900 border border-titanium-900 px-2.5 py-1.5 text-xs rounded-none outline-none focus:border-security-500"
          >
            <option value="all">Alle Revenue</option>
            <option value="very_high">very_high</option>
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </select>

          <label className="flex items-center gap-2 text-xs text-titanium-400">
            min Urgency
            <input
              type="number" min={0} max={10}
              value={minUrgency}
              onChange={(e) => setMinUrgency(Math.max(0, Math.min(10, Number(e.target.value) || 0)))}
              className="w-14 bg-obsidian-900 border border-titanium-900 px-2 py-1 text-xs rounded-none outline-none focus:border-security-500"
            />
          </label>

          <span className="ml-auto text-xs text-titanium-500">
            {filtered.length} / {gaps.length} Lücken
          </span>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-none p-3 mb-4">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-titanium-400 text-sm py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-titanium-500 text-sm">
            Keine Lücken — Daily-Scanner läuft täglich 06:00 UTC.
          </div>
        ) : (
          <div className="overflow-x-auto border border-titanium-900">
            <table className="w-full text-sm">
              <thead className="bg-obsidian-900 text-[11px] uppercase tracking-wider text-titanium-400">
                <tr>
                  <Th>Branche</Th>
                  <Th>Job / Audience</Th>
                  <Th>Lücke</Th>
                  <Th className="text-center">Urg</Th>
                  <Th>Revenue</Th>
                  <Th>Build</Th>
                  <Th>Stripe</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((g) => (
                  <tr
                    key={g.id}
                    onClick={() => setSelected(g)}
                    className="border-t border-titanium-900 bg-obsidian-950 hover:bg-obsidian-900 cursor-pointer"
                  >
                    <Td>
                      <div className="font-bold text-titanium-100">{g.industry}</div>
                      <div className="text-xs text-titanium-500">{g.sector}</div>
                    </Td>
                    <Td>
                      <div className="text-titanium-200">{g.job_category}</div>
                      <div className="text-xs text-titanium-500">{g.audience}</div>
                    </Td>
                    <Td className="max-w-md">
                      <div className="line-clamp-2 text-titanium-300">{g.gap_description}</div>
                    </Td>
                    <Td className="text-center">
                      <span className={`font-mono font-bold ${urgencyColor(g.urgency_score)}`}>{g.urgency_score}</span>
                    </Td>
                    <Td><RevenueBadge value={g.revenue_potential} /></Td>
                    <Td><span className="text-xs text-titanium-400">{g.build_complexity}</span></Td>
                    <Td><span className="text-xs text-titanium-400">{g.stripe_model}</span></Td>
                    <Td><StatusBadge value={g.status} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {selected && <DetailModal gap={selected} onClose={() => setSelected(null)} onChanged={loadGaps} />}
    </div>
  );
}

function DetailModal({ gap, onClose, onChanged }: { gap: MarketGap; onClose: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function setStatus(next: MarketGap['status']) {
    setBusy(true); setErr(null);
    try {
      const sb = getSupabase();
      const { error } = await sb.from('market_gaps').update({ status: next }).eq('id', gap.id);
      if (error) throw error;
      await onChanged();
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-obsidian-950/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-obsidian-900 border border-titanium-800 max-w-3xl w-full my-8 rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-titanium-900 px-6 py-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-titanium-500 mb-1">
              <Building2 className="h-3.5 w-3.5" />
              {gap.industry} · {gap.sector}
            </div>
            <h2 className="font-display text-xl font-bold text-titanium-50">
              {gap.job_category}
            </h2>
            <div className="flex items-center gap-3 mt-2 text-xs">
              <span className={`font-mono font-bold ${urgencyColor(gap.urgency_score)}`}>Urgency {gap.urgency_score}/10</span>
              <RevenueBadge value={gap.revenue_potential} />
              <span className="text-titanium-400">Build: {gap.build_complexity}</span>
              <span className="text-titanium-400">Stripe: {gap.stripe_model}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <Section title="Lücke">
            <p className="text-sm text-titanium-200 leading-relaxed">{gap.gap_description}</p>
          </Section>

          <Section title="SaaS-Lösung">
            <p className="text-sm text-titanium-200 leading-relaxed">{gap.saas_solution}</p>
          </Section>

          {gap.tam_estimate && (
            <Section title="TAM-Schätzung" icon={<TrendingUp className="h-3.5 w-3.5" />}>
              <p className="text-sm text-titanium-200">{gap.tam_estimate}</p>
            </Section>
          )}

          {gap.ceo_profile && (
            <Section title="CEO-Profil (Outreach-Ziel)">
              <p className="text-sm text-titanium-200 whitespace-pre-wrap">{gap.ceo_profile}</p>
            </Section>
          )}

          {gap.sources && gap.sources.length > 0 && (
            <Section title="Quellen">
              <ul className="space-y-1.5">
                {gap.sources.map((s, i) => (
                  <li key={i} className="text-xs text-titanium-300 flex items-start gap-2">
                    <ExternalLink className="h-3 w-3 mt-1 shrink-0 text-titanium-500" />
                    <span>
                      {s.title ?? s.note ?? s.url ?? '—'}
                      {s.url && <a href={s.url} target="_blank" rel="noreferrer" className="ml-2 text-security-400 hover:underline">{s.url}</a>}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        {err && (
          <div className="mx-6 mb-3 flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" /><span>{err}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-titanium-900 px-6 py-4 bg-obsidian-950">
          <span className="text-xs text-titanium-500 mr-2 self-center">Status: <span className="text-titanium-300">{gap.status}</span></span>
          <button
            disabled={busy || gap.status === 'validated'}
            onClick={() => setStatus('validated')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-titanium-800 hover:border-security-500 text-titanium-300 hover:text-titanium-50 disabled:opacity-40 rounded-none"
          >
            Validiert
          </button>
          <button
            disabled={busy || gap.status === 'building'}
            onClick={() => setStatus('building')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-titanium-800 hover:border-security-500 text-titanium-300 hover:text-titanium-50 disabled:opacity-40 rounded-none"
          >
            <FileText className="h-3.5 w-3.5" /> Übergeben (build)
          </button>
          <button
            disabled={busy || gap.status === 'rejected'}
            onClick={() => setStatus('rejected')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-titanium-800 hover:border-red-500 text-titanium-400 hover:text-red-300 disabled:opacity-40 rounded-none"
          >
            Verwerfen
          </button>
          {busy && <Loader2 className="h-4 w-4 animate-spin text-titanium-400 self-center ml-1" />}
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold text-titanium-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
        {icon}{title}
      </h3>
      {children}
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left px-3 py-2 font-bold ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}

function RevenueBadge({ value }: { value: MarketGap['revenue_potential'] }) {
  const styles: Record<MarketGap['revenue_potential'], string> = {
    low:        'bg-titanium-900 text-titanium-400 border-titanium-800',
    medium:     'bg-blue-950 text-blue-300 border-blue-900',
    high:       'bg-emerald-950 text-emerald-300 border-emerald-900',
    very_high:  'bg-fuchsia-950 text-fuchsia-200 border-fuchsia-800',
  };
  return <span className={`inline-block text-[10px] font-bold uppercase px-1.5 py-0.5 border ${styles[value]} rounded-none`}>{value}</span>;
}

function StatusBadge({ value }: { value: string }) {
  const map: Record<string, string> = {
    identified: 'text-titanium-400',
    validated:  'text-emerald-400',
    building:   'text-fuchsia-300',
    launched:   'text-security-400',
    rejected:   'text-red-400',
  };
  return <span className={`text-xs font-bold ${map[value] ?? 'text-titanium-400'}`}>{value}</span>;
}

function urgencyColor(n: number): string {
  if (n >= 9) return 'text-red-400';
  if (n >= 7) return 'text-orange-300';
  if (n >= 5) return 'text-amber-300';
  return 'text-titanium-400';
}
