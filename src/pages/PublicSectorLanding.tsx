import { Link } from 'react-router-dom';
import { ArrowLeft, Building2, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';

export function PublicSectorLanding() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-purple-500 to-indigo-700 flex items-center justify-center">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Behörden &amp; Verwaltung</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto space-y-10">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-purple-900 bg-purple-950/30 text-purple-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <Building2 className="h-3 w-3" /> Behörden · OZG · BFSG/BITV · AI Act High-Risk
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              KI in der öffentlichen Verwaltung — <span className="text-security-400">EU-souverän</span>.
            </h1>
            <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
              Bürger-Service-Chatbots, Antragsbearbeitung, Aktenklassifikation. AI Act stuft Behörden-KI als
              <strong className="text-titanium-50"> High-Risk</strong> ein. EU-Datensouveränität ist nicht-verhandelbar.
            </p>
          </div>

          <Section title="Warum US-Cloud nicht geht">
            <p>
              BfDI 2024 + Konferenz der unabhängigen Datenschutzaufsichtsbehörden (DSK):
              Behörden-KI muss <strong className="text-titanium-50">durchgehend EU-Datenresidenz</strong> haben.
              Drittlandtransfer an OpenAI/Anthropic/Google = grundsätzlich unzulässig.
            </p>
            <ul className="space-y-1.5 mt-3 text-sm">
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />Schrems-II + DPF-Adäquanzbeschluss reichen für Behörden-Daten nicht (höhere Schutzwirkung gefordert)</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />AI Act Annex III: Behörden-Entscheidungen mit KI = High-Risk → Conformity Assessment</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />OZG + BFSG/BITV 2.0: Barrierefreiheit + Auditierbarkeit + Nachvollziehbarkeit aller Entscheidungen</li>
            </ul>
          </Section>

          <Section title="Was wir liefern">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">EU-souveräner Stack</strong>: Frankfurt-Hosted Ollama (Llama / Mistral) — keine US-Cloud, keine Drittland-Berührung</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Audit-Trail aller automatisierten Entscheidungen</strong> mit Human-Override-Pflicht-Workflow</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">DSFA-Wizard für Behörden-Use-Cases</strong> (Art. 35 DSGVO + Konsultation der Datenschutzaufsicht falls erforderlich)</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Conformity-Assessment-Vorlage</strong> für AI-Act-High-Risk-Klassifikation</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">On-Premise-Variante</strong> (Docker-Compose + Lizenz) für Behörden mit reiner Inhouse-Anforderung</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">BFSG/BITV-konforme UI</strong> — barrierefrei, html lang attr, screenreader-tested</span></li>
            </ul>
          </Section>

          <Section title="Use-Cases">
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { t: 'Bürger-Service-Chatbot', d: 'Antrags-Voranalyse mit Auto-Disclaimer + Eskalation zu Sachbearbeiter' },
                { t: 'Antragsbearbeitung', d: 'Vollständigkeits-Check + Vor-Klassifikation, Final-Entscheidung human' },
                { t: 'Aktenklassifikation', d: 'Auto-Sortierung nach Sachgebieten + Aufbewahrungsfristen' },
                { t: 'Übersetzung in Leichte Sprache', d: 'Bescheide barrierefrei aufbereiten · BFSG-konform' },
                { t: 'OZG-Workflows', d: 'Online-Anträge mit Form-Validation + Pre-Filling via KI' },
                { t: 'Wissensmanagement intern', d: 'RAG auf Verwaltungs-Vorschriften, Mitarbeiter-Q&A' },
              ].map((u) => (
                <div key={u.t} className="p-3 bg-obsidian-900 border border-titanium-900 rounded-none">
                  <div className="font-display font-bold text-titanium-50 text-sm mb-1">{u.t}</div>
                  <div className="text-xs text-titanium-400 leading-relaxed">{u.d}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Beschaffungs-tauglich">
            <p>
              Pricing nach EVB-IT- oder vergleichbarem Behörden-Vertrag möglich. Enterprise-Tier
              auf Anfrage mit SLA, On-Premise, Custom-Onboarding, Schulungen.
              <strong className="text-titanium-50"> ISO 27001 / SOC 2 Type 1 in Vorbereitung</strong> für 2027.
            </p>
          </Section>

          <div className="mt-12 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
            <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
              EU-Datensouveränität ist Default. Nicht Premium-Feature.
            </h2>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <Link to="/contact-sales?source=public-sector" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Founding Access starten <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/legal/compliance-matrix" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                Provider-Vergleich
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
