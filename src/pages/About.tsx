import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Shield, Target, Compass, Users } from 'lucide-react';

export function About() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-security-500 to-security-700 flex items-center justify-center">
            <Compass className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Über RealSync Dynamics</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto space-y-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-security-900 bg-security-950/30 text-security-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <Shield className="h-3 w-3" /> Made in Germany · EU-Hosted · DSGVO-by-Design
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              Wir bauen die <span className="text-security-400">EU-souveräne</span> KI-Compliance-Plattform.
            </h1>
            <p className="text-lg text-titanium-300 leading-relaxed">
              RealSync Dynamics existiert, weil DSGVO + AI Act + BAIT + DORA für deutsche Mittelständler ein Dschungel sind —
              und weil US-SaaS-Lösungen (OneTrust, Usercentrics, OpenAI direkt) entweder zu teuer, nicht-souverän oder beides sind.
            </p>
          </div>

          <Section title="Mission">
            <p>
              <strong className="text-titanium-50">EU-Datensouveränität als Default, nicht als Premium-Feature.</strong>
              Wir liefern KI-Tools, AVV-Generatoren, DSFA-Wizards und Cookie-Consent-SDK auf einer Plattform —
              hosted in Frankfurt, ohne US-Drittlandtransfer, mit Audit-Trail über jeden KI-Call.
            </p>
            <p>
              Unser Ziel: Bis Ende 2027 die Standard-Compliance-Plattform für DACH-Mittelstand und Behörden zu sein.
              Keine 6-Monats-Implementierung. Keine 50.000 €/Jahr Enterprise-Verträge. Self-Service ab 49 €/Monat (Starter), Free Audit kostenlos.
            </p>
          </Section>

          <Section title="Warum jetzt">
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <Target className="h-5 w-5 text-security-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-titanium-50">AI Act tritt 2026 in Kraft.</strong> High-Risk-Klassifikation,
                  Conformity Assessments, Transparenz-Pflichten — die meisten DACH-Unternehmen haben kein System dafür.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Target className="h-5 w-5 text-security-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-titanium-50">Schrems II + DPF wackelt.</strong> Datentransfer in die USA bleibt
                  juristisch fragil. EU-Hosting ist die einzige robuste Antwort.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Target className="h-5 w-5 text-security-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-titanium-50">DSGVO-Bußgelder eskalieren.</strong> 2025 alleine über 1,5 Mrd. €
                  in der EU. Der Markt für nachweisliche Compliance ist real.
                </div>
              </li>
            </ul>
          </Section>

          <Section title="Was uns unterscheidet">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong className="text-titanium-50">EU-Stack-First</strong>: Frankfurt-Hosting, Ollama-Fallback (Llama/Mistral local), keine US-Cloud-Default-Pfade.</span>
              </li>
              <li className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong className="text-titanium-50">Tools statt Beratung</strong>: 8 kostenlose Self-Service-Tools (AVV, VVT, DSFA, AI-Act-Klassifikator, Bußgeld-Rechner, …) statt PowerPoint-Audits.</span>
              </li>
              <li className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong className="text-titanium-50">Industrial Design-DNA</strong>: 90°-Kanten, hard-edge UI, kein Glassmorphism-Bullshit. Vertrauen entsteht durch Klarheit.</span>
              </li>
              <li className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong className="text-titanium-50">Audit-Trail über jeden KI-Call</strong>: Was wurde wann mit welchem Modell verarbeitet? Nachvollziehbar — pflicht für AI Act High-Risk.</span>
              </li>
              <li className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong className="text-titanium-50">Faire Preise</strong>: Free Audit kostenlos · Starter 49 €/M · Growth 179 €/M · Agency 499 €/M. Keine Setup-Fees. 14 Tage Pilot kostenlos.</span>
              </li>
            </ul>
          </Section>

          <Section title="Werte">
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { t: 'Souveränität', d: 'EU-Hosting, EU-Modelle, EU-Recht. Default — nicht Add-on.' },
                { t: 'Transparenz', d: 'Sub-Processors-Liste öffentlich. AVV downloadbar. Compliance-Matrix nachvollziehbar.' },
                { t: 'Pragmatismus', d: 'Self-Service in Stunden, nicht Wochen. Snippet einbetten, fertig.' },
                { t: 'Honesty', d: 'Wir sagen, was wir nicht können. Kein Vapourware. Kein Marketing-Bullshit-Bingo.' },
              ].map((v) => (
                <div key={v.t} className="p-3 bg-obsidian-900 border border-titanium-900 rounded-none">
                  <div className="font-display font-bold text-titanium-50 text-sm mb-1">{v.t}</div>
                  <div className="text-xs text-titanium-400 leading-relaxed">{v.d}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Founder">
            <p>
              RealSync Dynamics wird geführt vom Gründer aus Hessen — mit Background in Software-Engineering,
              Compliance-Implementierung in regulierten Industrien (HealthTech, FinTech, Behörden) und einer
              klaren These: <strong className="text-titanium-50">DACH-Compliance braucht DACH-Tools</strong>.
            </p>
            <p>
              Kontakt für Presse, Partnerschaften, Investor-Anfragen: <Link to="/contact-sales" className="text-security-400 hover:text-security-300">/contact-sales</Link>
              {' '}oder über <Link to="/press" className="text-security-400 hover:text-security-300">/press</Link> für Media-Kit.
            </p>
          </Section>

          <Section title="Roadmap (öffentlich)">
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-start gap-2"><span className="text-emerald-400 font-mono text-xs mt-0.5">✓ 2026 Q2</span><span className="text-titanium-300">Plattform-Launch · 8 Free-Tools · Cookie-SDK · Industry-Doorways</span></li>
              <li className="flex items-start gap-2"><span className="text-amber-400 font-mono text-xs mt-0.5">→ 2026 Q3</span><span className="text-titanium-300">ISO 27001 Audit-Vorbereitung · TÜV-Süd-Zertifizierungspfad · 100 zahlende Kunden</span></li>
              <li className="flex items-start gap-2"><span className="text-titanium-500 font-mono text-xs mt-0.5">  2026 Q4</span><span className="text-titanium-400">SOC 2 Type 1 · On-Premise-Variante für Behörden · n8n-Integration GA</span></li>
              <li className="flex items-start gap-2"><span className="text-titanium-500 font-mono text-xs mt-0.5">  2027 Q1-Q2</span><span className="text-titanium-400">DACH-Vertrieb skalieren · 500 Kunden · Series-A-optional</span></li>
              <li className="flex items-start gap-2"><span className="text-titanium-500 font-mono text-xs mt-0.5">  2027 Q4</span><span className="text-titanium-400">100k €/Monat MRR-Ziel · Standard-Compliance-Plattform für DACH-Mittelstand</span></li>
            </ul>
          </Section>

          <div className="mt-12 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-5 w-5 text-security-400" />
              <h2 className="font-display font-bold text-titanium-50 text-xl">Mit uns arbeiten</h2>
            </div>
            <p className="text-titanium-300 text-sm mb-4">
              Pilotkunden, Early-Access, Beratungsanfragen, Presse, Investor-Decks — alles über einen Kanal.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link to="/contact-sales?source=about" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Termin vereinbaren <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/press" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                Media-Kit ansehen
              </Link>
              <Link to="/legal/compliance-matrix" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-titanium-400 hover:text-titanium-200 text-sm rounded-none">
                Compliance-Matrix
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-titanium-900 mt-12 py-6 px-4">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3 sm:justify-between text-xs text-titanium-500">
          <div>© 2026 RealSync Dynamics · Made in Germany · EU-Hosted</div>
          <div className="flex flex-wrap gap-3">
            <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>
            <Link to="/legal/avv" className="hover:text-titanium-300">AVV</Link>
            <Link to="/legal/sub-processors" className="hover:text-titanium-300">Sub-Processors</Link>
          </div>
        </div>
      </footer>
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
