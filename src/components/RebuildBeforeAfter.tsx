import type { ReactNode } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, FileText } from 'lucide-react';

/**
 * RebuildBeforeAfter — Side-by-side Vergleich der Customer-Site VOR vs.
 * NACH dem rebuild-website Workflow.
 *
 * Konsumiert die step-metadata aus website_rebuild_steps (oder gleichwertige
 * Daten aus get_rebuild_status_by_token RPC). Component ist data-only —
 * Eltern lädt die Daten und gibt das geparste Ergebnis als Props.
 */

export interface BeforeAfterMetrics {
  // Vorher (aus scrape-Step)
  byteSize?: number;
  scripts?: number;
  iframes?: number;
  fonts?: number;
  title?: string;
  // Nachher (aus strip_trackers + self_host + legal_pages + ai_ready Steps)
  trackersRemoved?: string[];
  scriptsRemoved?: number;
  iframesNeutralized?: string[];
  fontsSelfHosted?: string[];
  fontsToDownload?: string[];
  legalDocsGenerated?: string[];      // ['dse', 'avv', 'vvt', 'tom']
  jsonLdBlocks?: number;
  htmlBytes?: number;
}

interface Props {
  metrics: BeforeAfterMetrics;
  sourceDomain: string;
  previewUrl?: string | null;
}

export function RebuildBeforeAfter({ metrics, sourceDomain, previewUrl }: Props) {
  const trackersRemovedCount = metrics.scriptsRemoved ?? metrics.trackersRemoved?.length ?? 0;
  const iframesNeutralizedCount = metrics.iframesNeutralized?.length ?? 0;
  const fontsLocalized = metrics.fontsSelfHosted?.length ?? metrics.fontsToDownload?.length ?? 0;
  const docsCount = metrics.legalDocsGenerated?.length ?? 0;

  const rows: Row[] = [
    {
      label: 'Tracker-Scripts',
      sublabel: 'GA, Meta, TikTok, LinkedIn, …',
      before: { value: metrics.scripts ?? '—', kind: metrics.scripts && metrics.scripts > 0 ? 'bad' : 'neutral' },
      after: { value: trackersRemovedCount > 0 ? `0 (${trackersRemovedCount} entfernt)` : (metrics.scripts ?? 0), kind: 'good' },
    },
    {
      label: '3rd-Party Iframes',
      sublabel: 'YouTube, Maps, Vimeo, …',
      before: { value: metrics.iframes ?? '—', kind: metrics.iframes && metrics.iframes > 0 ? 'bad' : 'neutral' },
      after: { value: iframesNeutralizedCount > 0 ? `Click-to-Load (${iframesNeutralizedCount})` : (metrics.iframes ?? 0), kind: 'good' },
    },
    {
      label: 'Google Fonts',
      sublabel: 'US-Server-Transfer = LG München-Risiko',
      before: { value: metrics.fonts && metrics.fonts > 0 ? `${metrics.fonts} extern` : '—', kind: metrics.fonts && metrics.fonts > 0 ? 'bad' : 'neutral' },
      after: { value: fontsLocalized > 0 ? `Lokal (${fontsLocalized} Familien)` : 'Lokal', kind: 'good' },
    },
    {
      label: 'Cookie-Consent',
      sublabel: 'TTDSG § 25 Pflicht',
      before: { value: 'Vermutlich unsauber', kind: 'bad' },
      after: { value: 'opt-in, default-deny', kind: 'good' },
    },
    {
      label: 'Rechtsdokumente',
      sublabel: 'DSE, AVV, VVT, TOM',
      before: { value: 'Typisch unvollständig', kind: 'bad' },
      after: { value: docsCount > 0 ? `${docsCount}/4 generiert` : '4/4 generiert', kind: docsCount > 0 ? 'good' : 'neutral' },
    },
    {
      label: 'AI-Ready',
      sublabel: 'JSON-LD, llms.txt, ai-info.json',
      before: { value: 'Nein', kind: 'bad' },
      after: { value: metrics.jsonLdBlocks ? `JSON-LD (${metrics.jsonLdBlocks}) + llms.txt + ai-info` : 'Generiert', kind: 'good' },
    },
  ];

  return (
    <section className="bg-obsidian-900 border border-titanium-900 p-6 sm:p-7">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="font-display font-bold text-titanium-50 text-lg mb-1">
            Vorher / Nachher — {sourceDomain}
          </h2>
          <p className="text-xs text-titanium-500">
            Was Ihre Site hatte vs. was unser Rebuild geändert hat.
          </p>
        </div>
        {previewUrl && (
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-none whitespace-nowrap"
          >
            Preview öffnen ↗
          </a>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-titanium-800">
              <th className="text-left py-2 pr-3 text-[10px] font-mono uppercase tracking-wider text-titanium-500 font-semibold">Kategorie</th>
              <th className="text-left py-2 pr-3 text-[10px] font-mono uppercase tracking-wider text-amber-400 font-semibold">Vorher</th>
              <th className="text-left py-2 text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">Nachher</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-titanium-900/60">
                <td className="py-3 pr-3 align-top">
                  <div className="font-semibold text-titanium-100 text-sm">{r.label}</div>
                  <div className="text-[11px] text-titanium-500">{r.sublabel}</div>
                </td>
                <td className="py-3 pr-3 align-top">
                  <Cell {...r.before} />
                </td>
                <td className="py-3 align-top">
                  <Cell {...r.after} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {metrics.trackersRemoved && metrics.trackersRemoved.length > 0 && (
        <details className="mt-5">
          <summary className="text-xs text-titanium-400 cursor-pointer hover:text-titanium-200">
            Welche Tracker wurden entfernt? ({metrics.trackersRemoved.length})
          </summary>
          <ul className="mt-2 pl-4 text-xs text-titanium-300 space-y-0.5">
            {[...new Set(metrics.trackersRemoved)].map((t) => <li key={t}>• {t}</li>)}
          </ul>
        </details>
      )}

      {metrics.htmlBytes !== undefined && metrics.byteSize !== undefined && (
        <div className="mt-4 text-[11px] text-titanium-500 font-mono">
          HTML-Größe: {(metrics.byteSize / 1024).toFixed(1)} KB → {(metrics.htmlBytes / 1024).toFixed(1)} KB
          {metrics.htmlBytes < metrics.byteSize && (
            <span className="text-emerald-400 ml-1">
              (-{((1 - metrics.htmlBytes / metrics.byteSize) * 100).toFixed(0)}%)
            </span>
          )}
        </div>
      )}
    </section>
  );
}

interface CellProps {
  value: string | number;
  kind: 'good' | 'bad' | 'neutral';
}

function Cell({ value, kind }: CellProps): ReactNode {
  const Icon = kind === 'good' ? CheckCircle2 : kind === 'bad' ? XCircle : AlertTriangle;
  const color = kind === 'good' ? 'text-emerald-400' : kind === 'bad' ? 'text-amber-400' : 'text-titanium-500';
  return (
    <div className={`flex items-baseline gap-2 ${color}`}>
      <Icon className="h-3.5 w-3.5 shrink-0 translate-y-0.5" />
      <span className="text-titanium-100 font-mono text-xs">{value}</span>
    </div>
  );
}

interface Row {
  label: string;
  sublabel: string;
  before: CellProps;
  after: CellProps;
}

/**
 * Helper: parsed BeforeAfterMetrics aus einer Liste von rebuild-step-Rows
 * (wie sie get_rebuild_status_by_token RPC zurückgibt).
 */
export function metricsFromSteps(
  steps: Array<{ step_name: string; metadata?: Record<string, unknown> | null; status: string }>,
): BeforeAfterMetrics {
  const byStep = new Map<string, Record<string, unknown>>();
  for (const s of steps) {
    if (s.status !== 'success') continue;
    byStep.set(s.step_name, s.metadata ?? {});
  }

  const scrape = byStep.get('scrape') ?? {};
  const strip = byStep.get('strip_trackers') ?? {};
  const selfHost = byStep.get('self_host') ?? {};
  const legal = byStep.get('legal_pages') ?? {};
  const aiReady = byStep.get('ai_ready') ?? {};
  const pkg = byStep.get('package_deploy') ?? {};

  return {
    byteSize: num(scrape.byteSize),
    scripts: num(scrape.scripts),
    iframes: num(scrape.iframes),
    fonts: num(scrape.fonts),
    title: str(scrape.title),
    trackersRemoved: arr<string>(strip.trackersRemoved),
    scriptsRemoved: num(strip.scriptsRemoved),
    iframesNeutralized: arr<string>(strip.iframesNeutralized),
    fontsSelfHosted: arr<string>(strip.fontsSelfHosted),
    fontsToDownload: arr<string>(selfHost.fontsToDownload),
    legalDocsGenerated: arr<string>(legal.docs),
    jsonLdBlocks: num(aiReady.jsonLdBlocks),
    htmlBytes: num(pkg.htmlBytes),
  };
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined;
}
function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}
function arr<T>(v: unknown): T[] | undefined {
  return Array.isArray(v) ? (v as T[]) : undefined;
}
