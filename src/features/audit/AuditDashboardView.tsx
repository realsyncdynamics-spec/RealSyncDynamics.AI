import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  ScrollText,
  ShieldAlert,
  Webhook,
  RefreshCw,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { AuthGate } from '../kodee/connections/AuthGate';
import { getSupabase } from '../../lib/supabase';
import {
  actionBucket,
  relativeTime,
  riskTone,
  summarizeGovernanceEvents,
  summarizeWebhookEvents,
  type GovernanceEventRow as GEventLite,
  type WebhookEventRow as WEventLite,
} from '../../lib/audit/telemetryHelpers';

type Tab = 'admin' | 'policy' | 'webhook';
const PAGE_SIZE = 200;

interface AdminLogRow {
  id: string;
  tenant_id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

interface GovernanceEventRow {
  id: string;
  tenant_id: string | null;
  asset_id: string | null;
  policy_id: string | null;
  event_type: string;
  event_source: string;
  title: string;
  summary: string | null;
  risk_level: string;
  actor_email: string | null;
  vendor: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

interface WebhookEventRow {
  id: string;
  type: string;
  processed_at: string;
}

export function AuditDashboardView() {
  return <AuthGate>{(session) => <Inner session={session} />}</AuthGate>;
}

function Inner({ session }: { session: Session }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('admin');
  const [adminRows, setAdminRows] = useState<AdminLogRow[] | null>(null);
  const [policyRows, setPolicyRows] = useState<GovernanceEventRow[] | null>(null);
  const [webhookRows, setWebhookRows] = useState<WebhookEventRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    (async () => {
      const { data: prof, error: profErr } = await sb
        .from('profiles')
        .select('is_super_admin')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profErr) {
        setError(profErr.message);
        setAllowed(false);
        return;
      }

      const isAdmin = !!prof?.is_super_admin;
      setAllowed(isAdmin);
      if (isAdmin) await loadAll();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.user.id]);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const sb = getSupabase();
      const [a, p, w] = await Promise.all([
        sb.from('governance_admin_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE),
        sb.from('governance_events')
          .select('id, tenant_id, asset_id, policy_id, event_type, event_source, title, summary, risk_level, actor_email, vendor, payload, created_at')
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE),
        sb.from('webhook_events')
          .select('id, type, processed_at')
          .order('processed_at', { ascending: false })
          .limit(PAGE_SIZE),
      ]);
      if (a.error) throw a.error;
      if (p.error) throw p.error;
      if (w.error) throw w.error;
      setAdminRows((a.data ?? []) as AdminLogRow[]);
      setPolicyRows((p.data ?? []) as GovernanceEventRow[]);
      setWebhookRows((w.data ?? []) as WebhookEventRow[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (allowed === false) return <AccessDenied />;
  if (allowed === null) {
    return (
      <CenterMessage>
        <Loader2 className="h-5 w-5 animate-spin" /> Prüfe Berechtigung …
      </CenterMessage>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <Header onReload={loadAll} loading={loading} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {error && (
          <div className="flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        <Tabs tab={tab} onChange={setTab} counts={{
          admin: adminRows?.length ?? 0,
          policy: policyRows?.length ?? 0,
          webhook: webhookRows?.length ?? 0,
        }} />

        {tab === 'admin' && <AdminTab rows={adminRows} />}
        {tab === 'policy' && <PolicyTab rows={policyRows} />}
        {tab === 'webhook' && <WebhookTab rows={webhookRows} />}
      </main>
    </div>
  );
}

function Header({ onReload, loading }: { onReload: () => void; loading: boolean }) {
  return (
    <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-amber-500 to-orange-700 flex items-center justify-center">
            <ScrollText className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Audit &amp; Event Telemetry</div>
            <div className="text-[11px] text-titanium-400 font-medium">Cross-tenant view (super_admin)</div>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onReload}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-xs rounded-none disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        Refresh
      </button>
    </header>
  );
}

function Tabs({
  tab,
  onChange,
  counts,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
  counts: { admin: number; policy: number; webhook: number };
}) {
  const items: Array<{ id: Tab; label: string; icon: typeof ScrollText; count: number }> = [
    { id: 'admin',   label: 'Admin Actions',  icon: ScrollText,  count: counts.admin },
    { id: 'policy',  label: 'Policy Events',  icon: ShieldAlert, count: counts.policy },
    { id: 'webhook', label: 'Webhook Events', icon: Webhook,     count: counts.webhook },
  ];
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {items.map(({ id, label, icon: Icon, count }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={
            'inline-flex items-center gap-2 px-3 py-1.5 rounded-none border ' +
            (tab === id
              ? 'bg-security-500 text-white border-security-500 font-bold'
              : 'bg-obsidian-900 border-titanium-700 hover:border-titanium-500 text-titanium-200')
          }
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
          <span className={'tabular-nums ' + (tab === id ? 'opacity-90' : 'text-titanium-500')}>
            {count}
          </span>
        </button>
      ))}
    </div>
  );
}

function AdminTab({ rows }: { rows: AdminLogRow[] | null }) {
  if (rows === null) return <Loading label="Lade Admin-Log …" />;
  if (rows.length === 0) {
    return <EmptyState label="Noch keine Admin-Actions im Governance-Stack." />;
  }
  return (
    <div className="bg-obsidian-900 border border-titanium-900 rounded-none overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-obsidian-950 text-titanium-400 uppercase tracking-wider">
          <tr>
            <th className="text-left px-3 py-2.5">Time</th>
            <th className="text-left px-3 py-2.5">Tenant</th>
            <th className="text-left px-3 py-2.5">Actor</th>
            <th className="text-left px-3 py-2.5">Action</th>
            <th className="text-left px-3 py-2.5 hidden md:table-cell">Target</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-titanium-900">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-obsidian-950">
              <td className="px-3 py-2.5 text-titanium-400 text-[11px] whitespace-nowrap">
                <div className="text-titanium-200">{relativeTime(r.created_at)}</div>
                <div className="text-titanium-500">{new Date(r.created_at).toLocaleString('de-DE')}</div>
              </td>
              <td className="px-3 py-2.5 font-mono text-[10px] text-titanium-400">{r.tenant_id.slice(0, 8)}…</td>
              <td className="px-3 py-2.5 text-titanium-300">
                {r.actor_email ?? <span className="text-titanium-500">system</span>}
              </td>
              <td className="px-3 py-2.5">
                <span className="inline-block px-2 py-0.5 border border-titanium-700 bg-obsidian-950 text-[10px] font-bold uppercase tracking-wider rounded-none text-titanium-200">
                  {actionBucket(r.action)}
                </span>
                <span className="ml-2 text-titanium-300">{r.action}</span>
              </td>
              <td className="px-3 py-2.5 hidden md:table-cell text-titanium-400 text-[11px]">
                <div>{r.target_type}</div>
                {r.target_id && (
                  <div className="font-mono text-[10px] text-titanium-500">{r.target_id.slice(0, 8)}…</div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PolicyTab({ rows }: { rows: GovernanceEventRow[] | null }) {
  const summary = useMemo(() => {
    if (!rows) return null;
    const lite: GEventLite[] = rows.map((r) => ({
      id: r.id,
      risk_level: r.risk_level,
      event_type: r.event_type,
    }));
    return summarizeGovernanceEvents(lite);
  }, [rows]);

  if (rows === null) return <Loading label="Lade Policy-Events …" />;
  if (rows.length === 0) {
    return <EmptyState label="Keine Policy-Events erfasst." />;
  }

  return (
    <>
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {(['critical', 'high', 'medium', 'low', 'info'] as const).map((lvl) => {
            const tone = riskTone(lvl);
            return (
              <div
                key={lvl}
                className={`p-3 border rounded-none ${tone.border} ${tone.bg}`}
              >
                <div className="text-[11px] uppercase tracking-wider text-titanium-500 mb-1">
                  {tone.label}
                </div>
                <div className={`text-2xl font-display font-bold tabular-nums ${tone.text}`}>
                  {summary.by_risk[lvl]}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-obsidian-900 border border-titanium-900 rounded-none overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-obsidian-950 text-titanium-400 uppercase tracking-wider">
            <tr>
              <th className="text-left px-3 py-2.5">Time</th>
              <th className="text-left px-3 py-2.5">Risk</th>
              <th className="text-left px-3 py-2.5">Event</th>
              <th className="text-left px-3 py-2.5 hidden md:table-cell">Source</th>
              <th className="text-left px-3 py-2.5 hidden lg:table-cell">Actor / Vendor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-titanium-900">
            {rows.map((r) => {
              const tone = riskTone(r.risk_level);
              return (
                <tr key={r.id} className="hover:bg-obsidian-950">
                  <td className="px-3 py-2.5 text-titanium-400 text-[11px] whitespace-nowrap">
                    <div className="text-titanium-200">{relativeTime(r.created_at)}</div>
                    <div className="text-titanium-500">{new Date(r.created_at).toLocaleString('de-DE')}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block px-2 py-0.5 border text-[10px] font-bold uppercase tracking-wider rounded-none ${tone.border} ${tone.bg} ${tone.text}`}>
                      {tone.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-display font-bold text-titanium-50">{r.title}</div>
                    <div className="text-[11px] text-titanium-500">{r.event_type}</div>
                    {r.summary && (
                      <div className="text-[11px] text-titanium-400 mt-1 line-clamp-2">{r.summary}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 hidden md:table-cell text-titanium-300">{r.event_source}</td>
                  <td className="px-3 py-2.5 hidden lg:table-cell text-titanium-400 text-[11px]">
                    {r.actor_email && <div>{r.actor_email}</div>}
                    {r.vendor && <div className="text-titanium-500">{r.vendor}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function WebhookTab({ rows }: { rows: WebhookEventRow[] | null }) {
  const summary = useMemo(() => {
    if (!rows) return null;
    const lite: WEventLite[] = rows.map((r) => ({ id: r.id, type: r.type, processed_at: r.processed_at }));
    return summarizeWebhookEvents(lite);
  }, [rows]);

  if (rows === null) return <Loading label="Lade Webhook-Events …" />;
  if (rows.length === 0) {
    return <EmptyState label="Noch keine Webhook-Events. Sobald Stripe einen Event sendet, erscheint er hier." />;
  }

  return (
    <>
      {summary && summary.by_type.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-3">
            <div className="text-[11px] uppercase tracking-wider text-titanium-500 mb-2">Top Event Types</div>
            <ul className="space-y-1.5">
              {summary.by_type.slice(0, 8).map((t) => (
                <li key={t.type} className="flex items-center justify-between text-xs">
                  <span className="text-titanium-200 font-mono text-[11px]">{t.type}</span>
                  <span className="tabular-nums text-titanium-400">{t.count}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-3 text-xs">
            <div className="text-[11px] uppercase tracking-wider text-titanium-500 mb-2">Window</div>
            <dl className="space-y-1.5 text-titanium-300">
              <div className="flex justify-between"><dt>Events</dt><dd className="tabular-nums">{summary.total}</dd></div>
              <div className="flex justify-between"><dt>Oldest</dt><dd>{summary.oldest ? new Date(summary.oldest).toLocaleString('de-DE') : '—'}</dd></div>
              <div className="flex justify-between"><dt>Newest</dt><dd>{summary.newest ? new Date(summary.newest).toLocaleString('de-DE') : '—'}</dd></div>
            </dl>
          </div>
        </div>
      )}

      <div className="bg-obsidian-900 border border-titanium-900 rounded-none overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-obsidian-950 text-titanium-400 uppercase tracking-wider">
            <tr>
              <th className="text-left px-3 py-2.5">Processed</th>
              <th className="text-left px-3 py-2.5">Type</th>
              <th className="text-left px-3 py-2.5">Stripe Event ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-titanium-900">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-obsidian-950">
                <td className="px-3 py-2.5 text-titanium-400 text-[11px] whitespace-nowrap">
                  <div className="text-titanium-200">{relativeTime(r.processed_at)}</div>
                  <div className="text-titanium-500">{new Date(r.processed_at).toLocaleString('de-DE')}</div>
                </td>
                <td className="px-3 py-2.5 font-mono text-[11px] text-titanium-200">{r.type}</td>
                <td className="px-3 py-2.5 font-mono text-[10px] text-titanium-400">{r.id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-20 text-titanium-400 text-sm">
      <Loader2 className="h-5 w-5 animate-spin" /> {label}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="text-center py-12 text-sm text-titanium-500">{label}</div>;
}

function CenterMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex items-center justify-center">
      <div className="flex items-center gap-3 text-titanium-400 text-sm">{children}</div>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-3" />
        <h1 className="font-display font-bold text-2xl text-titanium-50 mb-2">Zugriff verweigert</h1>
        <p className="text-sm text-titanium-300 mb-4">
          /dashboard/audit erfordert super_admin-Rechte.
        </p>
        <Link to="/" className="text-security-400 hover:underline text-sm">← Zurück zur Startseite</Link>
      </div>
    </div>
  );
}

export default AuditDashboardView;
