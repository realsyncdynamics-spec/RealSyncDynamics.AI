import { SEOHead } from '../components/SEOHead';
import {
  ArrowRight,
  ArrowDown,
  Bot,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Factory,
  FileCheck2,
  Globe,
  Layers,
  MessagesSquare,
  Plug,
  Wrench,
  Sofa,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import {
  SmartLink,
  LandingHeader,
  LandingFooter,
  TRIAL_CTA,
} from '../components/landing/LandingShell';
import { CTA } from '../content/runtimeVocab';

/** intent qualifiziert den Lead, source attribuiert die Herkunft — beides liest ContactSales. */
const ENTERPRISE_CTA = '/contact-sales?intent=enterprise&source=onboarding-erklaert';

/**
 * OnboardingErklaert — öffentliche Erklärseite /onboarding-erklaert.
 *
 * Beantwortet die Frage, die im Vertrieb am häufigsten kommt: „Müssen wir
 * dafür unsere IT umbauen?" Antwort: nein. Die Seite zeigt den Weg vom
 * Erstprofil über die Systemverbindung bis zum laufenden Governance-Betrieb.
 *
 * Light-Theme („European Enterprise Trust") mit den vorhandenen Tokens und
 * dem geteilten LandingShell — keine neue Optik, nur neuer Inhalt (CLAUDE.md §10).
 *
 * Wichtig: Sämtliche Zahlen, Statuslisten und Dashboard-Ausschnitte auf dieser
 * Seite sind Beispiele zur Veranschaulichung, keine gemessenen Kundenwerte.
 * Sie sind im Markup als „Beispiel" gekennzeichnet und müssen es bleiben.
 */

const ERSTANGABEN = [
  'Name Ihres Unternehmens',
  'Branche',
  'Unternehmensgröße',
  'Website',
  'Wichtigste Geschäftsbereiche',
  'Bereits eingesetzte Systeme',
  'Gewünschte Ziele',
];

const UNTERNEHMENSTYPEN = [
  'Kleinunternehmen',
  'Handel',
  'Möbelhaus',
  'Produktionsunternehmen',
  'Dienstleister',
  'Agentur',
  'Industrieunternehmen',
  'Anderes Unternehmen',
];

const UMGEBUNG = [
  {
    icon: MessagesSquare,
    title: 'Kommunikation',
    items: ['Microsoft 365', 'Google Workspace', 'E-Mail', 'Teams', 'Kommunikationsplattformen'],
  },
  {
    icon: Building2,
    title: 'Geschäftssysteme',
    items: ['ERP', 'CRM', 'Warenwirtschaft', 'Buchhaltung', 'HR-System', 'Dokumentenmanagement'],
  },
  {
    icon: Globe,
    title: 'Digitale Kanäle',
    items: ['Website', 'Online-Shop', 'Kundenportal', 'Kontaktformulare', 'Chat', 'WhatsApp'],
  },
  {
    icon: Bot,
    title: 'KI',
    items: [
      'Interne KI-Anwendungen',
      'Externe KI-Dienste',
      'KI-APIs',
      'Automatisierte KI-Prozesse',
      'KI-Funktionen in bestehenden Anwendungen',
    ],
  },
];

type Tone = 'ok' | 'check' | 'critical' | 'idle';

const VERBINDUNGSSTATUS: { system: string; status: string; tone: Tone }[] = [
  { system: 'Microsoft 365', status: 'Verbunden', tone: 'ok' },
  { system: 'Google Workspace', status: 'Nicht verbunden', tone: 'idle' },
  { system: 'CRM', status: 'Verbunden', tone: 'ok' },
  { system: 'Warenwirtschaft', status: 'Verbindung erforderlich', tone: 'check' },
  { system: 'Website', status: 'Analysiert', tone: 'ok' },
  { system: 'KI-Systeme', status: 'Prüfung erforderlich', tone: 'check' },
];

const UNTERNEHMENSMODELL = [
  { system: 'Website', erkannt: ['Formulare', 'Cookies', 'Tracking', 'Drittanbieter', 'KI-Funktionen'] },
  { system: 'CRM', erkannt: ['Kunden', 'Ansprechpartner', 'Leads', 'Kundendaten'] },
  { system: 'Microsoft 365', erkannt: ['Benutzer', 'Rollen', 'Gruppen', 'Zugriffsrechte'] },
  { system: 'ERP', erkannt: ['Aufträge', 'Lieferanten', 'Produkte', 'Geschäftsprozesse'] },
  {
    system: 'KI-System',
    erkannt: ['Eingaben', 'Ausgaben', 'Verwendete Daten', 'Verantwortlichkeiten', 'Risiken'],
  },
];

const BEISPIELE = [
  {
    icon: Wrench,
    title: 'Handwerksbetrieb, 12 Mitarbeitende',
    systeme: [
      'Microsoft 365',
      'Website',
      'WhatsApp Business',
      'CRM',
      'Buchhaltungssoftware',
      'KI-Anwendung für Texte',
    ],
    fokus:
      'Der Betrieb baut keine neue IT-Infrastruktur auf. Nach dem Onboarding zeigt das Dashboard, welche Systeme verbunden sind, wo KI im Einsatz ist und welcher Datenfluss geprüft werden sollte.',
  },
  {
    icon: Factory,
    title: 'Produktionsunternehmen',
    systeme: [
      'ERP',
      'MES',
      'Warenwirtschaft',
      'Qualitätsmanagement',
      'Microsoft 365',
      'DMS',
      'CRM',
      'HR-System',
      'Maschinen- und Produktionssysteme',
      'Lieferantenportale',
      'KI-Anwendungen',
    ],
    fokus:
      'Hier geht es über Datenschutz hinaus: Informationssicherheit, Zugriffskontrolle, Lieferanten, Produktions- und Mitarbeiterdaten, KI-Risiken, Nachweisführung und Verantwortlichkeiten. Über das Profil „Produktion / Industrie" werden passende Governance-Strukturen und Prüfbereiche vorbereitet.',
  },
  {
    icon: Sofa,
    title: 'Möbelhaus / Handel',
    systeme: [
      'Warenwirtschaft',
      'ERP',
      'Kassensystem',
      'Online-Shop',
      'Website',
      'CRM',
      'Newsletter',
      'Google-Dienste',
      'Microsoft 365',
      'Telefon & WhatsApp',
      'Marketingplattformen',
      'KI für Produktbeschreibungen und Bilder',
    ],
    fokus:
      'Die Systeme werden nicht isoliert betrachtet, sondern entlang ihrer Datenflüsse: Kunde → Website → CRM → Marketing → KI, oder Produktdaten → Warenwirtschaft → Online-Shop → KI-generierte Produktbeschreibung.',
  },
];

const PROZESSKETTE = [
  'Website',
  'Kontaktformular',
  'CRM',
  'Mitarbeitende',
  'KI-Unterstützung',
  'Antwort an Kundinnen und Kunden',
];

const PROZESSFRAGEN = [
  'Welche Daten werden übertragen?',
  'Welche Systeme sind beteiligt?',
  'Wird KI verwendet?',
  'Welche Policy gilt?',
  'Ist der Vorgang zulässig?',
  'Wer ist verantwortlich?',
  'Welcher Nachweis wurde erzeugt?',
];

const RISIKOSTUFEN: { tone: Tone; title: string; text: string }[] = [
  {
    tone: 'ok',
    title: 'Kein Handlungsbedarf',
    text: 'Das System ist verbunden und entspricht den definierten Regeln.',
  },
  {
    tone: 'check',
    title: 'Prüfung erforderlich',
    text: 'Ein Datenfluss oder eine Konfiguration muss überprüft werden.',
  },
  {
    tone: 'critical',
    title: 'Kritisches Risiko',
    text: 'Eine definierte Policy wird verletzt oder ein relevantes Risiko wurde erkannt.',
  },
];

const AUFGABEN_BEISPIELE = [
  {
    titel: 'Risiko erkannt: KI verarbeitet Kundendaten',
    zeilen: [
      ['Betroffen', 'CRM → KI-Service'],
      ['Priorität', 'Hoch'],
      ['Verantwortlich', 'Datenschutz / IT'],
      ['Empfohlene Aktion', 'Datenfluss überprüfen'],
    ],
    cta: 'Jetzt prüfen',
  },
  {
    titel: 'Mitarbeiterzugriff prüfen',
    zeilen: [
      ['Betroffen', 'Microsoft 365 → Rollen'],
      ['Priorität', 'Mittel'],
      ['Verantwortlich', 'IT / HR'],
      ['Empfohlene Aktion', 'Berechtigung bestätigen oder entziehen'],
    ],
    cta: 'Zugriff prüfen',
  },
];

const EVIDENCE_FRAGEN = [
  'Was wurde geprüft?',
  'Wann wurde geprüft?',
  'Welches System war betroffen?',
  'Welche Policy wurde angewendet?',
  'Welche Entscheidung wurde getroffen?',
  'Wer war verantwortlich?',
  'Welche Änderung wurde vorgenommen?',
];

const PHASEN = [
  { phase: 'Phase 1', inhalt: 'Website und zentrale Benutzerverwaltung' },
  { phase: 'Phase 2', inhalt: 'CRM, ERP und Kommunikation' },
  { phase: 'Phase 3', inhalt: 'KI-Anwendungen' },
  { phase: 'Phase 4', inhalt: 'Weitere Geschäftsprozesse' },
  { phase: 'Phase 5', inhalt: 'Automatisierung und Enforcement' },
];

const AUTOMATISIERUNGSKETTE = [
  'System wird verbunden',
  'Assets werden erkannt',
  'Datenfluss wird analysiert',
  'Policy wird zugeordnet',
  'Risiko wird bewertet',
  'Bei Bedarf wird eine Aufgabe erstellt',
  'Entscheidung wird dokumentiert',
  'Evidence wird gespeichert',
  'Dashboard aktualisiert sich',
];

const GROESSEN = [
  {
    typ: 'Kleinunternehmen',
    zitat: 'Ich möchte endlich wissen, was in meiner IT passiert, ohne IT-Experte sein zu müssen.',
    antwort: 'Die Einrichtung wird geführt, möglichst viel läuft automatisch.',
  },
  {
    typ: 'Produktionsunternehmen',
    zitat: 'Ich habe viele Systeme und brauche eine zentrale Governance-Ebene.',
    antwort:
      'Bestehende Systeme werden verbunden; Risiken, Policies, Verantwortlichkeiten und Nachweise werden zentral sichtbar.',
  },
  {
    typ: 'Möbelhaus / Handel',
    zitat: 'Ich habe Website, Shop, Warenwirtschaft, CRM, Marketing und KI.',
    antwort: 'Diese Bereiche werden verbunden und ihre Daten- und Prozessflüsse gemeinsam betrachtet.',
  },
  {
    typ: 'Größeres Unternehmen',
    zitat: 'Wir brauchen zentrale Kontrolle über viele Systeme, Benutzer, Policies und Geschäftsbereiche.',
    antwort: 'Die Plattform wird als übergeordnete Governance- und Kontrollschicht eingesetzt.',
  },
];

const EINSTIEG = [
  'Unternehmen auswählen',
  'Systeme erkennen',
  'Verbindungen herstellen',
  'Unternehmensumgebung analysieren',
  'Policies und Anforderungen zuordnen',
  'Risiken erkennen',
  'Maßnahmen durchführen',
  'Nachweise automatisch dokumentieren',
  'Dashboard laufend aktualisieren',
  'Governance kontinuierlich automatisieren',
];

export function OnboardingErklaert() {
  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased font-sans">
      <SEOHead />
      <LandingHeader />

      {/* HERO */}
      <section className="bg-gradient-to-b from-slate-50 to-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-chip border border-petrol-200 bg-petrol-50 px-3 py-1 mb-7">
              <Plug className="h-3.5 w-3.5 text-petrol-700" />
              <span className="font-mono text-[11px] tracking-widest text-petrol-700 uppercase">
                Onboarding · Governance Runtime
              </span>
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.08] text-slate-900">
              So funktioniert das Onboarding
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl">
              Ihre bestehende IT bleibt. RealSyncDynamics.AI verbindet, erkennt und steuert
              sie — als gemeinsame Governance-Ebene über den Systemen, die Sie heute schon
              verwenden.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row gap-3 sm:gap-4">
              <SmartLink
                to={TRIAL_CTA}
                className="group inline-flex items-center justify-center gap-2 rounded-chip bg-petrol-700 px-7 py-4 text-base font-semibold text-white hover:bg-petrol-600 transition-colors"
              >
                Onboarding starten
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </SmartLink>
              <SmartLink
                to={ENTERPRISE_CTA}
                className="inline-flex items-center justify-center gap-2 rounded-chip border border-slate-300 bg-white px-7 py-4 text-base font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition-colors"
              >
                {CTA.enterprise}
              </SmartLink>
            </div>
          </div>
        </div>
      </section>

      {/* AUSGANGSLAGE */}
      <Section eyebrow="Ausgangslage" title="Ihre IT ist gewachsen — und soll bleiben">
        <div className="max-w-3xl space-y-5 text-base sm:text-lg text-slate-600 leading-relaxed">
          <p>
            Die IT-Landschaft der meisten Unternehmen ist über Jahre entstanden: ERP,
            Warenwirtschaft, Microsoft 365 oder Google Workspace, CRM, Website, Online-Shop,
            Buchhaltung, Dokumentenmanagement, WhatsApp, verschiedene Cloud-Dienste — und
            zunehmend KI-Anwendungen.
          </p>
          <p>
            Niemand möchte all diese Systeme austauschen. Genau deshalb funktioniert
            RealSyncDynamics.AI anders: Die Plattform verbindet sich mit dem, was bereits
            läuft, erkennt relevante Komponenten und Datenflüsse und schafft darüber eine
            zentrale Governance- und Automatisierungsebene.
          </p>
        </div>
        <blockquote className="mt-10 max-w-3xl rounded-panel border border-petrol-200 bg-petrol-50 p-7 sm:p-8">
          <p className="text-lg sm:text-xl font-semibold text-slate-900 leading-relaxed">
            „Ihre Systeme bleiben dort, wo sie sind. RealSyncDynamics.AI bringt sie unter
            eine gemeinsame Steuerungs-, Sicherheits- und Governance-Ebene."
          </p>
        </blockquote>
      </Section>

      {/* SCHRITT 1 */}
      <Section eyebrow="Schritt 1" title="Der Start: Sie erklären uns nicht Ihre komplette IT" tint>
        <div className="max-w-3xl mb-10 text-base sm:text-lg text-slate-600 leading-relaxed">
          Das Onboarding beginnt bewusst einfach — ohne komplexe technische Konfiguration und
          ohne lange Formulare. Sie geben zunächst nur an, wer Sie sind und was Sie erreichen
          wollen.
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-panel border border-slate-200 bg-white p-7">
            <h3 className="text-lg font-semibold text-slate-900 mb-5">Ihre ersten Angaben</h3>
            <ul className="space-y-3">
              {ERSTANGABEN.map((a) => (
                <li key={a} className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-petrol-600 shrink-0 mt-0.5" strokeWidth={1.75} />
                  <span className="text-base text-slate-700">{a}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-panel border border-slate-200 bg-white p-7">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Unternehmenstyp</h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-5">
              Aus dem Typ leitet sich ab, welche Systeme und Governance-Anforderungen für Sie
              relevant sein können — das weitere Onboarding passt sich daran an.
            </p>
            <div className="flex flex-wrap gap-2">
              {UNTERNEHMENSTYPEN.map((t) => (
                <span
                  key={t}
                  className="rounded-chip border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* SCHRITT 2 */}
      <Section eyebrow="Schritt 2" title="Das System erkennt Ihre vorhandene Umgebung">
        <div className="max-w-3xl mb-10 text-base sm:text-lg text-slate-600 leading-relaxed">
          Nach dem ersten Schritt geht es nicht darum, alles neu einzurichten. Betrachtet wird
          Ihre vorhandene digitale Umgebung — daraus entsteht schrittweise ein digitales Abbild
          Ihres Unternehmens.
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {UMGEBUNG.map((g) => (
            <div key={g.title} className="rounded-panel border border-slate-200 bg-white p-7">
              <span className="flex h-11 w-11 items-center justify-center rounded-card bg-petrol-50 border border-petrol-100 mb-5">
                <g.icon className="h-5 w-5 text-petrol-700" strokeWidth={1.75} />
              </span>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">{g.title}</h3>
              <ul className="space-y-2">
                {g.items.map((i) => (
                  <li key={i} className="text-sm text-slate-600 leading-relaxed">
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* SCHRITT 3 */}
      <Section eyebrow="Schritt 3" title="Sie verbinden Ihre vorhandenen Systeme" tint>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-start">
          <div className="space-y-5 text-base sm:text-lg text-slate-600 leading-relaxed">
            <p>
              Statt API-Endpunkt, OAuth-Flow und Webhook in den Vordergrund zu stellen, zeigt
              das Dashboard schlicht den Zustand jedes Systems. Sie entscheiden selbst, was
              verbunden wird.
            </p>
            <p>
              Wo eine direkte Verbindung möglich ist, führt RealSyncDynamics.AI durch den
              Autorisierungsprozess. Bei komplexeren Unternehmenssystemen kommen je nach
              System API-, Connector-, SDK- oder Integrationsverfahren zum Einsatz.
            </p>
          </div>
          <ExampleFrame label="Beispielansicht · Ihre Systeme">
            <ul className="divide-y divide-slate-100">
              {VERBINDUNGSSTATUS.map((s) => (
                <li key={s.system} className="flex items-center justify-between gap-4 py-3.5">
                  <span className="text-base text-slate-800">{s.system}</span>
                  <StatusChip tone={s.tone}>{s.status}</StatusChip>
                </li>
              ))}
            </ul>
          </ExampleFrame>
        </div>
      </Section>

      {/* ABGRENZUNG / EBENEN */}
      <Section eyebrow="Abgrenzung" title="RealSyncDynamics.AI ersetzt Ihr ERP nicht">
        <div className="max-w-3xl mb-10 space-y-4 text-base sm:text-lg text-slate-600 leading-relaxed">
          <p>
            Ihr ERP bleibt Ihr ERP. Ihre Warenwirtschaft bleibt Ihre Warenwirtschaft. Ihr CRM
            bleibt Ihr CRM. Ihre Buchhaltung bleibt Ihre Buchhaltung.
          </p>
          <p className="font-semibold text-slate-900">RealSyncDynamics.AI sitzt darüber.</p>
        </div>

        <div className="max-w-3xl">
          <LayerBlock title="Ihre bestehenden Systeme">
            <div className="flex flex-wrap gap-2">
              {['ERP', 'CRM', 'Warenwirtschaft', 'Microsoft 365', 'Website', 'Online-Shop', 'KI-Anwendungen'].map(
                (s) => (
                  <span
                    key={s}
                    className="rounded-chip border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
                  >
                    {s}
                  </span>
                ),
              )}
            </div>
          </LayerBlock>

          <LayerArrow />

          <div className="rounded-panel border border-petrol-200 bg-petrol-50 p-7 text-center">
            <p className="font-mono text-[11px] tracking-[0.25em] text-petrol-700 uppercase mb-2">
              Governance Runtime
            </p>
            <p className="text-xl font-extrabold tracking-tight text-slate-900">RealSyncDynamics.AI</p>
          </div>

          <LayerArrow />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: ShieldCheck, label: 'Policies' },
              { icon: Layers, label: 'Risiken' },
              { icon: FileCheck2, label: 'Evidence' },
            ].map((x) => (
              <div
                key={x.label}
                className="rounded-panel border border-slate-200 bg-white p-6 text-center"
              >
                <x.icon className="h-5 w-5 text-petrol-700 mx-auto mb-3" strokeWidth={1.75} />
                <span className="text-base font-semibold text-slate-900">{x.label}</span>
              </div>
            ))}
          </div>

          <LayerArrow />

          <div className="rounded-panel border border-slate-300 bg-slate-900 p-6 text-center">
            <span className="text-base font-semibold text-white">Dashboard</span>
          </div>
        </div>
      </Section>

      {/* UNTERNEHMENSMODELL */}
      <Section eyebrow="Schritt 4" title="Das Dashboard baut Ihr Unternehmensmodell auf" tint>
        <div className="max-w-3xl mb-10 text-base sm:text-lg text-slate-600 leading-relaxed">
          Aus einzelnen Integrationen wird ein zusammenhängendes Modell. Sichtbar wird nicht
          nur, welche Systeme existieren, sondern auch, wie sie miteinander verbunden sind und
          wo governance-relevante Vorgänge entstehen.
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {UNTERNEHMENSMODELL.map((m) => (
            <div key={m.system} className="rounded-panel border border-slate-200 bg-white p-7">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">{m.system}</h3>
              <ul className="space-y-2">
                {m.erkannt.map((e) => (
                  <li key={e} className="flex items-center gap-2.5 text-sm text-slate-600">
                    <ArrowRight className="h-3.5 w-3.5 text-petrol-600 shrink-0" strokeWidth={2} />
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* BEISPIELE */}
      <Section eyebrow="Beispiele" title="Drei Unternehmen, drei Systemlandschaften">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {BEISPIELE.map((b) => (
            <div key={b.title} className="rounded-panel border border-slate-200 bg-white p-7 flex flex-col">
              <span className="flex h-11 w-11 items-center justify-center rounded-card bg-petrol-50 border border-petrol-100 mb-5">
                <b.icon className="h-5 w-5 text-petrol-700" strokeWidth={1.75} />
              </span>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">{b.title}</h3>
              <div className="flex flex-wrap gap-1.5 mb-5">
                {b.systeme.map((s) => (
                  <span
                    key={s}
                    className="rounded-chip border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600"
                  >
                    {s}
                  </span>
                ))}
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{b.fokus}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 max-w-3xl">
          <ExampleFrame label="Beispielhafter Befund · Handwerksbetrieb">
            <p className="text-base font-semibold text-slate-900 mb-4">
              „KI-Anwendung verwendet möglicherweise personenbezogene Kundendaten."
            </p>
            <dl className="space-y-2.5">
              {[
                ['Quelle', 'CRM → KI-Anwendung'],
                ['Risiko', 'Datenschutz / KI-Governance'],
                ['Empfehlung', 'Datenfluss prüfen'],
              ].map(([k, v]) => (
                <div key={k} className="flex flex-col sm:flex-row sm:gap-4">
                  <dt className="font-mono text-[11px] tracking-widest text-slate-400 uppercase sm:w-32 sm:shrink-0 sm:pt-1">
                    {k}
                  </dt>
                  <dd className="text-sm text-slate-700">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 text-sm text-slate-600 leading-relaxed">
              Statt einer abstrakten technischen Warnung steht am Ende eine konkrete
              Handlungsmöglichkeit.
            </p>
          </ExampleFrame>
        </div>
      </Section>

      {/* PROZESSE */}
      <Section eyebrow="Schritt 5" title="Aus einzelnen Systemen werden Prozesse" tint>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-start">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-5">Beispiel: Kundenanfrage</h3>
            <ol className="space-y-2">
              {PROZESSKETTE.map((p, i) => (
                <li key={p}>
                  <div className="rounded-panel border border-slate-200 bg-white px-5 py-3.5 flex items-center gap-3">
                    <span className="font-mono text-[11px] text-slate-400">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-base text-slate-800">{p}</span>
                  </div>
                  {i < PROZESSKETTE.length - 1 && (
                    <ArrowDown className="h-4 w-4 text-slate-300 mx-auto my-1" strokeWidth={2} />
                  )}
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-5">
              Derselbe Prozess aus Governance-Sicht
            </h3>
            <ul className="space-y-3">
              {PROZESSFRAGEN.map((f) => (
                <li
                  key={f}
                  className="rounded-panel border border-slate-200 bg-white px-5 py-3.5 text-base text-slate-700"
                >
                  {f}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-slate-600 leading-relaxed">
              So wird Governance nicht zur statischen Dokumentensammlung, sondern Bestandteil
              der tatsächlichen Unternehmensprozesse.
            </p>
          </div>
        </div>
      </Section>

      {/* RISIKEN */}
      <Section eyebrow="Schritt 6" title="Das System erkennt Risiken">
        <div className="max-w-3xl mb-10 text-base sm:text-lg text-slate-600 leading-relaxed">
          Nach der Verbindung beginnt die eigentliche Arbeit der Governance Runtime: Ereignisse,
          Systeme und Richtlinien werden miteinander in Beziehung gesetzt.
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {RISIKOSTUFEN.map((r) => (
            <div key={r.title} className="rounded-panel border border-slate-200 bg-white p-7">
              <StatusChip tone={r.tone}>{r.title}</StatusChip>
              <p className="mt-4 text-sm text-slate-600 leading-relaxed">{r.text}</p>
            </div>
          ))}
        </div>
        <div className="max-w-3xl rounded-panel border border-slate-200 bg-slate-50 p-7 sm:p-8">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Was das Dashboard dazu zeigt</h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
            {[
              'Was ist passiert?',
              'Wo ist es passiert?',
              'Welches System ist betroffen?',
              'Warum ist es relevant?',
              'Welche Policy betrifft es?',
              'Was kann ich jetzt tun?',
            ].map((q) => (
              <li key={q} className="text-base text-slate-700">
                {q}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* AKTIONEN */}
      <Section eyebrow="Schritt 7" title="Aus einer Warnung wird eine Aufgabe" tint>
        <div className="max-w-3xl mb-10 text-base sm:text-lg text-slate-600 leading-relaxed">
          RealSyncDynamics.AI produziert nicht nur Warnungen. Jeder Befund bekommt
          Verantwortliche, Priorität und eine empfohlene Aktion — Governance wird damit zum
          operativen Prozess.
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {AUFGABEN_BEISPIELE.map((a) => (
            <ExampleFrame key={a.titel} label="Beispielaufgabe">
              <p className="text-base font-semibold text-slate-900 mb-4">{a.titel}</p>
              <dl className="space-y-2.5 mb-6">
                {a.zeilen.map(([k, v]) => (
                  <div key={k} className="flex flex-col sm:flex-row sm:gap-4">
                    <dt className="font-mono text-[11px] tracking-widest text-slate-400 uppercase sm:w-40 sm:shrink-0 sm:pt-1">
                      {k}
                    </dt>
                    <dd className="text-sm text-slate-700">{v}</dd>
                  </div>
                ))}
              </dl>
              <span className="inline-flex items-center gap-2 rounded-chip border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-500">
                {a.cta}
              </span>
            </ExampleFrame>
          ))}
        </div>
      </Section>

      {/* EVIDENCE */}
      <Section eyebrow="Nachweise" title="Jede wichtige Entscheidung bleibt nachvollziehbar">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-start">
          <div className="space-y-5 text-base sm:text-lg text-slate-600 leading-relaxed">
            <p>
              Für Unternehmen ist nicht nur wichtig, dass eine Prüfung stattgefunden hat.
              Später muss häufig auch nachvollziehbar sein, wie eine Entscheidung zustande
              gekommen ist.
            </p>
            <p>
              Deshalb gehört die Evidence-Ebene zum Kern des Systems: Aus einzelnen
              Ereignissen und Entscheidungen entsteht eine nachvollziehbare
              Governance-Historie — gegenüber Kundinnen und Kunden, Auditoren,
              Geschäftspartnern und internen Verantwortlichen.
            </p>
          </div>
          <div className="rounded-panel border border-slate-200 bg-slate-50 p-7 sm:p-8">
            <ul className="space-y-3">
              {EVIDENCE_FRAGEN.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <FileCheck2 className="h-5 w-5 text-petrol-600 shrink-0 mt-0.5" strokeWidth={1.75} />
                  <span className="text-base text-slate-700">{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* KEIN BIG BANG */}
      <Section eyebrow="Einführung" title="Kein Big-Bang-Projekt" tint>
        <div className="max-w-3xl mb-10 text-base sm:text-lg text-slate-600 leading-relaxed">
          Sie müssen nicht am ersten Tag Ihre komplette IT anbinden. Das Onboarding kann
          schrittweise erfolgen — mit überschaubarem Einstieg und späterer Erweiterung.
        </div>
        <ol className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {PHASEN.map((p) => (
            <li key={p.phase} className="rounded-panel border border-slate-200 bg-white p-6">
              <p className="font-mono text-[11px] tracking-[0.25em] text-petrol-700 uppercase mb-3">
                {p.phase}
              </p>
              <p className="text-base text-slate-800 leading-relaxed">{p.inhalt}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* AUTOMATISIERUNG */}
      <Section eyebrow="Betrieb" title="Automatisierung statt zusätzlicher Arbeit">
        <div className="max-w-3xl mb-10 text-base sm:text-lg text-slate-600 leading-relaxed">
          Das Ziel ist nicht, dass Ihre Mitarbeitenden ständig ein weiteres Dashboard öffnen.
          Erkennen, Bewerten und Dokumentieren soll so weit wie möglich automatisch laufen —
          aus der einmaligen Einrichtung wird ein kontinuierlicher Governance-Prozess.
        </div>
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {AUTOMATISIERUNGSKETTE.map((s, i) => (
            <li
              key={s}
              className="rounded-panel border border-slate-200 bg-white px-6 py-5 flex items-start gap-4"
            >
              <span className="font-mono text-[11px] text-petrol-700 pt-1">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="text-base text-slate-800 leading-relaxed">{s}</span>
            </li>
          ))}
        </ol>
      </Section>

      {/* UNTERNEHMENSGRÖSSEN */}
      <Section eyebrow="Zielgruppen" title="Für jede Unternehmensgröße derselbe Grundgedanke" tint>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {GROESSEN.map((g) => (
            <div key={g.typ} className="rounded-panel border border-slate-200 bg-white p-7">
              <p className="font-mono text-[11px] tracking-[0.25em] text-petrol-700 uppercase mb-4">
                {g.typ}
              </p>
              <p className="text-lg font-semibold text-slate-900 leading-relaxed mb-4">„{g.zitat}"</p>
              <p className="text-sm text-slate-600 leading-relaxed">{g.antwort}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* EINSTIEG */}
      <Section eyebrow="Zusammengefasst" title="Der Einstieg in zehn Schritten">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-start">
          <ol className="space-y-2.5">
            {EINSTIEG.map((s, i) => (
              <li key={s} className="flex items-start gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-card border border-petrol-200 bg-petrol-50 font-mono text-[11px] text-petrol-700">
                  {i + 1}
                </span>
                <span className="text-base text-slate-800 pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
          <div className="rounded-panel border border-slate-200 bg-slate-50 p-7 sm:p-8">
            <Workflow className="h-6 w-6 text-petrol-700 mb-5" strokeWidth={1.75} />
            <h3 className="text-xl font-extrabold tracking-tight text-slate-900 mb-4">
              Die wichtigste Botschaft
            </h3>
            <ul className="space-y-3 mb-6">
              {[
                'Sie müssen Ihre IT nicht neu bauen.',
                'Sie müssen nicht alle bestehenden Systeme austauschen.',
                'Sie müssen keine eigene Governance-Abteilung aufbauen.',
                'Sie müssen nicht für jede Anwendung ein separates Kontrollsystem betreiben.',
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <ClipboardCheck className="h-5 w-5 text-petrol-600 shrink-0 mt-0.5" strokeWidth={1.75} />
                  <span className="text-base text-slate-700 leading-relaxed">{t}</span>
                </li>
              ))}
            </ul>
            <p className="text-base text-slate-600 leading-relaxed">
              Ihre Systeme bleiben. Ihre Prozesse bleiben. Ihre Daten bleiben unter Ihrer
              Kontrolle. Die Governance wird zentral.
            </p>
          </div>
        </div>
      </Section>

      {/* CTA */}
      <section className="bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 sm:pb-24">
          <div className="rounded-panel border border-petrol-200 bg-petrol-50 p-10 sm:p-14 text-center">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mb-4">
              Starten Sie mit einem System — nicht mit einem IT-Projekt
            </h2>
            <p className="mx-auto max-w-2xl text-base sm:text-lg text-slate-600 leading-relaxed mb-9">
              Beginnen Sie mit Website und Benutzerverwaltung und erweitern Sie die
              Governance-Ebene anschließend Schritt für Schritt.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <SmartLink
                to={TRIAL_CTA}
                className="group inline-flex items-center justify-center gap-2 rounded-chip bg-petrol-700 px-8 py-4 text-base font-semibold text-white hover:bg-petrol-600 transition-colors"
              >
                Onboarding starten
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </SmartLink>
              <SmartLink
                to={ENTERPRISE_CTA}
                className="inline-flex items-center justify-center gap-2 rounded-chip border border-slate-300 bg-white px-8 py-4 text-base font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition-colors"
              >
                {CTA.enterprise}
              </SmartLink>
            </div>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}

function Section({
  eyebrow,
  title,
  tint,
  children,
}: {
  eyebrow: string;
  title: string;
  tint?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={tint ? 'bg-slate-50' : 'bg-white'}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="max-w-2xl mb-12">
          <p className="font-mono text-[11px] tracking-[0.25em] text-petrol-700 uppercase mb-4">{eyebrow}</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">{title}</h2>
        </div>
        {children}
      </div>
    </section>
  );
}

/**
 * Rahmen für Dashboard-Ausschnitte. Das Label ist Pflicht und trägt immer das
 * Wort „Beispiel": Die Zahlen und Zustände hier sind erfunden, und eine
 * Marketingseite darf sie nicht wie gemessene Kundenwerte aussehen lassen.
 */
function ExampleFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-panel border border-slate-200 bg-white overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50 px-6 py-3">
        <span className="font-mono text-[11px] tracking-widest text-slate-400 uppercase">{label}</span>
      </div>
      <div className="p-6 sm:p-7">{children}</div>
    </div>
  );
}

function LayerBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-panel border border-slate-200 bg-slate-50 p-7">
      <p className="font-mono text-[11px] tracking-[0.25em] text-slate-400 uppercase mb-4">{title}</p>
      {children}
    </div>
  );
}

function LayerArrow() {
  return <ArrowDown className="h-5 w-5 text-slate-300 mx-auto my-3" strokeWidth={2} aria-hidden="true" />;
}

const TONE_CLASS: Record<Tone, string> = {
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  check: 'border-amber-200 bg-amber-50 text-amber-700',
  critical: 'border-rose-200 bg-rose-50 text-rose-700',
  idle: 'border-slate-200 bg-slate-50 text-slate-500',
};

function StatusChip({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-chip border px-3 py-1 text-sm font-medium ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}
