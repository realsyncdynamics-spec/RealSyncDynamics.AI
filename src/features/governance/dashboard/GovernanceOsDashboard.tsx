/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Governance OS Dashboard — Zentrale Kommandozentrale (/app)
 * Zeigt das vollständige Modul-Landschaft und Health-Score.
 * Ohne Auth: Mockdaten + "Anmelden für Echtdaten"-Banner.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Globe, Cpu, AlertTriangle, FileCheck2, Activity,
  Bot, GitMerge, FileText, Building2, ClipboardCheck,
  TrendingUp, TrendingDown, Shield,
} from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import { countOpenIncidents } from '../incidentsApi';
import { countPendingApprovals } from '../approvalsApi';
import { countOpenDsrs } from '../dsrApi';
import { fetchTenantEvents, type DbGovernanceEvent } from '../governanceApi';

// ─── Typen ─────────────────────────────────────────────────────────────────

type ModuleStatus = 'live' | 'beta' | 'roadmap';
type EvidenceType = 'Scan' | 'Screenshot' | 'Network' | 'AI' | 'Document';
type RiskSeverity = 'Kritisch' | 'Hoch';

interface ModuleDef {
  id: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
  route: string;
  status: ModuleStatus;
  metric: string;
  lastActivity: string;
  alertCount: number;
  color: string;
}

interface EvidenceItem {
  type: EvidenceType;
  title: string;
  hash: string;
  c2pa: boolean;
  ts: string;
}

interface RiskItem {
  severity: RiskSeverity;
  title: string;
  framework: string;
  route: string;
}

// ─── Daten ─────────────────────────────────────────────────────────────────

const MODULES: ModuleDef[] = [
  {
    id: 'websites',
    label: 'Websites',
    icon: Globe,
    route: '/app/websites',
    status: 'live',
    metric: '5 Domains · Score ⌀ 68',
    lastActivity: 'Scan vor 3 Min.',
    alertCount: 4,
    color: 'text-blue-400',
  },
  {
    id: 'ai-systems',
    label: 'KI-Systeme',
    icon: Cpu,
    route: '/app/ai-systems',
    status: 'live',
    metric: '11 Systeme · 2 Hochrisiko',
    lastActivity: 'Registry vor 1 Std. aktualisiert',
    alertCount: 2,
    color: 'text-purple-400',
  },
  {
    id: 'risks',
    label: 'Risiken',
    icon: AlertTriangle,
    route: '/app/risks',
    status: 'live',
    metric: '3 Kritisch · 6 Hoch',
    lastActivity: 'Neues Risk vor 2 Std.',
    alertCount: 9,
    color: 'text-red-400',
  },
  {
    id: 'evidence',
    label: 'Evidence Vault',
    icon: FileCheck2,
    route: '/app/evidence',
    status: 'live',
    metric: '1.247 Nachweise · C2PA',
    lastActivity: 'Snapshot vor 3 Min.',
    alertCount: 0,
    color: 'text-teal-400',
  },
  {
    id: 'monitoring',
    label: 'Monitoring',
    icon: Activity,
    route: '/app/monitoring',
    status: 'live',
    metric: '18 Assets · 24/7',
    lastActivity: '● Aktiv — Event vor 8s',
    alertCount: 4,
    color: 'text-green-400',
  },
  {
    id: 'agents',
    label: 'Agenten',
    icon: Bot,
    route: '/app/agents',
    status: 'live',
    metric: '15 Skills · 7 Aktiv',
    lastActivity: 'Risk Agent vor 9 Min.',
    alertCount: 0,
    color: 'text-amber-400',
  },
  {
    id: 'workflows',
    label: 'Workflows',
    icon: GitMerge,
    route: '/app/workflows',
    status: 'live',
    metric: '8 Workflows · 3 Aktiv',
    lastActivity: 'Scan-Workflow vor 3 Min.',
    alertCount: 0,
    color: 'text-indigo-400',
  },
  {
    id: 'documents',
    label: 'Dokumente',
    icon: FileText,
    route: '/app/documents',
    status: 'live',
    metric: '8 Dokumente · 2 Veraltet',
    lastActivity: 'DSE v3.2 vor 2 Tagen',
    alertCount: 2,
    color: 'text-orange-400',
  },
  {
    id: 'vendors',
    label: 'Vendors',
    icon: Building2,
    route: '/app/vendors',
    status: 'live',
    metric: '14 Vendors · 3 ohne DPA',
    lastActivity: 'Brevo AVV vor 11 Tagen',
    alertCount: 3,
    color: 'text-sky-400',
  },
  {
    id: 'audit',
    label: 'Audit Export',
    icon: ClipboardCheck,
    route: '/app/audit',
    status: 'live',
    metric: '3 Pakete · 1 signiert',
    lastActivity: 'Bundle vor 1 Tag erstellt',
    alertCount: 0,
    color: 'text-teal-400',
  },
];

const RECENT_EVIDENCE: EvidenceItem[] = [
  { type: 'Scan', title: 'Compliance-Scan abgeschlossen', hash: 'sha256:9f4a...e91c', c2pa: true, ts: 'vor 3 Min.' },
  { type: 'Screenshot', title: 'Cookie-Banner Zustand Shop', hash: 'sha256:3b7d...f20a', c2pa: true, ts: 'vor 14 Min.' },
  { type: 'Network', title: 'Meta Pixel Pre-Consent Nachweis', hash: 'sha256:8f3a...d21c', c2pa: true, ts: 'vor 2 Std.' },
  { type: 'AI', title: 'KI-Klassifizierung Empfehlung v2.3', hash: 'sha256:7c91...b44e', c2pa: true, ts: 'vor 2 Std.' },
  { type: 'Document', title: 'Evidence-Bundle WP exportiert', hash: 'sha256:a12f...09d3', c2pa: true, ts: 'vor 1 Tag' },
];

const TOP_RISKS: RiskItem[] = [
  { severity: 'Kritisch', title: 'Meta Pixel ohne Einwilligung', framework: 'DSGVO Art. 6', route: '/app/risks' },
  { severity: 'Kritisch', title: 'CV-Screening ohne Konformitätsbewertung', framework: 'EU AI Act Art. 6', route: '/app/risks' },
  { severity: 'Kritisch', title: 'Profiling ohne Rechtsgrundlage', framework: 'DSGVO Art. 22', route: '/app/risks' },
  { severity: 'Hoch', title: 'Cookie-Banner ohne Kategorien', framework: 'TTDSG §25', route: '/app/risks' },
  { severity: 'Hoch', title: 'Google Fonts US-Transfer ohne SCC', framework: 'DSGVO Art. 44', route: '/app/risks' },
];

const STATUS_PILL: Record<ModuleStatus, string> = {
  live: 'bg-teal-950/60 text-teal-400 border border-teal-900',
  beta: 'bg-amber-950/60 text-amber-400 border border-amber-900',
  roadmap: 'bg-obsidian-800 text-titanium-500 border border-titanium-900',
};

const STATUS_LABEL: Record<ModuleStatus, string> = {
  live: 'Aktiv',
  beta: 'Beta',
  roadmap: 'Roadmap',
};

const EVIDENCE_TYPE_COLOR: Record<EvidenceType, string> = {
  Scan: 'text-blue-400',
  Screenshot: 'text-purple-400',
  Network: 'text-orange-400',
  AI: 'text-teal-400',
  Document: 'text-titanium-400',
};

// ─── Sub-Komponenten ────────────────────────────────────────────────────────

function OsHeaderBar({ tenantName, dateLabel }: { tenantName: string | null; dateLabel: string }) {
  return (
    <div className="bg-obsidian-900 border-b border-titanium-900 px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        {/* Links */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-teal-400 font-mono text-xs whitespace-nowrap">● GOVERNANCE OS</span>
          <span className="text-titanium-900">|</span>
          <span className="text-titanium-100 font-mono text-sm truncate">{tenantName ?? 'Demo Workspace'}</span>
          {tenantName ? (
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 border border-titanium-700 text-titanium-400 whitespace-nowrap">Enterprise</span>
          ) : (
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 border border-titanium-700 text-titanium-400 whitespace-nowrap">Demo</span>
          )}
        </div>

        {/* Mitte */}
        <div className="hidden md:flex flex-col items-center text-center flex-shrink-0">
          <span className="text-titanium-100 font-mono text-sm font-bold tracking-widest uppercase whitespace-nowrap">
            GOVERNANCE OPERATING SYSTEM
          </span>
          <span className="text-titanium-500 font-mono text-[10px] whitespace-nowrap">
            v2026.1 · EU-souverän · DSGVO · EU AI Act
          </span>
        </div>

        {/* Rechts */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <span className="hidden sm:block text-titanium-400 font-mono text-xs">{dateLabel}</span>
          <span className="text-red-400 font-mono text-xs whitespace-nowrap">4 Aktive Alerts</span>
          <span className="text-teal-400 font-mono text-xs flex items-center gap-1 whitespace-nowrap">
            <span className="animate-pulse">●</span> Monitoring aktiv
          </span>
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  color: string;
  trend: 'up' | 'down';
  trendValue: string;
  trendPositive: boolean;
  progress?: number;
}

function MetricCard({ label, value, color, trend, trendValue, trendPositive, progress }: MetricCardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : TrendingDown;
  const trendColor = trendPositive ? 'text-teal-400' : 'text-red-400';

  return (
    <div className="bg-obsidian-900 border border-titanium-900 p-4 flex flex-col gap-2">
      <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">{label}</span>
      <span className={`font-mono text-2xl tabular-nums font-bold ${color}`}>{value}</span>
      <div className="flex items-center gap-1">
        <TrendIcon className={`w-3 h-3 ${trendColor}`} />
        <span className={`font-mono text-[10px] ${trendColor}`}>{trendValue}</span>
      </div>
      {progress !== undefined && (
        <div className="w-full h-1 bg-obsidian-800">
          <div
            className={`h-1 ${color.replace('text-', 'bg-')}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

function KeyMetrics({ activeRisks, openActions }: { activeRisks: number | null; openActions: number | null }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-titanium-900">
      <MetricCard
        label="Compliance Score"
        value="78/100"
        color="text-teal-400"
        trend="up"
        trendValue="▲ +3 diese Woche"
        trendPositive={true}
        progress={78}
      />
      <MetricCard
        label="Aktive Risiken"
        value={activeRisks !== null ? String(activeRisks) : '24'}
        color="text-red-400"
        trend="down"
        trendValue="▼ –2 seit gestern"
        trendPositive={true}
      />
      <MetricCard
        label="Offene Aktionen"
        value={openActions !== null ? String(openActions) : '11'}
        color="text-orange-400"
        trend="up"
        trendValue="▲ +4 seit gestern"
        trendPositive={false}
      />
      <MetricCard
        label="KI-Systeme"
        value="11"
        color="text-blue-400"
        trend="up"
        trendValue="▲ +1 diese Woche"
        trendPositive={false}
      />
    </div>
  );
}

function ModuleCard({ mod }: { mod: ModuleDef }) {
  const Icon = mod.icon;
  return (
    <Link
      to={mod.route}
      className="relative bg-obsidian-900/60 border border-titanium-900 p-4 flex flex-col gap-3 hover:bg-obsidian-800/60 transition-colors cursor-pointer group"
    >
      {/* Alert Badge */}
      {mod.alertCount > 0 && (
        <span className="absolute top-2 right-2 bg-red-600 text-white font-mono text-[9px] tabular-nums min-w-[16px] h-4 flex items-center justify-center px-1">
          {mod.alertCount}
        </span>
      )}

      {/* Icon + Status */}
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 border ${mod.color.replace('text-', 'border-')}/30 ${mod.color.replace('text-', 'bg-')}/10 flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${mod.color}`} />
        </div>
        <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 ${STATUS_PILL[mod.status]}`}>
          {STATUS_LABEL[mod.status]}
        </span>
      </div>

      {/* Name */}
      <div>
        <div className="text-titanium-100 text-sm font-bold font-mono">{mod.label}</div>
        <div className="text-titanium-400 text-[10px] font-mono mt-0.5">{mod.metric}</div>
      </div>

      {/* Activity + Arrow */}
      <div className="flex items-end justify-between mt-auto">
        <span className="text-titanium-500 text-[9px] font-mono">{mod.lastActivity}</span>
        <span className={`text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity ${mod.color}`}>→</span>
      </div>
    </Link>
  );
}

function ModuleLauncher() {
  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-4 h-4 text-titanium-500" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">Module</span>
        <div className="flex-1 h-px bg-titanium-900" />
        <span className="text-[10px] font-mono text-titanium-500">{MODULES.length} Module</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-titanium-900">
        {MODULES.map((mod) => (
          <ModuleCard key={mod.id} mod={mod} />
        ))}
      </div>
    </div>
  );
}

function EvidenceIcon({ type }: { type: EvidenceType }) {
  const map: Record<EvidenceType, string> = {
    Scan: 'SC',
    Screenshot: 'SS',
    Network: 'NW',
    AI: 'AI',
    Document: 'DC',
  };
  return (
    <span className={`font-mono text-[9px] tabular-nums w-8 flex-shrink-0 ${EVIDENCE_TYPE_COLOR[type]}`}>
      [{map[type]}]
    </span>
  );
}

function RecentEvidence({ items }: { items: EvidenceItem[] }) {
  return (
    <div className="bg-obsidian-900 border border-titanium-900 flex flex-col">
      <div className="px-4 py-3 border-b border-titanium-900 flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">Recent Evidence</span>
        <span className="text-[10px] font-mono text-teal-400">C2PA</span>
      </div>
      <div className="flex-1 divide-y divide-titanium-900/60">
        {items.map((item, i) => (
          <div key={i} className="px-4 py-2.5 flex items-start gap-2 hover:bg-obsidian-800/40 transition-colors">
            <EvidenceIcon type={item.type} />
            <div className="flex-1 min-w-0">
              <div className="text-titanium-100 text-xs font-mono truncate">{item.title}</div>
              <div className="text-titanium-500 text-[9px] font-mono truncate">{item.hash}</div>
            </div>
            <div className="flex-shrink-0 flex items-center gap-1.5">
              {item.c2pa && (
                <span className="text-[8px] font-mono text-teal-500 border border-teal-900 px-1">C2PA</span>
              )}
              <span className="text-titanium-500 text-[9px] font-mono whitespace-nowrap">{item.ts}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 py-2.5 border-t border-titanium-900">
        <Link to="/app/evidence" className="text-[10px] font-mono text-teal-400 hover:text-teal-300 transition-colors">
          → Evidence Vault
        </Link>
      </div>
    </div>
  );
}

const SEVERITY_DOT: Record<RiskSeverity, string> = {
  Kritisch: 'bg-red-500',
  Hoch: 'bg-orange-500',
};

const SEVERITY_TEXT: Record<RiskSeverity, string> = {
  Kritisch: 'text-red-400',
  Hoch: 'text-orange-400',
};

function ActiveRisks() {
  const risks = TOP_RISKS;
  return (
    <div className="bg-obsidian-900 border border-titanium-900 flex flex-col">
      <div className="px-4 py-3 border-b border-titanium-900 flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">Aktive Risiken</span>
        <span className="text-[10px] font-mono text-red-400">3 Kritisch · 2 Hoch</span>
      </div>
      <div className="flex-1 divide-y divide-titanium-900/60">
        {risks.map((risk, i) => (
          <Link
            key={i}
            to={risk.route}
            className="px-4 py-2.5 flex items-start gap-2.5 hover:bg-obsidian-800/40 transition-colors"
          >
            <span className={`w-1.5 h-1.5 rounded-none mt-1.5 flex-shrink-0 ${SEVERITY_DOT[risk.severity]}`} />
            <div className="flex-1 min-w-0">
              <div className="text-titanium-100 text-xs font-mono truncate">{risk.title}</div>
              <div className="text-titanium-500 text-[9px] font-mono">{risk.framework}</div>
            </div>
            <div className="flex-shrink-0 flex items-center gap-2">
              <span className={`text-[9px] font-mono ${SEVERITY_TEXT[risk.severity]}`}>{risk.severity}</span>
              <span className="text-titanium-600 text-[9px] font-mono">→</span>
            </div>
          </Link>
        ))}
      </div>
      <div className="px-4 py-2.5 border-t border-titanium-900">
        <Link to="/app/risks" className="text-[10px] font-mono text-red-400 hover:text-red-300 transition-colors">
          → Alle Risiken
        </Link>
      </div>
    </div>
  );
}

// ─── Helfer (Live-Daten) ─────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.round(h / 24);
  return `vor ${d} Tag${d === 1 ? '' : 'en'}`;
}

function eventToEvidence(ev: DbGovernanceEvent): EvidenceItem {
  const rawHash = ev.payload?.content_hash;
  const hash = typeof rawHash === 'string'
    ? rawHash
    : `sha256:${ev.id.slice(0, 4)}…${ev.id.slice(-4)}`;
  const et = (ev.event_type ?? '').toLowerCase();
  const type: EvidenceType = ev.model_name ? 'AI'
    : et.includes('document') ? 'Document'
    : et.includes('screenshot') ? 'Screenshot'
    : et.includes('network') ? 'Network'
    : 'Scan';
  return { type, title: ev.title, hash, c2pa: true, ts: relativeTime(ev.created_at) };
}


// ─── Haupt-Komponente ───────────────────────────────────────────────────────

export function GovernanceOsDashboard() {
  const { activeTenantId, tenants } = useTenant();
  const tenantName = tenants.find((t) => t.tenantId === activeTenantId)?.name ?? null;

  const [activeRisks, setActiveRisks] = useState<number | null>(null);
  const [openActions, setOpenActions] = useState<number | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>(RECENT_EVIDENCE);

  useEffect(() => {
    if (!activeTenantId) {
      setActiveRisks(null);
      setOpenActions(null);
      setEvidence(RECENT_EVIDENCE);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [incidents, approvals, dsrs, events] = await Promise.all([
          countOpenIncidents(activeTenantId),
          countPendingApprovals(activeTenantId),
          countOpenDsrs(activeTenantId),
          fetchTenantEvents(activeTenantId, 5),
        ]);
        if (cancelled) return;
        setActiveRisks(incidents);
        setOpenActions(approvals + dsrs.total);
        setEvidence(events.length > 0 ? events.map(eventToEvidence) : RECENT_EVIDENCE);
      } catch {
        // Fallback bleibt Mockdaten — Dashboard zeigt weiterhin etwas an.
      }
    })();
    return () => { cancelled = true; };
  }, [activeTenantId]);

  const dateLabel = `${new Date().toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  })} UTC`;

  return (
    <div className="flex flex-col min-h-full bg-obsidian-950">
      {/* Row 1 — OS Header Bar */}
      <OsHeaderBar tenantName={tenantName} dateLabel={dateLabel} />

      {/* Row 2 — Key Metrics */}
      <KeyMetrics activeRisks={activeRisks} openActions={openActions} />

      {/* Row 3 — Module Launcher */}
      <ModuleLauncher />

      {/* Row 4 — Two Columns */}
      <div className="px-4 lg:px-6 pb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentEvidence items={evidence} />
        <ActiveRisks />
      </div>

      {/* Demo Banner */}
      {!activeTenantId && (
        <div className="mx-4 lg:mx-6 mb-6 border border-teal-900 bg-teal-950/30 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-titanium-100 font-semibold">Demo-Ansicht · Mockdaten</p>
            <p className="text-xs text-titanium-400 font-mono">Anmelden für Echtdaten aus Ihrem Workspace</p>
          </div>
          <Link
            to="/welcome"
            className="border border-teal-600 text-teal-300 text-xs font-mono px-4 py-2 hover:bg-teal-900/40 transition-colors"
          >
            → Anmelden
          </Link>
        </div>
      )}
    </div>
  );
}
