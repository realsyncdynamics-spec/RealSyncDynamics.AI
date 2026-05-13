import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, X, Minus, ShieldCheck, Euro, Code } from 'lucide-react';
import { CompetitorComparisonSection } from '../components/CompetitorComparisonSection';
import { ConsentLimitsSection } from '../components/sections/ConsentLimitsSection';
import { DATAGUARD_COMPARISON } from '../config/competitor-comparisons';

export function DataGuardAlternative() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">DataGuard-Alternative</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-emerald-900 bg-emerald-950/30 text-emerald-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <Euro className="h-3 w-3" /> Tools statt Beratung · Self-Service ab 79 €/M · Made in Germany
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              DataGuard-Alternative — <span className="text-security-400">Tools statt Beratungs-Verträge</span>
            </h1>
            <p className="text-lg text-titanium-300 max-w-2xl mx-auto leading-relaxed">
              DataGuard liefert externe Datenschutzbeauftragte und Compliance-Beratung im Abo (typisch 4.000–12.000 €/Jahr).
              Wir liefern <strong className="text-titanium-50">Self-Service-Tools für die operative Umsetzung</strong> ab 79 €/Monat (Starter) —
              für Unternehmen, die intern bereits einen DSB haben oder selbst handeln wollen.
            </p>
          </div>

          <div className="p-4 bg-amber-950/20 border border-amber-900 rounded-none">
            <p className="text-sm text-amber-200 leading-relaxed">
              <strong className="text-amber-100">Ehrlicher Hinweis:</strong> Wir sind kein 1:1-Ersatz für DataGuard.
              DataGuard stellt einen externen DSB. Wir liefern Tools, die ein interner DSB (oder ein externer Berater)
              effizient nutzen kann. Für Firmen ohne DSB-Ressource → DataGuard. Für alle anderen → wir.
            </p>
          </div>

          {/* Strategischer 9-Capability-Vergleich (PR #134) */}
          <CompetitorComparisonSection {...DATAGUARD_COMPARISON} />

          {/* Cookie Banner lösen nur einen Teil — Positionierungs-Section */}
          <ConsentLimitsSection />

          <div className="bg-obsidian-900 border border-titanium-900 rounded-none overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-obsidian-950 text-[11px] font-bold text-titanium-400 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Feature</th>
                  <th className="text-center px-4 py-3 w-32">DataGuard</th>
                  <th className="text-center px-4 py-3 w-32 text-emerald-300">RealSync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-titanium-900">
                {[
                  { f: 'Pricing-Modell', o: '4.000–12.000 €/Jahr (Abo)', r: '79–699 €/Monat (Self-Service)' },
                  { f: 'Externer DSB stellen', o: 'yes', r: 'no' },
                  { f: 'AVV-Generator (Self-Service)', o: 'partial', r: 'yes' },
                  { f: 'VVT-Wizard (Art. 30)', o: 'partial', r: 'yes' },
                  { f: 'DSFA-Wizard (Art. 35)', o: 'partial', r: 'yes' },
                  { f: 'TOM-Generator (Art. 32)', o: 'partial', r: 'yes' },
                  { f: 'AI-Act-Risikoklassifikator', o: 'no', r: 'yes' },
                  { f: 'AI-Audit-Log (pro KI-Call)', o: 'no', r: 'yes' },
                  { f: 'Cookie-Consent-SDK (BfDI 2024)', o: 'no', r: 'yes' },
                  { f: '72h-Meldepflicht-Timer', o: 'no', r: 'yes' },
                  { f: 'Bußgeld-Rechner', o: 'no', r: 'yes' },
                  { f: 'Audit-Tool (Website-Scan)', o: 'no', r: 'yes' },
                  { f: 'EU-Hosted', o: 'yes', r: 'yes' },
                  { f: 'Multi-Tenant für Agenturen', o: 'partial', r: 'yes' },
                  { f: 'API-Zugriff', o: 'no', r: 'yes' },
                  { f: 'Beratung im Preis enthalten', o: 'yes', r: 'no' },
                  { f: 'Setup-Zeit', o: '2-6 Wochen', r: 'Selbe Stunde' },
                  { f: 'Made-in-Germany', o: 'yes', r: 'yes' },
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

          <Section title="Wann ist DataGuard die richtige Wahl">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span>Du brauchst einen externen DSB (gesetzliche Pflicht ab 20 Personen mit personenbezogener Datenverarbeitung).</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span>Du willst „eine Person, die Verantwortung übernimmt" statt selber zu arbeiten.</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span>Budget: 4.000+ €/Jahr ist ok, Geschwindigkeit der Umsetzung sekundär.</span></li>
            </ul>
          </Section>

          <Section title="Wann ist RealSync die richtige Wahl">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span>Du hast bereits einen internen DSB oder einen Anwalt — und brauchst Tools, mit denen er/sie schneller arbeiten kann.</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span>Du willst KI einsetzen und brauchst dafür AI-Act-Klassifikation, Audit-Trail, DSFA — Tools, die DataGuard nicht hat.</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span>Du betreibst eine Agentur und willst Compliance-Workflows für mehrere Mandanten managen (Multi-Tenant).</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span>Du willst Self-Service ab 79 €/M statt Berater-Tagessätze.</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span>Du willst dein Cookie-Banner ohne Konfigurator-Hölle einbetten.</span></li>
            </ul>
          </Section>

          <Section title="Beide gemeinsam — geht das">
            <p>
              Ja. Viele unserer Kunden behalten ihren externen DSB (egal ob DataGuard, ProliancePro oder Einzelanwalt)
              und nutzen RealSync als operative Tool-Schicht. Der DSB prüft die Outputs, wir liefern die Inputs schneller.
              Sprich mit deinem DSB darüber, ob er/sie unsere Tools im Workflow integrieren kann — die meisten freuen sich
              über zeitsparende Vorlagen.
            </p>
          </Section>

          <Section title="Migration / Hybrid-Setup">
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>14 Tage Pilot-Trial bei uns starten — alle Tools kostenfrei testen.</li>
              <li>Bestehende Verarbeitungen aus DataGuard-VVT in unseren <Link to="/vvt-wizard" className="text-security-400 hover:text-security-300">VVT-Wizard</Link> übertragen (Excel-Import möglich).</li>
              <li>Cookie-Snippet austauschen (1 Zeile) — unser <Link to="/cookie-consent-sdk" className="text-security-400 hover:text-security-300">Consent-SDK</Link> ist BfDI 2024 konform.</li>
              <li>AI Act: <Link to="/ai-act-klassifikator" className="text-security-400 hover:text-security-300">Klassifikator</Link> für jeden KI-Use-Case durchlaufen — wird DataGuard 2026 ohnehin verlangen.</li>
              <li>DSB behalten oder ersetzen — deine Entscheidung.</li>
            </ol>
          </Section>

          <Section title="Code-Snippet (Cookie-SDK)">
            <p>
              Statt DataGuards Konfigurator: 1 Zeile HTML, Banner sofort sichtbar.
            </p>
            <div className="p-3 bg-obsidian-950 border border-titanium-700 rounded-none flex items-start gap-3">
              <Code className="h-4 w-4 text-emerald-400 shrink-0 mt-1" />
              <code className="text-emerald-300 text-xs font-mono break-all leading-relaxed">
                {'<script src="https://RealSyncDynamicsAI.de/sdk/cookie-consent.js" data-rsd-key="YOUR_KEY"></script>'}
              </code>
            </div>
          </Section>

          <div className="mt-12 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
            <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
              Pilot in 14 Tagen — keine Kreditkarte, kein Vertragsbinding
            </h2>
            <p className="text-titanium-300 text-sm mb-4">
              Alle Tools, alle Tiers, 14 Tage. Falls es nicht passt: einfach laufen lassen.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link to="/pricing" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Pilot starten <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/contact-sales?source=dataguard-alt" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                Migration-Call buchen
              </Link>
              <Link to="/dsgvo-tool-vergleich" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-titanium-400 hover:text-titanium-200 text-sm rounded-none">
                Voller Tool-Vergleich
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
