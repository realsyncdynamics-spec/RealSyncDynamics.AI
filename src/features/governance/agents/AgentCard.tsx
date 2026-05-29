import { Bot, Lock, ShieldAlert, UserCheck, Wrench } from 'lucide-react';
import type { AgentType, GovernanceAgent } from './types';
import { AgentRiskBadge, AgentStatusBadge } from './AgentStatusBadge';

const TYPE_LABEL: Record<AgentType, string> = {
  detection:      'Erkennung',
  classification: 'Klassifikation',
  evidence:       'Nachweise',
  policy:         'Regelwerk',
  triage:         'Triage',
  remediation:    'Remediation',
};

function formatTimestamp(iso: string | null): string {
  if (!iso) return 'noch nie gelaufen';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
}

interface Props {
  agent: GovernanceAgent;
}

export function AgentCard({ agent }: Props) {
  return (
    <article className="border border-titanium-800 bg-obsidian-900">
      <header className="flex items-start justify-between gap-3 border-b border-titanium-800 p-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-gradient-to-br from-indigo-500 to-blue-600">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-sm font-semibold tracking-tight text-titanium-50 truncate">
              {agent.name}
            </h3>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
              {TYPE_LABEL[agent.type]} · Owner: {agent.ownerRole}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <AgentRiskBadge level={agent.riskLevel} />
          <AgentStatusBadge status={agent.status} />
        </div>
      </header>

      <div className="p-4 text-sm leading-relaxed text-titanium-200">
        {agent.description}
      </div>

      <div className="grid grid-cols-1 gap-4 border-t border-titanium-800 p-4 md:grid-cols-2">
        <Section icon={<Wrench className="h-3.5 w-3.5" />} title="Erlaubte Werkzeuge">
          <Tags items={agent.tools} tone="default" />
        </Section>

        <Section icon={<Lock className="h-3.5 w-3.5" />} title="Berechtigungen">
          <Tags items={agent.permissions} tone="default" />
        </Section>

        <Section icon={<ShieldAlert className="h-3.5 w-3.5" />} title="Verbotene Aktionen">
          <Tags items={agent.restrictedActions} tone="rose" />
        </Section>

        <Section icon={<UserCheck className="h-3.5 w-3.5" />} title="Human Review erforderlich">
          <Tags items={agent.requiresHumanReview} tone="amber" />
        </Section>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-titanium-800 p-3 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
        <span>Letzter Lauf: <span className="text-titanium-200">{formatTimestamp(agent.lastRunAt)}</span></span>
        <span>Nachweise: <span className="text-titanium-200">{agent.evidenceRefs.length}</span></span>
      </footer>
    </article>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1.5 flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
        {icon} {title}
      </h4>
      {children}
    </div>
  );
}

const TONE_CLS = {
  default: 'border-titanium-800 bg-obsidian-950 text-titanium-300',
  amber:   'border-amber-500/40 bg-amber-500/10 text-amber-200',
  rose:    'border-rose-500/40 bg-rose-500/10 text-rose-200',
};

function Tags({ items, tone }: { items: string[]; tone: keyof typeof TONE_CLS }) {
  if (items.length === 0) return <p className="text-[11px] text-titanium-500">—</p>;
  return (
    <ul className="flex flex-wrap gap-1">
      {items.map((it) => (
        <li key={it} className={`border px-1.5 py-0.5 font-mono text-[11px] ${TONE_CLS[tone]}`}>
          {it}
        </li>
      ))}
    </ul>
  );
}
