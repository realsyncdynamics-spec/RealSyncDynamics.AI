import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, X, Minus, ShieldCheck, Euro } from 'lucide-react';

export function ProlianceAlternative() {
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
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Proliance-Alternative</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-emerald-900 bg-emerald-950/30 text-emerald-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <Euro className="h-3 w-3" /> Tools-Stack statt DSB-Beratung · ab 79 €/M · Made in Germany
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              Proliance-Alternative — <span className="text-security-400">die operative Tool-Schicht</span>
            </h1>
            <p className="text-lg text-titanium-300 max-w-2xl mx-auto leading-relaxed">
              Proliance (München) ist ein bekannter externer DSB-Anbieter mit Beratungs-Schwerpunkt
              (typisch 4.000–15.000 €/Jahr). Wir liefern <strong className="text-titanium-50">Self-Service-Tools für die operative DSGVO-Umsetzung</strong>
              — komplementär zum DSB oder als günstigere Alternative für Firmen mit interner Compliance-Ressource.
            </p>
          </div>

          <div className="p-4 bg-amber-950/20 border border-amber-900 rounded-none">
            <p className="text-sm text-amber-200 leading-relaxed">
              <strong className="text-amber-100">Ehrlicher Hinweis:</strong> Proliance bietet einen externen DSB.
              Wir nicht. Wenn die externe DSB-Funktion das Hauptbedürfnis ist → Proliance. Wenn du Tools für deinen
              internen DSB / Anwalt brauchst oder einfach selber arbeiten willst → wir.
            </p>
          </div>

          <div className="bg-obsidian-900 border border-titanium-900 rounded-none overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-obsidian-950 text-[11px] font-bold text-titanium-400 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Feature</th>
                  <th className="text-center px-4 py-3 w-32">Proliance</th>
                  <th className="text-center px-4 py-3 w-32 text-emerald-300">RealSync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-titanium-900">
                {[
                  { f: 'Pricing-Modell', o: '4.000–15.000 €/Jahr (DSB-Vertrag)', r: '79–699 €/M (Self-Service)' },
                  { f: 'Externer DSB stellen', o: 'yes', r: 'no' },
                  { f: 'Beratung im Preis enthalten', o: 'yes', r: 'no' },
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
                  { f: 'Multi-Tenant für Agenturen', o: 'partial', r: 'yes' },
                  { f: 'API-Zugriff', o: 'no', r: 'yes' },
                  { f: 'EU-Hosted', o: 'yes', r: 'yes' },
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

          <Section title="Wann Proliance die richtige Wahl ist">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span>Du brauchst einen externen DSB (gesetzliche Pflicht ab 20 Personen mit personenbezogener Datenverarbeitung).</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span>Du willst persönliche Beratung mit definierten Ansprechpartnern und Reporting im Quartalsrhythmus.</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span>Du brauchst Schulungen, Audits vor Ort, dokumentierte Prüfberichte.</span></li>
            </ul>
          </Section>

          <Section title="Wann RealSync die richtige Wahl ist">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span>Du hast bereits einen internen DSB oder einen Compliance-Officer und brauchst Tools statt zusätzlicher Beratung.</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span>Du nutzt KI und brauchst zusätzlich AI-Act-Klassifikator + AI-Audit-Log.</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span>Du betreibst eine Agentur und willst Compliance-Workflows für mehrere Mandanten managen (Multi-Tenant).</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span>Du willst Setup in der gleichen Stunde, nicht in 2-6 Wochen.</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span>Dein Pricing-Spielraum liegt unter 4.000 €/Jahr.</span></li>
            </ul>
          </Section>

          <Section title="Hybrid-Setup mit Proliance (üblich)">
            <p>
              Zahlreiche Kunden behalten ihren Proliance-DSB und nutzen RealSync als operative Tool-Schicht.
              Der DSB validiert die Outputs (AVV, VVT-Einträge, DSFA-Drafts), wir liefern die Inputs schneller und
              dokumentiert. Frag deinen DSB, ob er unsere Vorlagen in seinen Workflow integrieren kann — die
              meisten freuen sich über Zeitersparnis.
            </p>
          </Section>

          <Section title="Migration / Erstkonfiguration">
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>14 Tage Pilot bei uns starten — alle Tools kostenfrei, keine Kreditkarte.</li>
              <li>Bestehende VVT-Einträge aus Proliance-Excel oder PDF in unseren <Link to="/vvt-wizard" className="text-security-400 hover:text-security-300">VVT-Wizard</Link> übertragen.</li>
              <li>AVV-Vorlagen für deine Sub-Processors (Stripe, Supabase, Mailtrap, …) im <Link to="/avv-generator" className="text-security-400 hover:text-security-300">AVV-Generator</Link> generieren.</li>
              <li>AI Act: <Link to="/ai-act-klassifikator" className="text-security-400 hover:text-security-300">Klassifikator</Link> für jeden KI-Use-Case durchlaufen — Nachweispflicht ab 2026.</li>
              <li>DSB behalten oder ersetzen — deine Entscheidung.</li>
            </ol>
          </Section>

          <div className="mt-12 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
            <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
              Pilot starten — Tools statt Beratungs-Pakete
            </h2>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <Link to="/pricing" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Pilot starten <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/contact-sales?source=proliance-alt" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                Beratung-Call buchen
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
