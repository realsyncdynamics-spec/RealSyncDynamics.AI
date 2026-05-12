/**
 * Governance Runtime Dashboard — read-only product-shell preview.
 *
 * Renders the four pillars of the Operational AI Governance Infrastructure
 * on top of the demo fixture in `demoGovernanceData.ts`:
 *
 *   - Runtime Telemetry  → event stream + risk metrics
 *   - Policy Engine      → active policies + actions taken
 *   - Evidence Vault     → hash-chained artefacts per event
 *   - Governance Graph   → asset ↔ control mapping (status per cell)
 *
 * No Supabase reads happen here — this is the public preview shell.
 * Once browser-extension / SDK emitters write into the real tables,
 * a tenant-scoped variant will replace the demo data import.
 */
import {
  Activity,
  ShieldCheck,
  FileLock2,
  Network,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import {
  demoAssets,
  demoPolicies,
  demoEvents,
  demoEvidence,
  demoFrameworkControls,
  demoControlMappings,
} from './demoGovernanceData';
import type {
  ControlStatus,
  RiskLevel,
  GovernanceEvent,
  GovernancePolicy,
} from './types';

const RISK_COLORS: Record<RiskLevel, string> = {
  critical: 'text-rose-300 border-rose-500/60 bg-rose-500/10',
  high:     'text-amber-200 border-amber-500/60 bg-amber-500/10',
  medium:   'text-yellow-200 border-yellow-500/50 bg-yellow-500/10',
  low:      'text-sky-200 border-sky-500/50 bg-sky-500/10',
  info:     'text-silver-300 border-silver-600/50 bg-silver-700/10',
};

const STATUS_COLORS: Record<ControlStatus, string> = {
  implemented:     'bg-emerald-500/15 text-emerald-200 border-emerald-500/40',
  in_progress:     'bg-sky-500/15 text-sky-200 border-sky-500/40',
  gap:             'bg-rose-500/15 text-rose-200 border-rose-500/40',
  not_started:     'bg-silver-700/15 text-silver-300 border-silver-600/40',
  not_applicable:  'bg-silver-800/30 text-silver-500 border-silver-700/40',
};

const STATUS_LABEL: Record<ControlStatus, string> = {
  implemented:    'Implementiert',
  in_progress:    'In Arbeit',
  gap:            'Lücke',
  not_started:    'Offen',
  not_applicable: 'N/A',
};

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1)   return 'gerade eben';
  if (m < 60)  return `vor ${m} Min.`;
  const h = Math.round(m / 60);
  if (h < 24)  return `vor ${h} Std.`;
  const d = Math.round(h / 24);
  return `vor ${d} Tg.`;
}

export function GovernanceRuntimeDashboard() {
  const critical = demoEvents.filter((e) => e.risk_level === 'critical').length;
  const high     = demoEvents.filter((e) => e.risk_level === 'high').length;
  const blocked  = demoEvents.filter((e) => e.policy_action === 'block').length;
  const evidenceCount = demoEvidence.length;
  const highRiskAssets = demoAssets.filter((a) => a.risk_score >= 70).length;

  return (
    <div className="space-y-10">
      {/* Top metrics */}
      <section aria-label="Risk-Metriken" className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard label="Assets im Inventar"      value={demoAssets.length} sub={`${highRiskAssets} hoch-riskant`} />
        <MetricCard label="Events (24 Std.)"         value={demoEvents.length} sub="Runtime Telemetry" />
        <MetricCard label="Kritische Events"         value={critical}          sub="Sofort-Aufmerksamkeit" tone="critical" />
        <MetricCard label="High-Risk Events"         value={high}              sub="Eskalation prüfen"    tone="high" />
        <MetricCard label="Blockierte Aktionen"      value={blocked}           sub="Policy-Engine"        tone="blocked" />
      </section>

      {/* Runtime Telemetry */}
      <Panel
        icon={<Activity className="h-4 w-4 text-gold-400" />}
        title="Runtime Telemetry"
        subtitle="Event-Stream aus Website-Scanner, SDK, Agent-Runtime, GitHub und CI/CD."
      >
        <ul className="divide-y divide-silver-700/30">
          {demoEvents.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </ul>
      </Panel>

      {/* Policy Engine */}
      <Panel
        icon={<ShieldCheck className="h-4 w-4 text-gold-400" />}
        title="Policy Engine"
        subtitle="Aktive Regeln, ihre Aktion und Schweregrad. Verstöße erzeugen automatisch ein Event + Evidence."
      >
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {demoPolicies.map((policy) => (
            <PolicyCard key={policy.id} policy={policy} />
          ))}
        </ul>
      </Panel>

      {/* Evidence Vault */}
      <Panel
        icon={<FileLock2 className="h-4 w-4 text-gold-400" />}
        title="Evidence Vault"
        subtitle={`${evidenceCount} Artefakte, hash-verkettet. Jedes Event hinterlässt nachprüfbare Spuren — Audits werden re-konstruierbar.`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-mono uppercase tracking-[0.18em] text-silver-500 border-b border-silver-700/40">
                <th className="text-left py-2 pr-3">Artefakt</th>
                <th className="text-left py-2 pr-3">Typ</th>
                <th className="text-left py-2 pr-3">Hash</th>
                <th className="text-left py-2">Erfasst</th>
              </tr>
            </thead>
            <tbody>
              {demoEvidence.map((ev) => (
                <tr key={ev.id} className="border-b border-silver-700/20">
                  <td className="py-2 pr-3 text-silver-100">{ev.title}</td>
                  <td className="py-2 pr-3">
                    <code className="text-[11px] font-mono text-silver-300">{ev.evidence_type}</code>
                  </td>
                  <td className="py-2 pr-3">
                    <code className="text-[11px] font-mono text-gold-300">{ev.content_hash ?? '—'}</code>
                  </td>
                  <td className="py-2 text-silver-400 text-[12px]">{formatTimeAgo(ev.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Governance Graph */}
      <Panel
        icon={<Network className="h-4 w-4 text-gold-400" />}
        title="AI Governance Graph"
        subtitle="Asset ↔ Control-Mapping über mehrere Frameworks. Lücken werden direkt sichtbar."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-mono uppercase tracking-[0.18em] text-silver-500 border-b border-silver-700/40">
                <th className="text-left py-2 pr-3 min-w-[180px]">Asset</th>
                {demoFrameworkControls.map((ctl) => (
                  <th key={ctl.id} className="text-left py-2 px-2 min-w-[120px]">
                    <div className="text-gold-400">{ctl.framework}</div>
                    <div className="text-silver-400 normal-case font-mono text-[10px]">{ctl.control_code}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {demoAssets.map((asset) => (
                <tr key={asset.id} className="border-b border-silver-700/20 align-top">
                  <td className="py-3 pr-3">
                    <div className="text-silver-100 font-semibold">{asset.name}</div>
                    <div className="text-[11px] font-mono uppercase tracking-wider text-silver-500">
                      {asset.asset_type} · {asset.ai_act_class}
                    </div>
                  </td>
                  {demoFrameworkControls.map((ctl) => {
                    const mapping = demoControlMappings.find(
                      (m) => m.asset_id === asset.id && m.control_id === ctl.id,
                    );
                    if (!mapping) {
                      return (
                        <td key={ctl.id} className="py-3 px-2 text-silver-700 text-[11px]">—</td>
                      );
                    }
                    return (
                      <td key={ctl.id} className="py-3 px-2">
                        <span
                          className={`inline-block border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ${STATUS_COLORS[mapping.status]}`}
                        >
                          {STATUS_LABEL[mapping.status]}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────── */

function MetricCard({
  label, value, sub, tone,
}: {
  label: string;
  value: number;
  sub: string;
  tone?: 'critical' | 'high' | 'blocked';
}) {
  const valueColor =
    tone === 'critical' ? 'text-rose-300' :
    tone === 'high'     ? 'text-amber-300' :
    tone === 'blocked'  ? 'text-gold-300' :
    'text-titanium-50';
  return (
    <div className="p-4 bg-obsidian-900/60 border border-silver-700/30">
      <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-silver-500">{label}</div>
      <div className={`font-display font-bold text-3xl tracking-tight mt-1 tabular-nums ${valueColor}`}>{value}</div>
      <div className="text-[11px] text-silver-400 mt-1">{sub}</div>
    </div>
  );
}

function Panel({
  icon, title, subtitle, children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-obsidian-900/40 border border-silver-700/30">
      <header className="px-5 py-4 border-b border-silver-700/30">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="font-display font-bold text-titanium-50 text-lg tracking-tight">{title}</h2>
        </div>
        <p className="text-[13px] text-silver-400 mt-1.5">{subtitle}</p>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function EventRow({ event }: { event: GovernanceEvent }) {
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ${RISK_COLORS[event.risk_level]}`}
        >
          {event.risk_level === 'critical' && <AlertTriangle className="h-3 w-3" />}
          {event.risk_level}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-semibold text-titanium-50 text-[14px] leading-snug truncate">{event.title}</h3>
            <span className="text-[11px] text-silver-500 whitespace-nowrap">{formatTimeAgo(event.created_at)}</span>
          </div>
          {event.summary && <p className="text-[13px] text-silver-300 mt-1 leading-relaxed">{event.summary}</p>}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-mono uppercase tracking-wider text-silver-500">
            <Tag>src · {event.event_source}</Tag>
            <Tag>type · {event.event_type}</Tag>
            {event.vendor      && <Tag>vendor · {event.vendor}</Tag>}
            {event.model_name  && <Tag>model · {event.model_name}</Tag>}
            {event.policy_action && (
              <Tag tone={event.policy_action === 'block' ? 'danger' : event.policy_action === 'warn' ? 'warn' : 'neutral'}>
                policy · {event.policy_action}
              </Tag>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function PolicyCard({ policy }: { policy: GovernancePolicy }) {
  return (
    <li className="p-4 bg-obsidian-950/60 border border-silver-700/30 flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-block border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ${RISK_COLORS[policy.severity]}`}>
          {policy.severity}
        </span>
        <span className="inline-block border border-silver-600/50 bg-silver-700/10 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-silver-300">
          {policy.action}
        </span>
      </div>
      <h3 className="font-semibold text-titanium-50 text-[14px] leading-snug">{policy.name}</h3>
      {policy.description && <p className="text-[13px] text-silver-300 mt-1.5 leading-relaxed">{policy.description}</p>}
      <div className="mt-3 flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-silver-500">
        <span>{policy.policy_type}</span>
        <span className={policy.enabled ? 'text-emerald-300' : 'text-silver-500'}>
          {policy.enabled ? '● aktiv' : '○ pausiert'}
        </span>
      </div>
    </li>
  );
}

function Tag({
  children, tone = 'neutral',
}: { children: React.ReactNode; tone?: 'neutral' | 'warn' | 'danger' }) {
  const color =
    tone === 'danger' ? 'text-rose-300' :
    tone === 'warn'   ? 'text-amber-300' :
    'text-silver-400';
  return <span className={color}>{children}</span>;
}

/**
 * Disclaimer-Block for use below the dashboard on the public preview
 * page. Kept inside the feature folder so the page itself stays minimal.
 */
export function GovernanceRuntimeDisclaimer() {
  return (
    <div className="mt-10 p-5 border border-silver-700/40 bg-obsidian-900/40 text-[13px] text-silver-300 leading-relaxed">
      <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-gold-400 mb-2">
        Hinweis zur Demo-Ansicht
      </div>
      <p>
        Diese Ansicht zeigt die <strong className="text-titanium-50">Produktstruktur</strong> mit
        synthetischen Beispiel-Daten. Reale Events stammen ab Pilotstart aus Browser-Extension,
        SDK-Middleware, GitHub-Webhooks und Agent-Runtime-Hooks und werden tenant-isoliert in der
        EU gespeichert. Inhalte ersetzen keine individuelle Rechtsberatung.
      </p>
      <a
        href="/contact-sales?intent=governance-pilot&source=governance-runtime"
        className="mt-4 inline-flex items-center gap-1.5 text-gold-400 hover:text-gold-300 font-semibold text-[13px]"
      >
        Pilot-Slot anfragen <ArrowRight className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
