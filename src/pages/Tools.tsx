import { Link } from 'react-router-dom';
import {
  ArrowLeft, ShieldCheck, ArrowRight, FileSearch, FileText, AlertTriangle, ClipboardList,
  Cookie, Brain, Lock, GitMerge,
} from 'lucide-react';

interface Tool {
  href: string;
  badge: string;
  title: string;
  description: string;
  paragraph?: string;
  icon: React.ReactNode;
  free: boolean;
  premium?: string;
}

const TOOLS: Tool[] = [
  {
    href: '/audit',
    badge: 'Audit',
    title: 'DSGVO-Audit-Scanner',
    description: '29 Heuristiken in 30 Sekunden. Score 0-100 mit Paragraph-Referenzen. Kein Account, kein Cookie.',
    paragraph: 'DSGVO Art. 32 + AI Act + § 25 TTDSG',
    icon: <FileSearch className="h-5 w-5" />,
    free: true,
  },
  {
    href: '/avv-generator',
    badge: 'Generator',
    title: 'AVV-Generator',
    description: '3-Step-Wizard für AVV gemäß Art. 28 Abs. 3. Mit TOM-Anhang, Sub-Auftragsverarbeiter-Liste, druckfertig.',
    paragraph: 'DSGVO Art. 28 Abs. 3',
    icon: <FileText className="h-5 w-5" />,
    free: true,
  },
  {
    href: '/vvt-wizard',
    badge: 'Wizard',
    title: 'VVT-Wizard (Art. 30)',
    description: 'Verzeichnis der Verarbeitungstätigkeiten erstellen. Inkl. TOMs + Drittland-Tracking. Export als PDF/CSV.',
    paragraph: 'DSGVO Art. 30',
    icon: <ClipboardList className="h-5 w-5" />,
    free: true,
  },
  {
    href: '/ai-act-klassifikator',
    badge: 'Klassifikator',
    title: 'AI-Act-Risikoklassifikator',
    description: 'Annex III · 12 Fragen → automatische Einstufung Minimal / Limited / High / Unacceptable. Mit Begründung.',
    paragraph: 'AI Act Art. 6 + Annex III',
    icon: <Brain className="h-5 w-5" />,
    free: true,
  },
  {
    href: '/datenpanne-meldung',
    badge: 'Timer',
    title: '72h-Meldepflicht-Timer',
    description: 'Datenpanne erfasst → Live-Countdown. 17 Aufsichtsbehörden je Bundesland + Meldepflicht-Checkliste.',
    paragraph: 'DSGVO Art. 33 + 34',
    icon: <AlertTriangle className="h-5 w-5" />,
    free: true,
  },
  {
    href: '/tom-generator',
    badge: 'Generator',
    title: 'TOM-Generator',
    description: 'Technisch-organisatorische Maßnahmen-Doku gemäß Art. 32. Pseudonymisierung, Verschlüsselung, Zugriffskontrolle.',
    paragraph: 'DSGVO Art. 32 lit. a–d',
    icon: <Lock className="h-5 w-5" />,
    free: true,
  },
  {
    href: '/cookie-consent-sdk',
    badge: 'SDK',
    title: 'Cookie-Consent-SDK',
    description: 'Embedbar via 1-Zeilen-Script. 3 gleichberechtigte Buttons (BfDI 2024). i18n DE/EN.',
    paragraph: '§ 25 TTDSG · BfDI 2024',
    icon: <Cookie className="h-5 w-5" />,
    free: true,
    premium: '49 €/M Pro (White-Label)',
  },
  {
    href: '/legal/compliance-matrix',
    badge: 'Vergleich',
    title: 'AI-Provider-Compliance-Matrix',
    description: '4 Provider × 18 Kriterien (OpenAI · Anthropic · Google · RealSync). Mit BfDI/EDSA/BSI-Referenzen.',
    paragraph: 'EuGH C-311/18 + EDSA',
    icon: <GitMerge className="h-5 w-5" />,
    free: true,
  },
];

const PREMIUM: Tool[] = [
  {
    href: '/audit-pro',
    badge: 'Premium',
    title: 'Audit-Pro Tiefenscan',
    description: '100+ Heuristiken automatisch + manueller Review. 5 Tage Lieferung, signiertes PDF, DSFA-Bewertung, Re-Audit nach 30 Tagen inklusive.',
    icon: <FileSearch className="h-5 w-5" />,
    free: false,
    premium: '499 € einmalig',
  },
  {
    href: '/contact-sales?source=tools',
    badge: 'SaaS',
    title: 'RealSync Compliance-Plattform',
    description: 'Audit-Log über jeden KI-Call · EU-Datenresidenz · Multi-Tenant · BAIT/MaRisk-tauglich · 14 Tage Pilot kostenlos.',
    icon: <ShieldCheck className="h-5 w-5" />,
    free: false,
    premium: '29 €/M – 299 €/M',
  },
];

export function Tools() {
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
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">DSGVO-Tool-Suite</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-emerald-900 bg-emerald-950/30 text-emerald-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              8 kostenlose Tools · Kein Account · DSGVO-konform
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              Compliance-Tool-Suite — <span className="text-security-400">alles was Du brauchst</span>
            </h1>
            <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
              8 kostenlose Tools für DSGVO + AI Act + § 25 TTDSG.
              Direkt nutzbar, mit Paragraph-Referenzen, kein Sales-Funnel im Weg.
            </p>
          </div>

          <section>
            <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-4">Free Tools</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {TOOLS.map((t) => <ToolCard key={t.href} tool={t} />)}
            </div>
          </section>

          <section>
            <h2 className="text-xs font-bold text-amber-400 uppercase tracking-[0.2em] mb-4">Premium</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {PREMIUM.map((t) => <ToolCard key={t.href} tool={t} />)}
            </div>
          </section>

          <div className="mt-12 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
            <div className="flex items-start gap-3 mb-4">
              <ShieldCheck className="h-6 w-6 text-security-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
                  Alle Tools nutzen — eine Plattform.
                </h2>
                <p className="text-sm text-titanium-300 leading-relaxed">
                  Statt 8 Tools manuell zu jonglieren: RealSync verbindet alle in einem Dashboard.
                  Audit-Log + AVV + DSFA + AI-Act-Klassifikation + Cookie-Banner — pro Tenant, mit Aufsichts-Export.
                  Pilot 14 Tage kostenlos.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link to="/contact-sales?source=tools-hub" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Demo buchen <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/pricing?pilot=true" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-emerald-700 hover:bg-emerald-950/30 text-emerald-300 text-sm font-bold rounded-none">
                14-Tage-Pilot starten
              </Link>
              <Link to="/dsgvo-tool-vergleich" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-titanium-400 hover:text-titanium-200 text-sm rounded-none">
                Wettbewerber-Vergleich
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-titanium-900 mt-12 py-6 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row gap-3 sm:justify-between text-xs text-titanium-500">
          <div>© 2026 RealSync Dynamics · Made in Germany · EU-Hosted</div>
          <div className="flex flex-wrap gap-3">
            <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>
            <Link to="/legal/sub-processors" className="hover:text-titanium-300">Impressum</Link>
            <Link to="/legal/avv" className="hover:text-titanium-300">AVV</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ToolCard({ tool }: { tool: Tool }) {
  return (
    <Link to={tool.href}
      className="block bg-obsidian-900 border border-titanium-900 hover:border-security-500 rounded-none p-5 transition-colors">
      <div className="flex items-start gap-3 mb-3">
        <div className={`shrink-0 w-10 h-10 rounded-none border flex items-center justify-center ${
          tool.free
            ? 'bg-emerald-950/40 border-emerald-900 text-emerald-300'
            : 'bg-amber-950/40 border-amber-900 text-amber-300'
        }`}>
          {tool.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-[10px] uppercase tracking-wider font-bold mb-1 ${
            tool.free ? 'text-emerald-400' : 'text-amber-400'
          }`}>
            {tool.badge}{tool.premium && ` · ${tool.premium}`}
          </div>
          <h3 className="font-display font-bold text-titanium-50 text-base">{tool.title}</h3>
        </div>
      </div>
      <p className="text-sm text-titanium-300 leading-relaxed mb-3">{tool.description}</p>
      {tool.paragraph && (
        <div className="text-[11px] text-titanium-500 font-mono mb-2">{tool.paragraph}</div>
      )}
      <div className="text-xs text-security-400 inline-flex items-center gap-1">
        Tool öffnen <ArrowRight className="h-3 w-3" />
      </div>
    </Link>
  );
}
