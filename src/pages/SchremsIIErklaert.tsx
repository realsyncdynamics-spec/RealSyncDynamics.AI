import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowRight, ArrowLeft, AlertTriangle, Globe } from 'lucide-react';

export function SchremsIIErklaert() {
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
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Schrems-II erklärt</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto">
          <article className="space-y-8">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 border border-emerald-900 bg-emerald-950/30 text-emerald-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
                <Globe className="h-3 w-3" /> EuGH C-311/18 · 16. Juli 2020
              </div>
              <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
                Schrems-II — was bedeutet das für <span className="text-security-400">KI-Tools</span>?
              </h1>
              <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
                Warum jeder Aufruf von ChatGPT, Claude oder Gemini ein DSGVO-Problem ist
                — und welche zusätzlichen Schutzmaßnahmen du brauchst.
              </p>
            </div>

            <Section title="Das Urteil in 3 Sätzen">
              <p>
                Am 16. Juli 2020 hat der EuGH (Az. C-311/18) das EU-US Privacy Shield gekippt — das
                Datenaustausch-Abkommen, auf das sich tausende Unternehmen für ihre US-Cloud-Dienste verlassen
                hatten.
              </p>
              <p>
                Begründung: US-Sicherheitsbehörden (NSA, CIA) können auch nach FISA Section 702 + Executive Order
                12333 ohne effektive richterliche Kontrolle auf europäische Daten zugreifen. Das verstößt gegen
                das EU-Grundrecht auf Datenschutz (Art. 7 + 8 EU-Charta).
              </p>
              <p>
                <strong className="text-titanium-50">Konsequenz</strong>: Standardvertragsklauseln (SCCs) reichen für
                US-Provider <strong>nicht mehr aus</strong>. Es braucht zusätzlich „supplementary measures" — technisch UND organisatorisch.
              </p>
            </Section>

            <Section title="Was ist mit dem Trans-Atlantic Data Privacy Framework (TADPF) seit 2023?">
              <p>
                Im Juli 2023 hat die EU-Kommission den <em>Data Privacy Framework</em> (DPF) als legitim erklärt
                (Adäquanzbeschluss). Damit können US-Unternehmen, die unter DPF zertifiziert sind (OpenAI, Google,
                Anthropic), Daten aus der EU empfangen <em>ohne</em> SCCs.
              </p>
              <p>
                <strong className="text-amber-300">ABER</strong>: Datenschutz-Aktivisten + max-schrems.com bereiten bereits
                Schrems-III vor. Das DPF wird voraussichtlich erneut vor dem EuGH landen — mit guter Chance, gekippt
                zu werden, weil die FISA-Probleme nicht abschließend gelöst wurden.
              </p>
              <p>
                Praxisempfehlung: Auf DPF stützen geht juristisch — strategisch-langfristig solltest Du Dich aber
                nicht darauf verlassen, dass es 2026/2027 noch Bestand hat.
              </p>
            </Section>

            <Section title="Was bedeutet das für KI-Tools?">
              <p>Drei Szenarien je nach AI-Provider:</p>
              <ul className="space-y-3 mt-4">
                <li className="flex items-start gap-3">
                  <div className="shrink-0 w-7 h-7 bg-red-950 border border-red-900 rounded-none flex items-center justify-center text-red-300 font-bold text-sm">1</div>
                  <div>
                    <strong className="text-titanium-50">US-Cloud (OpenAI, Anthropic, Google)</strong> — DPF-zertifiziert,
                    rechtlich aktuell OK aber strategisches Risiko. Plus: Trainingsdaten landen weiterhin
                    auf US-Servern. Plus: kein Audit-Recht für deutsche Aufsichtsbehörden.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="shrink-0 w-7 h-7 bg-amber-950 border border-amber-900 rounded-none flex items-center justify-center text-amber-300 font-bold text-sm">2</div>
                  <div>
                    <strong className="text-titanium-50">EU-Cloud-Mirrors (Microsoft Azure OpenAI EU)</strong> —
                    Inferenz in EU-Rechenzentrum, aber Logging + Modell-Weiterverarbeitung läuft potenziell
                    weiterhin in den USA. Lies das Kleingedruckte.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="shrink-0 w-7 h-7 bg-emerald-950 border border-emerald-900 rounded-none flex items-center justify-center text-emerald-300 font-bold text-sm">3</div>
                  <div>
                    <strong className="text-titanium-50">EU-Self-Hosted (Mistral, Llama via Ollama, Aleph Alpha)</strong> —
                    100 % EU, kein Drittlandtransfer, volle Datenhoheit. Performance unter US-Frontier-Modellen,
                    aber für 80 % der Use-Cases ausreichend.
                  </div>
                </li>
              </ul>
            </Section>

            <Section title="Welche Schutzmaßnahmen forder die EDSA konkret?">
              <p>EDSA-Empfehlungen 01/2020 sehen 3 Kategorien zusätzlicher Maßnahmen vor:</p>
              <ul className="space-y-2 mt-4 text-sm">
                <li><strong className="text-titanium-50">Technisch</strong>: End-to-End-Verschlüsselung (Schlüssel bleiben in EU), Pseudonymisierung, BYOK (Bring Your Own Key) für Cloud-KI.</li>
                <li><strong className="text-titanium-50">Vertraglich</strong>: SCCs PLUS Transfer-Impact-Assessment (TIA) PLUS Audit-Rechte gegenüber dem Anbieter.</li>
                <li><strong className="text-titanium-50">Organisatorisch</strong>: Daten-Klassifikations-Policy, Zugriffskontrollen, Schulungen für Personal das KI-Tools nutzt.</li>
              </ul>
            </Section>

            <Section title="Wie helfen wir bei Schrems-II-Compliance?">
              <p>
                RealSyncDynamics.AI hat Schrems-II-Compliance als Default-Pattern gebaut:
              </p>
              <ul className="space-y-2 mt-4 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">✓</span>
                  <span><strong className="text-titanium-50">EU-Datenresidenz-Toggle</strong> pro Tenant. Aktiviert → AI-Aufrufe gehen ausschließlich an Self-Hosted-Ollama in Frankfurt.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">✓</span>
                  <span><strong className="text-titanium-50">Audit-Log</strong> dokumentiert pro AI-Call: Provider, Modell, Datenresidenz, Zeit, Kosten — revisionssicher.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">✓</span>
                  <span><strong className="text-titanium-50">Sub-Prozessor-Liste</strong> öffentlich + AVV mit jedem Provider gemäß Art. 28 DSGVO.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">✓</span>
                  <span><strong className="text-titanium-50">DSGVO-Selfservice</strong> (Art. 15 + 17) — Auskunft + Löschung in maschinenlesbarem Format auf Knopfdruck.</span>
                </li>
              </ul>
            </Section>

            <div className="mt-12 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="h-6 w-6 text-security-400 shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
                    Bist Du Schrems-II-konform?
                  </h2>
                  <p className="text-sm text-titanium-300 leading-relaxed">
                    Unser kostenloser DSGVO-Scanner prüft auch Schrems-II-Indikatoren: US-Cloud-Provider ohne IP-Anonymisierung,
                    fehlende AVVs, Tracker mit US-Drittlandtransfer.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Link to="/audit" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                  Kostenloser Audit-Scan <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/legal/compliance-matrix" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                  Provider-Vergleich
                </Link>
                <Link to="/dsgvo-ki-checkliste" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-titanium-400 hover:text-titanium-200 text-sm rounded-none">
                  DSGVO-KI-Checkliste
                </Link>
              </div>
            </div>
          </article>
        </div>
      </main>

      <footer className="border-t border-titanium-900 mt-12 py-6 px-4">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3 sm:justify-between text-xs text-titanium-500">
          <div>© 2026 RealSync Dynamics · Made in Germany · EU-Hosted (Frankfurt)</div>
          <div className="flex flex-wrap gap-3">
            <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>
            <Link to="/impressum" className="hover:text-titanium-300">Impressum</Link>
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
            headline: 'Schrems-II erklärt — Was bedeutet das für KI-Tools?',
            description: 'EuGH C-311/18: warum US-Cloud-KI nach Schrems-II zusätzliche Schutzmaßnahmen braucht. Mit konkreten Empfehlungen für DSGVO-konforme Anbieter.',
            datePublished: '2026-05-06',
            inLanguage: 'de-DE',
            author: { '@type': 'Organization', name: 'RealSync Dynamics' },
          }),
        }}
      />
    </div>
  );
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
