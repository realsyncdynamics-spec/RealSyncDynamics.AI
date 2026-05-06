import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, Loader2, AlertTriangle, CheckCircle2, XCircle,
  Activity, Users, Database, Cpu, Calendar, ExternalLink,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { AuthGate } from '../kodee/connections/AuthGate';
import { getSupabase } from '../../lib/supabase';

interface Health {
  last_hour?: { audits: number; leads: number; pageviews: number; unique_visitors: number };
  last_24h?: { audits: number; leads: number; pageviews: number; audits_unsent_email: number };
  totals?: {
    audits: number; leads: number; tenants: number; profiles: number;
    subscriptions: number; outreach_contacts: number; market_gaps: number; ceo_briefs: number;
  };
  integrations?: { resend_key_set: boolean; anthropic_key_set: boolean; google_key_set: boolean };
  cron_jobs?: { name: string; schedule: string; active: boolean }[];
  recent_http_responses?: { id: number; status_code: number; created: string }[];
  generated_at?: string;
  error?: string;
}

export function SystemHealthView() {
  return <AuthGate>{(session) => <Inner session={session} />}</AuthGate>;
}

function Inner({ session }: { session: Session }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [data, setData] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    (async () => {
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
      const { data: result, error: err } = await sb.rpc('admin_system_health');
      if (err) throw err;
      setData(result as Health);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (allowed === false) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-3" />
          <h1 className="font-display font-bold text-2xl text-titanium-50 mb-2">Zugriff verweigert</h1>
          <p className="text-sm text-titanium-300 mb-4">/admin/system erfordert super_admin-Rechte.</p>
          <Link to="/" className="text-security-400 hover:underline text-sm">← Zurück zur Startseite</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-security-500 to-blue-700 flex items-center justify-center">
              <Activity className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">System-Health</div>
              <div className="text-[11px] text-titanium-400 font-medium">Operations-Dashboard</div>
            </div>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-xs rounded-none disabled:opacity-50">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {error && (
          <div className="flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />{error}
          </div>
        )}

        {data?.integrations && <IntegrationStrip integrations={data.integrations} />}

        {data?.last_hour && data?.last_24h && (
          <section>
            <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">Activity</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Kpi label="Audits/h" value={data.last_hour.audits} sub={`${data.last_24h.audits} / 24h`} />
              <Kpi label="Leads/h" value={data.last_hour.leads} sub={`${data.last_24h.leads} / 24h`} />
              <Kpi label="Visitors/h" value={data.last_hour.unique_visitors} sub={`${data.last_24h.pageviews} pageviews / 24h`} />
              <Kpi label="Audits unversendet" value={data.last_24h.audits_unsent_email}
                hint={data.last_24h.audits_unsent_email > 0 ? 'Resend-Key fehlt?' : undefined}
                warn={data.last_24h.audits_unsent_email > 5} />
            </div>
          </section>
        )}

        {data?.totals && (
          <section>
            <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">Totals</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Kpi label="Profiles" value={data.totals.profiles} icon={<Users className="h-3.5 w-3.5" />} />
              <Kpi label="Tenants" value={data.totals.tenants} icon={<Users className="h-3.5 w-3.5" />} />
              <Kpi label="Aktive Subs" value={data.totals.subscriptions} icon={<Database className="h-3.5 w-3.5" />}
                hint={data.totals.subscriptions === 0 ? 'noch keine zahlenden Customer' : undefined} />
              <Kpi label="Outreach" value={data.totals.outreach_contacts} icon={<Users className="h-3.5 w-3.5" />} />
              <Kpi label="Audits" value={data.totals.audits} />
              <Kpi label="Leads" value={data.totals.leads} />
              <Kpi label="Market Gaps" value={data.totals.market_gaps} icon={<Cpu className="h-3.5 w-3.5" />} />
              <Kpi label="CEO Briefs" value={data.totals.ceo_briefs} icon={<Cpu className="h-3.5 w-3.5" />} />
            </div>
          </section>
        )}

        {data?.cron_jobs && data.cron_jobs.length > 0 && (
          <section>
            <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">Cron Jobs</h2>
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-obsidian-950 text-titanium-400 uppercase tracking-wider">
                  <tr><th className="text-left px-3 py-2">Name</th><th className="text-left px-3 py-2">Schedule</th><th className="text-center px-3 py-2">Active</th></tr>
                </thead>
                <tbody className="divide-y divide-titanium-900">
                  {data.cron_jobs.map((j) => (
                    <tr key={j.name}>
                      <td className="px-3 py-2 font-mono text-titanium-200">{j.name}</td>
                      <td className="px-3 py-2 font-mono text-titanium-400">{j.schedule}</td>
                      <td className="px-3 py-2 text-center">
                        {j.active ? <CheckCircle2 className="h-4 w-4 text-emerald-400 inline" /> : <XCircle className="h-4 w-4 text-red-400 inline" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {data?.recent_http_responses && data.recent_http_responses.length > 0 && (
          <section>
            <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">Recent Edge-Function HTTP Responses</h2>
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-obsidian-950 text-titanium-400 uppercase tracking-wider">
                  <tr><th className="text-left px-3 py-2">ID</th><th className="text-left px-3 py-2">Status</th><th className="text-left px-3 py-2">When</th></tr>
                </thead>
                <tbody className="divide-y divide-titanium-900">
                  {data.recent_http_responses.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 font-mono text-titanium-400">#{r.id}</td>
                      <td className="px-3 py-2">
                        <span className={
                          r.status_code >= 200 && r.status_code < 300 ? 'text-emerald-400' :
                          r.status_code >= 400 ? 'text-red-400' : 'text-amber-400'
                        }>{r.status_code}</span>
                      </td>
                      <td className="px-3 py-2 text-titanium-400">{new Date(r.created).toLocaleString('de-DE')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section>
          <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">Quick Links</h2>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link to="/admin/leads" className="px-3 py-1.5 bg-obsidian-900 border border-titanium-700 hover:border-security-500 text-titanium-200 rounded-none">Leads</Link>
            <Link to="/admin/analytics" className="px-3 py-1.5 bg-obsidian-900 border border-titanium-700 hover:border-security-500 text-titanium-200 rounded-none">Analytics</Link>
            <Link to="/outreach" className="px-3 py-1.5 bg-obsidian-900 border border-titanium-700 hover:border-security-500 text-titanium-200 rounded-none">Outreach</Link>
            <Link to="/market-gaps" className="px-3 py-1.5 bg-obsidian-900 border border-titanium-700 hover:border-security-500 text-titanium-200 rounded-none">Market Gaps</Link>
            <a href="https://supabase.com/dashboard/project/ebljyceifhnlzhjfyxup/functions" target="_blank" rel="noreferrer noopener"
              className="px-3 py-1.5 bg-obsidian-900 border border-titanium-700 hover:border-security-500 text-titanium-200 rounded-none inline-flex items-center gap-1">
              Edge Functions <ExternalLink className="h-3 w-3" />
            </a>
            <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer noopener"
              className="px-3 py-1.5 bg-obsidian-900 border border-titanium-700 hover:border-security-500 text-titanium-200 rounded-none inline-flex items-center gap-1">
              Stripe <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </section>

        {data?.generated_at && (
          <div className="text-[11px] text-titanium-500 text-right">
            Generated {new Date(data.generated_at).toLocaleString('de-DE')}
          </div>
        )}
      </main>
    </div>
  );
}

function IntegrationStrip({ integrations }: { integrations: Health['integrations'] }) {
  if (!integrations) return null;
  const items = [
    { label: 'Resend', set: integrations.resend_key_set, fix: 'https://supabase.com/dashboard/project/ebljyceifhnlzhjfyxup/settings/vault' },
    { label: 'Anthropic', set: integrations.anthropic_key_set, fix: 'https://supabase.com/dashboard/project/ebljyceifhnlzhjfyxup/settings/vault' },
    { label: 'Google AI', set: integrations.google_key_set, fix: 'https://supabase.com/dashboard/project/ebljyceifhnlzhjfyxup/settings/vault' },
  ];
  return (
    <section>
      <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">Integrationen</h2>
      <div className="grid grid-cols-3 gap-3">
        {items.map((i) => (
          <div key={i.label} className={`p-3 border ${i.set ? 'border-emerald-900 bg-emerald-950/20' : 'border-amber-900 bg-amber-950/20'} rounded-none`}>
            <div className="flex items-center gap-2 mb-1">
              {i.set
                ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                : <AlertTriangle className="h-4 w-4 text-amber-400" />}
              <div className="font-display font-bold text-titanium-50 text-sm">{i.label}</div>
            </div>
            <div className={`text-xs ${i.set ? 'text-emerald-300' : 'text-amber-300'}`}>
              {i.set ? 'Vault-Key gesetzt' : 'Key fehlt — Pipeline läuft graceful no-op'}
            </div>
            {!i.set && (
              <a href={i.fix} target="_blank" rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-amber-400 hover:underline text-[11px] mt-1.5">
                Vault öffnen <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Kpi({
  label, value, sub, hint, warn, icon,
}: { label: string; value: number; sub?: string; hint?: string; warn?: boolean; icon?: React.ReactNode }) {
  return (
    <div className={`p-3 border ${warn ? 'border-amber-900 bg-amber-950/20' : 'border-titanium-900 bg-obsidian-900'} rounded-none`}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-titanium-500 mb-1">
        {icon}{label}
      </div>
      <div className={`text-2xl font-display font-bold tabular-nums ${warn ? 'text-amber-300' : 'text-titanium-50'}`}>{value}</div>
      {sub && <div className="text-[11px] text-titanium-500 mt-0.5">{sub}</div>}
      {hint && <div className={`text-[11px] mt-0.5 ${warn ? 'text-amber-300' : 'text-titanium-400'}`}>{hint}</div>}
    </div>
  );
}

void Calendar;
