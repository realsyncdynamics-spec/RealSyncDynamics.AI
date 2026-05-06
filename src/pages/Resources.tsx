import { Link } from 'react-router-dom';
import {
  ArrowLeft, ShieldCheck, ArrowRight, BookOpen, Globe, Building2, FileText, Layers,
  AlertTriangle, GitMerge,
} from 'lucide-react';

interface Resource {
  href: string;
  title: string;
  description: string;
  badge: string;
  icon: React.ReactNode;
  external?: boolean;
}

const RESOURCES: Resource[] = [
  {
    href: '/dsgvo-ki-checkliste',
    title: 'DSGVO + AI Act Checkliste',
    description: '28 Punkte in 7 Kategorien — Datenresidenz, Transparenz, Sicherheit Art. 32, Rechte, AVV, AI Act, Beweisbarkeit. Mit Paragraph-Referenzen.',
    badge: 'Checkliste',
    icon: <Layers className="h-5 w-5" />,
  },
  {
    href: '/ai-act-faq',
    title: 'EU AI Act — 18 Fragen',
    description: 'Was bedeutet der AI Act für Dein Business? Risiko-Klassen, Pflichten, Fristen, Sanktionen, Praxis-Tipps.',
    badge: 'FAQ',
    icon: <AlertTriangle className="h-5 w-5" />,
  },
  {
    href: '/schrems-ii-erklaert',
    title: 'Schrems-II für KI-Tools',
    description: 'EuGH C-311/18 + DPF 2023: warum US-Cloud-KI zusätzliche Schutzmaßnahmen braucht. EDSA-Empfehlungen konkret.',
    badge: 'Tutorial',
    icon: <Globe className="h-5 w-5" />,
  },
  {
    href: '/bait-marisk-compliance-guide',
    title: 'BAIT & MaRisk für FinTechs',
    description: 'BAIT AT 4.5, MaRisk AT 7.2, DORA — wie regulierte FinTechs KI-Dienste compliant einsetzen.',
    badge: 'Guide',
    icon: <Building2 className="h-5 w-5" />,
  },
  {
    href: '/legal/compliance-matrix',
    title: 'Compliance-Matrix',
    description: 'Vergleich OpenAI · Anthropic · Google · RealSync auf 18 Compliance-Kriterien. Mit BfDI/EDSA/BSI-Referenzen.',
    badge: 'Vergleich',
    icon: <GitMerge className="h-5 w-5" />,
  },
  {
    href: '/legal/avv',
    title: 'AVV-Template',
    description: 'AVV gemäß DSGVO Art. 28 Abs. 3 mit TOM-Anhang. 10 Paragraphen, druckfertig, anpassbar.',
    badge: 'Template',
    icon: <FileText className="h-5 w-5" />,
  },
  {
    href: '/audit',
    title: 'DSGVO-Audit-Scanner',
    description: '29 Heuristiken in 30 Sekunden. Score 0-100, Befunde mit Paragraph-Referenz, optional Email-Report.',
    badge: 'Tool · Kostenlos',
    icon: <ShieldCheck className="h-5 w-5" />,
  },
  {
    href: '/case-studies',
    title: 'Customer Cases',
    description: 'Wie Kanzleien, HealthTechs, FinTechs in 14 Tagen compliance-ready werden. Konkrete Cases aus DACH.',
    badge: 'Stories',
    icon: <BookOpen className="h-5 w-5" />,
  },
];

export function Resources() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center">
            <BookOpen className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Ressourcen</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-emerald-900 bg-emerald-950/30 text-emerald-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <BookOpen className="h-3 w-3" /> 8 kostenlose Tools + Guides
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              DSGVO + AI Act Wissens-Hub
            </h1>
            <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
              Alle Ressourcen für Compliance-Entscheider in regulierten Branchen — Tools, Guides, Templates, Vergleiche.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {RESOURCES.map((r) => (
              <Link key={r.href} to={r.href}
                className="block bg-obsidian-900 border border-titanium-900 hover:border-security-500 rounded-none p-5 transition-colors">
                <div className="flex items-start gap-3 mb-3">
                  <div className="shrink-0 w-10 h-10 rounded-none bg-emerald-950/40 border border-emerald-900 flex items-center justify-center text-emerald-300">
                    {r.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold mb-1">
                      {r.badge}
                    </div>
                    <h2 className="font-display font-bold text-titanium-50 text-base">{r.title}</h2>
                  </div>
                </div>
                <p className="text-sm text-titanium-300 leading-relaxed mb-3">{r.description}</p>
                <div className="text-xs text-security-400 inline-flex items-center gap-1">
                  Lesen <ArrowRight className="h-3 w-3" />
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-16 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
            <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
              Newsletter — 1× monatlich, immer aktuell.
            </h2>
            <p className="text-sm text-titanium-300 leading-relaxed mb-4">
              Wir schicken Dir einmal pro Monat die neusten DSGVO-Urteile, AI-Act-Updates, BfDI-Leitlinien
              + 1 konkretes Case aus unserer Praxis. Double-Opt-In gemäß § 7 UWG.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link to="/audit" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Erstmal Site auditen <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/contact-sales?source=resources" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                Demo buchen
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-titanium-900 mt-12 py-6 px-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-3 sm:justify-between text-xs text-titanium-500">
          <div>© 2026 RealSync Dynamics · Made in Germany · EU-Hosted (Frankfurt)</div>
          <div className="flex flex-wrap gap-3">
            <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>
            <Link to="/legal/sub-processors" className="hover:text-titanium-300">Impressum</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
