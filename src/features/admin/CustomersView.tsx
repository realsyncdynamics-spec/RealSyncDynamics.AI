import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Loader2, AlertTriangle, RefreshCw, Users, ExternalLink, Building2,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { AuthGate } from '../kodee/connections/AuthGate';
import { getSupabase } from '../../lib/supabase';

interface Customer {
  tenant_id: string;
  tenant_name: string;
  owner_email: string | null;
  plan_key: string | null;
  status: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  member_count: number;
}

export function CustomersView() {
  return <AuthGate>{(session) => <Inner session={session} />}</AuthGate>;
}

function Inner({ session }: { session: Session }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'trialing' | 'no_sub'>('all');
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
      const { data, error: err } = await sb.rpc('admin_customers_list');
      if (err) throw err;
      setCustomers((data ?? []) as Customer[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    if (filter === 'all') return customers;
    if (filter === 'active') return customers.filter((c) => c.status === 'active');
    if (filter === 'trialing') return customers.filter((c) => c.status === 'trialing');
    if (filter === 'no_sub') return customers.filter((c) => !c.status);
    return customers;
  }, [customers, filter]);

  const kpis = useMemo(() => ({
    total: customers.length,
    active: customers.filter((c) => c.status === 'active').length,
    trialing: customers.filter((c) => c.status === 'trialing').length,
    no_sub: customers.filter((c) => !c.status).length,
    mrr_eur: customers.filter((c) => c.status === 'active').reduce((sum, c) => {
      const price = c.plan_key === 'bronze' ? 29 : c.plan_key === 'silver' ? 99 : c.plan_key === 'gold' ? 299 : 0;
      return sum + price;
    }, 0),
  }), [customers]);

  if (allowed === false) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-3" />
          <h1 className="font-display font-bold text-2xl text-titanium-50 mb-2">Zugriff verweigert</h1>
          <p className="text-sm text-titanium-300 mb-4">/admin/customers erfordert super_admin-Rechte.</p>
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
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Customers</div>
              <div className="text-[11px] text-titanium-400 font-medium">Tenants + Subscriptions</div>
            </div>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-xs rounded-none disabled:opacity-50">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {error && (
          <div className="flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />{error}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Kpi label="Total Tenants" value={kpis.total} icon={<Users className="h-3.5 w-3.5" />} />
          <Kpi label="Active Subs" value={kpis.active} accent />
          <Kpi label="Trialing" value={kpis.trialing} />
          <Kpi label="No Sub" value={kpis.no_sub} />
          <Kpi label="MRR" value={`${kpis.mrr_eur} €`} accent />
        </div>

        <div className="flex gap-2 text-xs">
          {(['all', 'active', 'trialing', 'no_sub'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-none ${filter === f ? 'bg-security-500 text-white font-bold' : 'bg-obsidian-900 border border-titanium-700 hover:border-titanium-500 text-titanium-200'}`}>
              {f === 'all' ? 'Alle' : f === 'no_sub' ? 'Ohne Sub' : f}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-titanium-500 self-center">
            {filtered.length} {filtered.length === 1 ? 'Tenant' : 'Tenants'}
          </span>
        </div>

        {loading
          ? (
            <div className="flex items-center justify-center gap-3 py-20 text-titanium-400">
              <Loader2 className="h-5 w-5 animate-spin" /> Lade …
            </div>
          )
          : filtered.length === 0
          ? (
            <div className="text-center py-12 text-sm text-titanium-500">
              {filter === 'all'
                ? <>Noch keine Tenants. Sobald sich der erste User registriert, taucht er hier auf.<br/>Erste Demos via <Link to="/contact-sales" className="text-security-400 hover:underline">/contact-sales</Link>.</>
                : `Keine Tenants matchen Filter "${filter}".`}
            </div>
          )
          : (
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-obsidian-950 text-titanium-400 uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-3 py-2.5">Tenant</th>
                    <th className="text-left px-3 py-2.5 hidden md:table-cell">Owner</th>
                    <th className="text-left px-3 py-2.5">Plan</th>
                    <th className="text-left px-3 py-2.5">Status</th>
                    <th className="text-left px-3 py-2.5 hidden lg:table-cell">Members</th>
                    <th className="text-left px-3 py-2.5 hidden lg:table-cell">Period End</th>
                    <th className="text-left px-3 py-2.5">Stripe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-titanium-900">
                  {filtered.map((c) => (
                    <tr key={c.tenant_id} className="hover:bg-obsidian-950">
                      <td className="px-3 py-2.5">
                        <div className="font-display font-bold text-titanium-50">{c.tenant_name}</div>
                        <div className="text-[10px] text-titanium-500 font-mono">{c.tenant_id.slice(0, 8)}…</div>
                      </td>
                      <td className="px-3 py-2.5 hidden md:table-cell text-titanium-300">
                        {c.owner_email
                          ? <a href={`mailto:${c.owner_email}`} className="hover:text-security-400">{c.owner_email}</a>
                          : <span className="text-titanium-500">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <PlanBadge plan={c.plan_key} />
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={c.status} cancelAtEnd={c.cancel_at_period_end} />
                      </td>
                      <td className="px-3 py-2.5 hidden lg:table-cell text-titanium-400 tabular-nums">
                        {c.member_count}
                      </td>
                      <td className="px-3 py-2.5 hidden lg:table-cell text-titanium-400 text-[11px]">
                        {c.current_period_end ? new Date(c.current_period_end).toLocaleDateString('de-DE') : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        {c.stripe_customer_id
                          ? (
                            <a href={`https://dashboard.stripe.com/customers/${c.stripe_customer_id}`}
                               target="_blank" rel="noreferrer noopener"
                               className="inline-flex items-center gap-1 text-security-400 hover:underline text-[11px]">
                              cus_… <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )
                          : <span className="text-titanium-500 text-[11px]">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        <div className="flex flex-wrap gap-2 text-xs">
          <Link to="/admin/system" className="px-3 py-1.5 bg-obsidian-900 border border-titanium-700 hover:border-security-500 text-titanium-200 rounded-none">→ System Health</Link>
          <Link to="/admin/leads" className="px-3 py-1.5 bg-obsidian-900 border border-titanium-700 hover:border-security-500 text-titanium-200 rounded-none">→ Leads</Link>
          <Link to="/admin/analytics" className="px-3 py-1.5 bg-obsidian-900 border border-titanium-700 hover:border-security-500 text-titanium-200 rounded-none">→ Analytics</Link>
          <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer noopener"
            className="px-3 py-1.5 bg-obsidian-900 border border-titanium-700 hover:border-security-500 text-titanium-200 rounded-none inline-flex items-center gap-1">
            Stripe Dashboard <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </main>
    </div>
  );
}

function Kpi({ label, value, accent, icon }: { label: string; value: number | string; accent?: boolean; icon?: React.ReactNode }) {
  return (
    <div className={`p-3 border ${accent ? 'border-emerald-900 bg-emerald-950/20' : 'border-titanium-900 bg-obsidian-900'} rounded-none`}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-titanium-500 mb-1">
        {icon}{label}
      </div>
      <div className={`text-2xl font-display font-bold tabular-nums ${accent ? 'text-emerald-300' : 'text-titanium-50'}`}>{value}</div>
    </div>
  );
}

function PlanBadge({ plan }: { plan: string | null }) {
  if (!plan) return <span className="text-titanium-500 text-[11px]">—</span>;
  const colors: Record<string, string> = {
    bronze: 'border-amber-900 bg-amber-950/30 text-amber-300',
    silver: 'border-zinc-700 bg-zinc-900 text-zinc-200',
    gold: 'border-yellow-900 bg-yellow-950/30 text-yellow-300',
    free: 'border-titanium-800 bg-obsidian-950 text-titanium-400',
  };
  return (
    <span className={`inline-block px-2 py-0.5 border ${colors[plan] ?? colors.free} text-[10px] font-bold uppercase tracking-wider rounded-none`}>
      {plan}
    </span>
  );
}

function StatusBadge({ status, cancelAtEnd }: { status: string | null; cancelAtEnd: boolean | null }) {
  if (!status) return <span className="text-titanium-500 text-[11px]">no sub</span>;
  const colors: Record<string, string> = {
    active: 'border-emerald-900 bg-emerald-950/30 text-emerald-300',
    trialing: 'border-blue-900 bg-blue-950/30 text-blue-300',
    past_due: 'border-orange-900 bg-orange-950/30 text-orange-300',
    canceled: 'border-red-900 bg-red-950/30 text-red-300',
    incomplete: 'border-amber-900 bg-amber-950/30 text-amber-300',
  };
  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-block px-2 py-0.5 border ${colors[status] ?? colors.canceled} text-[10px] font-bold uppercase tracking-wider rounded-none`}>
        {status}
      </span>
      {cancelAtEnd && (
        <span className="text-[10px] text-amber-400 font-bold">↓ ENDS</span>
      )}
    </div>
  );
}
