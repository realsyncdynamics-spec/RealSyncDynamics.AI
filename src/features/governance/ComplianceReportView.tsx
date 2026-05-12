import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, FileDown, Loader2, AlertTriangle, ShieldCheck, Hash,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import {
  fetchTenantEvents, fetchTenantAssets, fetchTenantPolicies,
  fetchTenantEvidence, fetchFrameworkControls, fetchTenantMappings,
  type DbGovernanceAsset, type DbGovernancePolicy, type DbGovernanceEvent,
  type DbGovernanceEvidence, type DbFrameworkControl, type DbAssetControlMapping,
} from './governanceApi';
import { getSupabase } from '../../lib/supabase';

/**
 * /governance/reports — point-in-time tenant snapshot.
 *
 * Pure client-side aggregation: fetches assets + policies + events
 * + evidence + mappings via tenant-RLS, sorts deterministically,
 * serializes to JSON, computes sha256 of the bytes, downloads a
 * file named with the hash prefix.
 *
 * The hash is the integrity anchor — two operators generating a
 * report against the same DB state get the exact same hash. For
 * sealed timestamping (signed receipt stored server-side), see
 * the deferred backlog in the PR description.
 */
export function ComplianceReportView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

interface ReportShape {
  report_id: string;
  tenant_id: string;
  generated_at: string;
  generator: string;
  summary: {
    assets_total: number;
    policies_total: number;
    events_total: number;
    evidence_total: number;
    mappings_total: number;
    framework_controls_total: number;
    events_by_risk: Record<string, number>;
    events_by_action: Record<string, number>;
    approvals_pending: number;
  };
  assets: DbGovernanceAsset[];
  policies: DbGovernancePolicy[];
  events: DbGovernanceEvent[];
  evidence: DbGovernanceEvidence[];
  mappings: DbAssetControlMapping[];
  framework_controls: DbFrameworkControl[];
}

function Inner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastReport, setLastReport] = useState<{
    hash: string;
    filename: string;
    summary: ReportShape['summary'];
    generated_at: string;
  } | null>(null);

  const generate = async () => {
    if (!activeTenantId) return;
    setError(null); setBusy(true); setLastReport(null);
    try {
      const sb = getSupabase();
      const [
        assets, policies, events, evidence, controls, mappings,
        { count: pendingApprovalsCount },
      ] = await Promise.all([
        fetchTenantAssets(activeTenantId),
        fetchTenantPolicies(activeTenantId),
        fetchTenantEvents(activeTenantId, 5000),
        fetchTenantEvidence(activeTenantId, 5000),
        fetchFrameworkControls(),
        fetchTenantMappings(activeTenantId),
        sb.from('governance_approvals')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', activeTenantId).eq('status', 'pending'),
      ]);

      // Deterministic ordering so identical state → identical bytes → identical hash.
      const sortById = <T extends { id: string }>(a: T, b: T) => a.id.localeCompare(b.id);
      const assetsSorted    = [...assets].sort(sortById);
      const policiesSorted  = [...policies].sort(sortById);
      const eventsSorted    = [...events].sort(sortById);
      const evidenceSorted  = [...evidence].sort(sortById);
      const controlsSorted  = [...controls].sort(sortById);
      const mappingsSorted  = [...mappings].sort(sortById);

      const eventsByRisk: Record<string, number> = {};
      const eventsByAction: Record<string, number> = {};
      for (const e of eventsSorted) {
        eventsByRisk[e.risk_level] = (eventsByRisk[e.risk_level] ?? 0) + 1;
        if (e.policy_action) eventsByAction[e.policy_action] = (eventsByAction[e.policy_action] ?? 0) + 1;
      }

      const report: ReportShape = {
        report_id: cryptoRandomUuid(),
        tenant_id: activeTenantId,
        generated_at: new Date().toISOString(),
        generator: 'RealSyncDynamics.AI Governance Runtime',
        summary: {
          assets_total: assetsSorted.length,
          policies_total: policiesSorted.length,
          events_total: eventsSorted.length,
          evidence_total: evidenceSorted.length,
          mappings_total: mappingsSorted.length,
          framework_controls_total: controlsSorted.length,
          events_by_risk: eventsByRisk,
          events_by_action: eventsByAction,
          approvals_pending: pendingApprovalsCount ?? 0,
        },
        assets: assetsSorted,
        policies: policiesSorted,
        events: eventsSorted,
        evidence: evidenceSorted,
        mappings: mappingsSorted,
        framework_controls: controlsSorted,
      };

      const jsonText = JSON.stringify(report, null, 2);
      const hash = await sha256Hex(jsonText);
      const date = report.generated_at.slice(0, 10);
      const shortTenant = activeTenantId.slice(0, 8);
      const filename = `rsd-governance-report-${shortTenant}-${date}-${hash.slice(0, 8)}.json`;

      triggerDownload(filename, jsonText);

      setLastReport({ hash, filename, summary: report.summary, generated_at: report.generated_at });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Report-Erzeugung fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/governance" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-fuchsia-500 to-violet-600 flex items-center justify-center shadow-sm">
              <FileDown className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Compliance Report</div>
              <div className="text-[11px] text-titanium-400 font-medium">Hash-versiegelter Tenant-Snapshot</div>
            </div>
          </div>
        </div>
        {tenants.length > 1 && (
          <select
            value={activeTenantId ?? ''}
            onChange={(e) => setActiveTenant(e.target.value)}
            className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer font-medium hover:bg-obsidian-800 max-w-[200px]"
          >
            {tenants.map((t) => <option key={t.tenantId} value={t.tenantId}>{t.name}</option>)}
          </select>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <section className="border border-titanium-900 bg-obsidian-900/60 p-5">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-4 w-4 text-amber-300" />
            <h2 className="font-display font-bold text-titanium-50 text-lg tracking-tight">
              Point-in-time Snapshot generieren
            </h2>
          </div>
          <p className="text-[13px] text-titanium-300 leading-relaxed mb-4">
            Liest Assets, Policies, Events, Evidence, Framework-Controls und Mappings des aktuellen
            Tenants über tenant-RLS, sortiert deterministisch und serialisiert als JSON. Der SHA-256
            der Bytes ist die Integritäts-Anker — gleicher DB-Stand erzeugt gleiches File mit
            gleichem Hash.
          </p>
          {error && (
            <div className="mb-3 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <button
            onClick={generate}
            disabled={busy || !activeTenantId}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-obsidian-950 text-sm font-bold rounded-none hover:bg-amber-400 disabled:opacity-50"
          >
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Erzeuge Snapshot…</>
                  : <><FileDown className="h-4 w-4" /> Report jetzt erzeugen + herunterladen</>}
          </button>
        </section>

        {lastReport && (
          <section className="border border-emerald-500/40 bg-emerald-500/5 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Hash className="h-4 w-4 text-emerald-300" />
              <h2 className="font-display font-bold text-emerald-200 text-sm tracking-wider uppercase">
                Snapshot erzeugt
              </h2>
            </div>
            <div className="text-[12px] font-mono text-titanium-200 break-all mb-3">
              <span className="text-titanium-500">file:</span> {lastReport.filename}
            </div>
            <div className="text-[12px] font-mono text-amber-200 break-all mb-3">
              <span className="text-titanium-500">sha256:</span> {lastReport.hash}
            </div>
            <div className="text-[11px] text-titanium-400 mb-3">
              Erzeugt: {new Date(lastReport.generated_at).toLocaleString('de-DE')}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] mt-3">
              <Stat label="Assets"   value={lastReport.summary.assets_total} />
              <Stat label="Policies" value={lastReport.summary.policies_total} />
              <Stat label="Events"   value={lastReport.summary.events_total} />
              <Stat label="Evidence" value={lastReport.summary.evidence_total} />
              <Stat label="Mappings" value={lastReport.summary.mappings_total} />
              <Stat label="Approvals offen" value={lastReport.summary.approvals_pending} />
            </div>
          </section>
        )}

        <section className="border border-titanium-900 bg-obsidian-900/40 p-4 text-[13px] text-titanium-300 leading-relaxed">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-300 mb-2">
            Nutzung durch Auditoren
          </div>
          <ul className="list-disc list-inside space-y-1.5">
            <li>Die Datei ist deterministisch hashbar — zwei Operatoren bekommen denselben SHA-256.</li>
            <li>Hash gehört in das Übergabe-Protokoll. Auditor kann später verifizieren: <code>sha256sum &lt;file&gt;</code>.</li>
            <li>
              Sealed-Timestamping mit serverseitigem Receipt (DB-Anchor, signiertes Datum) ist
              eigene Roadmap-Story. Aktuell: client-side Hash, manuelle Übergabe.
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-titanium-900 bg-obsidian-950/60 px-2.5 py-1.5">
      <div className="text-[9px] font-mono uppercase tracking-wider text-titanium-500">{label}</div>
      <div className="text-titanium-100 font-mono tabular-nums text-base mt-0.5">{value}</div>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────── */

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  const bytes = new Uint8Array(buf);
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

function triggerDownload(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function cryptoRandomUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
