/**
 * Auditor Console — read-only governance surface for Pilot W2+.
 *
 * Four panels, no writes, no settings:
 *   1. Tenant Quadrant (Risk × Cost)
 *   2. RACPO per Flow
 *   3. Hash-Chain Verify
 *   4. DSR Export
 *
 * See docs/runbooks/governance-runtime-pilot-runbook.md §3.4 for scope
 * and gate criteria. The console intentionally has no actions that
 * mutate state — CSM and the customer's DPO operate it; mutations go
 * through the policy / dsr-export Edge Functions separately.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ShieldCheck, AlertTriangle, Loader2, Download,
  CheckCircle2, XCircle, Activity,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import {
  buildExportBundle,
  fetchFlowList,
  fetchRacpo,
  fetchSubjectExport,
  fetchTenantQuadrant,
  verifyHashChain,
  type ChainVerifyResult,
  type DsrExportRow,
  type Quadrant,
  type Racpo,
  type TenantQuadrant,
} from './auditorConsoleApi';

export function AuditorConsoleView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

function Inner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link
            to="/governance/admin"
            className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-security-500 to-security-700 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">
                Auditor Console
              </div>
              <div className="text-[11px] text-titanium-400">
                Read-only · Quadrant · RACPO · Hash-Chain · DSR-Export
              </div>
            </div>
          </div>
        </div>
        {tenants.length > 1 && (
          <select
            value={activeTenantId ?? ''}
            onChange={(e) => setActiveTenant(e.target.value)}
            className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none"
          >
            {tenants.map((t) => (
              <option key={t.tenantId} value={t.tenantId}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {!activeTenantId ? (
          <EmptyState message="Wähle einen Tenant aus, um die Auditor-Views zu laden." />
        ) : (
          <>
            <QuadrantPanel tenantId={activeTenantId} />
            <RacpoPanel    tenantId={activeTenantId} />
            <ChainPanel    tenantId={activeTenantId} />
            <DsrPanel      tenantId={activeTenantId} />
          </>
        )}
      </main>
    </div>
  );
}

// ── Panel 1: Tenant Quadrant ────────────────────────────────────

function QuadrantPanel({ tenantId }: { tenantId: string }) {
  const [data,  setData]  = useState<TenantQuadrant | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null); setError(null);
    fetchTenantQuadrant(tenantId)
      .then((q) => { if (!cancelled) setData(q); })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Fehler');
      });
    return () => { cancelled = true; };
  }, [tenantId]);

  return (
    <Section title="Tenant Quadrant" icon={<Activity className="h-4 w-4" />}>
      {error ? <ErrorRow msg={error} />
        : data === null ? <LoadingRow />
        : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric label="Risk-Score" value={data.risk_score.toFixed(2)} hint="0..100" />
            <Metric label="Spend 90 d" value={fmtUsd(data.spend_90d)} hint="USD" />
            <Metric label="Cohort-Median" value={fmtUsd(data.median_spend)} hint="USD" />
            <QuadrantBadge q={data.quadrant} />
          </div>
        )}
    </Section>
  );
}

function QuadrantBadge({ q }: { q: Quadrant }) {
  const cfg: Record<Quadrant, { tone: string; label: string }> = {
    reserved_capacity: { tone: 'bg-emerald-900/60 border-emerald-700 text-emerald-100', label: 'Reserved Capacity' },
    investigate:       { tone: 'bg-amber-900/60   border-amber-700   text-amber-100',   label: 'Investigate'       },
    premium_review:    { tone: 'bg-blue-900/60    border-blue-700    text-blue-100',    label: 'Premium Review'    },
    red_alert:         { tone: 'bg-red-900/60     border-red-700     text-red-100',     label: 'Red Alert'         },
  };
  const c = cfg[q];
  return (
    <div className={`border ${c.tone} rounded-none p-3 flex flex-col justify-center`}>
      <div className="font-display font-bold text-sm">{c.label}</div>
      <div className="text-[10px] font-mono uppercase tracking-wider mt-0.5 opacity-70">
        Quadrant
      </div>
    </div>
  );
}

// ── Panel 2: RACPO per Flow ─────────────────────────────────────

function RacpoPanel({ tenantId }: { tenantId: string }) {
  const [flows,   setFlows]   = useState<string[] | null>(null);
  const [rows,    setRows]    = useState<Array<{ flow: string; r: Racpo }>>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFlows(null); setRows([]); setError(null); setLoading(true);
    (async () => {
      try {
        const fs = await fetchFlowList(tenantId);
        if (cancelled) return;
        setFlows(fs);
        const results = await Promise.all(
          fs.map(async (f) => ({ flow: f, r: await fetchRacpo(tenantId, f) }))
        );
        if (!cancelled) setRows(results);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Fehler');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId]);

  return (
    <Section title="RACPO per Flow (rolling 7d)" icon={<Activity className="h-4 w-4" />}>
      {error ? <ErrorRow msg={error} />
        : loading || flows === null ? <LoadingRow />
        : flows.length === 0 ? <NoneRow msg="Noch keine Flows mit Cost-Daten in 30 d." />
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-mono uppercase tracking-wider text-titanium-500 border-b border-titanium-900">
                  <th className="text-left  py-2 pr-3">Flow</th>
                  <th className="text-right py-2 pr-3">Raw $/Outcome</th>
                  <th className="text-right py-2 pr-3">Risk</th>
                  <th className="text-right py-2 pr-3">Pressure</th>
                  <th className="text-right py-2">RACPO</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ flow, r }) => (
                  <tr key={flow} className="border-b border-titanium-900">
                    <td className="py-2 pr-3 font-mono text-titanium-100">{flow}</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">
                      {r.raw_cost_per_completed === null ? '—' : fmtUsd(r.raw_cost_per_completed)}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums text-titanium-300">
                      {r.tenant_risk_score.toFixed(1)}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums text-titanium-300">
                      {r.incident_pressure.toFixed(1)}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums text-amber-300">
                      {r.racpo === null ? '—' : fmtUsd(r.racpo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </Section>
  );
}

// ── Panel 3: Hash-Chain Verify ──────────────────────────────────

function ChainPanel({ tenantId }: { tenantId: string }) {
  const [result,  setResult]  = useState<ChainVerifyResult | null>(null);
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const run = async () => {
    setBusy(true); setError(null); setResult(null);
    try { setResult(await verifyHashChain(tenantId)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Fehler'); }
    finally { setBusy(false); }
  };

  return (
    <Section title="Hash-Chain Verify" icon={<ShieldCheck className="h-4 w-4" />}>
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={run}
          disabled={busy}
          className="border border-titanium-700 hover:border-security-500 bg-obsidian-900 hover:bg-obsidian-800 px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-titanium-100 disabled:opacity-50 rounded-none flex items-center gap-2"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
          {busy ? 'Verifiziere…' : 'Chain verifizieren'}
        </button>
        <span className="text-[11px] text-titanium-500 font-mono">
          Rechnet event_hash neu und vergleicht mit gespeichertem Wert
        </span>
      </div>
      {error ? <ErrorRow msg={error} />
        : !result ? <span className="text-[11px] text-titanium-500">Noch nicht ausgeführt.</span>
        : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric label="Events geprüft" value={result.total.toLocaleString()} />
            <Metric label="Hash invalid" value={result.invalid.toLocaleString()} hint={result.invalid === 0 ? 'ok' : 'inspect'} />
            <Metric label="Chain-Brüche" value={result.chainBreaks.toLocaleString()} hint={result.chainBreaks === 0 ? 'ok' : 'inspect'} />
            <ChainStatusBadge ok={result.invalid === 0 && result.chainBreaks === 0} />
            {result.firstIssue && (
              <div className="col-span-2 md:col-span-4 border border-red-900 bg-red-950/40 p-3 text-[11px] font-mono text-red-200">
                Erster Fehler bei tenant_seq <span className="text-amber-300">{result.firstIssue.tenant_seq}</span>:
                {!result.firstIssue.valid    && ' event_hash mismatch.'}
                {!result.firstIssue.chain_ok && ' prev_hash mismatch.'}
              </div>
            )}
          </div>
        )}
    </Section>
  );
}

function ChainStatusBadge({ ok }: { ok: boolean }) {
  const cls = ok
    ? 'bg-emerald-900/60 border-emerald-700 text-emerald-100'
    : 'bg-red-900/60     border-red-700     text-red-100';
  return (
    <div className={`border ${cls} rounded-none p-3 flex flex-col justify-center items-start`}>
      <div className="flex items-center gap-2 font-display font-bold text-sm">
        {ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
        {ok ? 'Tamper-evident' : 'Inkonsistent'}
      </div>
      <div className="text-[10px] font-mono uppercase tracking-wider mt-0.5 opacity-70">Status</div>
    </div>
  );
}

// ── Panel 4: DSR Export ────────────────────────────────────────

function DsrPanel({ tenantId }: { tenantId: string }) {
  const [subjectRef, setSubjectRef] = useState('');
  const [rows,       setRows]       = useState<DsrExportRow[] | null>(null);
  const [busy,       setBusy]       = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const run = async () => {
    setBusy(true); setError(null); setRows(null);
    try { setRows(await fetchSubjectExport(tenantId, subjectRef.trim())); }
    catch (e) { setError(e instanceof Error ? e.message : 'Fehler'); }
    finally { setBusy(false); }
  };

  const bundle = useMemo(
    () => (rows ? buildExportBundle(subjectRef.trim(), rows) : null),
    [rows, subjectRef],
  );

  const download = () => {
    if (!bundle) return;
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/ld+json' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dsr-export-${subjectRef.trim()}-${Date.now()}.jsonld`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const canRun = subjectRef.trim().length >= 8 && !busy;

  return (
    <Section title="DSGVO Art. 20 Export" icon={<Download className="h-4 w-4" />}>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <input
          type="text"
          value={subjectRef}
          onChange={(e) => setSubjectRef(e.target.value)}
          placeholder="subject_ref (HMAC hex, ≥ 8 Zeichen)"
          className="bg-obsidian-950 border border-titanium-900 text-titanium-100 placeholder:text-titanium-600 text-xs font-mono px-2 py-1.5 outline-none rounded-none flex-1 min-w-[300px]"
        />
        <button
          onClick={run}
          disabled={!canRun}
          className="border border-titanium-700 hover:border-security-500 bg-obsidian-900 hover:bg-obsidian-800 px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-titanium-100 disabled:opacity-50 rounded-none flex items-center gap-2"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Activity className="h-3 w-3" />}
          {busy ? 'Lade…' : 'Bundle erzeugen'}
        </button>
        <button
          onClick={download}
          disabled={!bundle}
          className="border border-titanium-700 hover:border-amber-500 bg-obsidian-900 hover:bg-obsidian-800 px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-amber-300 disabled:opacity-50 rounded-none flex items-center gap-2"
        >
          <Download className="h-3 w-3" />
          JSON-LD
        </button>
      </div>
      {error ? <ErrorRow msg={error} />
        : !rows ? <span className="text-[11px] text-titanium-500">Noch nicht ausgeführt.</span>
        : rows.length === 0 ? <NoneRow msg="Keine Events für diesen subject_ref in 90 d." />
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-mono uppercase tracking-wider text-titanium-500 border-b border-titanium-900">
                  <th className="text-right py-2 pr-3">seq</th>
                  <th className="text-left  py-2 pr-3">Type</th>
                  <th className="text-left  py-2 pr-3">Severity</th>
                  <th className="text-left  py-2 pr-3">Time (UTC)</th>
                  <th className="text-left  py-2">event_hash</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r) => (
                  <tr key={String(r.global_seq)} className="border-b border-titanium-900">
                    <td className="py-2 pr-3 text-right font-mono tabular-nums text-titanium-300">{String(r.tenant_seq)}</td>
                    <td className="py-2 pr-3 font-mono text-titanium-100">{r.type}</td>
                    <td className="py-2 pr-3 text-titanium-300">{r.severity}</td>
                    <td className="py-2 pr-3 font-mono text-[11px] text-titanium-400">{r.ts.slice(0, 19).replace('T', ' ')}</td>
                    <td className="py-2 font-mono text-[11px] text-titanium-500 truncate max-w-[200px]">{r.event_hash}</td>
                  </tr>
                ))}
                {rows.length > 50 && (
                  <tr><td colSpan={5} className="py-2 text-center text-[11px] text-titanium-500 font-mono">
                    … {rows.length - 50} weitere im Download
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
    </Section>
  );
}

// ── shared building blocks ──────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border border-titanium-900 bg-obsidian-900/60">
      <header className="px-4 py-3 border-b border-titanium-900 flex items-center gap-2">
        <span className="text-titanium-400">{icon}</span>
        <h2 className="font-display font-bold text-titanium-50 text-sm tracking-wider uppercase">
          {title}
        </h2>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border border-titanium-900 bg-obsidian-900/60 p-3">
      <div className="text-xl font-display font-bold tabular-nums text-titanium-50 truncate">{value}</div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-titanium-400 mt-0.5">{label}</div>
      {hint && <div className="text-[10px] font-mono text-titanium-500 mt-0.5">{hint}</div>}
    </div>
  );
}

function LoadingRow() {
  return (
    <div className="flex items-center gap-2 text-titanium-500 text-sm py-6 justify-center">
      <Loader2 className="h-4 w-4 animate-spin" />Lade…
    </div>
  );
}

function ErrorRow({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
      <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
      <span className="font-mono text-[12px]">{msg}</span>
    </div>
  );
}

function NoneRow({ msg }: { msg: string }) {
  return <div className="text-[11px] text-titanium-500 py-3 font-mono">{msg}</div>;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-16 border border-titanium-900 bg-obsidian-900/40">
      <ShieldCheck className="h-8 w-8 mx-auto text-titanium-600 mb-3" />
      <p className="text-sm text-titanium-400 max-w-md mx-auto">{message}</p>
    </div>
  );
}

function fmtUsd(n: number): string {
  if (Math.abs(n) >= 1000) return `$${n.toFixed(0)}`;
  if (Math.abs(n) >= 1)    return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}
