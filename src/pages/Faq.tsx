import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, HelpCircle, Plus, Minus } from 'lucide-react';

type Item = { q: string; a: React.ReactNode; tag: 'DSGVO' | 'AI Act' | 'Pricing' | 'Technik' | 'Migration' };

const ITEMS: Item[] = [
  {
    tag: 'DSGVO',
    q: 'Ist eure Plattform DSGVO-konform — auch wenn sie KI-Calls an Anthropic / OpenAI macht?',
    a: (
      <>
        <p>
          Ja, mit zwei Schichten Wahlmöglichkeit:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 mt-2">
          <li><strong className="text-titanium-50">Default (Cloud-Pfad)</strong>: API-Calls über EU-region-pinned Endpoints (Anthropic EU, OpenAI EU-Tenant, Google Vertex eu-central) mit DPAs + SCCs nach Art. 46 DSGVO.</li>
          <li><strong className="text-titanium-50">EU-lokal-Modus</strong> (per Toggle in Account-Settings): Alle KI-Calls laufen ausschließlich über unseren Frankfurt-VPS mit Ollama (Llama / Mistral). Keine Drittland-Übermittlung.</li>
        </ul>
        <p className="mt-2">
          Volle Sub-Processor-Liste mit AVV-Links: <Link to="/legal/sub-processors" className="text-security-400">/legal/sub-processors</Link>
        </p>
      </>
    ),
  },
  {
    tag: 'AI Act',
    q: 'Was bedeutet der EU AI Act für meine KI-Anwendung?',
    a: (
      <>
        <p>
          Der AI Act stuft KI-Systeme in Risiko-Klassen ein. <strong className="text-titanium-50">Limited Risk</strong> (Chatbots, Content-Generation) braucht
          Transparenz-Pflichten. <strong className="text-titanium-50">High-Risk</strong> (Annex III: Medizin, Recht, Behörden, Underwriting, HR-Selektion) braucht
          Conformity Assessment, Risk-Management, Technical Documentation, Human Oversight, Audit-Logging.
        </p>
        <p className="mt-2">
          Klassifikation in 60 Sek: <Link to="/ai-act-klassifikator" className="text-security-400">/ai-act-klassifikator</Link>
        </p>
      </>
    ),
  },
  {
    tag: 'AI Act',
    q: 'Ab wann muss ich AI-Act-konform sein?',
    a: (
      <>
        <p>Phasenweise Geltung:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Februar 2025: Verbotene KI-Praktiken (Social Scoring, Emotion-Recognition am Arbeitsplatz, …)</li>
          <li>August 2025: General-Purpose-AI (GPAI) — Transparenz für Foundation Models</li>
          <li>August 2026: High-Risk-Systeme — voll wirksam</li>
          <li>August 2027: High-Risk-Systeme die in Sicherheitsbauteile eingebettet sind</li>
        </ul>
      </>
    ),
  },
  {
    tag: 'Pricing',
    q: 'Was kostet die Plattform?',
    a: (
      <>
        <p>Fünf Tiers + 14-Tage Pilot-Trial:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li><strong className="text-titanium-50">Free Audit</strong> kostenlos — einmaliger Compliance-Snapshot, kein Account</li>
          <li><strong className="text-titanium-50">Starter</strong> 79 €/Monat — eine Domain, Audit-Trail, monatlicher Re-Scan</li>
          <li><strong className="text-titanium-50">Growth</strong> 249 €/Monat — bis 3 Domains, tägliches Monitoring + Drift-Detection</li>
          <li><strong className="text-titanium-50">Agency</strong> 699 €/Monat — White-Label, Multi-Tenant (10 Sites), API + Webhooks</li>
          <li><strong className="text-titanium-50">Enterprise</strong> ab 1.500 €/Monat — SLA, AI-Act-Modul, DSB-Integration, Evidence Vault</li>
        </ul>
        <p className="mt-2">
          Volle Feature-Matrix: <Link to="/pricing" className="text-security-400">/pricing</Link>
        </p>
      </>
    ),
  },
  {
    tag: 'Pricing',
    q: 'Gibt es eine kostenlose Variante?',
    a: (
      <p>
        Ja — 8 Compliance-Tools (AVV-Generator, VVT-Wizard, DSFA-Wizard, TOM-Generator,
        AI-Act-Klassifikator, 72h-Meldepflicht-Timer, Bußgeld-Rechner, Datenschutz-Generator)
        sind kostenlos und ohne Anmeldung nutzbar. Übersicht: <Link to="/tools" className="text-security-400">/tools</Link>
      </p>
    ),
  },
  {
    tag: 'Technik',
    q: 'Wo werden meine Daten gehostet?',
    a: (
      <p>
        Postgres-DB + Auth + Edge Functions: Supabase Frankfurt (eu-central-1).
        KI-Cloud-Pfad: EU-region-pinned APIs der Anbieter. KI-Lokal-Pfad (Toggle):
        Hostinger Frankfurt VPS mit Ollama. Frontend: GitHub-Pages-CDN (Edge,
        keine PII-Persistenz).
      </p>
    ),
  },
  {
    tag: 'Technik',
    q: 'Habt ihr eine API?',
    a: (
      <p>
        Ja, ab Growth-Tier inklusive. API-Keys per Tenant, Rate-Limits, Audit-Log
        pro Aufruf. Dokumentation in Vorbereitung — bis dahin Endpoints siehe
        Sub-Processor-Liste.
      </p>
    ),
  },
  {
    tag: 'Technik',
    q: 'Kann ich Konversations-Bots (Chat, Telefonie, WhatsApp) einsetzen?',
    a: (
      <>
        <p>
          Ja — ab dem <strong className="text-titanium-50">Growth</strong>-Tier sind Konversations-Bots inklusive.
          Du legst sie selbst im Bot-Builder an (Persona, Begrüßung, Kanal) und bindest sie per Web-Endpoint
          bzw. Twilio-Webhook ein. Optional aktivierbar: <strong className="text-titanium-50">Terminbuchung</strong> und
          <strong className="text-titanium-50"> Bestellannahme</strong>.
        </p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li><strong className="text-titanium-50">Growth</strong> — Chat, Telegram & WhatsApp · bis 2 Bots · 2.000 Antworten/Monat</li>
          <li><strong className="text-titanium-50">Agency</strong> — zusätzlich Telefonie (Voice) · bis 10 Bots · 10.000 Antworten + 500 Voice-Minuten/Monat</li>
          <li><strong className="text-titanium-50">Scale</strong> — bis 50 Bots · 50.000 Antworten + 2.500 Voice-Minuten/Monat</li>
          <li><strong className="text-titanium-50">Enterprise</strong> — ohne Limit</li>
        </ul>
        <p className="mt-2">
          Jede Bot-Antwort ist RLS-geschützt, gedeckelt und mit Prüfpfad geloggt. Anlegen im Dashboard: <Link to="/app/bots" className="text-security-400">/app/bots</Link>
        </p>
      </>
    ),
  },
  {
    tag: 'Technik',
    q: 'Kann ich wiederkehrende Compliance-Aufgaben automatisieren?',
    a: (
      <>
        <p>
          Ja — über <strong className="text-titanium-50">Automatisierungs-Skills</strong> (DSGVO-Audit, Dokumenten-Generierung,
          Lead-Risk u. a.). Jeder Lauf wird mit Kosten und Prüfpfad protokolliert. Kontingente pro Monat:
        </p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li><strong className="text-titanium-50">Free</strong> 3 · <strong className="text-titanium-50">Starter</strong> 25 · <strong className="text-titanium-50">Growth</strong> 100 · <strong className="text-titanium-50">Agency</strong> 500 · <strong className="text-titanium-50">Scale</strong> 2.500 · <strong className="text-titanium-50">Enterprise</strong> unbegrenzt</li>
        </ul>
        <p className="mt-2">
          Übersicht der Skills: <Link to="/automations" className="text-security-400">/automations</Link>
        </p>
      </>
    ),
  },
  {
    tag: 'Technik',
    q: 'Gibt es einen Assistenten für Server-/VPS-Betrieb?',
    a: (
      <>
        <p>
          Ja — <strong className="text-titanium-50">Kodee</strong>, der VPS-Assistent, ab dem <strong className="text-titanium-50">Agency</strong>-Tier.
          Er verbindet sich per SSH mit deinem Server und hilft bei Status- und Log-Checks, DNS/TLS-Prüfung sowie
          Deployment-Aufgaben — inklusive Risiko-Advisor, der Schreib-Aktionen (z. B. Neustarts) vorab bewertet.
        </p>
        <p className="mt-2">
          Jede Aktion ist mandantengetrennt, verschlüsselt und im Prüfpfad geloggt. Zugang: <Link to="/kodee" className="text-security-400">/kodee</Link>
        </p>
      </>
    ),
  },
  {
    tag: 'Technik',
    q: 'Könnt ihr die Herkunft KI-generierter Inhalte nachweisen (C2PA / Content Credentials)?',
    a: (
      <>
        <p>
          Ja — der <strong className="text-titanium-50">Herkunftsnachweis</strong> (ab <strong className="text-titanium-50">Agency</strong>) bindet
          jedes Asset über eine unveränderliche <strong className="text-titanium-50">Chain-of-Custody</strong> (SHA-256-Hash-Kette) an einen
          signierten Manifest-Eintrag. Manipulation bricht die Kette und wird beim Verifizieren sofort erkannt.
        </p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Inhalts-Hash wird <strong className="text-titanium-50">lokal im Browser</strong> berechnet — die Datei verlässt dein Gerät nicht.</li>
          <li><strong className="text-titanium-50">Trust-Score</strong> (0–100) aus Signatur, Ketten-Kontinuität, Metadaten- und Eigentümer-Konsistenz.</li>
          <li>Jede Custody-Aktion ist mandantengetrennt (RLS) und im Prüfpfad geloggt.</li>
        </ul>
        <p className="mt-2">
          Datenmodell C2PA-angelehnt (Content Credentials); Zugang im Dashboard: <Link to="/app/provenance" className="text-security-400">/app/provenance</Link>
        </p>
      </>
    ),
  },
  {
    tag: 'Technik',
    q: 'Kann ich hunderte Domains auf einmal scannen (Bulk-Jobs)?',
    a: (
      <>
        <p>
          Ja — <strong className="text-titanium-50">Bulk-Jobs</strong> ab dem <strong className="text-titanium-50">Agency</strong>-Tier.
          Du fügst Domains per Liste oder <strong className="text-titanium-50">CSV-Import</strong> ein; sie werden lokal geprüft
          (dedupliziert, ungültige markiert) und als Batch in eine <strong className="text-titanium-50">Prioritäts-Queue</strong> mit
          automatischem Retry eingereiht. Fortschritt je Batch ist live sichtbar, Abbrechen jederzeit möglich.
        </p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Kontingent: <strong className="text-titanium-50">Agency</strong> 50 · <strong className="text-titanium-50">Scale</strong> 500 · <strong className="text-titanium-50">Enterprise</strong> unbegrenzt Batches/Monat</li>
        </ul>
        <p className="mt-2">
          Im Dashboard: <Link to="/app/bulk" className="text-security-400">/app/bulk</Link>
        </p>
      </>
    ),
  },
  {
    tag: 'Technik',
    q: 'Kann ich Scans automatisch planen (täglich/wöchentlich/monatlich)?',
    a: (
      <>
        <p>
          Ja — der <strong className="text-titanium-50">Scheduler</strong> ab dem <strong className="text-titanium-50">Agency</strong>-Tier.
          Du legst pro Mandant Zeitpläne an (täglich, wöchentlich oder monatlich zu fester UTC-Uhrzeit); zum geplanten
          Zeitpunkt wird automatisch ein Bulk-Scan der hinterlegten Domains ausgeführt. Pausieren/Fortsetzen jederzeit.
        </p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Benachrichtigung bei Lauf: <strong className="text-titanium-50">Slack</strong>, <strong className="text-titanium-50">Teams</strong> oder generischer <strong className="text-titanium-50">Webhook</strong> (HMAC-signiert).</li>
          <li>„Nächster Lauf" wird vorab angezeigt; Ausführung via pg_cron-Dispatch.</li>
        </ul>
        <p className="mt-2">
          Im Dashboard: <Link to="/app/scheduler" className="text-security-400">/app/scheduler</Link>
        </p>
      </>
    ),
  },
  {
    tag: 'Technik',
    q: 'Habt ihr ISO 27001 oder SOC 2?',
    a: (
      <p>
        Noch nicht zertifiziert. SOC 2 Type 1 in Vorbereitung für 2026 Q4,
        ISO 27001 läuft parallel. Aktuelle Security-Posture, offene Lücken
        und Roadmap unter <Link to="/security" className="text-security-400">/security</Link>.
      </p>
    ),
  },
  {
    tag: 'Migration',
    q: 'Wie aufwändig ist der Umstieg von OneTrust / Usercentrics / Cookiebot?',
    a: (
      <p>
        Cookie-SDK-Migration: Snippet austauschen, ca. 1 Stunde. Bestehende
        Consent-Cookies bleiben kompatibel. Volle Anbietervergleiche:
        <Link to="/dsgvo-tool-vergleich" className="text-security-400"> /dsgvo-tool-vergleich</Link>.
      </p>
    ),
  },
  {
    tag: 'DSGVO',
    q: 'Wer ist meine Aufsichtsbehörde — und wer eure?',
    a: (
      <p>
        Eure Aufsichtsbehörde richtet sich nach eurem Sitz (Bundesland-Datenschutzbeauftragter
        oder bei Firmen mit mehr als einer Niederlassung in DE der BfDI / die Konferenz der
        Datenschutzaufsichtsbehörden). Für uns ist es der Thüringer Landesbeauftragte
        (TLfDI Erfurt) — siehe <Link to="/impressum" className="text-security-400">/impressum</Link>.
      </p>
    ),
  },
  {
    tag: 'DSGVO',
    q: 'Brauche ich einen Datenschutzbeauftragten?',
    a: (
      <p>
        Pflicht nach § 38 BDSG ab 20 Personen, die ständig mit automatisierter
        Verarbeitung personenbezogener Daten beschäftigt sind, oder bei besonders
        sensiblen Verarbeitungen (DSFA-pflichtig). Bei Unsicherheit: kostenloses
        DSFA-Tool unter <Link to="/dsfa-wizard" className="text-security-400">/dsfa-wizard</Link>.
      </p>
    ),
  },
  {
    tag: 'Pricing',
    q: 'Gibt es Rabatte für Behörden, Bildungseinrichtungen oder Non-Profits?',
    a: (
      <p>
        Ja, individuell auf Anfrage. Public-Sector-Tier mit EVB-IT-tauglichen
        Verträgen ist möglich. <Link to="/contact-sales?source=faq-discount" className="text-security-400">Anfrage senden</Link>.
      </p>
    ),
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const [filter, setFilter] = useState<Item['tag'] | 'all'>('all');

  const visible = ITEMS.filter((i) => filter === 'all' || i.tag === filter);
  const tags: Array<Item['tag'] | 'all'> = ['all', 'DSGVO', 'AI Act', 'Pricing', 'Technik', 'Migration'];

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-security-500 to-security-700 flex items-center justify-center">
            <HelpCircle className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">FAQ</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto space-y-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-security-900 bg-security-950/30 text-security-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <HelpCircle className="h-3 w-3" /> Häufige Fragen · DSGVO · AI Act · Pricing · Technik
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              FAQ — alles was meistens gefragt wird
            </h1>
            <p className="text-lg text-titanium-300 leading-relaxed">
              Wenn du deine Frage hier nicht findest:
              {' '}<Link to="/contact-sales?source=faq" className="text-security-400 hover:text-security-300">Kontakt</Link>.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider border rounded-none ${
                  filter === t
                    ? 'border-security-500 bg-security-950 text-security-200'
                    : 'border-titanium-800 text-titanium-400 hover:border-titanium-600'
                }`}
              >
                {t === 'all' ? 'Alle' : t}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {visible.map((item) => {
              const idx = ITEMS.indexOf(item);
              const isOpen = open === idx;
              return (
                <div key={idx} className="border border-titanium-900 bg-obsidian-900 rounded-none">
                  <button
                    onClick={() => setOpen(isOpen ? null : idx)}
                    className="w-full flex items-start gap-3 p-4 text-left hover:bg-obsidian-950"
                  >
                    <span className="mt-0.5 text-security-400 shrink-0">
                      {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </span>
                    <div className="flex-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-titanium-500 mb-1">{item.tag}</div>
                      <div className="font-display font-bold text-titanium-50 text-sm">{item.q}</div>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pl-11 text-sm text-titanium-300 leading-relaxed">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-12 p-6 bg-obsidian-900 border border-security-700 rounded-none">
            <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">Frage nicht dabei?</h2>
            <p className="text-titanium-300 text-sm mb-4">
              Schreib uns dein Anliegen — unser Team antwortet innerhalb von 24 Std. Direkter Kanal: <a href="mailto:support@realsyncdynamicsai.de" className="text-security-400 hover:underline">support@realsyncdynamicsai.de</a>.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link to="/contact-sales?source=faq" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Frage stellen <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/tools" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                Tools ausprobieren
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
