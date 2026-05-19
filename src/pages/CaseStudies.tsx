import { Link } from 'react-router-dom';
import {
  ArrowLeft, ShieldCheck, ArrowRight, Building2, ShoppingBag, Cpu, Layers,
} from 'lucide-react';

interface CaseStudy {
  slug: string;
  industry: 'ecommerce' | 'saas' | 'agency';
  /** "Pilot" = Pilotphase, kein bezahlter Customer-Case. "Reference" = anonymer Echt-Kunde mit Einwilligung. */
  kind: 'Pilot' | 'Reference';
  company: string;
  size: string;
  challenge: string;
  solution: string;
  outcome: string;
  metrics?: { label: string; value: string }[];
}

const STUDIES: CaseStudy[] = [
  {
    slug: 'shopify-store-tracker-drift',
    industry: 'ecommerce',
    kind: 'Pilot',
    company: 'Shopify-Store (D2C-Fashion, 1 Shop)',
    size: 'Pilotpartner · Pre-Launch-Phase',
    challenge:
      'Cookie-Banner war konfiguriert, aber nach jedem App-Install lud der Store erneut pre-consent Tracker (Meta Pixel, TikTok Pixel, Klaviyo). Drift war nicht sichtbar, bis ein Mandant beim Bestellprozess die Consent-Quelle prüfte.',
    solution:
      'Tägliches Monitoring mit Diff zur letzten Baseline. Alarm bei neuen Network-Requests vor Consent-Event. Fix-Snippets für GTM-Container und Shopify-Theme-Layer.',
    outcome:
      'Drift wird innerhalb von 24 h erkannt statt erst beim nächsten manuellen Audit. 3 unbeabsichtigte App-Tracker entdeckt und entfernt.',
    metrics: [
      { label: 'Tracker-Drift erkannt in', value: '< 24 h' },
      { label: 'Pre-Consent-Requests', value: '−100 %' },
      { label: 'Manuelle Audit-Stunden', value: '−6 h/M' },
    ],
  },
  {
    slug: 'saas-ai-feature-classification',
    industry: 'saas',
    kind: 'Pilot',
    company: 'B2B-SaaS (LegalTech-Werkzeug)',
    size: 'Pilotpartner · 8-Personen-Team',
    challenge:
      'Drei AI-Features im Produkt — Vertragsanalyse, Termin-Vorschläge, automatisierte Antwortentwürfe. Unklarer Status nach EU AI Act: minimal / limited / high risk? Audit durch externen DSB stand an.',
    solution:
      'Strukturierte Klassifikation pro Feature gegen Annex III, Dokumentation der Inputs/Outputs/Trainings­daten und Risk-Statement im Evidence Vault. Output: kanzleifähiges PDF + maschinenlesbares JSON.',
    outcome:
      'Externer DSB konnte alle drei Features in einem 60-min-Termin durchgehen statt in einem mehrtägigen Workshop. Klassifikation überlebt das nächste Feature-Update.',
    metrics: [
      { label: 'DSB-Audit-Dauer', value: '60 min' },
      { label: 'Annex-III-Mapping', value: '3/3 Features' },
      { label: 'Evidence-Items versiegelt', value: '47' },
    ],
  },
  {
    slug: 'agency-multi-tenant-audit',
    industry: 'agency',
    kind: 'Pilot',
    company: 'Digital-Agentur (DACH, 12 Kundenseiten)',
    size: 'Pilotpartner · Frühphase',
    challenge:
      'Agentur betreute 12 Kundenwebsites. Vor jedem Quartalsreport musste der Junior-Consultant jede Seite einzeln in Cookiebot + Browser-Devtools prüfen — 2 Tage Arbeit, leicht inkonsistent.',
    solution:
      'Bulk-Scan über alle 12 Domains, White-Label-PDF-Report mit Agentur-Logo pro Kunde, API-Hook in das interne Reporting-Tool, Multi-Tenant-Dashboard.',
    outcome:
      'Quartalsreport-Zeit pro Kundenseite auf < 10 min reduziert. Drei vorher unbekannte Findings auf zwei Seiten gefunden (Heatmap-Tool ohne AVV, Schriftarten-CDN außerhalb EU).',
    metrics: [
      { label: 'Audit-Aufwand', value: '−87 %' },
      { label: 'Domains automatisiert', value: '12 / 12' },
      { label: 'Findings entdeckt', value: '3 neue' },
    ],
  },
];

const PILOT_NOTE =
  'Diese Cases stammen aus der Pilotphase. Sie zeigen das tatsächliche Verhalten des Produkts an realen Setups, sind aber keine veröffentlichten Customer-Stories mit Markenname. Sobald Kunden ihrer Veröffentlichung zustimmen, werden die anonymen Cases durch namentliche ersetzt.';

const INDUSTRY_META: Record<CaseStudy['industry'], { label: string; icon: React.ReactNode; color: string }> = {
  ecommerce: { label: 'E-Commerce', icon: <ShoppingBag className="h-4 w-4" />, color: 'text-amber-300 border-amber-900' },
  saas: { label: 'SaaS', icon: <Cpu className="h-4 w-4" />, color: 'text-cyan-300 border-cyan-900' },
  agency: { label: 'Agentur', icon: <Layers className="h-4 w-4" />, color: 'text-violet-300 border-violet-900' },
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
              <Building2 className="h-3 w-3" /> Pilotphase · 3 Cases
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              Was die Plattform in <span className="text-security-400">echten Setups</span> tut
            </h1>
            <p className="text-lg text-titanium-300 max-w-2xl mx-auto leading-relaxed">
              Drei Cases aus der Pilotphase — was das Problem war, was wir geliefert haben, was messbar herauskam. Anonymisiert, weil die Pilotpartner noch keiner Veröffentlichung mit Marke zugestimmt haben.
            </p>
          </div>

          <div className="mb-8 p-4 bg-obsidian-900 border border-amber-900/60 rounded-none text-xs text-titanium-400 leading-relaxed">
            <span className="text-amber-300 font-bold uppercase tracking-wider mr-2">Hinweis</span>
            {PILOT_NOTE}
          </div>

          <div className="space-y-6">
            {STUDIES.map((s) => <StudyCard key={s.slug} study={s} />)}
          </div>

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

function StudyCard({ study }: { study: CaseStudy }) {
  const meta = INDUSTRY_META[study.industry];
  return (
    <article className="block bg-obsidian-900 border border-titanium-900 rounded-none p-6">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 border ${meta.color} text-[10px] font-bold uppercase tracking-wider rounded-none`}>
          {meta.icon} {meta.label}
        </div>
        <div className="inline-flex items-center px-2 py-0.5 border border-amber-900 bg-amber-950/30 text-amber-300 text-[10px] font-bold uppercase tracking-wider rounded-none">
          {study.kind === 'Pilot' ? 'Pilot-Case' : 'Reference (anonym)'}
        </div>
      </div>
      <h3 className="font-display font-bold text-titanium-50 text-xl mb-1">{study.company}</h3>
      <div className="text-xs text-titanium-500 mb-4">{study.size}</div>

      <div className="space-y-3 text-sm text-titanium-300 leading-relaxed mb-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-titanium-500 mb-1">Problem</div>
          <p>{study.challenge}</p>
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-titanium-500 mb-1">Lösung</div>
          <p>{study.solution}</p>
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-titanium-500 mb-1">Ergebnis</div>
          <p>{study.outcome}</p>
        </div>
      </div>

      {study.metrics && (
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-titanium-900 text-center">
          {study.metrics.map((m) => (
            <div key={m.label}>
              <div className="font-display text-2xl font-bold text-emerald-400 tabular-nums">{m.value}</div>
              <div className="text-[10px] text-titanium-500 uppercase tracking-wider">{m.label}</div>
            </div>
          ))}
        </div>
      )}
    </article>
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
          <Link to="/legal/terms" className="hover:text-titanium-300">AGB</Link>
        </div>
      </div>
    </footer>
  );
}
