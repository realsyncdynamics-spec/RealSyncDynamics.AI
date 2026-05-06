import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, BarChart3, RefreshCw, AlertTriangle, Loader2, TrendingUp,
  Users, FileSearch, Send, Eye, Target,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar,
} from 'recharts';
import type { Session } from '@supabase/supabase-js';
import { AuthGate } from '../kodee/connections/AuthGate';
import { getSupabase } from '../../lib/supabase';

interface DailyRow {
  day: string;
  views: number;
  unique_visitors: number;
  audit_views: number;
  contact_views: number;
}
interface PageRow { path: string; views: number; unique_visitors: number; }
interface SourceRow { utm_source: string; views: number; unique_visitors: number; lead_count: number; }
interface Funnel {
  unique_visitors: number;
  landing_views: number;
  audit_views: number;
  audits_completed: number;
  contact_views: number;
  leads_captured: number;
  pricing_views: number;
}

export function AnalyticsView() {
  return <AuthGate>{(session) => <Inner session={session} />}</AuthGate>;
}

function Inner({ session }: { session: Session }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [days, setDays] = useState<number>(14);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    (async () => {
      const { data: prof } = await sb.from('profiles')
        .select('is_super_admin').eq('id', session.user.id).maybeSingle();
      const isAdmin = !!prof?.is_super_admin;
      setAllowed(isAdmin);
      if (isAdmin) await load(days);
      else setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.user.id]);

  useEffect(() => {
    if (allowed) load(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  async function load(d: number) {
    setLoading(true); setError(null);
    try {
      const sb = getSupabase();
      const [dailyRes, pagesRes, sourcesRes, funnelRes] = await Promise.all([
        sb.rpc('analytics_pageviews_daily', { days: d }),
        sb.rpc('analytics_top_pages', { days: d, lim: 15 }),
        sb.rpc('analytics_sources', { days: d }),
        sb.rpc('analytics_funnel', { days: d }),
      ]);
      if (dailyRes.error) throw dailyRes.error;
      if (pagesRes.error) throw pagesRes.error;
      if (sourcesRes.error) throw sourcesRes.error;
      if (funnelRes.error) throw funnelRes.error;
      setDaily(((dailyRes.data ?? []) as DailyRow[]).reverse());
      setPages((pagesRes.data ?? []) as PageRow[]);
      setSources((sourcesRes.data ?? []) as SourceRow[]);
      setFunnel(((funnelRes.data ?? [])[0] as Funnel | undefined) ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (allowed === null) {
    return <div className="min-h-screen bg-obsidian-950 flex items-center justify-center text-titanium-500 text-sm">Lade…</div>;
  }
  if (!allowed) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-obsidian-900 border border-titanium-900 p-8 text-center rounded-none">
          <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-3" />
          <h1 className="font-display text-xl font-bold text-titanium-50 mb-2">Kein Zugriff</h1>
          <p className="text-sm text-titanium-400 mb-5">Super-Admin only.</p>
          <Link to="/dashboard" className="text-sm text-security-400 hover:underline">→ Dashboard</Link>
        </div>
      </div>
    );
  }

  const totalViews = daily.reduce((s, d) => s + Number(d.views), 0);
  const totalUnique = funnel?.unique_visitors ?? 0;
  const totalLeads = funnel?.leads_captured ?? 0;
  const totalAudits = funnel?.audits_completed ?? 0;
  const conversionRate = totalUnique > 0 ? (totalLeads / totalUnique * 100).toFixed(1) : '0.0';

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/dashboard" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center">
            <BarChart3 className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Analytics</div>
            <div className="text-[11px] text-titanium-400 font-medium">Pageviews · Conversion · Sources</div>
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="bg-obsidian-900 border border-titanium-900 px-2.5 py-1.5 text-xs rounded-none outline-none focus:border-security-500"
          >
            <option value={7}>Letzte 7 Tage</option>
            <option value={14}>14 Tage</option>
            <option value={30}>30 Tage</option>
            <option value={90}>90 Tage</option>
          </select>
          <button
            onClick={() => load(days)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-titanium-800 hover:border-security-500 text-titanium-300 hover:text-titanium-50 rounded-none"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Reload
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {error && (
          <div className="flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-none p-3 mb-4">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-titanium-400 text-sm py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade…
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <Kpi icon={<Eye />} label="Pageviews" value={totalViews} sub={`${days} Tage`} />
              <Kpi icon={<Users />} label="Unique Visitors" value={totalUnique} sub={`${days} Tage`} />
              <Kpi icon={<FileSearch />} label="Audits durchgeführt" value={totalAudits} sub="DSGVO-Reports" />
              <Kpi icon={<Target />} label="Sales-Leads" value={totalLeads} sub={`${conversionRate}% Conversion`} highlight />
            </div>

            {/* Daily-Chart */}
            <Section title="Pageviews pro Tag">
              {daily.length === 0
                ? <Empty msg="Noch keine Daten — Cold-DMs versenden um Traffic zu erzeugen." />
                : (
                  <div className="bg-obsidian-900 border border-titanium-900 p-4 rounded-none" style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={daily}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1a2030" />
                        <XAxis dataKey="day" stroke="#7d8590" tick={{ fontSize: 11 }} />
                        <YAxis stroke="#7d8590" tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ background: '#111821', border: '1px solid #232b36', borderRadius: 0 }} />
                        <Line type="monotone" dataKey="views" stroke="#3b82f6" strokeWidth={2} dot={false} name="Views" />
                        <Line type="monotone" dataKey="unique_visitors" stroke="#10b981" strokeWidth={2} dot={false} name="Unique" />
                        <Line type="monotone" dataKey="audit_views" stroke="#f59e0b" strokeWidth={2} dot={false} name="/audit" />
                        <Line type="monotone" dataKey="contact_views" stroke="#ef4444" strokeWidth={2} dot={false} name="/contact-sales" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
            </Section>

            <div className="grid lg:grid-cols-2 gap-6 mt-6">
              {/* Top Pages */}
              <Section title="Top-Pages">
                {pages.length === 0
                  ? <Empty msg="Noch keine Pageviews." />
                  : (
                    <div className="bg-obsidian-900 border border-titanium-900 rounded-none overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-obsidian-950 text-[10px] uppercase tracking-wider text-titanium-500">
                          <tr>
                            <th className="text-left px-3 py-2 font-bold">Path</th>
                            <th className="text-right px-3 py-2 font-bold">Views</th>
                            <th className="text-right px-3 py-2 font-bold">Unique</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pages.map((p) => (
                            <tr key={p.path} className="border-t border-titanium-900">
                              <td className="px-3 py-2 font-mono text-xs text-titanium-300">{p.path}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{p.views}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-titanium-400">{p.unique_visitors}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
              </Section>

              {/* Sources */}
              <Section title="Source-Attribution (UTM)">
                {sources.length === 0
                  ? <Empty msg="Noch keine UTM-Quellen erfasst." />
                  : (
                    <div className="bg-obsidian-900 border border-titanium-900 rounded-none overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-obsidian-950 text-[10px] uppercase tracking-wider text-titanium-500">
                          <tr>
                            <th className="text-left px-3 py-2 font-bold">Source</th>
                            <th className="text-right px-3 py-2 font-bold">Visitors</th>
                            <th className="text-right px-3 py-2 font-bold">Leads</th>
                            <th className="text-right px-3 py-2 font-bold">CR%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sources.map((s) => {
                            const cr = s.unique_visitors > 0 ? (s.lead_count / s.unique_visitors * 100).toFixed(1) : '–';
                            return (
                              <tr key={s.utm_source} className="border-t border-titanium-900">
                                <td className="px-3 py-2 text-titanium-300">{s.utm_source}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{s.unique_visitors}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-emerald-400">{s.lead_count}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-titanium-400">{cr}{cr !== '–' && '%'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
              </Section>
            </div>

            {/* Conversion-Funnel */}
            {funnel && (
              <Section title="Conversion-Funnel">
                <div className="bg-obsidian-900 border border-titanium-900 p-4 rounded-none" style={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { stage: 'Visitors', count: funnel.unique_visitors },
                        { stage: '/ Landing', count: funnel.landing_views },
                        { stage: '/audit', count: funnel.audit_views },
                        { stage: 'Audit done', count: funnel.audits_completed },
                        { stage: '/pricing', count: funnel.pricing_views },
                        { stage: '/contact-sales', count: funnel.contact_views },
                        { stage: 'Lead captured', count: funnel.leads_captured },
                      ]}
                      layout="vertical"
                      margin={{ left: 80 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a2030" />
                      <XAxis type="number" stroke="#7d8590" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="stage" stroke="#7d8590" tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: '#111821', border: '1px solid #232b36', borderRadius: 0 }} />
                      <Bar dataKey="count" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Section>
            )}

            {/* Tipps when empty */}
            {totalViews === 0 && (
              <div className="mt-8 p-5 bg-obsidian-900 border border-amber-900 rounded-none">
                <div className="flex items-start gap-3">
                  <TrendingUp className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-display font-bold text-titanium-50 mb-1.5">Noch kein Traffic</h3>
                    <p className="text-sm text-titanium-300 mb-3 leading-relaxed">
                      Pageview-Tracking ist live, aber niemand besucht die Site. Mach Distribution: 5 Cold-DMs heute mit dem Audit-LP-Hook
                      (<code className="text-xs bg-obsidian-950 px-1.5 py-0.5">{`?utm_source=linkedin`}</code> in der URL anhängen, dann siehst du sie hier).
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Link to="/outreach" className="text-xs px-3 py-1.5 border border-titanium-800 hover:border-security-500 text-titanium-300 hover:text-titanium-50 rounded-none">
                        → Outreach-Pipeline
                      </Link>
                      <Link to="/market-gaps" className="text-xs px-3 py-1.5 border border-titanium-800 hover:border-security-500 text-titanium-300 hover:text-titanium-50 rounded-none">
                        → Markt-Lücken
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Kpi({ icon, label, value, sub, highlight }: { icon: React.ReactNode; label: string; value: number; sub?: string; highlight?: boolean }) {
  return (
    <div className={`p-4 rounded-none border ${highlight ? 'border-security-700 bg-security-950/20' : 'border-titanium-900 bg-obsidian-900'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className={`text-[10px] font-bold uppercase tracking-wider ${highlight ? 'text-security-400' : 'text-titanium-500'}`}>{label}</div>
        <div className={`w-7 h-7 flex items-center justify-center [&>svg]:h-3.5 [&>svg]:w-3.5 ${highlight ? 'text-security-400' : 'text-titanium-500'}`}>
          {icon}
        </div>
      </div>
      <div className="font-display font-bold text-2xl text-titanium-50 tabular-nums">{value.toLocaleString('de-DE')}</div>
      {sub && <div className="text-[11px] text-titanium-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-2">
      <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3 mt-6 first:mt-0">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-8 text-center text-sm text-titanium-500">
      {msg}
    </div>
  );
}
