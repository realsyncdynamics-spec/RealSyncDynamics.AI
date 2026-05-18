import { Link } from 'react-router-dom';
import { ArrowLeft, Stethoscope, ArrowRight, ShieldCheck, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

export function HealthTechLanding() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center">
            <Stethoscope className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">HealthTech-Compliance</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto space-y-10">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-emerald-900 bg-emerald-950/30 text-emerald-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <Stethoscope className="h-3 w-3" /> HealthTech · Patientendaten · AI Act High-Risk
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              KI in HealthTech — <span className="text-security-400">ohne Patientendaten-GAU</span>.
            </h1>
            <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
              Diagnose-Unterstützung, Triage-AI, Befund-Klassifikation. Ab August 2026 alles
              <strong className="text-titanium-50"> AI-Act-High-Risk</strong>. Wir liefern den Compliance-Layer.
            </p>
          </div>

          <Section title="Das Problem">
            <p>Du nutzt KI für Diagnose, Triage oder Befund-Sortierung. Datenkategorie:
              <strong className="text-titanium-50"> besonders schutzwürdige Gesundheitsdaten</strong> nach Art. 9 DSGVO.
              Plus AI Act Annex III: Healthcare-Diagnose-AI ist kategorisch
              <strong className="text-titanium-50"> High-Risk</strong> ab August 2026.
            </p>
            <p>Konsequenz ohne Compliance:</p>
            <ul className="space-y-1.5 mt-3 text-sm">
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />Bußgeld bis 4 % Jahresumsatz (DSGVO Art. 83 Abs. 5) plus 35 Mio./7 % (AI Act Art. 99)</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />Marktverbot durch Bundesnetzagentur bei nicht-konformem High-Risk-System</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />Krankenhäuser und MFA-Praxen als Kunden brechen Verträge ab Q1 2026</li>
            </ul>
          </Section>

          <Section title="Was wir liefern">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">EU-Datenresidenz</strong> für jeden KI-Aufruf — Patientendaten verlassen nie Frankfurt-Hosted Ollama</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Audit-Log pro AI-Call</strong> — Modell, Tokens, User, Datenresidenz, Zeit. Revisionssicher</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">DSFA-Wizard</strong> für Patientendaten-Verarbeitung gemäß Art. 35 DSGVO</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">AI-Act-Risk-Klassifikation</strong> + Conformity-Assessment-Vorlage</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">AVV mit allen Auftragsverarbeitern</strong> nach Art. 28 — inkl. Sub-Auftragsverarbeiter-Liste</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Human-Oversight-Workflow</strong> mit Override-Funktion + Audit-Trail aller automatisierten Entscheidungen</span></li>
            </ul>
          </Section>

          <Section title="Use-Cases die wir abdecken">
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { t: 'Diagnose-Unterstützung', d: 'GPT-4 / Claude für Befund-Vorschlag mit Audit-Log + Patientendaten-Pseudonymisierung pre-prompt' },
                { t: 'Triage-AI in Notaufnahmen', d: 'Real-time-Klassifikation mit Human-Override + DSFA + EU-local Llama-Inferenz' },
                { t: 'Befund-Sortierung', d: 'Automatische Vor-Klassifikation für Pathologen — alle Daten in Frankfurt' },
                { t: 'Patient-Kommunikation (Chatbot)', d: 'Symptom-Voranalyse mit konfigurierbarem AI-Disclaimer + Audit-Log' },
                { t: 'Forschungs-Datenaufbereitung', d: 'Anonymisierung + Pseudonymisierung-Workflow mit reversibilität für Studien-Zwecke' },
                { t: 'Krankenhaus-IT-Compliance', d: 'Multi-Tenant pro Abteilung, BAIT-tauglich, ISO-27001-vorbereitend' },
              ].map((u) => (
                <div key={u.t} className="p-3 bg-obsidian-900 border border-titanium-900 rounded-none">
                  <div className="font-display font-bold text-titanium-50 text-sm mb-1">{u.t}</div>
                  <div className="text-xs text-titanium-400 leading-relaxed">{u.d}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Pricing für HealthTech">
            <p className="mb-4">
              Standard-Tiers ab Starter 49 €/M. <strong className="text-titanium-50">HealthTech-Bundle</strong> (Growth + Patientendaten-Zusatz)
              ab 179 €/M empfohlen, beinhaltet:
            </p>
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-start gap-2"><Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><strong className="text-titanium-50">14 Tage Pilot kostenlos</strong></li>
              <li className="flex items-start gap-2"><Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />30-Min-Onboarding mit DSB-Walkthrough</li>
              <li className="flex items-start gap-2"><Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />Custom DSFA-Template für eure Use-Cases</li>
              <li className="flex items-start gap-2"><Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />Quartalsweise Compliance-Review-Call</li>
            </ul>
          </Section>

          <div className="mt-12 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
            <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
              In 14 Tagen AI-Act-konform — bevor August 2026 kommt.
            </h2>
            <p className="text-sm text-titanium-300 leading-relaxed mb-4">
              87 Tage bis High-Risk-Pflicht. 14 Tage Pilot. Du hast noch Zeit — aber nur knapp.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link to="/contact-sales?source=healthtech" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Founding Access starten <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/audit" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                Kostenloser DSGVO-Scan
              </Link>
              <Link to="/ai-act-faq" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-titanium-400 hover:text-titanium-200 text-sm rounded-none">
                AI-Act-FAQ
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
          </div>
        </div>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: 'KI-Compliance für HealthTech-Startups — DSGVO + AI Act',
            description: 'AI-Act-High-Risk ab August 2026. Wie HealthTechs Patientendaten + KI compliant verarbeiten.',
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
