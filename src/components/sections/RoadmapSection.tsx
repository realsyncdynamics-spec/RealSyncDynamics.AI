/**
 * Public roadmap section — Integrationen & Runtime.
 *
 * Statuses (honest signalling, do not promote without an actual release):
 *   - "Verfügbar"        — already shipped, beta + general availability
 *   - "Beta"             — released to beta tenants, gated rollout
 *   - "In Entwicklung"   — actively being built
 *   - "Geplant"          — on the backlog, no implementation work yet
 */
import { Wrench, ShoppingBag, MessagesSquare, Code2, BrainCircuit, Bot, GitMerge, type LucideIcon } from 'lucide-react';

type Status = 'Verfügbar' | 'Beta' | 'In Entwicklung' | 'Geplant';

interface RoadmapItem {
  Icon: LucideIcon;
  title: string;
  body: string;
  status: Status;
  bullets?: string[];
}

const ITEMS: RoadmapItem[] = [
  {
    Icon: Wrench,
    title: 'WordPress Plugin',
    status: 'Geplant',
    body:
      'Tracker-, Consent- und Header-Scans direkt aus dem WordPress-Adminbereich. Kein separates Dashboard nötig.',
    bullets: [
      'One-click Domain Verification',
      'Consent-Regression Detection',
      'Plugin-/Tracker-Änderungswarnungen',
      'Exportierbare Audit-Reports',
    ],
  },
  {
    Icon: ShoppingBag,
    title: 'Shopify Integration',
    status: 'Geplant',
    body:
      'Continuous Compliance Monitoring für Shopify-Storefronts inklusive Consent-, Pixel- und Pre-Checkout-Analyse.',
    bullets: [
      'Pre-consent Tracker Detection',
      'Checkout-/Pixel-Überwachung',
      'Drittanbieter- und App-Inventory',
      'Re-Scan nach Theme- oder App-Änderungen',
    ],
  },
  {
    Icon: MessagesSquare,
    title: 'Slack / Teams Alerts',
    status: 'In Entwicklung',
    body: 'Compliance-Drift landet direkt im Team-Workflow.',
    bullets: [
      'Neuer Tracker erkannt',
      'Consent-Regression',
      'Ablaufende Zertifikate',
      'Fehlende Security-Header',
      'Neue Drittland-Transfers',
    ],
  },
  {
    Icon: Code2,
    title: 'Audit API & Changelog',
    status: 'In Entwicklung',
    body:
      'Öffentliche Audit-API für externe Dashboards, Agenturen, CI/CD-Pipelines und eigene Compliance-Workflows. Jede Änderung der Audit-Engine wird versioniert dokumentiert.',
    bullets: [
      'Findings API',
      'Evidence Export',
      'Webhooks',
      'Engine-Versionierung',
      'Signed Audit Snapshots',
    ],
  },
  {
    Icon: BrainCircuit,
    title: 'AI-Act Governance Runtime',
    status: 'Verfügbar',
    body:
      'AI-Usecase-Inventar, Annex-III-Klassifizierung und Hochrisiko-Kontrollen mit Audit-Trail.',
    bullets: [
      'Provider-/Deployer-Mapping',
      'Risk-Tiering',
      'Evidence-Vault',
      'Governance-Graph',
      'Kontinuierliche Re-Evaluation',
    ],
  },
  {
    Icon: Bot,
    title: 'Compliance-Agenten',
    status: 'Beta',
    body:
      'Spezialisierte Agenten für Website Drift, AI-Usecases, Evidence Mapping und Risk Classification. Tool-use Loops mit Permissions, Approval Gates und Audit Logging. Aktuell verfügbar für Beta-Tenants auf /governance.',
    bullets: [
      'Website Drift Agent',
      'AI-Usecase Agent',
      'Evidence Mapping Agent',
      'Risk Classification Agent',
    ],
  },
  {
    Icon: GitMerge,
    title: 'CI/CD-Integrationen',
    status: 'In Entwicklung',
    body: 'Compliance-Checks direkt nach jedem Deploy.',
    bullets: [
      'GitHub Actions',
      'Vercel Hooks',
      'Netlify Hooks',
      'Automatische Re-Scans und Drift-Checks nach Deploy',
    ],
  },
];

function statusStyle(s: Status): string {
  switch (s) {
    case 'Verfügbar':
      return 'border-emerald-400 text-emerald-300';
    case 'Beta':
      return 'border-violet-400 text-violet-300';
    case 'In Entwicklung':
      return 'border-gold-400 text-gold-400';
    case 'Geplant':
      return 'border-silver-500 text-silver-300';
  }
}

export function RoadmapSection() {
  return (
    <section
      id="roadmap"
      className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20"
    >
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400 mb-3">
            Integrationen & Runtime
          </div>
          <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight max-w-3xl mx-auto">
            Was heute nutzbar ist — und was auf der Roadmap steht.
          </h2>
          <p className="mt-4 text-sm text-silver-400 max-w-2xl mx-auto leading-relaxed">
            RealSyncDynamics.AI trennt klar zwischen verfügbaren Modulen, Beta-Funktionen, laufender
            Entwicklung und geplanten Integrationen.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {ITEMS.map((it) => (
            <div
              key={it.title}
              className="p-5 sm:p-6 bg-obsidian-900/60 border border-silver-700/30 rounded-none flex gap-4"
            >
              <it.Icon className="h-5 w-5 text-gold-400 shrink-0 mt-1" strokeWidth={1.5} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="font-display font-bold text-titanium-50 text-base">{it.title}</div>
                  <span
                    className={`text-[10px] font-mono uppercase tracking-[0.18em] border px-2 py-0.5 rounded-none whitespace-nowrap ${statusStyle(it.status)}`}
                  >
                    {it.status}
                  </span>
                </div>
                <p className="text-sm text-silver-300 leading-relaxed">{it.body}</p>
                {it.bullets && it.bullets.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {it.bullets.map((b) => (
                      <li
                        key={b}
                        className="flex items-start gap-2 text-xs text-silver-400 leading-relaxed"
                      >
                        <span aria-hidden="true" className="text-silver-500 shrink-0">▸</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
