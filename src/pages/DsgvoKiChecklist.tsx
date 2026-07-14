import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowRight, AlertTriangle, CheckCircle2, ArrowLeft } from 'lucide-react';

interface ChecklistItem {
  id: string;
  title: string;
  detail: string;
  ref: string;
  category: 'datenresidenz' | 'transparenz' | 'sicherheit' | 'rechte' | 'avv' | 'aiact' | 'beweisbarkeit';
}

const items: ChecklistItem[] = [
  // Datenresidenz
  { id: 'd1', category: 'datenresidenz', title: 'Hosting in der EU', detail: 'KI-Provider und Speicher dürfen Daten nicht in Drittländer ohne Angemessenheitsbeschluss übertragen. Schrems-II hat das Privacy-Shield gekippt; aktuelle Standardvertragsklauseln (SCCs) reichen nur mit zusätzlichen Schutzmaßnahmen.', ref: 'DSGVO Art. 44–46 · Schrems-II EuGH C-311/18' },
  { id: 'd2', category: 'datenresidenz', title: 'Sub-Auftragsverarbeiter dokumentiert', detail: 'Jeder eingesetzte Cloud-Anbieter, der personenbezogene Daten verarbeitet, muss in einer öffentlich einsehbaren Liste aufgeführt sein — inklusive Sitz, Leistung und Rechtsgrundlage des Transfers.', ref: 'DSGVO Art. 28 Abs. 2' },
  { id: 'd3', category: 'datenresidenz', title: 'US-Provider nur mit zusätzlichen Schutzmaßnahmen', detail: 'OpenAI, Anthropic und Google verarbeiten primär in den USA. Einsatz erfordert SCCs + Verschlüsselung at-rest und in-transit + Transfer-Impact-Assessment.', ref: 'EDSA-Empfehlungen 01/2020' },

  // Transparenz
  { id: 't1', category: 'transparenz', title: 'Datenschutzerklärung enthält KI-Verarbeitung', detail: 'Welche Daten gehen an welchen KI-Provider? Welche Modelle? Welche Zweckbindung? Pauschale „Wir nutzen KI" reicht nicht.', ref: 'DSGVO Art. 13 Abs. 1+2' },
  { id: 't2', category: 'transparenz', title: 'Cookie-Banner mit „Ablehnen" gleichberechtigt', detail: 'Reject-Button muss visuell gleichwertig zu Accept-Button sein. Dark-Patterns (graue Reject-Schrift, versteckte Ebenen) sind abmahnfähig.', ref: '§ 25 TDDDG · BfDI-Leitlinie 2024' },
  { id: 't3', category: 'transparenz', title: 'Tracker erst nach Consent laden', detail: 'Google Analytics, Meta-Pixel, LinkedIn-Insight, Hotjar, Microsoft Clarity dürfen NICHT vor Cookie-Consent geladen werden — auch nicht „anonymisiert".', ref: 'DSGVO Art. 6 Abs. 1 · § 25 TDDDG' },
  { id: 't4', category: 'transparenz', title: 'Auftragsverarbeitung im Datenschutzhinweis', detail: 'Jeder Auftragsverarbeiter (KI-Anbieter, CRM, E-Mail) muss namentlich + mit Speicherort genannt werden.', ref: 'DSGVO Art. 13 Abs. 1 lit. e' },

  // Sicherheit (Art. 32)
  { id: 's1', category: 'sicherheit', title: 'TLS 1.2+ erzwungen', detail: 'HTTP-Antworten müssen Strict-Transport-Security senden. Mixed Content (HTTP-Asset auf HTTPS-Seite) ist ein Befund.', ref: 'DSGVO Art. 32 Abs. 1 lit. a' },
  { id: 's2', category: 'sicherheit', title: 'API-Keys nicht im Frontend', detail: 'Anthropic/OpenAI-Keys gehören in Edge Functions oder Vault, niemals in Vite-Bundle. Eine extrahierbare API-Key ist meldepflichtige Datenpanne.', ref: 'DSGVO Art. 32 Abs. 1 lit. b · Art. 33' },
  { id: 's3', category: 'sicherheit', title: 'Audit-Log über Modellaufrufe', detail: 'Welcher User hat welche Daten an welches Modell geschickt — vollständig nachvollziehbar mit Timestamps. Pflicht bei betrieblicher KI-Nutzung.', ref: 'DSGVO Art. 32 Abs. 1 lit. d · BAIT AT 4.5' },
  { id: 's4', category: 'sicherheit', title: 'Verschlüsselung at-rest', detail: 'Datenbank, Backups, Object-Storage — alles AES-256 oder stärker. Cloud-Provider müssen Key-Management dokumentieren.', ref: 'DSGVO Art. 32 Abs. 1 lit. a' },
  { id: 's5', category: 'sicherheit', title: 'Zugriffskontrollen mit Least-Privilege', detail: 'Service-Accounts dürfen nur das, was sie müssen. Row-Level-Security in DB-Tabellen mit personenbezogenen Daten.', ref: 'DSGVO Art. 32 · ISO 27002 §9' },

  // Betroffenenrechte
  { id: 'r1', category: 'rechte', title: 'Auskunftsrecht maschinell lieferbar', detail: 'User muss innerhalb 30 Tagen einen vollständigen Export seiner Daten als JSON oder CSV erhalten — inklusive aller AI-generierten Inhalte mit ihm als Subject.', ref: 'DSGVO Art. 15' },
  { id: 'r2', category: 'rechte', title: 'Löschung kaskadiert', detail: 'Account-Löschung muss alle Datenpunkte entfernen oder anonymisieren — auch in Backups, Embeddings, Caches, AI-Provider-Logs.', ref: 'DSGVO Art. 17' },
  { id: 'r3', category: 'rechte', title: 'Datenportabilität', detail: 'Strukturiertes maschinenlesbares Format (JSON/CSV) für alle vom User bereitgestellten Daten. Auf Anfrage direkt an anderen Anbieter übertragbar.', ref: 'DSGVO Art. 20' },
  { id: 'r4', category: 'rechte', title: 'Widerspruchsrecht gegen automatisierte Entscheidungen', detail: 'Wenn KI Entscheidungen mit rechtlicher Wirkung trifft (Bonität, Bewerbung, Kündigung), hat Betroffener Anspruch auf menschlichen Eingriff.', ref: 'DSGVO Art. 22' },

  // AVV
  { id: 'a1', category: 'avv', title: 'AVV mit jedem Auftragsverarbeiter', detail: 'Schriftlicher Vertrag mit jedem Cloud-/KI-/Hosting-/Newsletter-Anbieter, der personenbezogene Daten verarbeitet. Mündlich oder per Klick reicht NICHT.', ref: 'DSGVO Art. 28 Abs. 3' },
  { id: 'a2', category: 'avv', title: 'TOM-Anhang im AVV', detail: 'Technisch-organisatorische Maßnahmen — Pseudonymisierung, Verschlüsselung, Zugriffskontrolle — müssen konkret im AVV-Anhang stehen.', ref: 'DSGVO Art. 32 i.V.m. Art. 28 Abs. 3 lit. c' },
  { id: 'a3', category: 'avv', title: 'Sub-Verarbeiter freigegeben', detail: 'Wenn der Auftragsverarbeiter selbst Sub-Auftragsverarbeiter einsetzt (z. B. Aufsetz-Cloud), müssen diese im AVV oder gesondert genehmigt sein.', ref: 'DSGVO Art. 28 Abs. 2+4' },

  // AI Act
  { id: 'i1', category: 'aiact', title: 'Risiko-Klassifikation des KI-Systems', detail: 'AI Act unterscheidet: minimal · limited · high · unacceptable. HR-Tools und Bonitätsprüfung sind High-Risk und brauchen Conformity Assessment.', ref: 'AI Act Art. 6 + Annex III' },
  { id: 'i2', category: 'aiact', title: 'Transparenzpflicht bei KI-Interaktion', detail: 'User muss erkennen, dass sie mit einer KI sprechen — explizit, nicht versteckt. Gilt für Chatbots, Voice-Assistants, AI-generierte Texte.', ref: 'AI Act Art. 50' },
  { id: 'i3', category: 'aiact', title: 'Technische Dokumentation', detail: 'Trainingsdaten-Quelle, Modell-Architektur, Test-Methodik, Bias-Mitigation — bei High-Risk-Systemen Pflicht ab 2026.', ref: 'AI Act Art. 11 + Annex IV' },
  { id: 'i4', category: 'aiact', title: 'Human Oversight', detail: 'High-Risk-KI-Systeme müssen menschlich überwachbar sein — Override-Funktion, Stop-Button, Audit-Trail aller automatisierten Entscheidungen.', ref: 'AI Act Art. 14' },

  // Beweisbarkeit
  { id: 'b1', category: 'beweisbarkeit', title: 'Verzeichnis der Verarbeitungstätigkeiten (VVT)', detail: 'Lebende Liste aller Datenverarbeitungen mit Zweck, Rechtsgrundlage, Empfängern, Fristen. Bei Aufsichts-Anfrage in 14 Tagen vorzulegen.', ref: 'DSGVO Art. 30' },
  { id: 'b2', category: 'beweisbarkeit', title: 'Datenschutz-Folgenabschätzung (DSFA) bei KI-Einsatz', detail: 'Pflicht bei KI mit hohem Risiko für Betroffene — Profiling, Scoring, Bewerber-Screening. Vor Inbetriebnahme!', ref: 'DSGVO Art. 35' },
  { id: 'b3', category: 'beweisbarkeit', title: 'Meldewege für Datenschutzpannen', detail: 'Aufsichtsbehörde innerhalb 72 Stunden, Betroffene unverzüglich. Vorbereiteter Incident-Plan + Kontakte zu allen Auftragsverarbeitern.', ref: 'DSGVO Art. 33+34' },
  { id: 'b4', category: 'beweisbarkeit', title: 'Datenschutzbeauftragter benannt', detail: 'Ab 20 mit personenbezogenen Daten regelmäßig befassten Personen, oder bei Kerntätigkeit „umfangreiche Verarbeitung sensibler Daten".', ref: 'DSGVO Art. 37+38 · § 38 BDSG' },
];

const categoryMeta: Record<ChecklistItem['category'], { label: string; color: string }> = {
  datenresidenz:    { label: 'Datenresidenz',          color: 'text-emerald-300 border-emerald-900' },
  transparenz:      { label: 'Transparenz',            color: 'text-blue-300 border-blue-900' },
  sicherheit:       { label: 'Sicherheit (Art. 32)',   color: 'text-orange-300 border-orange-900' },
  rechte:           { label: 'Betroffenenrechte',      color: 'text-purple-300 border-purple-900' },
  avv:              { label: 'AVV (Art. 28)',          color: 'text-teal-300 border-teal-900' },
  aiact:            { label: 'AI Act',                 color: 'text-red-300 border-red-900' },
  beweisbarkeit:    { label: 'Beweisbarkeit',          color: 'text-amber-300 border-amber-900' },
};

export function DsgvoKiChecklist() {
  const grouped = groupBy(items, (i) => i.category);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <Header />

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto">
          <article>
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 border border-emerald-900 bg-emerald-950/30 text-emerald-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
                <ShieldCheck className="h-3 w-3" /> DSGVO + AI Act · Stand 2026
              </div>
              <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
                DSGVO-konforme KI in <span className="text-security-400">{items.length} Punkten</span>
              </h1>
              <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
                Eine vollständige Checkliste für Entscheider in regulierten Branchen — HealthTech, Legal,
                FinTech, Behörden. Jeder Punkt mit Paragraph-Referenz und Prüf-Kriterium.
              </p>
              <div className="mt-6">
                <Link to="/audit" className="inline-flex items-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                  Lass Deine Site automatisch prüfen <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="space-y-12">
              {(Object.entries(grouped) as [ChecklistItem['category'], ChecklistItem[]][]).map(([cat, list]) => (
                <section key={cat}>
                  <div className={`inline-block px-3 py-1 border ${categoryMeta[cat].color} text-xs font-bold uppercase tracking-wider rounded-none mb-4`}>
                    {categoryMeta[cat].label}
                  </div>
                  <ul className="space-y-3">
                    {list.map((item) => <ItemCard key={item.id} item={item} />)}
                  </ul>
                </section>
              ))}
            </div>

            <div className="mt-16 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="h-6 w-6 text-security-400 shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
                    Diese Liste manuell abarbeiten dauert 6 Monate.
                  </h2>
                  <p className="text-sm text-titanium-300 leading-relaxed">
                    RealSync Dynamics liefert die Bausteine als SaaS — EU-Datenresidenz, Audit-Log, AVV-Generator,
                    DSGVO-Selfservice (Art. 15 + 17). <strong className="text-titanium-50">In 14 Tagen DSGVO-ready.</strong>
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Link to="/audit" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                  Kostenloser Audit-Scan <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/contact-sales?source=checklist" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                  Founding Access starten
                </Link>
                <Link to="/legal/compliance-matrix" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-titanium-400 hover:text-titanium-200 text-sm rounded-none">
                  Compliance-Matrix vergleichen
                </Link>
              </div>
            </div>
          </article>
        </div>
      </main>

      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: `DSGVO-konforme KI in ${items.length} Punkten — Checkliste 2026`,
            description: 'Vollständige DSGVO + AI-Act Checkliste für Entscheider in regulierten Branchen. Mit Paragraph-Referenzen.',
            author: { '@type': 'Organization', name: 'RealSync Dynamics' },
            publisher: { '@type': 'Organization', name: 'RealSync Dynamics' },
            datePublished: '2026-05-06',
            inLanguage: 'de-DE',
          }),
        }}
      />
    </div>
  );
}

function ItemCard({ item }: { item: ChecklistItem }) {
  return (
    <li className="flex items-start gap-3 p-4 bg-obsidian-900 border border-titanium-900 rounded-none">
      <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="font-display font-bold text-titanium-50 text-sm mb-1">{item.title}</div>
        <div className="text-sm text-titanium-300 leading-relaxed mb-2">{item.detail}</div>
        <div className="text-[11px] text-titanium-500 font-mono">{item.ref}</div>
      </div>
    </li>
  );
}

function Header() {
  return (
    <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
      <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-none bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center">
          <ShieldCheck className="h-4 w-4 text-white" />
        </div>
        <div className="font-display font-bold text-sm tracking-tight text-titanium-50">DSGVO-KI-Checkliste</div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-titanium-900 mt-12 py-6 px-4">
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3 sm:justify-between text-xs text-titanium-500">
        <div>© 2026 RealSync Dynamics · Made in Germany</div>
        <div className="flex flex-wrap gap-3">
          <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>
          <Link to="/impressum" className="hover:text-titanium-300">Impressum</Link>
          <Link to="/legal/avv" className="hover:text-titanium-300">AVV</Link>
        </div>
      </div>
    </footer>
  );
}

function groupBy<T, K extends string>(arr: T[], key: (t: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const item of arr) {
    const k = key(item);
    if (!out[k]) out[k] = [];
    out[k].push(item);
  }
  return out;
}
