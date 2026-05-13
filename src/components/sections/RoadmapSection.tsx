/**
 * Public roadmap section. Each item carries an explicit, honest status
 * badge so visitors never read it as "already shipping".
 *
 * Statuses:
 *   - "Geplant"          — on the backlog, no implementation work yet
 *   - "In Entwicklung"   — actively being built
 *   - "Verfügbar"        — already shipped, included only for context
 *
 * Add/move items as engineering reality changes; do NOT promote
 * "Geplant" → "Verfügbar" without an actual release.
 */
import { Wrench, ShoppingBag, MessagesSquare, Code2, BrainCircuit, Bot, GitMerge, type LucideIcon } from 'lucide-react';

type Status = 'Geplant' | 'In Entwicklung' | 'Verfügbar';

interface RoadmapItem {
  Icon: LucideIcon;
  title: string;
  body: string;
  status: Status;
}

const ITEMS: RoadmapItem[] = [
  {
    Icon: Wrench,
    title: 'WordPress Plugin',
    body: 'Tracker- und Consent-Scan direkt aus dem WP-Adminbereich, ohne separates Dashboard.',
    status: 'Geplant',
  },
  {
    Icon: ShoppingBag,
    title: 'Shopify Integration',
    body: 'Continuous Scan für Shopify-Storefronts inklusive Pre-Checkout-Tracker-Detection.',
    status: 'Geplant',
  },
  {
    Icon: MessagesSquare,
    title: 'Slack / Teams Alerts',
    body: 'Drift-Alerts (neuer Tracker, Cert-Ablauf, Consent-Regression) in Slack- und Teams-Kanäle.',
    status: 'In Entwicklung',
  },
  {
    Icon: Code2,
    title: 'API & Changelog',
    body: 'Öffentliche Audit-API plus versionierter Changelog je Audit-Engine-Release.',
    status: 'In Entwicklung',
  },
  {
    Icon: BrainCircuit,
    title: 'AI-Act Governance Features',
    body: 'AI-Use-Case-Inventar, Annex-III-Klassifizierung, Hochrisiko-Kontrollen mit Audit-Trail.',
    status: 'Verfügbar',
  },
  {
    Icon: Bot,
    title: 'Compliance-Agenten (Beta)',
    body: 'Website-Drift-, AI-Usecase- und Evidence-Agent live für Beta-Tenants. Chat-Widget auf /governance, tool-use Loop mit Permissions + Approval-Gates.',
    status: 'Verfügbar',
  },
  {
    Icon: GitMerge,
    title: 'CI/CD-Integrationen',
    body: 'GitHub Actions sowie Vercel-/Netlify-Hooks lösen nach jedem Deploy automatisch Scans aus und erzeugen Alerts bei Compliance-Drift.',
    status: 'In Entwicklung',
  },
];

function statusStyle(s: Status): string {
  switch (s) {
    case 'Geplant':
      return 'border-silver-500 text-silver-300';
    case 'In Entwicklung':
      return 'border-gold-400 text-gold-400';
    case 'Verfügbar':
      return 'border-emerald-400 text-emerald-300';
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
            Roadmap · nächste 90 Tage
          </div>
          <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight max-w-2xl mx-auto">
            Was als nächstes kommt — und was bewusst noch nicht da ist
          </h2>
          <p className="mt-4 text-sm text-silver-400 max-w-2xl mx-auto leading-relaxed">
            Jeder Punkt trägt einen Status. „Geplant" ist nicht „Verfügbar". Wir kommunizieren bewusst, was wir nicht haben.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {ITEMS.map((it) => (
            <div
              key={it.title}
              className="p-5 sm:p-6 bg-obsidian-900/60 border border-silver-700/30 rounded-none flex gap-4"
            >
              <it.Icon className="h-5 w-5 text-gold-400 shrink-0 mt-1" strokeWidth={1.5} />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-display font-bold text-titanium-50 text-base">{it.title}</div>
                  <span
                    className={`text-[10px] font-mono uppercase tracking-[0.18em] border px-2 py-0.5 rounded-none ${statusStyle(it.status)}`}
                  >
                    {it.status}
                  </span>
                </div>
                <p className="text-sm text-silver-300 leading-relaxed">{it.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
