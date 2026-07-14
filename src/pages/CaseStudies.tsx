import { Link } from 'react-router-dom';
import {
  ArrowLeft, ShieldCheck, ArrowRight, Building2, Stethoscope, Scale, Briefcase, AlertTriangle,
} from 'lucide-react';

interface CaseStudy {
  slug: string;
  industry: 'legal' | 'healthtech' | 'fintech' | 'public' | 'ecommerce' | 'saas' | 'agency';
  company: string;
  size: string;
  challenge: string;
  solution: string;
  outcome: string;
  metrics?: { label: string; value: string }[];
  quote?: { text: string; role: string };
  isPilot?: boolean; // true = Referenzszenario, kein zahlender Kunde
}

// Pilot-Referenzszenarien — klar als „Pilot / Referenzszenario" markiert.
// Erst ersetzen durch echte Customer-Cases, sobald Kunde einwilligt.
const STUDIES: CaseStudy[] = [
  {
    slug: 'shopify-tracker-drift',
    industry: 'ecommerce',
    company: 'Anonymisierter Online-Shop (Shopify)',
    size: '1 Domain · ~50 k Besucher/Monat',
    challenge: 'Nach einem Theme-Update wurden 7 Tracker vor dem Cookie-Consent geladen — darunter Meta Pixel und Google Analytics. Das Team bemerkte den Drift erst 4 Wochen später bei einem manuellen Audit.',
    solution: 'Tägliches Monitoring mit Drift-Detection ab Tag 1. Bei Pre-Consent-Request automatischer Alert per E-Mail inkl. Code-Snippet zum Fix.',
    outcome: 'Drift innerhalb von 2 h entdeckt und behoben. Keine manuellen Audits mehr notwendig.',
    metrics: [
      { label: 'Time-to-detect', value: '<2 h' },
      { label: 'Tracker pre-consent', value: '0' },
      { label: 'Manueller Aufwand', value: '−90 %' },
    ],
    isPilot: true,
  },
  {
    slug: 'saas-ai-act-classification',
    industry: 'saas',
    company: 'Anonymisiertes SaaS-Unternehmen (B2B)',
    size: '8 Mitarbeitende · 3 KI-Features',
    challenge: 'Das Produkt nutzt GPT-4 für drei Features. Unklar, ob eines davon unter Annex III EU AI Act fällt (Limited-Risk / High-Risk). Ohne Klassifikation drohten ungeplante Compliance-Kosten.',
    solution: 'AI-Feature-Scan: automatische Klassifikation gegen Annex-III-Kriterien, Risk-Assessment-Bericht mit konkreter Handlungsempfehlung.',
    outcome: 'Zwei Features als Minimal-Risk eingestuft, ein Feature als Limited-Risk. Transparenz-Pflichten dokumentiert, kein High-Risk-Aufwand.',
    metrics: [
      { label: 'Features klassifiziert', value: '3 / 3' },
      { label: 'High-Risk-Findings', value: '0' },
      { label: 'Berichtszeit', value: '< 1 Tag' },
    ],
    isPilot: true,
  },
  {
    slug: 'agentur-multi-tenant-audit',
    industry: 'agency',
    company: 'Anonymisierte Webagentur (DACH)',
    size: '12 Mitarbeitende · 28 Kundenseiten',
    challenge: 'Manuelle DSGVO-Audits für 28 Kundenseiten alle 6 Monate. Aufwand: ~3 Tage pro Audit-Zyklus. Keine Skalierbarkeit für Wachstum.',
    solution: 'Multi-Tenant-Dashboard: alle 28 Domains auf einem Blick, tägliches Monitoring, White-Label-Reports für Endkunden, API-Export in bestehendes Reporting.',
    outcome: 'Audit-Zyklus von 3 Tagen auf 30 Minuten reduziert. Jede Kundenseite erhält automatisch monatlichen Compliance-Report.',
    metrics: [
      { label: 'Audit-Aufwand', value: '−94 %' },
      { label: 'Domains überwacht', value: '28' },
      { label: 'Reports automatisiert', value: '100 %' },
    ],
    isPilot: true,
  },
];

const INDUSTRY_META: Record<CaseStudy['industry'], { label: string; icon: React.ReactNode; color: string }> = {
  legal: { label: 'Legal', icon: <Scale className="h-4 w-4" />, color: 'text-blue-300 border-blue-900' },
  healthtech: { label: 'HealthTech', icon: <Stethoscope className="h-4 w-4" />, color: 'text-emerald-300 border-emerald-900' },
  fintech: { label: 'FinTech', icon: <Briefcase className="h-4 w-4" />, color: 'text-amber-300 border-amber-900' },
  public: { label: 'Public Sector', icon: <Building2 className="h-4 w-4" />, color: 'text-purple-300 border-purple-900' },
  ecommerce: { label: 'E-Commerce', icon: <Briefcase className="h-4 w-4" />, color: 'text-cyan-300 border-cyan-900' },
  saas: { label: 'SaaS', icon: <Building2 className="h-4 w-4" />, color: 'text-violet-300 border-violet-900' },
  agency: { label: 'Agentur', icon: <Scale className="h-4 w-4" />, color: 'text-amber-300 border-amber-900' },
};

export function CaseStudies() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Case Studies</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-amber-900 bg-amber-950/30 text-amber-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <AlertTriangle className="h-3 w-3" /> Pilot · Referenzszenarien
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              Typische Compliance-Probleme — <span className="text-security-400">und wie sie gelöst werden</span>
            </h1>
            <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
              Die folgenden Szenarien basieren auf realen Problemstellungen aus unserer Pilotphase.
              Sie sind als Referenzszenarien ausgewiesen — keine anonymisierten Kundenstories.
            </p>
          </div>

          {STUDIES.length === 0 ? (
            <PlaceholderState />
          ) : (
            <div className="space-y-6">
              {STUDIES.map((s) => <StudyCard key={s.slug} study={s} />)}
            </div>
          )}

          <div className="mt-16 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
            <div className="flex items-start gap-3 mb-4">
              <ShieldCheck className="h-6 w-6 text-security-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
                  Werde unsere nächste Case-Study.
                </h2>
                <p className="text-sm text-titanium-300 leading-relaxed">
                  Pilot-Tier 14 Tage kostenlos. Wenn's passt, danach Growth 249 €/M (oder Starter 79 €/M). Bei Erfolg veröffentlichen wir Deinen Case (anonym oder named — Deine Wahl).
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link to="/contact-sales?source=case-studies" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Founding Access starten <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/audit" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                Kostenloser DSGVO-Scan
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function PlaceholderState() {
  return (
    <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-8 sm:p-10 text-center">
      <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-4 opacity-60" />
      <h2 className="font-display font-bold text-titanium-50 text-lg mb-2">
        Erste Case-Studies in Vorbereitung
      </h2>
      <p className="text-sm text-titanium-300 mb-6 max-w-lg mx-auto leading-relaxed">
        Wir sind seit Kurzem live und finalisieren gerade die ersten Customer-Cases. Schau in 4-6 Wochen
        wieder rein — oder werde selbst Reference-Account.
      </p>
      <div className="grid sm:grid-cols-2 gap-3 max-w-lg mx-auto text-left">
        {(Object.entries(INDUSTRY_META) as [CaseStudy['industry'], typeof INDUSTRY_META[CaseStudy['industry']]][]).map(([key, meta]) => (
          <div key={key} className="p-3 border border-titanium-900 bg-obsidian-950 rounded-none">
            <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 border ${meta.color} text-[10px] font-bold uppercase tracking-wider rounded-none mb-1`}>
              {meta.icon} {meta.label}
            </div>
            <div className="text-xs text-titanium-400">Case in Vorbereitung</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StudyCard({ study }: { study: CaseStudy }) {
  const meta = INDUSTRY_META[study.industry];
  return (
    <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-6">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 border ${meta.color} text-[10px] font-bold uppercase tracking-wider rounded-none`}>
          {meta.icon} {meta.label}
        </div>
        {study.isPilot && (
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 border border-amber-900 bg-amber-950/30 text-amber-300 text-[10px] font-bold uppercase tracking-wider rounded-none">
            <AlertTriangle className="h-2.5 w-2.5" /> Referenzszenario · Kein Kundenzitat
          </div>
        )}
      </div>
      <h3 className="font-display font-bold text-titanium-50 text-xl mb-2">{study.company}</h3>
      <div className="text-xs text-titanium-500 mb-3">{study.size}</div>
      <p className="text-sm text-titanium-300 leading-relaxed mb-2"><strong className="text-titanium-200">Problem:</strong> {study.challenge}</p>
      <p className="text-sm text-titanium-300 leading-relaxed mb-4"><strong className="text-titanium-200">Lösung:</strong> {study.solution}</p>
      {study.metrics && (
        <div className="grid grid-cols-3 gap-3 mb-3 text-center border-t border-titanium-900 pt-4">
          {study.metrics.map((m) => (
            <div key={m.label}>
              <div className="font-display text-2xl font-bold text-emerald-400 tabular-nums">{m.value}</div>
              <div className="text-[10px] text-titanium-500 uppercase tracking-wider">{m.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-titanium-900 mt-12 py-6 px-4">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-3 sm:justify-between text-xs text-titanium-500">
        <div>© 2026 RealSync Dynamics · Made in Germany · EU-Hosted (Frankfurt)</div>
        <div className="flex flex-wrap gap-3">
          <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>
          <Link to="/impressum" className="hover:text-titanium-300">Impressum</Link>
        </div>
      </div>
    </footer>
  );
}
