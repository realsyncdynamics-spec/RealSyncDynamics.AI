import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Mail, Filter, RefreshCw, AlertTriangle, Loader2, ExternalLink,
  Building2, FileSearch, Users, Target,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { AuthGate } from '../kodee/connections/AuthGate';
import { getSupabase } from '../../lib/supabase';

interface SalesLead {
  id: string;
  name: string | null;
  email: string;
  company: string | null;
  use_case: string | null;
  message: string | null;
  source: string | null;
  path: string | null;
  created_at: string;
}

interface AuditRow {
  id: string;
  url: string;
  domain: string;
  email: string;
  company: string | null;
  score: number;
  severity: string;
  fetched_status: number | null;
  created_at: string;
}

type Tab = 'leads' | 'audits';

export function LeadsView() {
  return <AuthGate>{(session) => <Inner session={session} />}</AuthGate>;
}

function Inner({ session }: { session: Session }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('leads');
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    (async () => {
      const { data: prof } = await sb.from('profiles')
        .select('is_super_admin').eq('id', session.user.id).maybeSingle();
      const isAdmin = !!prof?.is_super_admin;
      setAllowed(isAdmin);
      if (isAdmin) await loadAll();
      else setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.user.id]);

  async function loadAll() {
    setLoading(true); setError(null);
    try {
      const sb = getSupabase();
      const [leadsRes, auditsRes] = await Promise.all([
        sb.from('sales_leads')
          .select('id, name, email, company, use_case, message, source, path, created_at')
          .order('created_at', { ascending: false }).limit(500),
        sb.from('gdpr_audits')
          .select('id, url, domain, email, company, score, severity, fetched_status, created_at')
          .order('created_at', { ascending: false }).limit(500),
      ]);
      if (leadsRes.error) throw leadsRes.error;
      if (auditsRes.error) throw auditsRes.error;
      setLeads((leadsRes.data ?? []) as SalesLead[]);
      setAudits((auditsRes.data ?? []) as AuditRow[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const sources = useMemo(() => {
    const s = new Set(leads.map((l) => l.source ?? '(direct)'));
    return ['all', ...Array.from(s).sort()];
  }, [leads]);

  const filteredLeads = useMemo(() =>
    leads.filter((l) => sourceFilter === 'all' || (l.source ?? '(direct)') === sourceFilter),
    [leads, sourceFilter]
  );

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

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/dashboard" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-fuchsia-500 to-rose-700 flex items-center justify-center">
            <Users className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Leads</div>
            <div className="text-[11px] text-titanium-400 font-medium">Sales-Submissions + Audit-Reports</div>
          </div>
        </div>
        <button
          onClick={loadAll}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-titanium-800 hover:border-security-500 text-titanium-300 hover:text-titanium-50 rounded-none"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Reload
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Kpi icon={<Mail />} label="Sales-Leads" value={leads.length} />
          <Kpi icon={<FileSearch />} label="Audits" value={audits.length} />
          <Kpi icon={<Target />} label="Audit→Lead" value={leads.filter((l) => l.source === 'audit_lp').length} sub="von /audit" />
          <Kpi icon={<Users />} label="Heute" value={leads.filter((l) => isToday(l.created_at)).length} />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-titanium-900">
          <Tab id="leads" current={tab} setTab={setTab} count={leads.length} />
          <Tab id="audits" current={tab} setTab={setTab} count={audits.length} />
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-none p-3 mb-4">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}

        {loading
          ? (<div className="flex items-center gap-2 text-titanium-400 text-sm py-12 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Lade…</div>)
          : tab === 'leads' ? (
            <>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="flex items-center gap-2 text-xs text-titanium-400">
                  <Filter className="h-3.5 w-3.5" /> Source:
                </div>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="bg-obsidian-900 border border-titanium-900 px-2.5 py-1.5 text-xs rounded-none outline-none focus:border-security-500"
                >
                  {sources.map((s) => <option key={s} value={s}>{s === 'all' ? `Alle (${leads.length})` : `${s} (${leads.filter((l) => (l.source ?? '(direct)') === s).length})`}</option>)}
                </select>
                <span className="ml-auto text-xs text-titanium-500">{filteredLeads.length} sichtbar</span>
              </div>

              {filteredLeads.length === 0
                ? <Empty msg="Keine Leads in diesem Filter." />
                : (
                  <div className="overflow-x-auto border border-titanium-900">
                    <table className="w-full text-sm">
                      <thead className="bg-obsidian-900 text-[11px] uppercase tracking-wider text-titanium-400">
                        <tr>
                          <Th>Datum</Th>
                          <Th>Email</Th>
                          <Th>Firma</Th>
                          <Th>Use-Case</Th>
                          <Th>Source</Th>
                          <Th>Message</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLeads.map((l) => (
                          <tr key={l.id} className="border-t border-titanium-900 hover:bg-obsidian-900">
                            <Td>
                              <div className="text-xs text-titanium-400">{new Date(l.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</div>
                              <div className="text-[10px] text-titanium-500">{new Date(l.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
                            </Td>
                            <Td>
                              <a href={`mailto:${l.email}`} className="text-security-400 hover:underline text-xs font-mono">{l.email}</a>
                              {l.name && <div className="text-xs text-titanium-300 mt-0.5">{l.name}</div>}
                            </Td>
                            <Td className="text-titanium-200">{l.company ?? <span className="text-titanium-600">—</span>}</Td>
                            <Td><span className="text-xs px-1.5 py-0.5 bg-obsidian-900 border border-titanium-800 rounded-none">{l.use_case ?? '–'}</span></Td>
                            <Td><span className="text-xs font-mono text-fuchsia-300">{l.source ?? '(direct)'}</span></Td>
                            <Td className="max-w-md">
                              <div className="text-xs text-titanium-300 line-clamp-2 whitespace-pre-wrap">{l.message ?? '—'}</div>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </>
          ) : (
            audits.length === 0
              ? <Empty msg="Noch keine Audits." />
              : (
                <div className="overflow-x-auto border border-titanium-900">
                  <table className="w-full text-sm">
                    <thead className="bg-obsidian-900 text-[11px] uppercase tracking-wider text-titanium-400">
                      <tr>
                        <Th>Datum</Th>
                        <Th>Domain</Th>
                        <Th>Email</Th>
                        <Th>Firma</Th>
                        <Th className="text-center">Score</Th>
                        <Th>Severity</Th>
                        <Th></Th>
                      </tr>
                    </thead>
                    <tbody>
                      {audits.map((a) => (
                        <tr key={a.id} className="border-t border-titanium-900 hover:bg-obsidian-900">
                          <Td>
                            <div className="text-xs text-titanium-400">{new Date(a.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</div>
                            <div className="text-[10px] text-titanium-500">{new Date(a.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
                          </Td>
                          <Td>
                            <a href={a.url} target="_blank" rel="noreferrer" className="text-titanium-200 text-xs font-mono hover:underline inline-flex items-center gap-1">
                              {a.domain} <ExternalLink className="h-3 w-3" />
                            </a>
                          </Td>
                          <Td><a href={`mailto:${a.email}`} className="text-security-400 hover:underline text-xs">{a.email}</a></Td>
                          <Td className="text-titanium-200">{a.company ?? <span className="text-titanium-600">—</span>}</Td>
                          <Td className="text-center">
                            <span className={`font-mono font-bold tabular-nums ${scoreColor(a.score)}`}>
                              {a.score}<span className="text-[10px] text-titanium-500">/100</span>
                            </span>
                          </Td>
                          <Td><SeverityBadge value={a.severity} /></Td>
                          <Td>
                            <Link
                              to={`/contact-sales?source=manual_audit_followup&audit=${a.id}`}
                              className="text-xs text-security-400 hover:underline"
                            >
                              → Outreach
                            </Link>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
          )}
      </main>
    </div>
  );
}

function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub?: string }) {
  return (
    <div className="p-4 rounded-none border border-titanium-900 bg-obsidian-900">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-titanium-500">{label}</div>
        <div className="w-7 h-7 flex items-center justify-center text-titanium-500 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</div>
      </div>
      <div className="font-display font-bold text-2xl text-titanium-50 tabular-nums">{value.toLocaleString('de-DE')}</div>
      {sub && <div className="text-[11px] text-titanium-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function Tab({ id, current, setTab, count }: { id: Tab; current: Tab; setTab: (t: Tab) => void; count: number }) {
  const labels: Record<Tab, string> = { leads: 'Sales-Leads', audits: 'Audits' };
  return (
    <button
      onClick={() => setTab(id)}
      className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
        current === id
          ? 'border-security-500 text-titanium-50 font-bold'
          : 'border-transparent text-titanium-400 hover:text-titanium-200'
      }`}
    >
      {labels[id]} <span className="text-xs text-titanium-500 font-mono">({count})</span>
    </button>
  );
}

function SeverityBadge({ value }: { value: string }) {
  const map: Record<string, string> = {
    critical: 'text-red-300 bg-red-950/30 border-red-900',
    high:     'text-orange-300 bg-orange-950/30 border-orange-900',
    medium:   'text-amber-300 bg-amber-950/30 border-amber-900',
    low:      'text-titanium-400 bg-obsidian-900 border-titanium-800',
    pass:     'text-emerald-300 bg-emerald-950/30 border-emerald-900',
  };
  return <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 border rounded-none ${map[value] ?? ''}`}>{value}</span>;
}

function scoreColor(score: number): string {
  if (score < 40) return 'text-red-400';
  if (score < 60) return 'text-orange-300';
  if (score < 80) return 'text-amber-300';
  return 'text-emerald-400';
}

function isToday(iso: string): boolean {
  const d = new Date(iso); const t = new Date();
  return d.getUTCFullYear() === t.getUTCFullYear()
      && d.getUTCMonth() === t.getUTCMonth()
      && d.getUTCDate() === t.getUTCDate();
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <th className={`text-left px-3 py-2 font-bold ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}
function Empty({ msg }: { msg: string }) {
  return <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-8 text-center text-sm text-titanium-500">{msg}</div>;
}
