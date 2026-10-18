/**
 * Landing v6 — KMU-Inhalte (Phase 1, 18.10.2026).
 *
 * Nur Aussagen, die der heutige Ablauf deckt (Bestandsaufnahme vor dem Umbau):
 *  - Website-Check `/audit`: Domain + E-Mail + kurze Auswahl (Rolle), kein Konto (`requireAuth: false`),
 *    Ergebnis direkt im Browser, Teilen-Link. Geprüft werden öffentlich
 *    abrufbare Seiten (Startseite, Impressum, Datenschutzseite).
 *  - Werbe-E-Mails nur über die separate, freiwillige Checkbox im Check.
 *  - Danach: `/onboarding/:scanId` (Branche + Rückfragen), Dashboard `/app/dashboard`.
 *  - Laufendes Domain-Monitoring ist laut implementation-status „coming-soon“.
 * Keine Dauer-Angabe („90 Sekunden“): Der Scan hat kein Zeitlimit im Code.
 */

export type IconName =
  | 'search'
  | 'bulb'
  | 'list'
  | 'file'
  | 'globe'
  | 'chart'
  | 'cpu'
  | 'database'
  | 'flag'
  | 'folder'
  | 'tool'
  | 'scale'
  | 'heart'
  | 'layers'
  | 'building'
  | 'shield'
  | 'eye'
  | 'check'
  | 'route'
  | 'map';

/** Woher eine Antwort kommt — ehrlich getrennt: von außen prüfbar vs. Angaben des Unternehmens. */
export type Source = 'scan' | 'partial' | 'company' | 'platform';

export const SOURCE_LABEL: Record<Source, string> = {
  scan: 'Website-Check prüft automatisch',
  partial: 'Website-Check erkennt einen Teil',
  company: 'Braucht Ihre Angaben',
  platform: 'Im Dashboard nach der Anmeldung',
};

export const PROBLEMS: { icon: IconName; q: string; a: string; source: Source }[] = [
  {
    icon: 'globe',
    q: 'Welche externen Dienste lädt unsere Website?',
    a: 'Der Check erkennt bekannte Tracker, Social-Media-Pixel und Chat-Widgets auf den geprüften Seiten.',
    source: 'partial',
  },
  {
    icon: 'chart',
    q: 'Werden Analyse- und Trackingdienste korrekt eingesetzt?',
    a: 'Der Check prüft, ob Tracker oder Cookies schon vor der Einwilligung Ihrer Besucher geladen werden.',
    source: 'scan',
  },
  {
    icon: 'cpu',
    q: 'Welche KI-Werkzeuge werden im Unternehmen verwendet?',
    a: 'Ein Chatbot auf der Website ist sichtbar. Welche KI Ihr Team intern nutzt, kann nur Ihr Unternehmen selbst angeben.',
    source: 'company',
  },
  {
    icon: 'database',
    q: 'Wo werden personenbezogene Daten verarbeitet?',
    a: 'Formulare ohne Einwilligungshinweis fallen im Check auf. Interne Abläufe und Systeme erfassen Sie selbst.',
    source: 'company',
  },
  {
    icon: 'flag',
    q: 'Welche Risiken sollten wir zuerst überprüfen?',
    a: 'Das Ergebnis sortiert die Befunde nach Schweregrad und zeigt die wichtigsten Risiken zuerst.',
    source: 'scan',
  },
  {
    icon: 'folder',
    q: 'Wie dokumentieren wir Entscheidungen und Maßnahmen?',
    a: 'Prüfberichte, Maßnahmen und Nachweise laufen im Dashboard an einer Stelle zusammen.',
    source: 'platform',
  },
];

export const SCOPE_AUTO = [
  'Startseite, Impressum und Datenschutzseite',
  'HTTPS und Sicherheits-Header',
  'Tracker und Cookies vor der Einwilligung',
  'Pflichtangaben im Impressum',
  'Chatbot ohne Hinweis auf KI',
];
export const SCOPE_COMPANY = [
  'KI-Werkzeuge, die Ihr Team intern nutzt',
  'Interne Systeme und Datenflüsse',
  'Verantwortlichkeiten im Unternehmen',
  'Verträge mit Dienstleistern (AVV)',
  'Serverseitiges Tracking',
];

export const STEPS: { n: string; k: string; icon: IconName; d: string; example: string; feature: string }[] = [
  {
    n: '01',
    k: 'Prüfen',
    icon: 'search',
    d: 'Digitale Risiken und auffällige Konfigurationen erkennen.',
    example: 'Der Check findet: Ihr Statistik-Dienst startet, bevor Besucher zustimmen.',
    feature: 'Kostenloser Website-Check',
  },
  {
    n: '02',
    k: 'Verstehen',
    icon: 'bulb',
    d: 'Ergebnisse klar und ohne unnötige Fachbegriffe erklären.',
    example: '„Statistik-Cookies ohne Einwilligung“ – mit Erklärung, warum das zählt, und dem Bezug auf § 25 TDDDG.',
    feature: 'Ergebnisbericht mit Punktzahl und Paragrafbezug',
  },
  {
    n: '03',
    k: 'Handeln',
    icon: 'list',
    d: 'Mögliche Maßnahmen und nächste Schritte nachvollziehbar darstellen.',
    example: 'Nächster Schritt: Cookie-Banner so einstellen, dass Statistik erst nach Zustimmung lädt.',
    feature: 'Maßnahmen-Hinweise im Bericht und im Dashboard',
  },
  {
    n: '04',
    k: 'Nachweisen',
    icon: 'file',
    d: 'Prüfergebnisse und Bearbeitungsstände dokumentieren.',
    example: 'Prüfbericht und erledigte Maßnahme mit Datum festhalten – für Datenschutzbeauftragte, Kunden oder Prüfer.',
    feature: 'Nachweise im Dashboard, Bericht als Teilen-Link',
  },
];

export const INDUSTRIES: { icon: IconName; t: string; d: string; typical: string }[] = [
  {
    icon: 'tool',
    t: 'Handwerk & Dienstleister',
    d: 'Einfacher Einstieg ohne eigene IT-Abteilung.',
    typical: 'Kontaktformular, Kartendienst, Bewertungs-Widget',
  },
  {
    icon: 'scale',
    t: 'Kanzleien',
    d: 'Vertraulichkeit, digitale Prozesse und nachvollziehbare Verantwortlichkeiten.',
    typical: 'Mandantenkommunikation, KI-Textassistenten, Terminbuchung',
  },
  {
    icon: 'heart',
    t: 'Arztpraxen',
    d: 'Besonderes Augenmerk auf Datenschutz und sensible Informationsprozesse.',
    typical: 'Online-Terminbuchung, Kontaktformulare, Rückrufbitten',
  },
  {
    icon: 'layers',
    t: 'Agenturen & Beratungen',
    d: 'Digitale Werkzeuge, Kundenwebsites und strukturierte Governance-Prozesse.',
    typical: 'Mehrere Kundenwebsites, Tracking-Setups, KI-Content-Werkzeuge',
  },
  {
    icon: 'building',
    t: 'Mittelstand',
    d: 'Mehrere Mitarbeitende, Systeme und Zuständigkeiten übersichtlich verwalten.',
    typical: 'Abteilungen, Standorte, verschiedene Verantwortliche',
  },
];

export type Tone = 'ok' | 'warn' | 'risk' | 'info';

/** Dashboard-Vorschau — Beispieldaten, im UI ausdrücklich so gekennzeichnet. */
export const DASH_CATEGORIES: { t: string; status: string; tone: Tone; done: number; total: number; source: Source }[] = [
  { t: 'Website & Pflichtangaben', status: 'In Ordnung', tone: 'ok', done: 5, total: 5, source: 'scan' },
  { t: 'Cookies & Tracking', status: 'Handlungsbedarf', tone: 'risk', done: 1, total: 3, source: 'scan' },
  { t: 'KI-Einsatz', status: 'Angaben fehlen', tone: 'info', done: 0, total: 2, source: 'company' },
  { t: 'Dokumentation', status: 'In Arbeit', tone: 'warn', done: 2, total: 4, source: 'platform' },
];

export const DASH_MEASURES: { t: string; ref: string; status: string; tone: Tone }[] = [
  { t: 'Statistik-Dienst erst nach Einwilligung laden', ref: '§ 25 TDDDG', status: 'Offen', tone: 'risk' },
  { t: 'Hinweis ergänzen: Website-Chat nutzt KI', ref: 'Art. 50 EU AI Act', status: 'In Arbeit', tone: 'warn' },
  { t: 'Verantwortliche Person für KI-Werkzeuge festlegen', ref: 'Ihre Angabe', status: 'Offen', tone: 'info' },
  { t: 'Impressum: Rechtsform ergänzt', ref: '§ 5 DDG', status: 'Erledigt', tone: 'ok' },
];

export const DASH_DOCS: { t: string; tone: Tone; status: string }[] = [
  { t: 'Prüfbericht Website-Check', tone: 'ok', status: 'gespeichert' },
  { t: 'Maßnahme „Impressum“', tone: 'ok', status: 'dokumentiert' },
  { t: 'KI-Werkzeuge im Team', tone: 'info', status: 'Angaben ausstehend' },
];

export const JOURNEY: { n: string; t: string; d: string; when: string }[] = [
  {
    n: '1',
    t: 'Website prüfen',
    d: 'Sie geben Ihre Domain und eine E-Mail-Adresse ein, beantworten ein paar kurze Auswahlfragen und starten den Check. Ein Konto brauchen Sie nicht.',
    when: 'Jetzt · kostenlos',
  },
  {
    n: '2',
    t: 'Ergebnisse verstehen',
    d: 'Sie sehen direkt im Browser, welche Bereiche geprüft wurden, was auffällt und warum – mit nächsten Schritten.',
    when: 'Direkt danach',
  },
  {
    n: '3',
    t: 'Unternehmen einrichten',
    d: 'Im Anschluss erfassen Sie Schritt für Schritt Branche und weitere Angaben – nur, was für die Einordnung nötig ist.',
    when: 'Wenn Sie weitermachen möchten',
  },
  {
    n: '4',
    t: 'Risiken verwalten',
    d: 'Im Dashboard laufen Prüfungen, Maßnahmen und Nachweise zusammen – übersichtlich für Sie und Ihr Team.',
    when: 'Mit Ihrem Konto',
  },
];

/** Jede Aussage mit überprüfbarer Quelle auf der eigenen Website. */
export const TRUST: { icon: IconName; t: string; d: string; href: string; link: string }[] = [
  {
    icon: 'shield',
    t: 'Datenschutz von Anfang an',
    d: 'Für den Website-Check speichern wir Domain und E-Mail-Adresse (optional den Unternehmensnamen), um Ihnen den Bericht bereitzustellen. Angebote per E-Mail nur, wenn Sie das separat und freiwillig ankreuzen.',
    href: '/datenschutz',
    link: 'Datenschutzerklärung',
  },
  {
    icon: 'eye',
    t: 'Transparente Prüfgrenzen',
    d: 'Geprüft werden öffentlich abrufbare Seiten. Serverseitiges Tracking, interne Abläufe und die KI-Nutzung im Betrieb erkennt kein externer Scan – dafür fragen wir Sie.',
    href: '#probleme',
    link: 'Was der Check prüft',
  },
  {
    icon: 'file',
    t: 'Dokumentierte Ergebnisse',
    d: 'Jeder Befund mit Fundstelle, Schweregrad und Bezug auf DSGVO, TDDDG oder EU AI Act.',
    href: '#evidence',
    link: 'Beispiel ansehen',
  },
  {
    icon: 'check',
    t: 'Klar beschriebene Funktionen',
    d: 'Was verfügbar ist, steht da. Was noch entsteht, ist als „In Arbeit“ oder „Geplant“ gekennzeichnet – abgeleitet aus unserem Funktionsstatus.',
    href: '/roadmap',
    link: 'Roadmap und Status',
  },
  {
    icon: 'route',
    t: 'Nachvollziehbare nächste Schritte',
    d: 'Kein Abo nötig, um das Ergebnis zu sehen. Sie entscheiden selbst, ob und wann Sie weitermachen.',
    href: '#preise',
    link: 'Pläne vergleichen',
  },
  {
    icon: 'map',
    t: 'Datenhaltung in der EU',
    d: 'Datenbank und Nachweise liegen bei Supabase in Frankfurt am Main. Alle Sub-Prozessoren sind offen gelistet.',
    href: '/legal/sub-processors',
    link: 'Sub-Prozessoren',
  },
];
