import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, AlertTriangle, X, Check, UserCheck } from 'lucide-react';

/**
 * /grenzen — Grenzen automatisierter Compliance.
 *
 * Strategischer Trust-Hub: macht offen, was unsere Tools NICHT können
 * und wann menschliche Prüfung Pflicht ist. Reduziert Haftung,
 * False-Expectation-Klagen und Enterprise-Skepsis. Komplementär zu
 * /legal/methodology.
 */
export function Limits() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-amber-500 to-orange-700 flex items-center justify-center">
            <AlertTriangle className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Grenzen automatisierter Compliance</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto space-y-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-amber-900 bg-amber-950/30 text-amber-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <AlertTriangle className="h-3 w-3" /> Was unsere Tools NICHT können · Wann manuelle Prüfung Pflicht ist
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              Wo Automatisierung <span className="text-amber-400">aufhört</span>
            </h1>
            <p className="text-lg text-titanium-300 leading-relaxed">
              Wir bauen Compliance-Tools, kein digitales Anwaltsbüro. Hier dokumentieren wir
              transparent, was wir leisten — und was wir bewusst nicht leisten.
            </p>
          </div>

          <Section title="Was unsere Tools NICHT können">
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-start gap-3"><X className="h-4 w-4 text-red-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Individuelle Rechtsberatung im Sinne des RDG</strong> — nur ein zugelassener Rechtsanwalt, Steuerberater oder DSB darf rechtsverbindlich beraten. Unsere Outputs sind Vorlagen, keine Gutachten.</span></li>
              <li className="flex items-start gap-3"><X className="h-4 w-4 text-red-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Bindende AI-Act-Konformitätsbewertung</strong> — Conformity Assessment für High-Risk-AI macht ein Notified Body. Wir liefern Vor-Klassifikation und Dokumentations-Templates.</span></li>
              <li className="flex items-start gap-3"><X className="h-4 w-4 text-red-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Final-DSFA nach Art. 35 DSGVO</strong> — Art. 35 setzt eine menschliche Bewertung des Verantwortlichen / DSB voraus. Wir liefern Wizard + Vorlage, das Endurteil bleibt menschlich.</span></li>
              <li className="flex items-start gap-3"><X className="h-4 w-4 text-red-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Bestehende AVVs prüfen oder ersetzen</strong> — wir generieren neue Vorlagen aus deinem Sub-Processor-Setup. Bewertung bestehender Verträge braucht juristische Prüfung.</span></li>
              <li className="flex items-start gap-3"><X className="h-4 w-4 text-red-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Bußgeld-Höhe verbindlich vorhersagen</strong> — unser Simulator zeigt eine <em>Bandbreite</em> auf Basis Art. 83 DSGVO + DSK-Konzept + öffentlicher Bescheide, kein verbindliches Ergebnis.</span></li>
              <li className="flex items-start gap-3"><X className="h-4 w-4 text-red-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Aufsichts-Beschwerden bearbeiten</strong> — bei laufenden Verfahren mit BfDI/TLfDI braucht es spezialisierte Anwälte.</span></li>
              <li className="flex items-start gap-3"><X className="h-4 w-4 text-red-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Drittland-Transfer-Impact-Assessment final unterschreiben</strong> — TIA nach EDPB 01/2020 ist eine Verantwortlichen-Pflicht; wir liefern strukturierte Vorlage.</span></li>
              <li className="flex items-start gap-3"><X className="h-4 w-4 text-red-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Branchenspezifische Sondervorschriften abschließend prüfen</strong> — § 203 StGB (Berufsgeheimnis), BAIT (BaFin-Aufsicht), § 26 BDSG (Beschäftigtendaten) brauchen oft Fachanwalt-Expertise.</span></li>
            </ul>
          </Section>

          <Section title="Wann menschliche Prüfung Pflicht ist">
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-start gap-3"><UserCheck className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Drittlandtransfer:</strong> Wenn US-Cloud-LLM (Anthropic/OpenAI/Google) involviert ist — TIA durch Verantwortlichen prüfen.</span></li>
              <li className="flex items-start gap-3"><UserCheck className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Besondere Datenkategorien (Art. 9 DSGVO):</strong> Gesundheits-, Gewerkschafts-, Glaubens-, biometrische, sexuelle, ethnische Daten — immer Anwalt/DSB.</span></li>
              <li className="flex items-start gap-3"><UserCheck className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Automatisierte Einzelentscheidung (Art. 22):</strong> Wenn KI-Output rechtliche Wirkung gegen Betroffene hat — explizite Einwilligung + manuelle Override-Pflicht.</span></li>
              <li className="flex items-start gap-3"><UserCheck className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Minderjährige (Art. 8):</strong> Eltern-Einwilligung &lt; 16 Jahre, plus pädagogisches Konzept (Schule/EdTech).</span></li>
              <li className="flex items-start gap-3"><UserCheck className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">High-Risk AI Act (Annex III):</strong> Conformity Assessment + Risk-Management-Framework — Notified Body involvieren.</span></li>
              <li className="flex items-start gap-3"><UserCheck className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Datenpanne nach Art. 33:</strong> 72-Stunden-Meldung — unser Timer ist Operations-Tool, das Schreiben verfasst dein DSB.</span></li>
              <li className="flex items-start gap-3"><UserCheck className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Tool-Output mit Confidence Medium oder Low:</strong> Sektionen explizit zur Review markiert — vor Versand prüfen.</span></li>
            </ul>
          </Section>

          <Section title="Was wir GUT können (Komplement zu menschlicher Prüfung)">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-3"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Strukturierte Vorlagen</strong> — AVV / VVT / DSFA / TOM mit branchenspezifischen Use-Cases.</span></li>
              <li className="flex items-start gap-3"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Static-Audit fremder Websites</strong> — Tracker, Cookie-Banner-Konformität, fehlende Pflichtangaben automatisch erkennen.</span></li>
              <li className="flex items-start gap-3"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Vor-Klassifikation</strong> nach AI Act und DSGVO mit Confidence-Indikator und expliziten manuellen-Review-Pointern.</span></li>
              <li className="flex items-start gap-3"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Versionierter Audit-Trail</strong> — wer hat wann mit welcher Methodik-Version was generiert.</span></li>
              <li className="flex items-start gap-3"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Sub-Processors-Verwaltung</strong> — Liste, Versionierung, Art. 28 Abs. 2 Notification.</span></li>
              <li className="flex items-start gap-3"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Operative Workflows</strong> — Meldepflicht-Timer, Bußgeld-Range-Simulator, Compliance-Matrix-Vergleich.</span></li>
            </ul>
          </Section>

          <Section title="Unser Modell: Compliance Co-Pilot">
            <p>
              Wir halten uns bewusst zurück, „der digitale Anwalt" zu sein. Stattdessen liefern wir
              ein <strong className="text-titanium-50">professionelles Assistenzsystem mit nachvollziehbarer Methodik</strong>,
              das die Arbeit des DSB / Anwalts / Compliance-Officers spürbar beschleunigt — ohne ihn zu ersetzen.
            </p>
            <p>
              Das ist juristisch belastbarer (klarer RDG-Abstand), kommerziell skalierbarer
              (kein 1:1-Beratungsmandat) und für deine Kunden vertrauenswürdiger
              (Methodik einsehbar, Confidence transparent, Grenzen offen).
            </p>
          </Section>

          <div className="mt-12 p-6 bg-obsidian-900 border border-security-700 rounded-none">
            <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">Hilfe bei der manuellen Prüfung</h2>
            <p className="text-titanium-300 text-sm mb-4">
              Du brauchst einen Anwalt oder DSB für den Final-Check? Wir vermitteln dich weiter
              an unser Partner-Netzwerk in DACH (Datenschutz-Anwälte, externe DSBs, Notified Bodies).
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link to="/contact-sales?source=limits" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Partner anfragen <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/legal/methodology" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                Methodik-Details
              </Link>
              <Link to="/security" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-titanium-400 hover:text-titanium-200 text-sm rounded-none">
                Security-Posture
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
            <Link to="/legal/methodology" className="hover:text-titanium-300">Methodik</Link>
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
