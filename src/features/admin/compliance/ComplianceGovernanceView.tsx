/**
 * Platform Admin — Compliance / Governance KPI shell (Anzeige only).
 * Route: /admin/compliance
 * DEV fixture: ?fixture=1 (empty/null) | ?fixture=populated (layout verify)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { AuthGate } from '../../kodee/connections/AuthGate';
import { getSupabase } from '../../../lib/supabase';
import { ComplianceKpiRow } from './ComplianceKpiRow';
import {
  getComplianceGovernanceFixture,
  getComplianceGovernancePopulatedFixture,
} from './complianceFixture';
import { loadGovernanceCompliance } from './loadComplianceGovernance';
import {
  triggerComplianceScoreRefresh,
  triggerDigestRefresh,
} from './triggerComplianceRefresh';
import type {
  ComplianceRefreshMeta,
  GovernanceComplianceSnapshot,
} from './complianceTypes';
import { formatComplianceMetric } from './complianceTypes';

function fixtureModeFromSearch(params: URLSearchParams): 'empty' | 'populated' | null {
  const v = params.get('fixture');
  if (v === '1' || v === 'empty') return 'empty';
  if (v === 'populated') return 'populated';
  return null;
}

export function ComplianceGovernanceView() {
  if (import.meta.env.DEV) {
    // AuthGate skipped only when a fixture query is present (local verify).
    const params = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
    if (fixtureModeFromSearch(params)) {
      return <Inner session={null} forceFixture />;
    }
  }
  return <AuthGate>{(session) => <Inner session={session} />}</AuthGate>;
}

function Inner({
  session,
  forceFixture = false,
}: {
  session: Session | null;
  forceFixture?: boolean;
}) {
  const [searchParams] = useSearchParams();
  const fixtureMode = fixtureModeFromSearch(searchParams);
  const tenantFromQuery = searchParams.get('tenant');

  const [allowed, setAllowed] = useState<boolean | null>(forceFixture || !!fixtureMode ? true : null);
  const [snapshot, setSnapshot] = useState<GovernanceComplianceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshMeta, setRefreshMeta] = useState<ComplianceRefreshMeta | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(tenantFromQuery);
  const [tenantOptions, setTenantOptions] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (forceFixture || fixtureMode) {
      void load();
      return;
    }
    if (!session) {
      setAllowed(false);
      setLoading(false);
      return;
    }
    const sb = getSupabase();
    (async () => {
      const { data: prof } = await sb
        .from('profiles')
        .select('is_super_admin')
        .eq('id', session.user.id)
        .maybeSingle();
      const isAdmin = !!prof?.is_super_admin;
      setAllowed(isAdmin);
      if (isAdmin) {
        const { data: customers } = await sb.rpc('admin_customers_list');
        const opts = ((customers ?? []) as Array<{ tenant_id: string; tenant_name: string }>).map((c) => ({
          id: c.tenant_id,
          name: c.tenant_name,
        }));
        setTenantOptions(opts);
        if (!tenantId && opts[0]) setTenantId(opts[0].id);
        await load(opts[0]?.id ?? tenantId);
      } else {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id, forceFixture]);

  async function load(explicitTenant?: string | null) {
    setLoading(true);
    setError(null);
    try {
      if (fixtureMode === 'populated') {
        setSnapshot(getComplianceGovernancePopulatedFixture());
        return;
      }
      if (fixtureMode === 'empty' || forceFixture) {
        setSnapshot(getComplianceGovernanceFixture());
        return;
      }
      const tid = explicitTenant ?? tenantId;
      const data = await loadGovernanceCompliance({ tenantId: tid });
      setSnapshot(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const onTenantChange = useCallback(async (id: string) => {
    setTenantId(id || null);
    await load(id || null);
  }, []);

  const onRefreshScores = useCallback(async () => {
    setRefreshing(true);
    const meta = await triggerComplianceScoreRefresh(tenantId);
    setRefreshMeta(meta);
    // Meta only — always re-read tables for scores (never invent from HTTP).
    await load(tenantId);
    setRefreshing(false);
  }, [tenantId]);

  const onRefreshDigest = useCallback(async () => {
    setRefreshing(true);
    const meta = await triggerDigestRefresh(tenantId);
    setRefreshMeta(meta);
    await load(tenantId);
    setRefreshing(false);
  }, [tenantId]);

  const sourceLabel = useMemo(() => {
    if (!snapshot) return '—';
    if (snapshot.source === 'fixture') return `fixture · ${snapshot.generated_at}`;
    return `live · tenant ${snapshot.tenant_id ?? '—'}`;
  }, [snapshot]);

  if (allowed === false) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-3" />
          <h1 className="font-display font-bold text-2xl text-titanium-50 mb-2">Zugriff verweigert</h1>
          <p className="text-sm text-titanium-300 mb-4">/admin/compliance erfordert super_admin-Rechte.</p>
          <Link to="/" className="text-security-400 hover:underline text-sm">← Zurück zur Startseite</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/admin" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-petrol-700 to-security-blue flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">
                Compliance KPI
              </div>
              <div className="text-[11px] text-titanium-400 font-medium">
                Anzeige only · null = unbekannt · 0 = gemessen
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!fixtureMode && tenantOptions.length > 0 && (
            <select
              value={tenantId ?? ''}
              onChange={(e) => void onTenantChange(e.target.value)}
              className="bg-obsidian-950 border border-titanium-700 text-titanium-200 text-xs rounded-none px-2 py-1.5 max-w-[200px]"
            >
              <option value="">— Tenant —</option>
              {tenantOptions.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => void load(tenantId)}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-xs rounded-none disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Neu laden
          </button>
          {!fixtureMode && (
            <>
              <button
                type="button"
                onClick={() => void onRefreshScores()}
                disabled={loading || refreshing || !tenantId}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-obsidian-950 border border-titanium-700 hover:border-petrol-500 text-titanium-200 text-xs rounded-none disabled:opacity-50"
                title="POST dashboard-intelligence → update_scores (Meta only)"
              >
                Scores refresh
              </button>
              <button
                type="button"
                onClick={() => void onRefreshDigest()}
                disabled={loading || refreshing || !tenantId}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-obsidian-950 border border-titanium-700 hover:border-petrol-500 text-titanium-200 text-xs rounded-none disabled:opacity-50"
                title="POST dashboard-digest-generate (Meta only)"
              >
                Digest refresh
              </button>
            </>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-titanium-500">
            first_view · compliance_kpi_row
          </p>
          <h1 className="font-display font-bold text-2xl text-titanium-50 mt-1">
            Governance · Compliance
          </h1>
          <p className="text-sm text-titanium-400 mt-1">
            Quelle: <span className="font-mono text-titanium-300">{sourceLabel}</span>
          </p>
        </div>

        {error && (
          <div className="border border-rose-900/50 bg-rose-950/20 p-4 flex items-start gap-3 rounded-none">
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-rose-300 font-semibold">Laden fehlgeschlagen</p>
              <p className="text-xs text-rose-300/80 font-mono mt-1">{error}</p>
            </div>
          </div>
        )}

        {refreshMeta && (
          <div className="border border-titanium/15 bg-obsidian-900 p-3 rounded-none">
            <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-1">
              Refresh Meta (keine Scores)
            </p>
            <p className="font-mono text-xs text-titanium-300">
              ok={String(refreshMeta.ok)}
              {refreshMeta.action ? ` · action=${refreshMeta.action}` : ''}
              {refreshMeta.updated_count != null ? ` · updated_count=${refreshMeta.updated_count}` : ''}
              {refreshMeta.insights_generated != null ? ` · insights_generated=${refreshMeta.insights_generated}` : ''}
              {refreshMeta.digests_created != null ? ` · digests_created=${refreshMeta.digests_created}` : ''}
              {refreshMeta.timestamp_utc ? ` · ${refreshMeta.timestamp_utc}` : ''}
              {refreshMeta.error ? ` · error=${refreshMeta.error}` : ''}
            </p>
          </div>
        )}

        {loading && !snapshot ? (
          <div className="flex items-center gap-2 text-titanium-400 text-sm py-12 justify-center">
            <Loader2 className="h-5 w-5 animate-spin" /> Lade Compliance-Kennzahlen …
          </div>
        ) : snapshot ? (
          <>
            <ComplianceKpiRow compliance={snapshot.compliance} />

            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-label="Digest Nebenkennzahlen">
              <MetaBlock
                title="Incidents / Fristen"
                rows={[
                  ['newIncidents', formatComplianceMetric(snapshot.compliance.newIncidents)],
                  ['resolvedIncidents', formatComplianceMetric(snapshot.compliance.resolvedIncidents)],
                  ['upcomingDeadlines', formatComplianceMetric(snapshot.compliance.upcomingDeadlines)],
                  ['criticalFindings', formatComplianceMetric(snapshot.compliance.criticalFindings)],
                ]}
              />
              <MetaBlock
                title="Policies / Vendors"
                rows={[
                  ['policies.documented', formatComplianceMetric(snapshot.compliance.policies.documented)],
                  ['policies.pending', formatComplianceMetric(snapshot.compliance.policies.pending)],
                  ['vendors.active', formatComplianceMetric(snapshot.compliance.vendors.active)],
                  ['vendors.highRisk', formatComplianceMetric(snapshot.compliance.vendors.highRisk)],
                ]}
              />
            </section>

            <section className="border border-titanium/15 bg-obsidian-900 p-4 rounded-none">
              <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-2">
                Field sources
              </p>
              <ul className="text-xs text-titanium-400 space-y-1 font-mono">
                <li>score_* / breakdown → compliance_score_history (latest)</li>
                <li>riskTrendDirection → compliance_score_history.trend_direction</li>
                <li>newIncidents / resolvedIncidents → incidents (24h)</li>
                <li>upcomingDeadlines → dpia_assessments pending ≤30d</li>
                <li>criticalFindings → audits.findings_count (latest completed)</li>
                <li>HTTP dashboard-intelligence / digest-generate → ok/counts only</li>
              </ul>
            </section>

            <p className="text-xs text-titanium-600">
              Quota / Rollenmatrix: bewusst ausgelassen (Prio später). Stub-Keys vorhanden, Werte null.
            </p>
          </>
        ) : null}
      </main>
    </div>
  );
}

function MetaBlock({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string]>;
}) {
  return (
    <div className="border border-titanium/15 bg-obsidian border-l-2 border-l-petrol-700/60 p-4 rounded-none">
      <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-3">{title}</p>
      <dl className="space-y-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 text-sm">
            <dt className="font-mono text-titanium-500 text-xs">{k}</dt>
            <dd className={`font-mono ${v === '—' ? 'text-titanium-600' : 'text-titanium-100'}`}>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default ComplianceGovernanceView;
