import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Calculator, AlertTriangle, CheckCircle2 } from 'lucide-react';

export function SteuerberaterLanding() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center">
            <Calculator className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Steuerberater &amp; WP</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto space-y-10">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-blue-900 bg-blue-950/30 text-blue-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <Calculator className="h-3 w-3" /> § 203 StGB · BStBK · IDW · DATEV-fähig
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              KI in der Steuer­kanzlei — <span className="text-security-400">§ 203 StGB-fest</span>
            </h1>
            <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
              Mandatsdaten dürfen weder per ChatGPT-Web noch via US-Cloud-Default verarbeitet werden.
              Wir liefern den EU-souveränen KI-Stack, mit dem deine Kanzlei BStBK-konform automatisiert.
            </p>
          </div>

          <Section title="Regulatorische Lage">
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><strong className="text-titanium-50 mr-1">§ 203 StGB:</strong> Verletzung von Privatgeheimnissen — Drittlandtransfer von Mandatsdaten ohne expliziten Schutz strafbar</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><strong className="text-titanium-50 mr-1">StBerG:</strong> Berufsrechtliche Verschwiegenheitspflicht ist absolut, keine konkludente Zustimmung des Mandanten</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><strong className="text-titanium-50 mr-1">BStBK-Hinweise 2024:</strong> KI-Tools im Mandatskontext brauchen Auftragsverarbeitungsvertrag (AVV), Audit-Trail, EU-Datenresidenz</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><strong className="text-titanium-50 mr-1">AO § 30:</strong> Steuergeheimnis bei Bearbeitung steuerlicher Mandate — auch gegenüber Dritten/Software-Anbietern</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><strong className="text-titanium-50 mr-1">DSGVO:</strong> Mandatsdaten als personenbezogen — Art. 9 ggf. einschlägig bei Privatpatienten-/Sozial-Daten</li>
            </ul>
          </Section>

          <Section title="Was wir liefern">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">EU-souveräner KI-Stack</strong> mit Frankfurt-Hosting + Ollama-Self-Hosting (Llama / Mistral lokal) — kein US-Cloud-Default-Pfad</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Mandanten-Wahl-Mechanismus</strong> — KI-Aufrufe können pro Mandant aktiviert/deaktiviert werden, dokumentiert</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Audit-Trail pro KI-Aufruf</strong> — welcher User, welcher Mandant, welches Modell, welche Daten, wann</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">AVV-Vorlage Steuerberater-spezifisch</strong> — mit § 203-StGB-/StBerG-Hinweisen, BStBK-konformer Wording</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">DATEV-Export</strong> für Buchhaltungsdaten geplant Q2/2027</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Multi-Mandant-Workspace</strong> — Trennung pro Mandant, Rollen-Modell, Onboarding-Workflow</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">DSFA-Vorlagen Steuer-Use-Cases</strong> + 72h-Meldepflicht-Timer mit Aufsichtsbehörden je Bundesland</span></li>
            </ul>
          </Section>

          <Section title="Use-Cases">
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { t: 'Belegverarbeitung', d: 'OCR + Kategorisierung lokal · keine Cloud-Übertragung von Belegen' },
                { t: 'Steuer-Erklärungs-Vorbereitung', d: 'Anlagen-Voranalyse · finale Prüfung Steuerberater' },
                { t: 'Mandanten-Korrespondenz', d: 'Antworts-Vorschläge mit § 203-Hinweis · finale Versendung manuell' },
                { t: 'Steuer-Recht-Recherche (RAG)', d: 'BMF-Schreiben + Rechtsprechung lokal indexiert · Quellen-Zitierung Pflicht' },
                { t: 'Stundenerfassung', d: 'Auto-Vorschläge basierend auf Aktivität · DSGVO-konform' },
                { t: 'Geldwäsche-Indikatoren', d: 'GwG-Auffälligkeits-Score mit Begründung · Final-Entscheidung Berater' },
              ].map((u) => (
                <div key={u.t} className="p-3 bg-obsidian-900 border border-titanium-900 rounded-none">
                  <div className="font-display font-bold text-titanium-50 text-sm mb-1">{u.t}</div>
                  <div className="text-xs text-titanium-400 leading-relaxed">{u.d}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Berufsrechts­konforme Pricing-Struktur">
            <p>
              Für Steuerkanzleien bieten wir einen <strong className="text-titanium-50">Kanzlei-Tier</strong> mit
              individuellem AVV-Anhang (BStBK/§-203-konform), Mandanten-Trennungs-Workspace, Audit-Trail-Export
              und optionalem On-Premise-Modus. Pricing nach Anzahl Mandate-buchhaltungen — Anfrage über
              Sales-Call.
            </p>
          </Section>

          <div className="mt-12 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
            <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
              KI-Effizienz ohne § 203-Risiko
            </h2>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <Link to="/contact-sales?source=steuerberater" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Founding Access starten <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/avv-generator?source=steuerberater" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                AVV-Vorlage erstellen
              </Link>
              <Link to="/legal-tech" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-titanium-400 hover:text-titanium-200 text-sm rounded-none">
                Auch für Anwälte?
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-titanium-900 mt-12 py-6 px-4">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3 sm:justify-between text-xs text-titanium-500">
          <div>© 2026 RealSync Dynamics · Made in Germany · EU-Hosted</div>
          <div className="flex flex-wrap gap-3">
            <Link to="/impressum" className="hover:text-titanium-300">Impressum</Link>
            <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>
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
