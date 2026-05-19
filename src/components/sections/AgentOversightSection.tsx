import { Bot, Radar, Wrench, FileCheck2, ShieldCheck, AlertOctagon, UserCheck } from 'lucide-react';

const AGENTS = [
  {
    icon: Radar,
    name: 'Website Drift Agent',
    scope: ['Scan verifizierte Domains', 'Tracker-Drift erkennen', 'Remediation-To-dos erzeugen'],
    cannot: ['Produktionssysteme ändern', 'Aussenstehende Domains scannen'],
    approval: 'für externe Ticket-Erstellung',
    last: 'careers.example.de · neuer Meta-Pixel-Eintrag · severity high',
  },
  {
    icon: Bot,
    name: 'AI Risk Agent',
    scope: ['KI-Usecases klassifizieren', 'AI-Act-Pflichten mappen', 'Hochrisiko-Systeme flaggen'],
    cannot: ['Hochrisiko-Systeme genehmigen', 'Klassifikation final committen'],
    approval: 'Compliance-Owner zwingend',
    last: 'Recruiting-Assistant v2.3 → Annex III · §4(a) employment',
  },
  {
    icon: Wrench,
    name: 'Remediation Agent',
    scope: ['Jira-Tickets erstellen', 'GitHub-PRs draften', 'CMP-Konfigs vorschlagen'],
    cannot: ['Mergen', 'Deployen', 'Direkt produktiv schalten'],
    approval: 'immer human-in-the-loop',
    last: 'PR #482 zu careers-repo draft, awaiting review',
  },
  {
    icon: FileCheck2,
    name: 'Evidence Agent',
    scope: ['Evidence-Bundles generieren', 'Logs zu Controls verknüpfen', 'Audit-Pakete exportieren'],
    cannot: ['Source-Events modifizieren', 'Hash-Chain umschreiben'],
    approval: 'für Regulator-Export',
    last: 'Annex-IV-Bundle für Usecase a3f2 sealed · chain_index 4821',
  },
];

const GUARANTEES = [
  { icon: ShieldCheck, label: 'Tenant-scoped', detail: 'Jeder Agent operiert ausschließlich in seinem Tenant. Cross-Tenant-Reads sind RLS-geblockt, nicht nur konventionell.' },
  { icon: UserCheck,   label: 'Approval-Gates', detail: 'Mutationen pausieren am Gate. Ein Mensch entscheidet — Run wird suspended + persisted, resumed auf Approval/Reject.' },
  { icon: AlertOctagon,label: 'Kill-Switch + Budgets', detail: 'Token/Tool-Call/Wall-Clock-Budget pro Run. Über-Budget-Runs werden gekillt, der Meta-Agent kann ganze Agents pausieren.' },
];

export function AgentOversightSection() {
  return (
    <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-3xl mb-10">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-3">
            Agent Oversight
          </div>
          <h2 className="font-display font-bold text-3xl sm:text-5xl text-titanium-50 tracking-tight leading-tight">
            Agenten mit Aufsicht, Scope und Prüfpfad.
          </h2>
          <p className="mt-4 text-silver-300 text-base sm:text-lg leading-relaxed">
            Jeder Governance-Agent hat klare Berechtigungen, Approval-Gates, Risk-Budgets und
            vollständige Ausführungsprotokolle. Automatisierung bleibt kontrollierbar — auch wenn
            mehrere Agents in einer Chain laufen.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {AGENTS.map((a) => {
            const Icon = a.icon;
            return (
              <article key={a.name} className="bg-obsidian-900/60 border border-silver-700/30 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-9 w-9 flex items-center justify-center border border-titanium-100/30 bg-titanium-100/5 text-titanium-100">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="font-display font-bold text-lg text-titanium-50">{a.name}</h3>
                </div>

                <DefinitionList label="scope" items={a.scope} tone="silver" />
                <DefinitionList label="cannot" items={a.cannot} tone="rose" />
                <DefinitionList label="approval required" items={[a.approval]} tone="amber" />

                <div className="mt-4 pt-3 border-t border-silver-700/30">
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-silver-500 mb-1">
                    last action
                  </div>
                  <p className="text-[11px] text-silver-300 font-mono leading-relaxed">{a.last}</p>
                </div>
              </article>
            );
          })}
        </div>

        {/* Guarantees */}
        <div className="border border-silver-700/30 bg-obsidian-950/60 p-5 sm:p-6">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-titanium-100 mb-4">
            Platform-Level Guarantees
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {GUARANTEES.map((g) => {
              const Icon = g.icon;
              return (
                <div key={g.label} className="flex items-start gap-3">
                  <Icon className="h-4 w-4 text-amber-300 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-display font-semibold text-sm text-titanium-50">{g.label}</div>
                    <p className="mt-1 text-xs text-silver-300 leading-relaxed">{g.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function DefinitionList({ label, items, tone }: { label: string; items: string[]; tone: 'silver' | 'rose' | 'amber' }) {
  const dot = tone === 'rose' ? 'bg-rose-300' : tone === 'amber' ? 'bg-amber-300' : 'bg-silver-400';
  const text = tone === 'rose' ? 'text-rose-200' : tone === 'amber' ? 'text-amber-200' : 'text-silver-300';
  return (
    <div className="mb-3 last:mb-0">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-silver-500 mb-1.5">{label}</div>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-xs leading-relaxed">
            <span className={`mt-1.5 h-1 w-1 rounded-full ${dot} shrink-0`} />
            <span className={text}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
