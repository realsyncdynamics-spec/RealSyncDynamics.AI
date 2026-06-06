// WorkspaceHome — kanonisches Status-Home (/app) des Governance OS (P0).
//
// Ersetzt den Chat als Post-Login-Einstieg: Status-first, in 3 Sekunden
// erfassbar. Nutzt ausschliesslich vorhandene, RLS-gescopte Count-Helfer —
// keine erfundenen Daten. Kacheln verlinken in die bestehenden Views.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ClipboardCheck, UserCheck, FileCheck2, Inbox,
  Globe, Bot, Activity, ArrowRight, Loader2, Plus, Search, ShieldCheck,
} from 'lucide-react';
import { AuthGate } from '../kodee/connections/AuthGate';
import { useTenant } from '../../core/access/TenantProvider';
import { WorkspaceShell } from './WorkspaceShell';
import { countOpenDpias } from '../governance/dpiasApi';
import { countOpenDsrs } from '../governance/dsrApi';
import { countPendingApprovals } from '../governance/approvalsApi';
import { countOpenIncidents } from '../governance/incidentsApi';
import { countVendorsNoDpa } from '../governance/vendorsApi';
import { DsgvoControlPackPanel } from '../governance/dsgvo-control-pack/DsgvoControlPackPanel';
import { DEMO_CONTROL_SIGNALS } from '../governance/dsgvo-control-pack/dsgvoControlPackDemo';

interface Counts {
  incidents: number;
  dpias: number;
  dsr: { total: number; overdue: number };
  approvals: number;
  vendorsNoDpa: number;
}

export function WorkspaceHome() {
  return (
    <AuthGate>
      {() => (
        <WorkspaceShell title="Übersicht">
          <Inner />
        </WorkspaceShell>
      )}
    </AuthGate>
  );
}

function Inner() {
  const { activeTenantId, tenants } = useTenant();
  const tenantName = tenants.find((t) => t.tenantId === activeTenantId)?.name ?? null;
  const [counts, setCounts] = useState<Counts | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!activeTenantId) { setCounts(null); return; }
    setCounts(null); setError(null);
    (async () => {
      try {
        const [incidents, dpias, dsr, approvals, vendorsNoDpa] = await Promise.all([
          countOpenIncidents(activeTenantId),
          countOpenDpias(activeTenantId),
          countOpenDsrs(activeTenantId),
          countPendingApprovals(activeTenantId),
          countVendorsNoDpa(activeTenantId),
        ]);
        if (!cancelled) setCounts({ incidents, dpias, dsr, approvals, vendorsNoDpa });
      } catch (e) {
        if (!cancelled) setError((e as Error)?.message ?? String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [activeTenantId]);

  const inboxTotal = counts ? counts.approvals + counts.dsr.overdue + counts.incidents : 0;
  // Transparenter Self-Assessment-Score aus den BEREITS geladenen Counts —
  // keine zusätzlichen Fetches, keine erfundenen Zahlen. Gewichtung: überfällige
  // DSR und offene Vorfälle wiegen am schwersten. 100 = nichts offen.
  const score = computeComplianceScore(counts);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* Begrüßung + Schnellaktionen */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl text-titanium-50 tracking-tight">
            {tenantName ? `Governance · ${tenantName}` : 'Governance-Übersicht'}
          </h2>
          <p className="text-sm text-titanium-400 mt-1">Status, offene Aufgaben und Objekte auf einen Blick.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <QuickAction to="/audit?source=workspace" icon={Plus} label="Website hinzufügen" primary />
          <QuickAction to="/governance/agents" icon={Bot} label="KI-System erfassen" />
          <QuickAction to="/governance/reports" icon={FileCheck2} label="Report exportieren" />
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-rose-300 bg-rose-950/40 border border-rose-900 p-3">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {/* Compliance-Score (Self-Assessment, aus offenen Posten abgeleitet) */}
      <ScoreCard score={score} loading={!counts} />

      {/* Aktions-Inbox (Linear-artig) */}
      <section className="border border-titanium-800 bg-obsidian-900">
        <div className="flex items-center justify-between px-4 py-3 border-b border-titanium-900">
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-cyan-300" />
            <span className="font-display font-semibold text-titanium-50 text-sm">Aktions-Inbox</span>
            {counts && inboxTotal > 0 && (
              <span className="font-mono text-[11px] text-obsidian-950 bg-cyan-400 px-1.5 py-0.5">{inboxTotal}</span>
            )}
          </div>
        </div>
        <div className="divide-y divide-titanium-900">
          <InboxRow to="/governance/approvals" label="Offene Freigaben" count={counts?.approvals} loading={!counts} icon={UserCheck} />
          <InboxRow to="/governance/dsr" label="Überfällige Betroffenenanfragen (DSR)" count={counts?.dsr.overdue} loading={!counts} icon={ClipboardCheck} severity={!!counts?.dsr.overdue} />
          <InboxRow to="/governance/incidents" label="Offene Vorfälle / Meldefristen" count={counts?.incidents} loading={!counts} icon={AlertTriangle} severity={!!counts?.incidents} />
        </div>
      </section>

      {/* Status-Kacheln */}
      <section>
        <h3 className="font-display font-semibold text-titanium-50 text-sm mb-3">Status</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-titanium-900">
          <Tile to="/governance/incidents" icon={AlertTriangle} label="Offene Risiken" value={counts?.incidents} loading={!counts} accent="rose" />
          <Tile to="/governance/dpias" icon={ClipboardCheck} label="Offene DSFA" value={counts?.dpias} loading={!counts} accent="cyan" />
          <Tile to="/governance/dsr" icon={ClipboardCheck} label="DSR offen" value={counts?.dsr.total} sub={counts?.dsr.overdue ? `${counts.dsr.overdue} überfällig` : undefined} loading={!counts} accent="amber" />
          <Tile to="/governance/vendors" icon={UserCheck} label="Vendoren ohne DPA" value={counts?.vendorsNoDpa} loading={!counts} accent="amber" />
        </div>
      </section>

      {/* DSGVO Control Pack — Post-Market Monitoring */}
      <DsgvoControlPackPanel signals={DEMO_CONTROL_SIGNALS} />

      {/* Objekte */}
      <section>
        <h3 className="font-display font-semibold text-titanium-50 text-sm mb-3">Objekte & Bereiche</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-titanium-900">
          <NavCard to="/app/websites" icon={Globe} title="Websites" body="Domains, Cookies, Vendoren, Monitoring, Evidence." />
          <NavCard to="/app/ai-systems" icon={Bot} title="KI-Systeme" body="Inventar, Klassifizierung, Dokumentation, Drift." />
          <NavCard to="/app/evidence" icon={FileCheck2} title="Evidence" body="Nachweise, Reports, Audit-Trail, Exporte." />
          <NavCard to="/app/compliance" icon={ClipboardCheck} title="Compliance" body="DSGVO, AI Act, VVT, TOM, DSFA, DSR." />
          <NavCard to="/app/monitoring" icon={Activity} title="Monitoring" body="Live-Scans, Drift, Alerts." />
          <NavCard to="/app/risks" icon={Search} title="Risiken" body="Findings, Vorfälle, Vendor-Risiken priorisiert." />
        </div>
      </section>
    </div>
  );
}

// ─── Compliance-Score (Self-Assessment) ─────────────────────────────
// Reine Ableitung aus offenen Posten — KEIN externer Anspruch, KEINE
// Zertifizierungs-Behauptung. 100 = keine offenen Posten. Gewichte:
// überfällige DSR (−12) und offene Vorfälle (−10) am schwersten, offene
// DSFA (−5), Vendoren ohne DPA (−4), offene Freigaben (−3). Clamp 0..100.
function computeComplianceScore(counts: Counts | null): number | null {
  if (!counts) return null;
  const penalty =
    counts.dsr.overdue * 12 +
    counts.incidents * 10 +
    counts.dpias * 5 +
    counts.vendorsNoDpa * 4 +
    counts.approvals * 3;
  return Math.max(0, Math.min(100, 100 - penalty));
}

function scoreLabel(score: number): string {
  if (score >= 90) return 'Sehr gut';
  if (score >= 75) return 'Gut';
  if (score >= 50) return 'Verbesserungsbedarf';
  return 'Handlungsbedarf';
}

function ScoreCard({ score, loading }: { score: number | null; loading: boolean }) {
  const accent = score === null ? 'text-titanium-600'
    : score >= 75 ? 'text-emerald-300'
    : score >= 50 ? 'text-amber-300' : 'text-rose-300';
  return (
    <section className="border border-titanium-800 bg-obsidian-900 p-5 flex flex-wrap items-center gap-x-8 gap-y-3">
      <div className="flex items-center gap-3">
        <ShieldCheck className={`h-7 w-7 ${accent}`} />
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display font-semibold text-titanium-50 text-sm">Compliance-Status</span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 border border-titanium-800 px-1.5 py-0.5">Self-Assessment</span>
          </div>
          <p className="text-xs text-titanium-400 mt-0.5">Aus offenen Vorfällen, Fristen, DSFA, DPAs und Freigaben abgeleitet.</p>
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        {loading || score === null
          ? <Loader2 className="h-7 w-7 animate-spin text-titanium-600" />
          : <>
              <span className={`font-display font-bold text-4xl tabular-nums ${accent}`}>{score}</span>
              <span className="text-sm text-titanium-500">/ 100</span>
              <span className="text-xs text-titanium-400 ml-2">{scoreLabel(score)}</span>
            </>}
      </div>
      <Link to="/app/compliance" className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-300 ml-auto">
        Compliance öffnen <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}

// ─── Bausteine ───────────────────────────────────────────────────────

function QuickAction({ to, icon: Icon, label, primary }: { to: string; icon: typeof Plus; label: string; primary?: boolean }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold transition-colors ${
        primary
          ? 'bg-cyan-400 text-obsidian-950 hover:bg-cyan-300'
          : 'border border-titanium-700 text-titanium-200 hover:border-titanium-500'
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );
}

function InboxRow({ to, label, count, loading, icon: Icon, severity }: { to: string; label: string; count?: number; loading: boolean; icon: typeof Inbox; severity?: boolean }) {
  return (
    <Link to={to} className="flex items-center justify-between px-4 py-3 hover:bg-obsidian-800 transition-colors">
      <span className="flex items-center gap-2.5 text-sm text-titanium-200">
        <Icon className={`h-4 w-4 ${severity ? 'text-rose-300' : 'text-titanium-500'}`} /> {label}
      </span>
      <span className="flex items-center gap-2">
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-titanium-600" />
          : <span className={`font-mono text-sm tabular-nums ${count ? (severity ? 'text-rose-300' : 'text-titanium-100') : 'text-titanium-600'}`}>{count ?? 0}</span>}
        <ArrowRight className="h-3.5 w-3.5 text-titanium-600" />
      </span>
    </Link>
  );
}

const ACCENT: Record<string, string> = {
  rose: 'text-rose-300', cyan: 'text-cyan-300', amber: 'text-amber-300',
};

function Tile({ to, icon: Icon, label, value, sub, loading, accent }: { to: string; icon: typeof AlertTriangle; label: string; value?: number; sub?: string; loading: boolean; accent: keyof typeof ACCENT }) {
  return (
    <Link to={to} className="bg-obsidian-900 p-5 hover:bg-obsidian-800 transition-colors">
      <Icon className={`h-5 w-5 mb-3 ${ACCENT[accent]}`} />
      <div className="font-display font-bold text-3xl tabular-nums text-titanium-50">
        {loading ? <Loader2 className="h-6 w-6 animate-spin text-titanium-600" /> : (value ?? 0)}
      </div>
      <div className="text-xs text-titanium-400 mt-1">{label}</div>
      {sub && <div className="text-[11px] text-rose-300 mt-0.5">{sub}</div>}
    </Link>
  );
}

function NavCard({ to, icon: Icon, title, body }: { to: string; icon: typeof Globe; title: string; body: string }) {
  return (
    <Link to={to} className="bg-obsidian-900 p-5 hover:bg-obsidian-800 transition-colors flex flex-col">
      <Icon className="h-5 w-5 text-cyan-300 mb-3" />
      <div className="font-display font-semibold text-titanium-50">{title}</div>
      <p className="text-sm text-titanium-400 mt-1 flex-1">{body}</p>
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-300 mt-3">Öffnen <ArrowRight className="h-3.5 w-3.5" /></span>
    </Link>
  );
}
