import { Link } from 'react-router-dom';
import {
  Activity, ArrowRight, Bot, ChevronRight, ClipboardCheck,
  FileCheck2, Globe, LayoutDashboard, RefreshCw, ShieldCheck,
  Sparkles, Workflow,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AiCommandComposer } from '../../ai-home/AiCommandComposer';
import type { CockpitData } from '../cockpit/cockpitData';
import type { StartPanelInput, StartPanelModel } from './startPanelModel';

interface DashboardOverviewProps {
  tenantName: string | null;
  hasTenant: boolean;
  facts: StartPanelInput;
  model: StartPanelModel;
  data: CockpitData | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

interface Metric {
  label: string;
  value: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

const ACCESS: ReadonlyArray<{ title: string; detail: string; href: string; icon: LucideIcon }> = [
  { title: 'Websites & Scans', detail: 'Domains, Audits und Befunde', href: '/app/websites', icon: Globe },
  { title: 'KI-Agenten', detail: 'Agenten und Ausführungen', href: '/app/agents', icon: Bot },
  { title: 'Automationen', detail: 'Workflows und Routinen', href: '/app/workflows', icon: Workflow },
  { title: 'Website erstellen', detail: 'Builder und individuelle Designs', href: '/build', icon: LayoutDashboard },
  { title: 'Risiken & Maßnahmen', detail: 'Offene Pflichten bearbeiten', href: '/app/risks', icon: ClipboardCheck },
  { title: 'Evidence Vault', detail: 'Nachweise und Prüfpfade', href: '/app/evidence', icon: FileCheck2 },
];

function metricValue(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '—';
}

function metrics(facts: StartPanelInput, data: CockpitData | null): Metric[] {
  // Unknown and failed sources must never be presented as zero.
  const evidenceUnavailable = !data || data.partialFailures.some((f) => f.startsWith('evidence-total:'));
  const alertUnavailable = !data?.summary24h || data.partialFailures.some((f) => f.startsWith('summary24h:'));
  return [
    { label: 'Websites', value: metricValue(facts.websiteCount), href: '/app/websites', icon: Globe, description: 'Erfasste Domains' },
    { label: 'KI-Systeme', value: metricValue(facts.aiSystemCount), href: '/app/ai-systems', icon: Bot, description: 'Im Register' },
    { label: 'Governance-Score', value: data?.scoreStatus === 'ok' ? `${metricValue(data.score)} / 100` : '—', href: '/app/risks', icon: ShieldCheck, description: 'Keine Zertifizierung' },
    { label: 'Evidence', value: metricValue(evidenceUnavailable ? null : data.evidenceHealth.totalCount), href: '/app/evidence', icon: FileCheck2, description: 'Erfasste Nachweise' },
    { label: 'Offene Alerts', value: metricValue(alertUnavailable ? null : data.summary24h?.open_alerts), href: '/app/alerts', icon: Activity, description: 'Monitoring-Signale' },
  ];
}

/**
 * The new dashboard canvas is AI-first. The existing CommandCenterDashboard
 * still owns and loads all real RLS-scoped data and retains its established
 * onboarding, billing, compliance and runtime panels below this overview.
 */
export function AiOsDashboardOverview({
  tenantName, hasTenant, facts, model, data, loading, error, onRetry,
}: DashboardOverviewProps) {
  const cards = metrics(facts, data);
  const failures = data?.partialFailures.length ?? 0;
  const next = model.primary;
  return (
    <div className="mx-auto w-full max-w-[1480px] px-4 pb-7 pt-7 sm:px-6 lg:px-8" data-testid="ai-os-dashboard-overview">
      <section aria-labelledby="ai-dashboard-headline" className="mx-auto flex w-full max-w-3xl flex-col items-center py-10 text-center sm:py-14">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-titanium-800 bg-obsidian-900 px-4 py-2 text-xs tracking-wide text-titanium-300">
          <Sparkles className="h-4 w-4 text-[#00B8D4]" aria-hidden="true" />
          <span>RealSync AI OS</span>
          {tenantName && <span className="max-w-44 truncate text-titanium-500">· {tenantName}</span>}
        </div>
        <h1 id="ai-dashboard-headline" className="text-3xl font-semibold tracking-tight text-titanium-50 sm:text-4xl lg:text-5xl">
          Was möchtest du heute erledigen?
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-titanium-400 sm:text-base">
          Dein Arbeitsbereich für Governance, Websites, KI-Agenten und Automationen.
          Die KI unterstützt dich direkt in den Anwendungen.
        </p>
        <div className="mt-8 w-full text-left">
          <AiCommandComposer compact />
        </div>
        <p className="mt-3 text-xs text-titanium-500">
          Dein Text öffnet den Assistenten. Gesendet wird erst nach deiner Bestätigung.
        </p>
      </section>

      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-titanium-50">Dein Workspace auf einen Blick</h2>
          <p className="mt-1 text-xs text-titanium-400">Nur echte, mandantenbezogene Daten · Unbekannt bedeutet nicht null.</p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg border border-titanium-700 px-3 py-2 text-sm text-titanium-200 hover:bg-obsidian-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Aktualisieren
        </button>
      </div>

      {!hasTenant && (
        <div role="status" className="mb-5 rounded-xl border border-titanium-700 bg-obsidian-900 px-5 py-4 text-sm text-titanium-300">
          Noch kein Workspace ausgewählt. <Link to="/welcome?next=/app/dashboard" className="underline underline-offset-4">Workspace einrichten</Link>
        </div>
      )}
      {error && (
        <div role="alert" className="mb-5 rounded-xl border border-rose-500/40 bg-rose-950/20 px-5 py-4 text-sm text-rose-200">
          Dashboard-Daten derzeit nicht verfügbar. <span className="break-words">{error}</span>
        </div>
      )}
      {failures > 0 && (
        <div role="status" className="mb-5 rounded-xl border border-amber-600/40 bg-amber-950/20 px-5 py-4 text-sm text-amber-200" data-testid="dashboard-partial-data">
          {failures} Datenquelle{failures === 1 ? '' : 'n'} derzeit nicht verfügbar. Betroffene Kennzahlen bitte in der Detailansicht prüfen.
        </div>
      )}

      <section aria-label="Live-Status" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" data-testid="ai-dashboard-metrics">
        {cards.map(({ label, value, href, icon: Icon, description }) => (
          <Link key={href + label} to={href} className="group min-w-0 rounded-xl border border-titanium-800 bg-obsidian-900/80 p-4 transition-colors hover:border-titanium-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-titanium-400">{label}</span>
              <Icon className="h-4 w-4 text-titanium-500 group-hover:text-cyan-300" aria-hidden="true" />
            </div>
            <p className="mt-4 text-2xl font-semibold tabular-nums text-titanium-50" data-testid={`ai-metric-${label}`}>{loading && !data && value === '—' ? '—' : value}</p>
            <p className="mt-1 text-xs text-titanium-500">{description}</p>
          </Link>
        ))}
      </section>

      <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <section aria-labelledby="dashboard-tools-title">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 id="dashboard-tools-title" className="text-lg font-semibold text-titanium-50">Anwendungen öffnen</h2>
            <Link to="/app/modules" className="inline-flex items-center gap-1 text-sm text-cyan-300 hover:underline">
              Alle Module <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <nav aria-label="Anwendungen" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ACCESS.map(({ title, detail, href, icon: Icon }) => (
              <Link key={href} to={href} className="group flex min-w-0 flex-col gap-3 rounded-xl border border-titanium-800 bg-obsidian-900/70 p-5 transition-colors hover:border-cyan-500/50 hover:bg-obsidian-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">
                <div className="flex items-center justify-between">
                  <Icon className="h-5 w-5 text-cyan-300" aria-hidden="true" />
                  <ArrowRight className="h-4 w-4 text-titanium-500 group-hover:text-titanium-100" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-semibold text-titanium-50">{title}</h3>
                  <p className="mt-1 text-xs leading-5 text-titanium-400">{detail}</p>
                </div>
              </Link>
            ))}
          </nav>
        </section>

        <aside aria-labelledby="dashboard-next-title" className="self-start rounded-xl border border-titanium-800 bg-obsidian-900/80 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="dashboard-next-title" className="text-base font-semibold text-titanium-50">Nächster Schritt</h2>
            <span className="text-xs text-titanium-400">{model.doneCount} / {model.totalCount} erledigt</span>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-titanium-800" role="progressbar" aria-label="Einrichtung" aria-valuenow={model.doneCount} aria-valuemin={0} aria-valuemax={model.totalCount}>
            <div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.round(100 * model.doneCount / Math.max(1, model.totalCount))}%` }} />
          </div>
          <p className="mt-5 text-xs uppercase tracking-wider text-titanium-500">{model.maturity}</p>
          <h3 className="mt-2 text-base font-semibold text-titanium-100">
            {next?.headline ?? (model.pending ? 'Workspace-Status wird geprüft …' : 'Noch kein nächster Schritt verfügbar')}
          </h3>
          <p className="mt-2 text-sm leading-6 text-titanium-400">
            {next?.detail ?? 'Sobald Daten verfügbar sind, erscheinen hier die nächsten sinnvollen Aufgaben.'}
          </p>
          {next && (
            <Link to={next.href} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#00B8D4] px-4 py-2.5 text-sm font-semibold text-obsidian-950 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" data-testid="ai-dashboard-next-action">
              {next.cta} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
          <div className="mt-6 border-t border-titanium-800 pt-4">
            <Link to="/app/actions" className="flex items-center justify-between gap-3 text-sm text-titanium-300 hover:text-white">
              Maßnahmen und Freigaben ansehen <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
