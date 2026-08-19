import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, ArrowRight, Check, X, Minus, ExternalLink, Info, Layers, Wallet, ListChecks } from 'lucide-react';
import {
  DSGVO_TOOLS,
  MATRIX_TOOLS,
  MATRIX_AS_OF_LABEL,
  LANDSCAPE_AS_OF_LABEL,
  TOOL_CATEGORIES,
  BUDGET_GUIDANCE,
  SELECTION_CRITERIA,
  PRICING_DISCLAIMER,
  TRANSFER_LABEL,
  toolsByCategory,
  toolByName,
  type DsgvoTool,
  type Rating,
} from '../config/dsgvo-tool-landscape';

function cell(v: Rating): React.ReactNode {
  if (v === 'yes') return <Check className="h-4 w-4 text-emerald-400 inline" />;
  if (v === 'partial') return <Minus className="h-4 w-4 text-amber-400 inline" />;
  return <X className="h-4 w-4 text-red-400 inline" />;
}

/** Origin-Chip — EU gruen, US amber, uebrige Drittlaender blau (wie bisher). */
function originChip(origin: DsgvoTool['origin']) {
  const tone =
    origin === 'EU'
      ? 'border-emerald-900 text-emerald-300 bg-emerald-950/30'
      : origin === 'US'
        ? 'border-amber-900 text-amber-300 bg-amber-950/30'
        : 'border-blue-900 text-blue-300 bg-blue-950/30';
  return (
    <span className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded-none border ${tone}`}>
      {origin}
    </span>
  );
}

const OWN_TOOL = toolByName('RealSyncDynamics.AI');
const ONETRUST_TOOL = toolByName('OneTrust');

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
            <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 border border-emerald-900 bg-emerald-950/30 text-emerald-300 text-xs font-bold uppercase tracking-wider rounded-none">
                {MATRIX_TOOLS.length} Anbieter · Stand {MATRIX_AS_OF_LABEL}
              </div>
              <a
                href="#marktueberblick"
                className="inline-flex items-center gap-2 px-3 py-1 border border-titanium-800 bg-obsidian-900 text-titanium-300 hover:text-titanium-100 hover:border-security-700 text-xs font-bold uppercase tracking-wider rounded-none"
              >
                + {DSGVO_TOOLS.length} im Marktüberblick · Stand {LANDSCAPE_AS_OF_LABEL}
              </a>
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
                {MATRIX_TOOLS.map((t) => (
                  <tr key={t.name} className={t.name === 'RealSyncDynamics.AI' ? 'bg-emerald-950/20' : 'hover:bg-obsidian-950'}>
                    <td className="px-3 py-2.5">
                      <div className="font-display font-bold text-titanium-50">{t.name}</div>
                      <div className="text-[10px] text-titanium-500">{t.vendor}</div>
                    </td>
                    <td className="px-3 py-2.5">{originChip(t.origin)}</td>
                    <td className="px-3 py-2.5 text-titanium-300 text-[11px]">{t.pricingFrom}</td>
                    <td className="px-3 py-2.5 text-center">{cell(t.matrix.cookieConsent)}</td>
                    <td className="px-3 py-2.5 text-center">{cell(t.matrix.avvGenerator)}</td>
                    <td className="px-3 py-2.5 text-center">{cell(t.matrix.auditLog)}</td>
                    <td className="px-3 py-2.5 text-center">{cell(t.matrix.aiAct)}</td>
                    <td className="px-3 py-2.5 text-center">{cell(t.matrix.dsfaWizard)}</td>
                    <td className="px-3 py-2.5 text-center">{cell(t.matrix.euHosted)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3">
            {MATRIX_TOOLS.map((t) => (
              <div key={t.name} className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h2 className="font-display font-bold text-titanium-50">{t.name}</h2>
                    <div className="text-[11px] text-titanium-500">{t.capabilities.join(' · ')}</div>
                  </div>
                  <a href={t.url} target="_blank" rel="noopener noreferrer" className="text-xs text-security-400 hover:underline inline-flex items-center gap-1 shrink-0">
                    Website <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <p className="text-xs text-titanium-300 leading-relaxed">{t.notes}</p>
              </div>
            ))}
          </div>

          {/* ── Marktüberblick: die 4 Kategorien ───────────────────────────── */}
          <section id="marktueberblick" className="pt-8 scroll-mt-20">
            <div className="flex items-start gap-3 mb-2">
              <Layers className="h-6 w-6 text-security-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
                  Marktüberblick {LANDSCAPE_AS_OF_LABEL}: {DSGVO_TOOLS.length} Anbieter in 4 Kategorien
                </h2>
                <p className="text-sm text-titanium-300 leading-relaxed max-w-3xl">
                  Die DSGVO-Pflichten zerfallen in vier Aufgabenbereiche. Die meisten Tools decken genau einen davon
                  ab — nur Enterprise-Plattformen versuchen das Gesamtpaket. Wer die Kategorie kennt, in die die eigene
                  Lücke fällt, spart sich den Vergleich der übrigen drei.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 mt-4 mb-6 bg-obsidian-900 border border-titanium-900 rounded-none">
              <Info className="h-4 w-4 text-titanium-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-titanium-400 leading-relaxed">{PRICING_DISCLAIMER}</p>
            </div>

            <div className="space-y-6">
              {TOOL_CATEGORIES.map((cat, i) => (
                <div key={cat.key} className="bg-obsidian-900 border border-titanium-900 rounded-none">
                  <div className="border-b border-titanium-900 px-4 py-3">
                    <h3 className="font-display font-bold text-titanium-50 text-sm">
                      <span className="text-titanium-600 font-mono mr-2">{String(i + 1).padStart(2, '0')}</span>
                      {cat.label}
                    </h3>
                    <p className="text-[11px] text-titanium-400 leading-relaxed mt-1">{cat.focus}</p>
                  </div>

                  <div className="divide-y divide-titanium-900">
                    {toolsByCategory(cat.key).map((t) => (
                      <div
                        key={t.name}
                        className={`px-4 py-3 ${t.name === 'RealSyncDynamics.AI' ? 'bg-emerald-950/20' : ''}`}
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="font-display font-bold text-titanium-50 text-sm">{t.name}</span>
                          {originChip(t.origin)}
                          <span className="text-[10px] font-mono text-titanium-500">{TRANSFER_LABEL[t.transfer]}</span>
                          {t.matrix && (
                            <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold rounded-none border border-security-800 text-security-300 bg-security-900/30">
                              im Detailvergleich
                            </span>
                          )}
                          <a
                            href={t.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-auto text-[11px] text-security-400 hover:underline inline-flex items-center gap-1 shrink-0"
                          >
                            Website <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                        <div className="text-[10px] text-titanium-500 mb-1.5">{t.vendor}</div>
                        <p className="text-xs text-titanium-300 leading-relaxed">{t.strengths}</p>
                        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-[11px]">
                          <span className="text-titanium-400">
                            Einstieg: <span className="font-mono text-titanium-200">{t.pricingFrom}</span>
                          </span>
                          <span className="text-titanium-400">
                            Passend für: <span className="text-titanium-200">{t.bestFor}</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Budget nach Unternehmensgröße ──────────────────────────────── */}
          <section className="pt-8">
            <div className="flex items-start gap-3 mb-4">
              <Wallet className="h-6 w-6 text-security-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
                  Was das kostet — Orientierung nach Unternehmensgröße
                </h2>
                <p className="text-sm text-titanium-300 leading-relaxed max-w-3xl">
                  Richtwerte für das Gesamtbudget aus Lizenzen und Beratung, nicht für ein einzelnes Tool.
                </p>
              </div>
            </div>

            <div className="bg-obsidian-900 border border-titanium-900 rounded-none overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-obsidian-950 text-titanium-400 uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-3 py-2.5">Unternehmensgröße</th>
                    <th className="text-left px-3 py-2.5">Budget / Jahr</th>
                    <th className="text-left px-3 py-2.5">Typische Zusammenstellung</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-titanium-900">
                  {BUDGET_GUIDANCE.map((b) => (
                    <tr key={b.size} className="hover:bg-obsidian-950">
                      <td className="px-3 py-2.5 font-display font-bold text-titanium-50 align-top whitespace-nowrap">{b.size}</td>
                      <td className="px-3 py-2.5 font-mono text-titanium-200 align-top whitespace-nowrap">{b.budgetPerYear}</td>
                      <td className="px-3 py-2.5 text-titanium-300 leading-relaxed">{b.recommendation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Auswahlkriterien ───────────────────────────────────────────── */}
          <section className="pt-8">
            <div className="flex items-start gap-3 mb-4">
              <ListChecks className="h-6 w-6 text-security-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
                  Sechs Kriterien, an denen sich die Auswahl entscheidet
                </h2>
                <p className="text-sm text-titanium-300 leading-relaxed max-w-3xl">
                  Jedes Kriterium mit der Pflicht, aus der es folgt — damit die Entscheidung begründbar bleibt.
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {SELECTION_CRITERIA.map((c, i) => (
                <div key={c.title} className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
                  <h3 className="font-display font-bold text-titanium-50 text-sm mb-1.5">
                    <span className="text-titanium-600 font-mono mr-2">{String(i + 1).padStart(2, '0')}</span>
                    {c.title}
                  </h3>
                  <p className="text-xs text-titanium-300 leading-relaxed">{c.why}</p>
                </div>
              ))}
            </div>
          </section>

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
                  {OWN_TOOL && ONETRUST_TOOL && (
                    <>
                      {' '}Einstieg ab {OWN_TOOL.pricingFrom}; Enterprise-Suiten wie {ONETRUST_TOOL.name} liegen
                      laut öffentlichen Angaben bei {ONETRUST_TOOL.pricingFrom}.
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link to="/contact-sales?source=tool-vergleich" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Founding Access starten <ArrowRight className="h-4 w-4" />
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
            <Link to="/impressum" className="hover:text-titanium-300">Impressum</Link>
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
            dateModified: '2026-08-19',
            inLanguage: 'de-DE',
            author: { '@type': 'Organization', name: 'RealSync Dynamics' },
          }),
        }}
      />
    </div>
  );
}
