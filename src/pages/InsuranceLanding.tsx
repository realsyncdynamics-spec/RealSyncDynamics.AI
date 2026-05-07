import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';

export function InsuranceLanding() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center">
            <ShieldAlert className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Versicherungen</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto space-y-10">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-blue-900 bg-blue-950/30 text-blue-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <ShieldAlert className="h-3 w-3" /> VAIT · Solvency II · IDD · DORA · AI Act High-Risk
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              KI in der Versicherung — <span className="text-security-400">VAIT-konform</span>.
            </h1>
            <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
              Tarifrechner, Schadenbearbeitung, Underwriting, Betrugserkennung. BaFin VAIT
              + Solvency II + IDD + DORA + AI Act stuft KI-Entscheidungen oft als
              <strong className="text-titanium-50"> High-Risk</strong> ein.
            </p>
          </div>

          <Section title="Regulatorische Lage">
            <p>
              Versicherer unterliegen einem dichten Geflecht: <strong className="text-titanium-50">VAIT (Versicherungsaufsichtliche Anforderungen
              an die IT)</strong>, Solvency II Art. 41 (Governance), <strong className="text-titanium-50">IDD</strong> für Vertrieb,
              DORA für Cyber-Resilienz und ab 2026 der AI Act. Wer eine KI-Komponente in Underwriting
              oder Schadenregulierung einsetzt, hat in der Regel mehrere Compliance-Layer parallel.
            </p>
            <ul className="space-y-1.5 mt-3 text-sm">
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />VAIT AT 4.5: KI-Modelle als wesentliche Auslagerung — Risikoanalyse + Audit-fähig</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />AI Act Annex III (5)(c): Versicherungs-Underwriting für Lebens-/Krankenversicherung = High-Risk</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />DSGVO Art. 22: Automatisierte Einzelentscheidungen — Auskunfts- und Erklärungspflicht</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />DORA: ICT-Risk-Framework, Drittanbieter-Register, Resilience-Tests</li>
            </ul>
          </Section>

          <Section title="Was wir liefern">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">EU-souveräner KI-Stack</strong> mit Frankfurt-Hosting + optional Ollama-Self-Hosting (Llama / Mistral lokal)</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">VAIT-tauglicher Audit-Trail</strong> — jeder Modell-Call mit Eingabe-Hash, Modellversion, Tenant, Zeitstempel</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">DSFA-Wizard</strong> — Vorlagen für Underwriting, Schadenregulierung, Tarifierung</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Conformity-Assessment-Vorlage</strong> für AI Act High-Risk + IDD-Erklärungspflichten</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Human-in-the-Loop</strong> Workflows für DSGVO-Art-22-Konformität (Begründung + Anfechtung)</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Sub-Processors-Liste</strong> mit AVV pro Anbieter — DORA-Drittanbieter-Register-fähig</span></li>
            </ul>
          </Section>

          <Section title="Use-Cases">
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { t: 'Tarif-Voranalyse', d: 'Kontext-aware Beratung mit Auto-Disclaimer + Übergabe an Vertrieb' },
                { t: 'Schadenmeldung-Triage', d: 'Vollständigkeits-Check + Vor-Klassifikation, Schadenregulierung human' },
                { t: 'Vertragsbedingungen-Erklärung', d: 'Plain-Language-Erläuterung von AVB / IDD-konform' },
                { t: 'Betrugs-Indikator-Modelle', d: 'Score-Generierung mit nachvollziehbarer Feature-Erklärung' },
                { t: 'Underwriting-Assistent', d: 'Risiko-Faktor-Aggregation, Final-Entscheidung Underwriter' },
                { t: 'Wissensmanagement intern', d: 'RAG auf Bedingungswerken + Aktuariats-Vorgaben' },
              ].map((u) => (
                <div key={u.t} className="p-3 bg-obsidian-900 border border-titanium-900 rounded-none">
                  <div className="font-display font-bold text-titanium-50 text-sm mb-1">{u.t}</div>
                  <div className="text-xs text-titanium-400 leading-relaxed">{u.d}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Beschaffung &amp; Audit-Bereitschaft">
            <p>
              Pro-Tier-Verträge mit individueller AVV. ISO 27001 / SOC 2 Type 1 in Vorbereitung
              für 2026 Q4. On-Premise-Variante (Docker-Compose + Lizenz) für Versicherer mit reiner
              Inhouse-Anforderung verfügbar.
            </p>
          </Section>

          <div className="mt-12 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
            <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
              KI in der Versicherung — ohne BaFin-Stress.
            </h2>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <Link to="/contact-sales?source=insurance" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Versicherungs-Demo buchen <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/legal/compliance-matrix" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                Provider-Vergleich
              </Link>
              <Link to="/fintech" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-titanium-400 hover:text-titanium-200 text-sm rounded-none">
                Auch FinTech?
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
