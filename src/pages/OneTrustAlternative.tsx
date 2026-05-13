import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, ArrowRight, Check, X, Minus, Euro, Globe, Award } from 'lucide-react';
import { CompetitorComparisonSection } from '../components/CompetitorComparisonSection';
import { ConsentLimitsSection } from '../components/sections/ConsentLimitsSection';
import { ONETRUST_COMPARISON } from '../config/competitor-comparisons';

export function OneTrustAlternative() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center">
            <Award className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">OneTrust-Alternative</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-emerald-900 bg-emerald-950/30 text-emerald-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <Euro className="h-3 w-3" /> 12× günstiger · EU-Hosted · 14 Tage Pilot
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              OneTrust-Alternative aus <span className="text-security-400">Deutschland</span>
            </h1>
            <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
              OneTrust kostet ab 600 €/Monat, ist US-gehostet und kein Audit-Log über AI-Calls.
              Wir liefern die KI-spezifische Compliance-Schicht ab 79 €/M (Starter).
            </p>
          </div>

          {/* Strategischer 9-Capability-Vergleich (PR #134) */}
          <CompetitorComparisonSection {...ONETRUST_COMPARISON} />

          {/* Cookie Banner lösen nur einen Teil — Positionierungs-Section */}
          <ConsentLimitsSection />

          <div className="bg-obsidian-900 border border-titanium-900 rounded-none overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-obsidian-950 text-[11px] font-bold text-titanium-400 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Feature</th>
                  <th className="text-center px-4 py-3 w-32">OneTrust</th>
                  <th className="text-center px-4 py-3 w-32 text-emerald-300">RealSync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-titanium-900">
                {[
                  { f: 'Pricing ab', o: '~600 €/M (Enterprise)', r: '79 €/M (Starter) · Free Audit kostenlos' },
                  { f: 'Origin / Hosting', o: 'USA', r: '🇩🇪 Frankfurt' },
                  { f: 'Schrems-II-tauglich (default)', o: 'partial', r: 'yes' },
                  { f: 'Cookie-Consent-Banner (BfDI 2024)', o: 'yes', r: 'yes' },
                  { f: 'AVV-Generator (Art. 28 Abs. 3)', o: 'yes', r: 'yes' },
                  { f: 'VVT-Wizard (Art. 30)', o: 'yes', r: 'yes' },
                  { f: 'DSFA-Wizard (Art. 35)', o: 'yes', r: 'yes' },
                  { f: 'Audit-Log über jeden KI-Call (Provider, Token, Kosten, User)', o: 'no', r: 'yes' },
                  { f: 'AI-Act-Risikoklassifikator (Annex III)', o: 'partial', r: 'yes' },
                  { f: 'EU-Local-LLM (Ollama, kein Drittlandtransfer)', o: 'no', r: 'yes' },
                  { f: 'BAIT/MaRisk-Doku-Export', o: 'no', r: 'yes' },
                  { f: '72h-Meldepflicht-Timer (Art. 33)', o: 'partial', r: 'yes' },
                  { f: 'Setup-Zeit', o: '6+ Wochen Sales-Cycle', r: '14 Tage Pilot' },
                  { f: 'Kostenlose Self-Service-Tools', o: 'no', r: 'yes (8 Stück)' },
                  { f: 'API-Keys per Tenant (programmatic)', o: 'partial', r: 'yes' },
                  { f: 'Made-in-Germany / EU-Founded', o: 'no', r: 'yes' },
                ].map((r) => (
                  <tr key={r.f} className="hover:bg-obsidian-950">
                    <td className="px-4 py-3 text-titanium-200">{r.f}</td>
                    <td className="px-4 py-3 text-center">{cell(r.o)}</td>
                    <td className="px-4 py-3 text-center">{cell(r.r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Section title="Warum Unternehmen wechseln">
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <Globe className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-titanium-50">Schrems-II-Sicherheit</strong>: Wir hosten in Frankfurt. OneTrust hostet in den USA.
                  Schrems-II-Aktivisten bereiten Schrems-III vor — DPF-Adäquanzbeschluss könnte 2027 fallen.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Award className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-titanium-50">KI-Compliance-Native</strong>: OneTrust ist Cookie-Consent + GRC-Plattform aus 2016.
                  Wir sind seit 2026 KI-First gebaut — Audit-Log pro AI-Call ist Default, nicht Add-on.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Euro className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-titanium-50">Pricing-Transparenz</strong>: OneTrust hat Sales-Calls und Quote-on-Request ab ~600 €/M.
                  Wir haben Pricing online ab 79 €/M (Starter), Self-Serve, jederzeit kündbar.
                </div>
              </li>
            </ul>
          </Section>

          <Section title="Migration in 14 Tagen">
            <p>
              Wir haben einen <strong className="text-titanium-50">OneTrust-Importer</strong> (auf Anfrage):
              Cookie-Banner-Konfig + AVV-Bibliothek übernehmen, ohne neu konfigurieren.
              Plus: 30-Min-Onboarding-Call mit Walkthrough für deinen DSB.
            </p>
          </Section>

          <div className="mt-12 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
            <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
              Vergleichstest in 30 Sekunden — kostenlos.
            </h2>
            <p className="text-sm text-titanium-300 mb-4 leading-relaxed">
              Lass deine Site durch unseren DSGVO-Scanner laufen. Kein Account. Score + Befunde mit Paragraph-Referenzen. Vergleich danach mit OneTrust ist trivial.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link to="/audit" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Kostenloser Site-Scan <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/contact-sales?source=onetrust-alt" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                Migration-Call buchen
              </Link>
              <Link to="/dsgvo-tool-vergleich" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-titanium-400 hover:text-titanium-200 text-sm rounded-none">
                Volles Tool-Vergleich
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-titanium-900 mt-12 py-6 px-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-3 sm:justify-between text-xs text-titanium-500">
          <div>© 2026 RealSync Dynamics · Made in Germany · EU-Hosted</div>
          <div className="flex flex-wrap gap-3">
            <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>
            <Link to="/legal/avv" className="hover:text-titanium-300">AVV</Link>
          </div>
        </div>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: 'OneTrust-Alternative aus Deutschland — 12× günstiger, EU-Hosted',
            description: 'Vergleich OneTrust vs RealSyncDynamics.AI für DSGVO + AI Act + Schrems-II-Compliance.',
            datePublished: '2026-05-06',
            inLanguage: 'de-DE',
            author: { '@type': 'Organization', name: 'RealSync Dynamics' },
          }),
        }}
      />
    </div>
  );
}

function cell(v: string): React.ReactNode {
  if (v === 'yes') return <Check className="h-4 w-4 text-emerald-400 inline" />;
  if (v === 'no') return <X className="h-4 w-4 text-red-400 inline" />;
  if (v === 'partial') return <Minus className="h-4 w-4 text-amber-400 inline" />;
  return <span className="text-xs text-titanium-300">{v}</span>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl sm:text-2xl font-display font-bold text-titanium-50 mb-3">{title}</h2>
      <div className="prose prose-invert max-w-none text-titanium-300 text-sm sm:text-base leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}
