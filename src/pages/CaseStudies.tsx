import { Link } from 'react-router-dom';
import {
  ArrowLeft, ShieldCheck, ArrowRight, Building2, Stethoscope, Scale, Briefcase, AlertTriangle,
} from 'lucide-react';

interface CaseStudy {
  slug: string;
  industry: 'legal' | 'healthtech' | 'fintech' | 'public';
  company: string; // anonymisiert oder mit Einwilligung
  size: string;
  challenge: string;
  solution: string;
  outcome: string;
  metrics?: { label: string; value: string }[];
  quote?: { text: string; role: string };
}

// Add real customer cases here once first paying customers consent.
// Empty array → page shows placeholder + lead-magnet CTA.
const STUDIES: CaseStudy[] = [];

const INDUSTRY_META: Record<CaseStudy['industry'], { label: string; icon: React.ReactNode; color: string }> = {
  legal: { label: 'Legal', icon: <Scale className="h-4 w-4" />, color: 'text-blue-300 border-blue-900' },
  healthtech: { label: 'HealthTech', icon: <Stethoscope className="h-4 w-4" />, color: 'text-emerald-300 border-emerald-900' },
  fintech: { label: 'FinTech', icon: <Briefcase className="h-4 w-4" />, color: 'text-amber-300 border-amber-900' },
  public: { label: 'Public Sector', icon: <Building2 className="h-4 w-4" />, color: 'text-purple-300 border-purple-900' },
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
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-emerald-900 bg-emerald-950/30 text-emerald-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <Building2 className="h-3 w-3" /> DACH-Customer-Cases
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              Wie unsere Kunden in <span className="text-security-400">14 Tagen</span> compliance-ready werden
            </h1>
            <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
              Konkrete Cases aus regulierten Branchen — was die Probleme waren, was wir geliefert haben, was rauskam.
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
                  Pilot-Tier 14 Tage kostenlos. Wenn's passt, danach Growth 179 €/M (oder Starter 49 €/M). Bei Erfolg veröffentlichen wir Deinen Case (anonym oder named — Deine Wahl).
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
    <Link to={`/case-studies/${study.slug}`} className="block bg-obsidian-900 border border-titanium-900 hover:border-security-500 rounded-none p-6 transition-colors">
      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 border ${meta.color} text-[10px] font-bold uppercase tracking-wider rounded-none mb-3`}>
        {meta.icon} {meta.label}
      </div>
      <h3 className="font-display font-bold text-titanium-50 text-xl mb-2">{study.company}</h3>
      <div className="text-xs text-titanium-500 mb-3">{study.size}</div>
      <p className="text-sm text-titanium-300 leading-relaxed mb-4">{study.challenge}</p>
      {study.metrics && (
        <div className="grid grid-cols-3 gap-3 mb-3 text-center">
          {study.metrics.map((m) => (
            <div key={m.label}>
              <div className="font-display text-2xl font-bold text-emerald-400 tabular-nums">{m.value}</div>
              <div className="text-[10px] text-titanium-500 uppercase tracking-wider">{m.label}</div>
            </div>
          ))}
        </div>
      )}
      <div className="text-xs text-security-400">Vollständige Case lesen →</div>
    </Link>
  );
}

function Footer() {
  return (
    <footer className="border-t border-titanium-900 mt-12 py-6 px-4">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-3 sm:justify-between text-xs text-titanium-500">
        <div>© 2026 RealSync Dynamics · Made in Germany · EU-Hosted (Frankfurt)</div>
        <div className="flex flex-wrap gap-3">
          <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>
          <Link to="/legal/sub-processors" className="hover:text-titanium-300">Impressum</Link>
        </div>
      </div>
    </footer>
  );
}
