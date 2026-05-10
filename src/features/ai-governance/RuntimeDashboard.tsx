import { useMemo } from 'react';
import {
  Activity,
  AlertOctagon,
  ShieldAlert,
  Bot,
  Layers,
  Clock,
} from 'lucide-react';
import { demoRuntimeEvents } from './runtimeDemoData';
import type { AiRuntimeEventDemo } from './runtimeTypes';

/**
 * RuntimeDashboard — zeigt Echtzeit-AI-Nutzung im Unternehmen.
 *
 * In dieser PR rendert die Section statische Demo-Daten. Folge-PR ersetzt
 * durch Live-Queries gegen ai_runtime_events (Auth-Gating + Tenant-Filter).
 *
 * Layout (gemaess User-Spec):
 *   1. Events-Timeline (kombiniert Recent-Activity)
 *   2. Top-Vendors (Counts pro Vendor)
 *   3. Policy-Violations (warned / blocked / requires_approval)
 *   4. Sensitive-Data-Warnings (data_class personal_data / special_category)
 *   5. Agent-Actions (filter: eventType=agent_action OR tool_call)
 */

const RISK_TONE: Record<AiRuntimeEventDemo['riskLevel'], string> = {
  info: 'text-silver-400 border-silver-700/40',
  low: 'text-emerald-300 border-emerald-900/40',
  medium: 'text-amber-300 border-amber-900/40',
  high: 'text-orange-300 border-orange-900/40',
  critical: 'text-red-300 border-red-900/50',
};

const POLICY_TONE: Record<AiRuntimeEventDemo['policyStatus'], string> = {
  allowed: 'bg-emerald-900/30 text-emerald-300',
  logged: 'bg-silver-700/30 text-silver-300',
  warned: 'bg-amber-900/30 text-amber-200',
  requires_approval: 'bg-orange-900/30 text-orange-200',
  blocked: 'bg-red-900/40 text-red-200',
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export interface RuntimeDashboardProps {
  events?: AiRuntimeEventDemo[];
  eyebrow?: string;
  headline?: string;
  subline?: string;
}

export function RuntimeDashboard({
  events = demoRuntimeEvents,
  eyebrow = 'Runtime Telemetry · Live AI Usage',
  headline = 'Was Ihre Mitarbeiter und Agents in den letzten Stunden mit AI gemacht haben.',
  subline = 'Inventory zeigt was Sie haben. Runtime zeigt was tatsächlich passiert. Vendor-Mix, Policy-Verstöße, Sensitive-Data-Flags und Agent-Aktionen — pro Event.',
}: RuntimeDashboardProps = {}) {
  const sorted = useMemo(
    () => [...events].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    [events],
  );

  const topVendors = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events) counts.set(e.vendor, (counts.get(e.vendor) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [events]);

  const policyViolations = useMemo(
    () => events.filter((e) => ['warned', 'blocked', 'requires_approval'].includes(e.policyStatus)),
    [events],
  );

  const sensitiveDataWarnings = useMemo(
    () =>
      events.filter(
        (e) =>
          (e.dataClass === 'personal_data' || e.dataClass === 'special_category') &&
          ['medium', 'high', 'critical'].includes(e.riskLevel),
      ),
    [events],
  );

  const agentActions = useMemo(
    () => events.filter((e) => e.eventType === 'agent_action' || e.eventType === 'tool_call'),
    [events],
  );

  return (
    <section
      id="runtime-dashboard"
      className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20"
    >
      <div className="max-w-6xl mx-auto">
        <div className="mb-10">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400 mb-3">
            {eyebrow}
          </div>
          <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight max-w-3xl">
            {headline}
          </h2>
          <p className="mt-4 max-w-3xl text-silver-300 text-sm sm:text-base leading-relaxed">
            {subline}
          </p>
        </div>

        {/* Top-Row: Vendors / Violations / Sensitive / Agents */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <SummaryCard
            icon={<Layers className="h-5 w-5 text-titanium-100" />}
            title="Top Vendors"
            count={topVendors.length}
          >
            <ul className="space-y-1.5 text-sm">
              {topVendors.slice(0, 4).map(([vendor, count]) => (
                <li key={vendor} className="flex items-center justify-between text-silver-200">
                  <span>{vendor}</span>
                  <span className="font-mono text-silver-400 tabular-nums">{count}</span>
                </li>
              ))}
            </ul>
          </SummaryCard>

          <SummaryCard
            icon={<ShieldAlert className="h-5 w-5 text-amber-400" />}
            title="Policy Violations"
            count={policyViolations.length}
            tone="amber"
          >
            <ul className="space-y-1.5 text-xs">
              {policyViolations.slice(0, 3).map((e) => (
                <li key={e.id} className="text-silver-300 leading-snug">
                  <span className={`font-mono uppercase tracking-wider text-[10px] ${POLICY_TONE[e.policyStatus]} px-1.5 py-0.5`}>
                    {e.policyStatus}
                  </span>{' '}
                  {e.vendor} / {e.team}
                </li>
              ))}
            </ul>
          </SummaryCard>

          <SummaryCard
            icon={<AlertOctagon className="h-5 w-5 text-red-400" />}
            title="Sensitive Data Warnings"
            count={sensitiveDataWarnings.length}
            tone="red"
          >
            <ul className="space-y-1.5 text-xs">
              {sensitiveDataWarnings.slice(0, 3).map((e) => (
                <li key={e.id} className="text-silver-300 leading-snug">
                  <span className="font-mono uppercase tracking-wider text-[10px] text-red-300">
                    {e.dataClass}
                  </span>{' '}
                  → {e.vendor}
                </li>
              ))}
            </ul>
          </SummaryCard>

          <SummaryCard
            icon={<Bot className="h-5 w-5 text-titanium-100" />}
            title="Agent Actions"
            count={agentActions.length}
          >
            <ul className="space-y-1.5 text-xs">
              {agentActions.slice(0, 3).map((e) => (
                <li key={e.id} className="text-silver-300 leading-snug">
                  {e.team} → {e.model}
                </li>
              ))}
            </ul>
          </SummaryCard>
        </div>

        {/* Events Timeline */}
        <div className="bg-obsidian-900/60 border border-silver-700/30 rounded-none p-5">
          <div className="flex items-center gap-2 mb-5">
            <Activity className="h-5 w-5 text-titanium-100" />
            <h3 className="font-display font-bold text-xl text-titanium-50">Events Timeline</h3>
            <span className="ml-auto text-[10px] font-mono uppercase tracking-wider text-silver-500">
              {events.length} Events · 24h Fenster
            </span>
          </div>

          <ol className="space-y-2">
            {sorted.map((e) => (
              <li
                key={e.id}
                className={`grid grid-cols-1 md:grid-cols-[80px_140px_1fr_140px] gap-3 border-l-2 ${RISK_TONE[e.riskLevel]} bg-obsidian-950/60 px-4 py-3`}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-silver-500">
                  <Clock className="h-3 w-3" />
                  {formatTime(e.occurredAt)}
                </div>
                <div className="font-mono text-[11px] text-silver-300">
                  <div className="text-titanium-100">{e.vendor}</div>
                  <div className="text-silver-500">{e.model}</div>
                </div>
                <div className="text-sm text-silver-200 leading-snug">
                  {e.summary}
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-silver-500 border border-silver-700/40 px-1.5 py-0.5">
                      {e.team}
                    </span>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-silver-500 border border-silver-700/40 px-1.5 py-0.5">
                      {e.dataClass}
                    </span>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-silver-500 border border-silver-700/40 px-1.5 py-0.5">
                      {e.promptCategory}
                    </span>
                  </div>
                </div>
                <div className="flex md:justify-end">
                  <span
                    className={`inline-block font-mono uppercase tracking-wider text-[10px] px-2 py-0.5 ${POLICY_TONE[e.policyStatus]}`}
                  >
                    {e.policyStatus}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function SummaryCard({
  icon,
  title,
  count,
  tone,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  tone?: 'amber' | 'red';
  children: React.ReactNode;
}) {
  const ringTone =
    tone === 'amber'
      ? 'border-amber-900/40'
      : tone === 'red'
        ? 'border-red-900/40'
        : 'border-silver-700/30';
  return (
    <div className={`bg-obsidian-900/60 border ${ringTone} p-5`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-[11px] font-mono uppercase tracking-wider text-silver-300">
            {title}
          </span>
        </div>
        <span className="font-display font-bold text-2xl text-titanium-50 tabular-nums">
          {count}
        </span>
      </div>
      <div className="border-t border-silver-700/20 pt-3">{children}</div>
    </div>
  );
}
