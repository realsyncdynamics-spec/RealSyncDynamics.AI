import { Bot, Database, FileCheck2, MessageSquare, ShieldAlert, UserCheck, Wrench } from 'lucide-react';
import type {
  AgentEvidenceRequirement,
  AgentReviewMode,
  GovernedAgentEntry,
  GovernedAgentType,
} from './types';
import { AgentMaturityBadge, AgentRiskBadge } from './AgentStatusBadge';

const TYPE_LABEL: Record<GovernedAgentType, string> = {
  compliance:   'Compliance',
  evidence:     'Nachweise',
  security:     'Security',
  onboarding:   'Onboarding',
  website_chat: 'Website-Chat',
  voice:        'Telefon',
  whatsapp:     'WhatsApp',
  browser:      'Browser',
  builder:      'Builder',
  workflow:     'Workflow',
};

const REVIEW_LABEL: Record<AgentReviewMode, string> = {
  always:  'Immer Freigabe',
  on_risk: 'Freigabe bei Risiko',
  none:    'Keine Freigabe',
};

const EVIDENCE_LABEL: Record<AgentEvidenceRequirement, string> = {
  every_action: 'Jede Aktion',
  on_decision:  'Bei Entscheidungen',
  none:         'Keine',
};

interface Props {
  agent: GovernedAgentEntry;
}

export function AgentCard({ agent }: Props) {
  const Icon = agent.kind === 'bot' ? MessageSquare : Bot;
  return (
    <article className="border border-titanium-800 bg-obsidian-900" data-agent-id={agent.id}>
      <header className="flex items-start justify-between gap-3 border-b border-titanium-800 p-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-gradient-to-br from-indigo-500 to-blue-600">
            <Icon className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-sm font-semibold tracking-tight text-titanium-50 truncate">
              {agent.name}
            </h3>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
              {agent.kind === 'bot' ? 'Bot' : 'Agent'} · {TYPE_LABEL[agent.agentType]} · Owner: {agent.owner}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <AgentRiskBadge level={agent.riskLevel} />
          <AgentMaturityBadge maturity={agent.maturity} />
        </div>
      </header>

      <div className="p-4 text-sm leading-relaxed text-titanium-200">
        {agent.purpose}
      </div>

      <div className="grid grid-cols-1 gap-4 border-t border-titanium-800 p-4 md:grid-cols-2">
        <Section icon={<Database className="h-3.5 w-3.5" />} title="Datenzugriff">
          <Tags items={agent.dataAccess} tone="default" />
        </Section>

        <Section icon={<Wrench className="h-3.5 w-3.5" />} title="Erlaubte Aktionen">
          <Tags items={agent.allowedActions} tone="default" />
        </Section>

        <Section icon={<ShieldAlert className="h-3.5 w-3.5" />} title="Verbotene Aktionen">
          <Tags items={agent.forbiddenActions} tone="rose" />
        </Section>

        <Section icon={<UserCheck className="h-3.5 w-3.5" />} title={`Review · ${REVIEW_LABEL[agent.reviewMode]}`}>
          <Tags items={agent.reviewPoints} tone="amber" />
        </Section>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-titanium-800 p-3 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
        <span className="inline-flex items-center gap-1">
          <FileCheck2 className="h-3 w-3" />
          Evidence: <span className="text-titanium-200">{EVIDENCE_LABEL[agent.evidenceRequirement]}</span>
        </span>
        <span>{agent.runnable ? 'Preview-Lauf möglich' : 'Nicht ausführbar'}</span>
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

function Tags({ items, tone }: { items: readonly string[]; tone: keyof typeof TONE_CLS }) {
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
