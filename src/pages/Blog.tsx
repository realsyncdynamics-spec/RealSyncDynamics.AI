import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, FileText } from 'lucide-react';
import { usePageMeta } from '../lib/usePageMeta';

/**
 * /blog — minimal placeholder index.
 *
 * Five honest themed cards mapped to topics where the platform has
 * actual technical knowledge to share. Each card is currently a stub —
 * see TODO markers; published posts will replace these one by one.
 *
 * Why a stub instead of generated filler:
 *   - We do not publish AI-written compliance content without expert review.
 *   - Empty categories are honest; fake article counts are not.
 */

interface Topic {
  slug: string;
  title: string;
  blurb: string;
}

const TOPICS: Topic[] = [
  {
    slug: 'dsgvo-compliance-governance',
    title: 'DSGVO-Compliance in der Praxis',
    blurb:
      'Europäische Datenschutz-Grundverordnung: Anforderungen an Verarbeitung, Speicherung und Audit. Wie Sie Konformität messbar und nachweisbar aufbauen.',
  },
  {
    slug: 'eu-ai-act-classification',
    title: 'EU AI Act — Klassifizierung & Risiken',
    blurb:
      'Minimal Risk bis Prohibited Systems: Wie Sie KI-Anwendungen richtig einordnen, Risikoklassen identifizieren und Conformity Assessments durchführen.',
  },
  {
    slug: 'ki-governance-framework',
    title: 'KI-Governance Framework',
    blurb:
      'Policies, Prozesse, Audit-Trails für KI-Systeme in Unternehmen. Wie Sie AI Governance strukturieren und kontinuierlich prüfen.',
  },
  {
    slug: 'evidence-management-audit-trails',
    title: 'Evidence Management & Audit Trails',
    blurb:
      'Nachweisbarkeit ist alles: Wie Sie Entscheidungen, Datenflüsse und Genehmigungen für Prüfer dokumentieren und forensisch nachvollziehbar machen.',
  },
  {
    slug: 'privacy-by-design-implementation',
    title: 'Privacy by Design (Umsetzung)',
    blurb:
      'Nicht nur Compliance-Checkliste: Privacy by Design in Architecture, Data Flows und Code. Praktische Patterns für datenschutzkonforme Systeme.',
  },
  {
    slug: 'vendor-governance-risk',
    title: 'Vendor Governance & Risiko-Management',
    blurb:
      'Drittanbieter, SaaS-Provider, Cloud-Services: Wie Sie Supply-Chain-Risiken identifizieren, bewerten und kontinuierlich überwachen.',
  },
  {
    slug: 'code-compliance-audit',
    title: 'Code Compliance & Audit',
    blurb:
      'Technische Compliance mesbar machen: Log-Analysis, Vulnerability Scanning, Dependency Tracking und automatisierte Policy-Prüfung im Code.',
  },
  {
    slug: 'data-classification-retention',
    title: 'Datensensitivität & Retention Policies',
    blurb:
      'Personendaten, Geschäftsgeheimnisse, öffentliche Daten — Klassifizierung, Speicherfristen und Löschpflichten richtig umsetzen.',
  },
];

export function Blog() {
  usePageMeta({
    title: 'RealSync Dynamics Blog — KI-Governance, DSGVO, EU AI Act',
    description:
      'Enterprise-Leitfäden zu DSGVO-Compliance, EU AI Act Klassifizierung, KI-Governance, Evidence Management, Privacy by Design und Vendor Governance. Praxisorientiert, technisch fundiert, ohne Marketing-Lyrik.',
    url: 'https://realsyncdynamics.ai/blog',
  });

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link
          to="/"
          className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3"
          aria-label="Zur Startseite"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-titanium-500 to-titanium-700 flex items-center justify-center">
            <BookOpen className="h-4 w-4 text-titanium-50" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Blog</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400 mb-3">
              Governance & Compliance
            </div>
            <h1 className="font-display font-bold text-3xl sm:text-4xl text-titanium-50 tracking-tight leading-tight max-w-2xl mx-auto">
              KI-Governance, DSGVO & EU AI Act
            </h1>
            <p className="mt-4 text-sm text-silver-400 max-w-2xl mx-auto leading-relaxed">
              Enterprise-Leitfäden für technische Compliance. Risiko-Klassifizierung, Audit-Trails, Privacy by Design — ohne Marketing-Rhetorik. Jeder Beitrag ist Fach-geprüft und praxiserprobt.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {TOPICS.map((t) => (
              <div
                key={t.slug}
                className="p-5 sm:p-6 bg-obsidian-900/60 border border-silver-700/30 rounded-none flex gap-4"
              >
                <FileText className="h-5 w-5 text-gold-400 shrink-0 mt-1" strokeWidth={1.5} />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-display font-bold text-titanium-50 text-base">{t.title}</div>
                    <span className="text-[10px] font-mono uppercase tracking-[0.18em] border border-silver-500 text-silver-300 px-2 py-0.5 rounded-none">
                      In Vorbereitung
                    </span>
                  </div>
                  <p className="text-sm text-silver-300 leading-relaxed">{t.blurb}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-10 text-center text-xs text-titanium-500">
            Themen-Wünsche? <Link to="/contact-sales?source=blog-suggest" className="text-titanium-300 hover:text-titanium-100 underline-offset-4 hover:underline">Kontaktieren Sie unser Team.</Link>
          </p>
        </div>
      </main>

      <footer className="border-t border-titanium-900 px-4 sm:px-6 py-8">
        <div className="max-w-5xl mx-auto text-xs text-titanium-500 flex flex-wrap items-center justify-between gap-3">
          <span>© 2026 RealSync Dynamics — Made in Germany, Hosted in EU</span>
          <Link to="/legal/compliance-methodology" className="hover:text-titanium-300">Compliance Methodik 2026.Q2</Link>
        </div>
      </footer>
    </div>
  );
}
