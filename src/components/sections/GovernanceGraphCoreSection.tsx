import { Link } from 'react-router-dom';
import { GitBranch, Layers, FileCheck2, ArrowRight } from 'lucide-react';

interface GraphNode {
  label: string;
  kind: 'usecase' | 'website' | 'data' | 'model' | 'agent' | 'policy' | 'regulation' | 'evidence' | 'vendor';
}

const CENTER: GraphNode = { label: 'AI Recruiting Workflow', kind: 'usecase' };

const NEIGHBOURS: Array<{ rel: string; node: GraphNode }> = [
  { rel: 'runs on',          node: { label: 'careers.company.de',  kind: 'website' } },
  { rel: 'processes',        node: { label: 'Applicant Data',      kind: 'data' } },
  { rel: 'uses',             node: { label: 'OpenAI GPT-4',        kind: 'model' } },
  { rel: 'monitored by',     node: { label: 'HR Screening Agent',  kind: 'agent' } },
  { rel: 'governed by',      node: { label: 'Human Oversight Policy', kind: 'policy' } },
  { rel: 'mapped to',        node: { label: 'EU AI Act Annex III', kind: 'regulation' } },
  { rel: 'proven by',        node: { label: 'Audit Package #4821', kind: 'evidence' } },
  { rel: 'transfers via',    node: { label: 'Vendor · US Transfer',kind: 'vendor' } },
];

const KIND_STYLE: Record<GraphNode['kind'], string> = {
  usecase:    'border-amber-400/40 bg-amber-400/10 text-amber-200',
  website:    'border-emerald-400/30 bg-emerald-400/5 text-emerald-200',
  data:       'border-sky-400/30 bg-sky-400/5 text-sky-200',
  model:      'border-violet-400/30 bg-violet-400/5 text-violet-200',
  agent:      'border-indigo-400/30 bg-indigo-400/5 text-indigo-200',
  policy:     'border-titanium-100/30 bg-titanium-100/5 text-titanium-100',
  regulation: 'border-rose-400/30 bg-rose-400/5 text-rose-200',
  evidence:   'border-teal-400/30 bg-teal-400/5 text-teal-200',
  vendor:     'border-orange-400/30 bg-orange-400/5 text-orange-200',
};

const BENEFITS = [
  {
    icon: GitBranch,
    title: 'Beziehungen statt isolierter Findings',
    body: 'Ein Befund am Tracker ist nicht nur ein Cookie-Issue, sondern ein Pfad zurück auf eine AI-Usecase, eine Regulierung und ein Audit-Paket.',
  },
  {
    icon: Layers,
    title: 'Risikoausbreitung über Systeme sichtbar',
    body: 'Verliert ein Vendor seinen Adequacy-Status, propagiert sich das Risiko durch die Datasets, Modelle und Usecases — nicht erst beim nächsten Audit.',
  },
  {
    icon: FileCheck2,
    title: 'Evidence automatisch mit Policies verknüpft',
    body: 'Jeder Scan, jede Policy-Entscheidung, jede Agent-Aktion wird im Graph an die Controls + Regulationen geknüpft, die sie belegt.',
  },
];

export function GovernanceGraphCoreSection() {
  return (
    <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-3xl mb-10">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-3">
            Governance Graph Core
          </div>
          <h2 className="font-display font-bold text-3xl sm:text-5xl text-titanium-50 tracking-tight leading-tight">
            Ein Governance Graph für Ihre digitale Infrastruktur.
          </h2>
          <p className="mt-4 text-silver-300 text-base sm:text-lg leading-relaxed">
            RealSyncDynamics.AI verbindet Websites, APIs, KI-Systeme, Agenten, Datenflüsse, Vendors,
            Policies und Evidence zu einem nachvollziehbaren Governance-Modell — der eigentliche
            Burggraben gegen "noch ein AI-Compliance-Tool".
          </p>
        </div>

        {/* Graph viz */}
        <div className="bg-obsidian-900/60 border border-silver-700/30 p-6 sm:p-8 mb-10">
          <div className="flex items-center gap-2 mb-6">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-titanium-100">
              Graph-Excerpt · Demo Tenant
            </span>
            <span className="font-mono text-[10px] text-silver-500">node_id: uc_a3f2…</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 items-start">
            {/* Left column: 4 nodes */}
            <div className="space-y-3">
              {NEIGHBOURS.slice(0, 4).map((n) => (
                <NodeRow key={n.node.label} side="left" rel={n.rel} node={n.node} />
              ))}
            </div>

            {/* Center node */}
            <div className="flex flex-col items-center justify-center min-h-[120px]">
              <div className={`relative border-2 ${KIND_STYLE[CENTER.kind]} px-5 py-3 font-display font-bold text-base sm:text-lg`}>
                {CENTER.label}
                <div className="absolute inset-0 -z-10 bg-amber-400/5 blur-xl rounded-full" />
              </div>
              <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-silver-400">
                {CENTER.kind}
              </div>
            </div>

            {/* Right column: 4 nodes */}
            <div className="space-y-3">
              {NEIGHBOURS.slice(4).map((n) => (
                <NodeRow key={n.node.label} side="right" rel={n.rel} node={n.node} />
              ))}
            </div>
          </div>

          <div className="mt-8 border-t border-silver-700/30 pt-4 font-mono text-[11px] text-silver-400">
            Aus diesem Graph entstehen Risk-Scores, Pflichten, Audit-Trails und Remediation-To-dos —
            nicht durch manuelle Excel-Pflege.
          </div>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {BENEFITS.map((b) => {
            const Icon = b.icon;
            return (
              <article key={b.title} className="border border-silver-700/30 bg-obsidian-900/60 p-5">
                <div className="h-9 w-9 flex items-center justify-center border border-titanium-100/30 bg-titanium-100/5 text-titanium-100 mb-4">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="font-display font-bold text-base text-titanium-50">{b.title}</h3>
                <p className="mt-2 text-sm text-silver-300 leading-relaxed">{b.body}</p>
              </article>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <Link
            to="/governance-graph"
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-titanium-100/30 hover:border-amber-400 text-titanium-100 hover:text-amber-300 text-sm font-medium transition-colors"
          >
            Governance Graph Tiefe lesen <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function NodeRow({ side, rel, node }: { side: 'left' | 'right'; rel: string; node: GraphNode }) {
  const align = side === 'left' ? 'flex-row' : 'flex-row-reverse';
  const text = side === 'left' ? 'text-right' : 'text-left';
  return (
    <div className={`flex items-center gap-3 ${align}`}>
      <div className={`flex-1 min-w-0 ${text}`}>
        <div className={`inline-block border ${KIND_STYLE[node.kind]} px-3 py-1.5 text-xs font-medium`}>
          {node.label}
        </div>
        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-silver-500">
          {node.kind}
        </div>
      </div>
      <div className="shrink-0">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-silver-500 px-2 py-1 border-y border-silver-700/30">
          {side === 'left' ? `${rel} →` : `← ${rel}`}
        </div>
      </div>
    </div>
  );
}
