import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Database, Cog, FileSearch, Calendar, GitBranch, AlertTriangle } from 'lucide-react';
import { MethodologyBooking } from '../../components/MethodologyBooking';

/**
 * /legal/methodology — Methodology Center.
 *
 * Strategischer Trust-Building-Hub: erklärt nachvollziehbar, wie unsere
 * automatisierten Analysen (Audit, AI-Act-Klassifikator, Bußgeld-Rechner,
 * Tracker-Erkennung) funktionieren, woher die Daten kommen, wie wir
 * Confidence quantifizieren und wann manuelle Prüfung nötig ist.
 *
 * Strategie: nicht „perfekt erscheinen", sondern „transparent zeigen,
 * wie Unsicherheit gehandhabt wird". Reduziert Haftung, Support-Kosten,
 * Enterprise-Skepsis.
 */
export function LegalMethodology() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-security-500 to-security-700 flex items-center justify-center">
            <BookOpen className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Methoden- &amp; Rechts­transparenz</div>
            <div className="text-[11px] text-titanium-400 font-medium">Wie unsere Analysen entstehen</div>
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto space-y-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-security-900 bg-security-950/30 text-security-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <BookOpen className="h-3 w-3" /> Datenquellen · Methodik · Update-Prozess · Mapping
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              Wie unsere Analysen <span className="text-security-400">tatsächlich entstehen</span>
            </h1>
            <p className="text-lg text-titanium-300 leading-relaxed">
              Wir behaupten nicht, perfekt zu sein. Wir zeigen offen, wie unsere automatisierten
              Tools (Audit, AI-Act-Klassifikator, Bußgeld-Simulator, Tracker-Erkennung) funktionieren,
              woher Daten und Regeln kommen, und wann manuelle Prüfung erforderlich ist.
            </p>
          </div>

          <Section title="Grundprinzip: Compliance Co-Pilot, kein AI-Anwalt" icon={<AlertTriangle className="h-5 w-5 text-amber-400" />}>
            <p>
              Unsere Tools <strong className="text-titanium-50">unterstützen</strong> bei der Compliance-Arbeit —
              sie ersetzen keinen DSB, keinen Anwalt, keine eigenständige juristische Bewertung.
              Output ist immer eine begründete Vorlage, nie ein Endurteil.
            </p>
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-1">→</span><span>Jeder Tool-Output enthält eine <em>Confidence-Indikation</em> (siehe unten)</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-1">→</span><span>Vor Export kritischer Dokumente (AVV, DSFA, TOM): Pflicht-Bestätigung des Nutzers, dass juristische Prüfung empfohlen ist</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-1">→</span><span>Bei niedriger Confidence empfehlen wir Sektionen explizit zur manuellen Review</span></li>
            </ul>
          </Section>

          <Section title="Datenquellen" icon={<Database className="h-5 w-5 text-security-400" />}>
            <p>
              Unsere Regelwerke speisen sich aus öffentlich zugänglichen, primären Rechtsquellen
              und kuratierten Industrie-Datenbanken. Stand wird per Versions-Tag dokumentiert
              (siehe „Update-Prozess" unten).
            </p>
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              {[
                { t: 'Primäre Rechtstexte', d: 'DSGVO, BDSG, TTDSG, MStV, AI Act EU 2024/1689, BAIT, MaRisk, IDD, KWG, StBerG, BRAO, § 203 StGB' },
                { t: 'Aufsichtsbehörden', d: 'BfDI 2024 Guidelines · DSK-Beschlüsse · Landesbeauftragten-Hinweise · BaFin-Rundschreiben · BMF-Schreiben · KMK' },
                { t: 'Rechtsprechung', d: 'EuGH (Schrems I/II), BGH, BVerwG, OVG-Entscheidungen, einschlägige Datenschutz-Urteile (LG Düsseldorf 2024 etc.)' },
                { t: 'EDPB / EU-Stellen', d: 'EDPB-Empfehlungen 01/2020 (Transfer Impact Assessment), Annex III AI Act, AI-Office-Guidance' },
                { t: 'Tracker-DB', d: 'EasyList, Disconnect.me, eigene kuratierte Liste (DACH-Fokus). Versionsnummer auf jedem Audit-Report' },
                { t: 'Bußgeld-Datenbank', d: 'CMS DSGVO-Tracker, GDPR-Hub (öffentliche Aufsichts-Bescheide DACH), BfDI-Tätigkeitsberichte' },
              ].map((s) => (
                <div key={s.t} className="p-3 bg-obsidian-900 border border-titanium-900 rounded-none">
                  <div className="font-display font-bold text-titanium-50 text-sm mb-1">{s.t}</div>
                  <div className="text-xs text-titanium-400 leading-relaxed">{s.d}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Klassifikations-Methodik" icon={<Cog className="h-5 w-5 text-security-400" />}>
            <p>
              <strong className="text-titanium-50">Wichtig:</strong> Wir nutzen für rechtliche Klassifikation
              <em> deterministische Regelwerke</em>, kein LLM-Endurteil. KI ist nur unterstützend für
              Wording-Vorschläge oder unstrukturierte Use-Case-Beschreibungen — die finale
              Risiko-Klassifikation erfolgt regelbasiert.
            </p>
            <div className="space-y-3 mt-3">
              <div className="p-3 bg-obsidian-900 border-l-2 border-emerald-700 rounded-none">
                <div className="font-display font-bold text-titanium-50 text-sm mb-1">AI-Act-Klassifikator</div>
                <div className="text-xs text-titanium-400 leading-relaxed">
                  Decision Tree mit 12 Fragen → Mapping auf Annex III Punkte 1-8 + Art. 5 (verbotene Praktiken)
                  + Art. 52 (Transparenz). Output: Indikation („möglicherweise High-Risk Annex III(4)" — nicht
                  „Sie sind High-Risk"). Confidence basiert auf Übereinstimmungstiefe der Antworten mit
                  Annex-Beispielen.
                </div>
              </div>
              <div className="p-3 bg-obsidian-900 border-l-2 border-emerald-700 rounded-none">
                <div className="font-display font-bold text-titanium-50 text-sm mb-1">Audit-Tool (Website-Scan)</div>
                <div className="text-xs text-titanium-400 leading-relaxed">
                  Statische Analyse: HTTP-Header, sichtbare Cookies, Script-Quellen-Whitelist-Match,
                  Subpage-Crawl /datenschutz + /impressum. Score = gewichtete Summe. Confidence pro
                  detektiertem Tracker (Script-URL-Match: hoch · Cookie-Pattern: mittel · DOM-Heuristik: niedrig).
                </div>
              </div>
              <div className="p-3 bg-obsidian-900 border-l-2 border-emerald-700 rounded-none">
                <div className="font-display font-bold text-titanium-50 text-sm mb-1">Bußgeld-Simulator</div>
                <div className="text-xs text-titanium-400 leading-relaxed">
                  Output ist <strong className="text-titanium-50">Bußgeldrahmen (von–bis)</strong>, keine
                  Punkt-Schätzung. Berechnungsbasis: Art. 83 DSGVO + DSK-Bußgeld-Konzept 2019 +
                  öffentliche Aufsichts-Bescheide. Educational Tool — keine Rechtsberatung.
                </div>
              </div>
              <div className="p-3 bg-obsidian-900 border-l-2 border-emerald-700 rounded-none">
                <div className="font-display font-bold text-titanium-50 text-sm mb-1">DSFA / VVT / AVV / TOM-Generatoren</div>
                <div className="text-xs text-titanium-400 leading-relaxed">
                  Template-basiert mit Use-Case-Mapping. Output ist immer Vorlage mit explizit markierten
                  Sektionen, die manuell zu prüfen sind (Drittlandtransfer, Gesundheitsdaten,
                  KI-basiertes Profiling).
                </div>
              </div>
            </div>
          </Section>

          <Section title="Confidence-Indikator" icon={<FileSearch className="h-5 w-5 text-security-400" />}>
            <p>
              Jeder Tool-Output enthält einen Confidence-Score mit Stufen-Klassifikation. Bei
              <strong className="text-titanium-50"> Medium oder Low</strong> empfehlen wir manuelle
              Prüfung der gekennzeichneten Sektionen.
            </p>
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-obsidian-950 text-[11px] font-bold text-titanium-400 uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-4 py-2.5">Stufe</th>
                    <th className="text-left px-4 py-2.5">Score</th>
                    <th className="text-left px-4 py-2.5">Bedeutung</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-titanium-900">
                  <tr><td className="px-4 py-2.5 text-emerald-300 font-bold">High</td><td className="px-4 py-2.5 text-titanium-300">85–100</td><td className="px-4 py-2.5 text-titanium-300 text-xs">Eindeutige Regel-Übereinstimmung mit primären Quellen</td></tr>
                  <tr><td className="px-4 py-2.5 text-amber-300 font-bold">Medium</td><td className="px-4 py-2.5 text-titanium-300">60–84</td><td className="px-4 py-2.5 text-titanium-300 text-xs">Wahrscheinliche Übereinstimmung — Kontext kann Auslegung ändern</td></tr>
                  <tr><td className="px-4 py-2.5 text-red-300 font-bold">Low</td><td className="px-4 py-2.5 text-titanium-300">0–59</td><td className="px-4 py-2.5 text-titanium-300 text-xs">Mehrere Auslegungs-Möglichkeiten — manuelle Prüfung dringend</td></tr>
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Audit- &amp; Versionierungs-Methodik" icon={<GitBranch className="h-5 w-5 text-security-400" />}>
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-1">•</span><span>Jeder Tool-Output trägt eine <strong className="text-titanium-50">Methodology-Version</strong> (z. B. <code className="text-emerald-300 text-xs">audit:2026.05.0</code> · <code className="text-emerald-300 text-xs">aiact:2026.05.0</code>)</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-1">•</span><span>Major-Updates der Regel-Engine werden im <Link to="/changelog" className="text-security-400">Changelog</Link> mit Quellen-Verweis dokumentiert</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-1">•</span><span>Tracker-DB-Update wöchentlich (jeder Donnerstag), Versionstag im Audit-Report sichtbar</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-1">•</span><span>Audit-Trail-Logs sind <strong className="text-titanium-50">append-only</strong> — Modifikation eines bestehenden Logs ist technisch ausgeschlossen (Postgres-Trigger)</span></li>
            </ul>
          </Section>

          <Section title="Update-Prozess Rechtslage" icon={<Calendar className="h-5 w-5 text-security-400" />}>
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-1">•</span><span><strong className="text-titanium-50">Wöchentlich:</strong> Tracker-DB, Anbieter-AVV-Links, Sub-Processor-Liste</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-1">•</span><span><strong className="text-titanium-50">Bei Aufsichts-Hinweis:</strong> BfDI / DSK / Landesbeauftragten-Veröffentlichungen werden in &lt; 7 Tagen in Regel-Engine eingearbeitet, im Changelog dokumentiert</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-1">•</span><span><strong className="text-titanium-50">Bei höchstrichterlicher Entscheidung:</strong> EuGH/BGH-Urteile mit Compliance-Relevanz werden binnen 14 Tagen analysiert + ggf. Mapping aktualisiert</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-1">•</span><span><strong className="text-titanium-50">Bei Gesetzesänderung:</strong> Pre-Launch-Tests gegen neue Anforderungen vor Major-Version-Release</span></li>
            </ul>
          </Section>

          <Section title="AI-Act-Mapping (Annex III)" icon={<FileSearch className="h-5 w-5 text-security-400" />}>
            <p>
              Unser Klassifikator mappt User-Use-Cases auf folgende High-Risk-Bereiche:
            </p>
            <ul className="space-y-1 text-xs font-mono text-titanium-400">
              <li>(1) Biometrische Identifikation</li>
              <li>(2) Kritische Infrastruktur</li>
              <li>(3) Bildung &amp; Berufsbildung — Auswahl, Bewertung, Prüfungs-Aufsicht</li>
              <li>(4) Beschäftigung &amp; Personalmanagement — Recruiting, Performance, Kündigung</li>
              <li>(5) Wesentliche Dienste — Kreditwürdigkeit, Versicherung-Underwriting, Gesundheits-Triage, Notrufe</li>
              <li>(6) Strafverfolgung</li>
              <li>(7) Migration &amp; Asyl</li>
              <li>(8) Justizverwaltung &amp; demokratische Prozesse</li>
            </ul>
            <p className="mt-3">
              Plus: Art. 5 (verbotene Praktiken — Social Scoring, Manipulation, Real-time-Biometrie),
              Art. 52 (Transparenz für Limited Risk — Chatbots, AI-generated Content).
            </p>
          </Section>

          <Section title="Grenzen automatisierter Compliance" icon={<AlertTriangle className="h-5 w-5 text-amber-400" />}>
            <p>
              Unsere Tools können NICHT:
            </p>
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-start gap-2"><span className="text-red-400 mt-1">✗</span><span>Individuelle Rechtsberatung im Sinne des RDG ersetzen</span></li>
              <li className="flex items-start gap-2"><span className="text-red-400 mt-1">✗</span><span>Bindende AI-Act-Konformitätsbewertung erstellen (das macht ein Notified Body)</span></li>
              <li className="flex items-start gap-2"><span className="text-red-400 mt-1">✗</span><span>DSFA durchführen, die ohne menschliche Prüfung des DSB / Verantwortlichen final ist (Art. 35 setzt menschliche Bewertung voraus)</span></li>
              <li className="flex items-start gap-2"><span className="text-red-400 mt-1">✗</span><span>Bestehende AVVs prüfen oder ersetzen — nur Vorlagen generieren</span></li>
              <li className="flex items-start gap-2"><span className="text-red-400 mt-1">✗</span><span>Bußgeld-Höhe verbindlich vorhersagen — nur Bandbreite simulieren</span></li>
            </ul>
            <p className="mt-3">
              Mehr dazu unter <Link to="/grenzen" className="text-security-400 hover:text-security-300">/grenzen</Link>.
            </p>
          </Section>

          <MethodologyBooking source="methodology" />

          <div className="flex flex-col sm:flex-row gap-2 pt-4">
            <Link to="/changelog" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
              Versions-Changelog
            </Link>
            <Link to="/security" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-titanium-400 hover:text-titanium-200 text-sm rounded-none">
              Security-Posture
            </Link>
          </div>

          <p className="text-xs text-titanium-500 leading-relaxed">
            Methodik-Stand: 2026.05.0 · Nächste geplante Major-Update: bei AI-Act-High-Risk-Enforcement August 2026 ·
            Quellen-Liste auf Anfrage als ausgedruckte PDF mit Belegstellen.
          </p>
        </div>
      </main>

      <footer className="border-t border-titanium-900 mt-12 py-6 px-4">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3 sm:justify-between text-xs text-titanium-500">
          <div>© 2026 RealSync Dynamics · Made in Germany · EU-Hosted</div>
          <div className="flex flex-wrap gap-3">
            <Link to="/impressum" className="hover:text-titanium-300">Impressum</Link>
            <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>
            <Link to="/grenzen" className="hover:text-titanium-300">Grenzen</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="text-xl sm:text-2xl font-display font-bold text-titanium-50">{title}</h2>
      </div>
      <div className="prose prose-invert max-w-none text-titanium-300 text-sm sm:text-base leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}
