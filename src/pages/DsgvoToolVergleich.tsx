import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, ArrowRight, Check, X, Minus, ExternalLink } from 'lucide-react';

interface Tool {
  name: string;
  vendor: string;
  url: string;
  origin: 'EU' | 'US' | 'UK';
  pricingFrom: string;
  category: string[];
  cookieConsent: 'yes' | 'partial' | 'no';
  avvGenerator: 'yes' | 'partial' | 'no';
  auditLog: 'yes' | 'partial' | 'no';
  aiAct: 'yes' | 'partial' | 'no';
  dsfaWizard: 'yes' | 'partial' | 'no';
  euHosted: 'yes' | 'partial' | 'no';
  notes: string;
}

const TOOLS: Tool[] = [
  {
    name: 'RealSyncDynamics.AI',
    vendor: 'RealSync Dynamics',
    url: 'https://realsyncdynamicsai.de',
    origin: 'EU',
    pricingFrom: '29 €/M',
    category: ['Cookie-Consent', 'AVV', 'Audit-Log', 'AI-Act', 'DSFA'],
    cookieConsent: 'yes', avvGenerator: 'yes', auditLog: 'yes', aiAct: 'yes', dsfaWizard: 'yes', euHosted: 'yes',
    notes: 'All-in-One für KI-First-Compliance · BAIT/MaRisk-tauglich · Made in Germany',
  },
  {
    name: 'OneTrust',
    vendor: 'OneTrust LLC',
    url: 'https://onetrust.com',
    origin: 'US',
    pricingFrom: '~600 €/M (Enterprise-only)',
    category: ['Cookie-Consent', 'AVV', 'DSFA'],
    cookieConsent: 'yes', avvGenerator: 'yes', auditLog: 'partial', aiAct: 'partial', dsfaWizard: 'yes', euHosted: 'partial',
    notes: 'Enterprise-Tier komplex · Schrems-II-Risiko · keine integrierten KI-Audit-Logs',
  },
  {
    name: 'TrustArc',
    vendor: 'TrustArc Inc.',
    url: 'https://trustarc.com',
    origin: 'US',
    pricingFrom: '~400 €/M',
    category: ['Cookie-Consent', 'DSFA'],
    cookieConsent: 'yes', avvGenerator: 'partial', auditLog: 'no', aiAct: 'no', dsfaWizard: 'yes', euHosted: 'partial',
    notes: 'Stark in DSFA · schwach in KI-Compliance · US-DPA',
  },
  {
    name: 'Usercentrics',
    vendor: 'Usercentrics GmbH',
    url: 'https://usercentrics.com',
    origin: 'EU',
    pricingFrom: '~150 €/M',
    category: ['Cookie-Consent'],
    cookieConsent: 'yes', avvGenerator: 'no', auditLog: 'no', aiAct: 'no', dsfaWizard: 'no', euHosted: 'yes',
    notes: 'Cookie-Banner-Marktführer DACH · keine AVV/AI-Tools',
  },
  {
    name: 'DataGuard',
    vendor: 'DataGuard GmbH',
    url: 'https://dataguard.de',
    origin: 'EU',
    pricingFrom: '~300 €/M',
    category: ['DSB-as-a-Service', 'AVV', 'DSFA'],
    cookieConsent: 'partial', avvGenerator: 'yes', auditLog: 'no', aiAct: 'no', dsfaWizard: 'yes', euHosted: 'yes',
    notes: 'Externer DSB + Tools · personell-getrieben · keine KI-Compliance',
  },
  {
    name: 'Borlabs Cookie',
    vendor: 'Borlabs GmbH',
    url: 'https://borlabs.io',
    origin: 'EU',
    pricingFrom: '79 €/Jahr (WP-only)',
    category: ['Cookie-Consent'],
    cookieConsent: 'yes', avvGenerator: 'no', auditLog: 'no', aiAct: 'no', dsfaWizard: 'no', euHosted: 'yes',
    notes: 'WordPress-only · günstig, aber nur Cookie-Banner',
  },
  {
    name: 'Cookiebot (Cybot)',
    vendor: 'Cybot A/S',
    url: 'https://cookiebot.com',
    origin: 'EU',
    pricingFrom: '~10 €/M',
    category: ['Cookie-Consent'],
    cookieConsent: 'yes', avvGenerator: 'no', auditLog: 'no', aiAct: 'no', dsfaWizard: 'no', euHosted: 'partial',
    notes: 'Dänisch, günstig · Server in EU + US · kein KI-Tooling',
  },
];

function cell(v: 'yes' | 'partial' | 'no'): React.ReactNode {
  if (v === 'yes') return <Check className="h-4 w-4 text-emerald-400 inline" />;
  if (v === 'partial') return <Minus className="h-4 w-4 text-amber-400 inline" />;
  return <X className="h-4 w-4 text-red-400 inline" />;
}

export function DsgvoToolVergleich() {
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
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">DSGVO-Tool-Vergleich 2026</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-emerald-900 bg-emerald-950/30 text-emerald-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              7 Anbieter · Stand Mai 2026
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              DSGVO-Tool-Vergleich: <span className="text-security-400">7 Anbieter</span> im Direkt-Test
            </h1>
            <p className="text-lg text-titanium-300 max-w-2xl mx-auto leading-relaxed">
              OneTrust, TrustArc, Usercentrics, DataGuard, Borlabs, Cookiebot, RealSync — was passt für Dein Compliance-Setup?
              Mit Pricing, Origin (Schrems-II!) und Feature-Matrix.
            </p>
          </div>

          <div className="bg-obsidian-900 border border-titanium-900 rounded-none overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-obsidian-950 text-titanium-400 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2.5">Tool</th>
                  <th className="text-left px-3 py-2.5">Origin</th>
                  <th className="text-left px-3 py-2.5">Pricing</th>
                  <th className="text-center px-3 py-2.5">Cookie</th>
                  <th className="text-center px-3 py-2.5">AVV</th>
                  <th className="text-center px-3 py-2.5">Audit-Log</th>
                  <th className="text-center px-3 py-2.5">AI Act</th>
                  <th className="text-center px-3 py-2.5">DSFA</th>
                  <th className="text-center px-3 py-2.5">EU-Hosted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-titanium-900">
                {TOOLS.map((t) => (
                  <tr key={t.name} className={t.name === 'RealSyncDynamics.AI' ? 'bg-emerald-950/20' : 'hover:bg-obsidian-950'}>
                    <td className="px-3 py-2.5">
                      <div className="font-display font-bold text-titanium-50">{t.name}</div>
                      <div className="text-[10px] text-titanium-500">{t.vendor}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded-none border ${t.origin === 'EU' ? 'border-emerald-900 text-emerald-300 bg-emerald-950/30' : t.origin === 'US' ? 'border-amber-900 text-amber-300 bg-amber-950/30' : 'border-blue-900 text-blue-300 bg-blue-950/30'}`}>
                        {t.origin}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-titanium-300 text-[11px]">{t.pricingFrom}</td>
                    <td className="px-3 py-2.5 text-center">{cell(t.cookieConsent)}</td>
                    <td className="px-3 py-2.5 text-center">{cell(t.avvGenerator)}</td>
                    <td className="px-3 py-2.5 text-center">{cell(t.auditLog)}</td>
                    <td className="px-3 py-2.5 text-center">{cell(t.aiAct)}</td>
                    <td className="px-3 py-2.5 text-center">{cell(t.dsfaWizard)}</td>
                    <td className="px-3 py-2.5 text-center">{cell(t.euHosted)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3">
            {TOOLS.map((t) => (
              <div key={t.name} className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h3 className="font-display font-bold text-titanium-50">{t.name}</h3>
                    <div className="text-[11px] text-titanium-500">{t.category.join(' · ')}</div>
                  </div>
                  <a href={t.url} target="_blank" rel="noopener noreferrer" className="text-xs text-security-400 hover:underline inline-flex items-center gap-1 shrink-0">
                    Website <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <p className="text-xs text-titanium-300 leading-relaxed">{t.notes}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
            <div className="flex items-start gap-3 mb-4">
              <ShieldCheck className="h-6 w-6 text-security-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
                  Warum RealSyncDynamics.AI gewinnt — wenn du KI nutzt.
                </h2>
                <p className="text-sm text-titanium-300 leading-relaxed">
                  Die anderen sind stark in Cookie-Banner oder AVV. Aber niemand außer uns deckt KI-Compliance ab —
                  Audit-Log pro AI-Call, AI-Act-Risk-Klassifikation, BAIT-Doku-Export, EU-local-Modus mit Ollama.
                  Bei 5× günstigerem Pricing als OneTrust.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link to="/contact-sales?source=tool-vergleich" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Demo buchen <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/audit" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                Kostenloser DSGVO-Scan
              </Link>
              <Link to="/legal/compliance-matrix" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-titanium-400 hover:text-titanium-200 text-sm rounded-none">
                AI-Provider-Vergleich
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
          </div>
        </div>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: 'DSGVO-Tool-Vergleich 2026: 7 Anbieter im Test',
            description: 'OneTrust, TrustArc, Usercentrics, DataGuard, Borlabs, Cookiebot, RealSyncDynamics — Feature-Matrix mit Pricing und Origin.',
            datePublished: '2026-05-06',
            inLanguage: 'de-DE',
            author: { '@type': 'Organization', name: 'RealSync Dynamics' },
          }),
        }}
      />
    </div>
  );
}
