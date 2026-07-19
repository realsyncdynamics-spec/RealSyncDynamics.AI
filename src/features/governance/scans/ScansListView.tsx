/**
 * Scans list — Pilot-customer surface for `/governance/scans`.
 *
 * Shows the active tenant's scan_runs, most-recent-first. Each row
 * links to /governance/scans/:id for the detail view. AuthGate +
 * TenantGate; no writes; deny-by-default RLS does the scoping.
 *
 * Reads from PR 1/2 tables (scan_runs + findings). Score / grade
 * NOT computed here — the list view shows the denormalized
 * finding_count + severity_max from the row, computed by the
 * scan-pipeline adapter at completeScanRun time (PR 2).
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, AlertTriangle, Loader2, CheckCircle2, XCircle, Clock, Plus, Play,
} from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import { AuthGate } from '../../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from '../../../lib/hoc';
import {
  listScanRuns, listWebsitesForTenant, addWebsiteForTenant,
  triggerTenantAudit, type TenantWebsite,
} from './scansApi';
import type { ScanRun } from '../../../types/governance/scan-run';
import { SEVERITY_PALETTE } from '../../../lib/governance/severityPalette';

const SEVERITY_COLOR: Record<string, string> = {
  critical: SEVERITY_PALETTE.critical.text,
  high:     SEVERITY_PALETTE.high.text,
  medium:   SEVERITY_PALETTE.medium.text,
  low:      SEVERITY_PALETTE.low.text,
  info:     SEVERITY_PALETTE.info.text,
};

const STATUS_BADGE: Record<ScanRun['status'], { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  queued:    { label: 'Wartend',    cls: 'border-titanium-700 text-titanium-300', Icon: Clock },
  running:   { label: 'Läuft',      cls: 'border-sky-500/40 text-sky-300',         Icon: Loader2 },
  completed: { label: 'Abgeschlossen', cls: 'border-emerald-500/40 text-emerald-300', Icon: CheckCircle2 },
  failed:    { label: 'Fehlgeschlagen', cls: 'border-rose-500/40 text-rose-300', Icon: XCircle },
  cancelled: { label: 'Abgebrochen', cls: 'border-titanium-700 text-titanium-400', Icon: XCircle },
};


function _ScansListView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const ScansListView = withPerformanceMonitoring(
  _ScansListView,
  'ScansListView',
  { threshold: 500, maxRenders: 10 }
);

function Inner() {
  const { activeTenantId } = useTenant();

  if (!activeTenantId) {
    return (
      <EmptyShell title="Kein aktiver Workspace">
        Bitte zuerst einen Workspace auswählen, um Scans zu sehen.
      </EmptyShell>
    );
  }
  return <ScansList tenantId={activeTenantId} />;
}

function ScansList({ tenantId }: { tenantId: string }) {
  const [rows, setRows] = useState<ScanRun[] | null>(null);
  const [websites, setWebsites] = useState<TenantWebsite[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [r, w] = await Promise.all([
        listScanRuns(tenantId, { limit: 50 }),
        listWebsitesForTenant(tenantId),
      ]);
      setRows(r);
      setWebsites(w);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [tenantId]);

  useEffect(() => {
    setRows(null); setWebsites(null); setError(null);
    void refresh();
  }, [refresh]);

  if (error) {
    return (
      <EmptyShell title="Fehler beim Laden">
        <span className="text-rose-300">{error}</span>
      </EmptyShell>
    );
  }
  if (rows === null || websites === null) {
    return (
      <EmptyShell title="Lade Workspace…">
        <Loader2 className="h-4 w-4 animate-spin inline-block" />
      </EmptyShell>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <Header />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div>
          <h1 className="font-display font-bold text-2xl tracking-tight text-titanium-50 mb-1">
            Scans
          </h1>
          <p className="text-sm text-titanium-400">
            Liste der zuletzt durchgeführten Compliance-Scans für den aktiven Workspace.
          </p>
        </div>

        <WebsitesSection
          tenantId={tenantId}
          websites={websites}
          onChange={() => { void refresh(); }}
        />

        <div>
          <h2 className="font-display font-semibold text-titanium-50 mb-3">Scan-Läufe</h2>
          {rows.length === 0 ? (
            <div className="border border-titanium-800 bg-obsidian-900 p-8 text-center">
              <AlertTriangle className="h-6 w-6 text-amber-400 mx-auto mb-3" />
              <h3 className="font-display font-semibold text-titanium-50 mb-1">Noch keine Scans</h3>
              <p className="text-sm text-titanium-400 mb-4">
                Trage oben eine Website ein und drücke „Scan starten" — der Lauf erscheint dann hier.
              </p>
              <Link
                to="/audit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm border border-titanium-700 text-titanium-100 font-medium hover:border-titanium-500 transition-colors"
              >
                Stattdessen anonymen Audit ausprobieren <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => <ScanRow key={r.id} run={r} />)}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

// ─── Websites-Sektion (Hinzufügen + Scan-Trigger) ──────────────────

function WebsitesSection({
  tenantId, websites, onChange,
}: {
  tenantId: string;
  websites: TenantWebsite[];
  onChange: () => void;
}) {
  const [domainInput, setDomainInput] = useState('');
  const [busy, setBusy] = useState<'idle' | 'adding' | string>('idle');
  const [err, setErr] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!domainInput.trim()) return;
    setBusy('adding'); setErr(null);
    try {
      await addWebsiteForTenant(tenantId, domainInput);
      setDomainInput('');
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('idle');
    }
  }

  async function handleScan(site: TenantWebsite) {
    setBusy(`scan-${site.id}`); setErr(null);
    try {
      const url = site.domain.startsWith('http') ? site.domain : `https://${site.domain}`;
      await triggerTenantAudit(tenantId, url, { website_id: site.id });
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('idle');
    }
  }

  return (
    <section>
      <h2 className="font-display font-semibold text-titanium-50 mb-3">Websites</h2>

      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2 mb-3">
        <input
          type="text"
          value={domainInput}
          onChange={(e) => setDomainInput(e.target.value)}
          placeholder="z. B. shop.kunde-1.de"
          className="flex-1 bg-obsidian-900 border border-titanium-800 px-3 py-2 text-sm text-titanium-100 placeholder-titanium-500 focus:border-cyan-400 focus:outline-none"
          aria-label="Domain hinzufügen"
        />
        <button
          type="submit"
          disabled={busy === 'adding' || !domainInput.trim()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm bg-cyan-400 text-obsidian-950 font-semibold hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {busy === 'adding' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Website hinzufügen
        </button>
      </form>

      {err ? (
        <div className="mb-3 border border-rose-500/40 bg-rose-500/10 text-rose-200 text-sm p-2">
          {err}
        </div>
      ) : null}

      {websites.length === 0 ? (
        <div className="border border-titanium-800 bg-obsidian-900 p-4 text-sm text-titanium-400">
          Noch keine Website erfasst. Trage oben eine Domain ein, um den ersten Scan zu starten.
        </div>
      ) : (
        <ul className="space-y-2">
          {websites.map((w) => {
            const scanning = busy === `scan-${w.id}`;
            return (
              <li key={w.id} className="border border-titanium-800 bg-obsidian-900 p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-sm text-titanium-100 truncate">{w.domain}</div>
                  <div className="text-[10px] uppercase tracking-wider text-titanium-500 mt-0.5">
                    {w.plan_tier} · {w.status}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleScan(w)}
                  disabled={scanning}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-titanium-700 text-titanium-100 hover:border-titanium-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  Scan starten
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ScanRow({ run }: { run: ScanRun }) {
  const badge = STATUS_BADGE[run.status];
  const sev = run.severity_max ?? 'info';
  return (
    <li>
      <Link
        to={`/governance/scans/${run.id}`}
        className="block border border-titanium-800 bg-obsidian-900 hover:border-titanium-600 transition-colors p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase font-mono tracking-wider border ${badge.cls}`}>
                <badge.Icon className={`h-3 w-3 ${run.status === 'running' ? 'animate-spin' : ''}`} />
                {badge.label}
              </span>
              <span className="text-xs text-titanium-400 font-mono">{run.detector}</span>
            </div>
            <div className="font-mono text-[11px] text-titanium-500">{run.id}</div>
            <div className="text-[11px] text-titanium-500 mt-1">
              {formatRelative(run.created_at)}
              {run.duration_ms !== null ? ` · Dauer: ${formatDuration(run.duration_ms)}` : ''}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-display font-bold text-2xl tabular-nums text-titanium-50">
              {run.finding_count}
            </div>
            <div className="text-[10px] text-titanium-500 uppercase tracking-wider">
              {run.finding_count === 1 ? 'Befund' : 'Befunde'}
            </div>
            {run.severity_max ? (
              <div className={`text-[10px] uppercase tracking-wider mt-1 ${SEVERITY_COLOR[sev] ?? ''}`}>
                max: {run.severity_max}
              </div>
            ) : null}
          </div>
        </div>
      </Link>
    </li>
  );
}

function Header() {
  return (
    <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
      <Link
        to="/"
        className="p-1.5 hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3"
        aria-label="Zurück zur Startseite"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <h1 className="font-display font-bold text-sm tracking-tight text-titanium-50">
        Governance · Scans
      </h1>
    </header>
  );
}

function EmptyShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-12 text-center">
        <h2 className="font-display font-semibold text-titanium-50 mb-2">{title}</h2>
        <div className="text-sm text-titanium-400">{children}</div>
      </main>
    </div>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'gerade eben';
  if (mins < 60) return `vor ${mins} Min.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `vor ${days} Tag${days === 1 ? '' : 'en'}`;
  return d.toLocaleDateString('de-DE');
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms / 60_000)} min`;
}
