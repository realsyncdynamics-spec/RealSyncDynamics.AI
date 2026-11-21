/**
 * Inhalte der Produkt-Landingpages App Builder, Governance OS und Claude Code
 * Optimizer (Entwurf, 19.11.2026). `/ki-bots` hat wegen des Gesprächsablaufs
 * eine eigene Seite (kiBotsContent.ts), nutzt aber denselben Aufbau.
 *
 * Jede Aussage stützt sich auf src/product/implementation-status.ts:
 *   - App Builder     → `web-builder` (Preview), `builder-entitlement-gate` (Preview).
 *                       Vorschau vor Produktion, Produktion nur mit Owner/Admin-GO.
 *                       Eigene Domain, DNS und Rollback fehlen → offen benannt.
 *   - Governance OS   → `free-audit`, `governance-runtime-core`, `policy-engine`,
 *                       `evidence-surfaces`, `ai-system-registry`, `ai-act-classify` (Live);
 *                       `continuous-domain-monitoring` (In Vorbereitung) → kein Dauerbetrieb.
 *   - Optimizer       → `cloud-code-optimizer` (Preview): Website-Audit mit Befunden.
 *                       Keine Repository-Analyse, keine Code-Fixes, keine Pull Requests.
 * Status-Badges kommen zur Laufzeit aus der Registry (statusLabel), nie aus diesem Text.
 * Abläufe sind Beispiele und als solche gekennzeichnet; keine Kundenreferenzen.
 */
import type { ProductPage } from './productLandingShared';

export type ProductLandingKey = Exclude<ProductPage['key'], 'ki-bots'>;

export interface ProductLink {
  label: string;
  to: string;
}

export interface ProductFlowStep {
  title: string;
  /** Was in diesem Schritt passiert. */
  action: string;
  /** Was danach vorliegt. */
  result: string;
}

export interface ProductLandingContent {
  key: ProductLandingKey;
  /** Tracking-Quelle der Links. */
  source: string;
  name: string;
  audience: string;
  h1: readonly [string, string];
  lead: string;
  primary: ProductLink;
  secondary: ProductLink;
  /** Status-Zeile im Hero: Bezeichnung plus Registry-Eintrag. */
  status: ReadonlyArray<{ label: string; registryId: string }>;
  stageTag: string;
  stageCaption: string;
  promiseTitle: string;
  promises: ReadonlyArray<{ title: string; body: string }>;
  flow: {
    eyebrow: string;
    title: string;
    text: string;
    panelLabel: string;
    steps: readonly ProductFlowStep[];
    fine: string;
  };
  casesTitle: string;
  cases: ReadonlyArray<{ trade: string; situation: string; result: string }>;
  startSteps: ReadonlyArray<{ title: string; body: string }>;
  pricingTitle: string;
  /** Ehrliche Grenzen, direkt unter den Preisen. */
  limits: string;
  cta: { title: string; text: string; primary: ProductLink; secondary: ProductLink };
  faqs: ReadonlyArray<{ q: string; a: string }>;
}

const APP_BUILDER_SOURCE = 'app-builder';
const GOVERNANCE_SOURCE = 'governance-os';
const OPTIMIZER_SOURCE = 'cco-landing';

export const APP_BUILDER: ProductLandingContent = {
  key: 'app-builder',
  source: APP_BUILDER_SOURCE,
  name: 'App Builder',
  audience: 'Für Betriebe, die online gefunden werden wollen',
  h1: ['Ihre Website.', 'Erst Vorschau, dann live.'],
  lead:
    'Im App Builder entsteht Ihre Website oder App direkt im Browser. Jede Änderung sehen Sie zuerst in einer Vorschau. Live geht sie erst, wenn Sie freigeben.',
  primary: { label: 'App Builder öffnen', to: `/build?source=${APP_BUILDER_SOURCE}` },
  secondary: { label: 'So läuft es ab', to: '#ablauf' },
  status: [
    { label: 'Builder', registryId: 'web-builder' },
    { label: 'Freischaltung je Tarif', registryId: 'builder-entitlement-gate' },
  ],
  stageTag: 'App Builder · Entwurf',
  stageCaption: 'Entwurf → Vorschau → Freigabe → live',
  promiseTitle: 'Eine Website, die Sie selbst pflegen.',
  promises: [
    { title: 'Im Browser bearbeiten', body: 'Seiten, Texte und Aufbau ändern Sie selbst, ohne Programmierung.' },
    { title: 'Erst die Vorschau', body: 'Jede Änderung landet zuerst in einer Vorschau, die Sie in Ruhe prüfen.' },
    { title: 'Ein Mensch entscheidet', body: 'Veröffentlichen dürfen nur Inhaber oder Admins. Ohne Freigabe geht nichts live.' },
  ],
  flow: {
    eyebrow: 'So arbeitet der App Builder',
    title: 'Von der Idee zur Seite.',
    text: 'Klicken Sie sich durch die vier Schritte. Rechts sehen Sie, was nach jedem Schritt vorliegt.',
    panelLabel: 'App Builder · Beispiel',
    steps: [
      {
        title: 'Entwurf',
        action: 'Sie legen ein Projekt an und wählen den Aufbau Ihrer Seite.',
        result: 'Ein Entwurf, den Sie im Editor weiterbearbeiten.',
      },
      {
        title: 'Anpassen',
        action: 'Sie ändern Texte, Reihenfolge und Abschnitte im Editor.',
        result: 'Der Entwurf zeigt Ihren Betrieb in Ihren Worten.',
      },
      {
        title: 'Vorschau',
        action: 'Der App Builder stellt den Stand als Vorschau bereit.',
        result: 'Eine Vorschau, die Sie vor der Veröffentlichung prüfen.',
      },
      {
        title: 'Freigabe',
        action: 'Inhaber oder Admin geben die Vorschau frei.',
        result: 'Erst jetzt wird veröffentlicht.',
      },
    ],
    fine: 'Beispielablauf zur Veranschaulichung, ohne Verbindung zu einem echten Projekt.',
  },
  casesTitle: 'Wofür Betriebe ihn nutzen.',
  cases: [
    {
      trade: 'Malerbetrieb',
      situation: 'Die alte Website zeigt Leistungen von vor fünf Jahren.',
      result: 'Leistungen und Kontaktweg sind aktuell, geprüft in der Vorschau.',
    },
    {
      trade: 'Elektro',
      situation: 'Kunden finden die Notdienst-Nummer nicht.',
      result: 'Ein klarer Kontaktbereich, nach Freigabe live.',
    },
    {
      trade: 'Sanitär',
      situation: 'Für eine neue Leistung fehlt eine eigene Seite.',
      result: 'Eine neue Unterseite, die erst nach Ihrer Freigabe erscheint.',
    },
  ],
  startSteps: [
    { title: 'Öffnen', body: 'Den App Builder im Browser starten und ein Projekt anlegen.' },
    { title: 'Gestalten', body: 'Entwurf anpassen und in der Vorschau prüfen.' },
    { title: 'Veröffentlichen', body: 'Tarif wählen und freigeben. Veröffentlichen ist ab Starter enthalten.' },
  ],
  pricingTitle: 'Tarife im Überblick.',
  limits:
    'Noch nicht verfügbar: eigene Domain, DNS-Einrichtung und das Zurücksetzen auf einen früheren Stand. Der App Builder ist eine Preview.',
  cta: {
    title: 'Ihre Seite beginnt mit einem Entwurf.',
    text: 'Öffnen Sie den App Builder und sehen Sie Ihren Betrieb zuerst in der Vorschau.',
    primary: { label: 'App Builder öffnen', to: `/build?source=${APP_BUILDER_SOURCE}-cta` },
    secondary: { label: 'Preise ansehen', to: `/pricing?source=${APP_BUILDER_SOURCE}` },
  },
  faqs: [
    {
      q: 'Brauche ich Programmierkenntnisse?',
      a: 'Nein. Sie bearbeiten Seiten und Texte im Browser.',
    },
    {
      q: 'Wann ist meine Seite öffentlich?',
      a: 'Erst nach der Freigabe durch Inhaber oder Admin. Vorher gibt es nur die Vorschau.',
    },
    {
      q: 'Kann ich meine eigene Domain verwenden?',
      a: 'Noch nicht. Eigene Domain und DNS-Einrichtung sind geplant und noch nicht freigeschaltet.',
    },
  ],
};

export const GOVERNANCE_OS: ProductLandingContent = {
  key: 'governance-os',
  source: GOVERNANCE_SOURCE,
  name: 'Governance OS',
  audience: 'Für Betriebe, die KI und Kundendaten nutzen',
  h1: ['Datenschutz und KI-Pflichten.', 'An einem Ort, mit Nachweis.'],
  lead:
    'Governance OS bündelt KI-Register, Risiken, Vorfälle, Betroffenenanfragen und Freigaben. Zu jedem Schritt entsteht ein Nachweis, den Sie später vorzeigen können.',
  primary: { label: 'Kostenlosen Governance Scan starten', to: `/audit?source=${GOVERNANCE_SOURCE}` },
  secondary: { label: 'KI-Einstufung ausprobieren', to: `/ai-act-klassifikator?source=${GOVERNANCE_SOURCE}` },
  status: [
    { label: 'Scan', registryId: 'free-audit' },
    { label: 'KI-Register', registryId: 'ai-system-registry' },
    { label: 'Dauerüberwachung', registryId: 'continuous-domain-monitoring' },
  ],
  stageTag: 'Governance OS · Entwurf',
  stageCaption: 'Scan → Einordnung → Freigabe → Nachweis',
  promiseTitle: 'Pflichten erledigen statt sammeln.',
  promises: [
    { title: 'Alles an einem Ort', body: 'KI-Systeme, Risiken, Vorfälle, Anfragen und Dienstleister in einer Übersicht.' },
    { title: 'Nachweis zu jedem Schritt', body: 'Was erfasst, geprüft und freigegeben wurde, ist nachvollziehbar abgelegt.' },
    { title: 'Ein Mensch entscheidet', body: 'Regeln prüfen automatisch. Freigaben erteilt Ihr Team.' },
  ],
  flow: {
    eyebrow: 'So arbeitet Governance OS',
    title: 'Vom Befund zum Nachweis.',
    text: 'Klicken Sie sich durch ein Beispiel: ein Betrieb, der einen Website-Chat mit KI einsetzt.',
    panelLabel: 'Governance OS · Beispiel',
    steps: [
      {
        title: 'Scan',
        action: 'Der kostenlose Scan prüft die Website auf Datenschutz- und Governance-Aspekte.',
        result: 'Eine Befundliste mit Schweregrad.',
      },
      {
        title: 'Einordnen',
        action: 'Der Website-Chat wird im KI-Register erfasst und nach EU AI Act eingestuft.',
        result: 'Registereintrag mit Risikostufe.',
      },
      {
        title: 'Freigeben',
        action: 'Die Policy Engine prüft die Regeln. Ihr Team gibt die Maßnahme frei.',
        result: 'Die Maßnahme ist von Ihrem Team freigegeben.',
      },
      {
        title: 'Nachweisen',
        action: 'Alle Schritte landen in der Nachweisablage.',
        result: 'Ein Nachweis, den Sie exportieren und vorzeigen können.',
      },
    ],
    fine: 'Beispielablauf zur Veranschaulichung. Der Scan ist keine Rechtsberatung und keine vollständige Prüfung.',
  },
  casesTitle: 'Wo Governance OS hilft.',
  cases: [
    {
      trade: 'Website-Chat mit KI',
      situation: 'Ein Betrieb setzt einen Chat-Assistenten auf der Website ein.',
      result: 'Das System ist im KI-Register erfasst und eingestuft.',
    },
    {
      trade: 'Auskunftsanfrage',
      situation: 'Ein Kunde will wissen, welche Daten gespeichert sind.',
      result: 'Die Anfrage ist mit Bearbeitungsstand dokumentiert.',
    },
    {
      trade: 'Neuer Dienstleister',
      situation: 'Ein neues Tool soll Kundendaten verarbeiten.',
      result: 'Der Dienstleister ist erfasst, die Freigabe festgehalten.',
    },
  ],
  startSteps: [
    { title: 'Scannen', body: 'Kostenlosen Governance Scan Ihrer Website starten, ohne Konto.' },
    { title: 'Erfassen', body: 'KI-Systeme und Dienstleister im Register anlegen.' },
    { title: 'Nachweisen', body: 'Freigaben erteilen und Nachweise exportieren.' },
  ],
  pricingTitle: 'Der Scan ist kostenlos. Tarife im Überblick.',
  limits:
    'In Vorbereitung: dauerhafte Überwachung Ihrer Domain mit täglichem Re-Scan. Heute prüft der Scan einmalig.',
  cta: {
    title: 'Wo steht Ihr Betrieb heute?',
    text: 'Der Governance Scan zeigt es. Kostenlos und ohne Konto.',
    primary: { label: 'Kostenlosen Governance Scan starten', to: `/audit?source=${GOVERNANCE_SOURCE}-cta` },
    secondary: { label: 'Preise ansehen', to: `/pricing?source=${GOVERNANCE_SOURCE}` },
  },
  faqs: [
    {
      q: 'Ersetzt Governance OS eine Rechtsberatung?',
      a: 'Nein. Es ordnet, dokumentiert und erinnert. Rechtliche Bewertungen bleiben bei Ihnen oder Ihren Beratern.',
    },
    {
      q: 'Brauche ich für den Scan ein Konto?',
      a: 'Nein. Sie geben Ihre Website-Adresse ein und erhalten das Ergebnis direkt.',
    },
    {
      q: 'Überwacht Governance OS meine Website dauerhaft?',
      a: 'Noch nicht. Die tägliche Überwachung ist in Vorbereitung. Heute prüft der Scan einmalig.',
    },
  ],
};

export const OPTIMIZER: ProductLandingContent = {
  key: 'claude-code-optimizer',
  source: OPTIMIZER_SOURCE,
  name: 'Claude Code Optimizer',
  audience: 'Für Betriebe mit eigener Website',
  h1: ['Website prüfen.', 'Befunde verstehen.'],
  lead:
    'Der Optimizer prüft Ihre Website auf ausgewählte DSGVO-, Tracking- und Einwilligungsthemen und zeigt die Befunde nach Schweregrad. Kostenlos und ohne Konto.',
  primary: { label: 'Website scannen', to: '/claude-code-optimizer/scan' },
  secondary: { label: 'So läuft es ab', to: '#ablauf' },
  status: [
    { label: 'Optimizer', registryId: 'cloud-code-optimizer' },
    { label: 'Dauerüberwachung', registryId: 'continuous-domain-monitoring' },
  ],
  stageTag: 'Optimizer · Entwurf',
  stageCaption: 'Adresse → Scan → Befunde → Bericht',
  promiseTitle: 'Ein klarer Befund statt einer langen Liste.',
  promises: [
    { title: 'Ohne Konto starten', body: 'Adresse eingeben, Scan starten, Befunde ansehen. Die Dauer hängt von der Website ab.' },
    { title: 'Nach Schweregrad sortiert', body: 'Sie sehen zuerst, was am wichtigsten ist.' },
    { title: 'Ehrliche Grenzen', body: 'Ein Scan ist keine vollständige Code- oder Rechtsprüfung.' },
  ],
  flow: {
    eyebrow: 'So arbeitet der Optimizer',
    title: 'Vom Scan zum Bericht.',
    text: 'Klicken Sie sich durch die vier Schritte des Ablaufs.',
    panelLabel: 'Optimizer · Beispiel',
    steps: [
      {
        title: 'Adresse',
        action: 'Sie geben die Adresse Ihrer Website ein.',
        result: 'Der Scan ist gestartet, ohne Konto.',
      },
      {
        title: 'Befunde',
        action: 'Der Optimizer prüft ausgewählte Datenschutz-, Tracking- und Einwilligungsthemen.',
        result: 'Eine Liste der Befunde mit Schweregrad.',
      },
      {
        title: 'Anmelden',
        action: 'Für den ausführlichen Bericht melden Sie sich an.',
        result: 'Ihr Ergebnis ist Ihrem Konto zugeordnet.',
      },
      {
        title: 'Bericht',
        action: 'Sie öffnen den ausführlichen Bericht.',
        result: 'Befunde mit Erklärung und passendem Paket.',
      },
    ],
    fine: 'Beispielablauf zur Veranschaulichung. Der echte Scan startet über „Website scannen“.',
  },
  casesTitle: 'Wann sich ein Scan lohnt.',
  cases: [
    {
      trade: 'Nach einem Relaunch',
      situation: 'Die neue Website ist online, Tracking wurde neu eingebunden.',
      result: 'Sie sehen, ob Einwilligung und Tracking zusammenpassen.',
    },
    {
      trade: 'Neues Cookie-Banner',
      situation: 'Ein anderes Banner-Tool ersetzt das alte.',
      result: 'Befunde zeigen, wo nachgebessert werden sollte.',
    },
    {
      trade: 'Vor einem Gespräch',
      situation: 'Die Agentur soll Datenschutzthemen der Website angehen.',
      result: 'Eine Befundliste als gemeinsame Grundlage.',
    },
  ],
  startSteps: [
    { title: 'Scannen', body: 'Website-Adresse eingeben, kostenlos und ohne Konto.' },
    { title: 'Ansehen', body: 'Befunde nach Schweregrad durchgehen.' },
    { title: 'Vertiefen', body: 'Anmelden und den ausführlichen Bericht öffnen.' },
  ],
  pricingTitle: 'Der Scan ist kostenlos. Tarife im Überblick.',
  limits:
    'Noch nicht verfügbar: Analyse von GitHub-Repositories, automatische Code-Korrekturen, Pull Requests und dauerhafte Überwachung. Der Optimizer ist eine Preview.',
  cta: {
    title: 'Wie steht es um Ihre Website?',
    text: 'Der Scan zeigt es. Kostenlos und ohne Konto.',
    primary: { label: 'Website scannen', to: '/claude-code-optimizer/scan' },
    secondary: { label: 'Preise ansehen', to: `/pricing?source=${OPTIMIZER_SOURCE}` },
  },
  faqs: [
    {
      q: 'Was prüft der Optimizer genau?',
      a: 'Ausgewählte DSGVO-, Tracking- und Einwilligungsthemen Ihrer Website. Er ersetzt keine vollständige Code- oder Rechtsprüfung.',
    },
    {
      q: 'Ändert der Optimizer meinen Code?',
      a: 'Nein. Repository-Analyse und automatische Code-Korrekturen sind noch nicht verfügbar.',
    },
    {
      q: 'Brauche ich ein Konto?',
      a: 'Für den Scan nicht. Für den ausführlichen Bericht melden Sie sich an.',
    },
  ],
};

export const LANDINGPAGE_BUILDER: ProductLandingContent = {
  ...APP_BUILDER,
  key: 'landingpage-builder',
  source: 'landingpage-builder',
  name: 'Landingpage-Builder',
  audience: 'Für Betriebe, die eine neue oder bessere Landingpage möchten',
  h1: ['Ihre Idee wird sichtbar.', 'Erst im Entwurf, dann nach Ihrer Freigabe.'],
  lead: 'Beschreiben Sie Ziel, Inhalt und Stil. Der Builder führt Sie zu einem Frontend-Entwurf mit Vorschau. Ihr bestehendes Backend bleibt unverändert.',
  primary: { label: 'Landingpage-Builder öffnen', to: `/build?source=landingpage-builder` },
  secondary: { label: 'So läuft es ab', to: '#ablauf' },
  status: [
    { label: 'Builder', registryId: 'web-builder' },
    { label: 'Freischaltung je Tarif', registryId: 'builder-entitlement-gate' },
  ],
  stageTag: 'Landingpage-Builder · Preview',
  stageCaption: 'Idee → Frontend-Entwurf → Vorschau → Freigabe',
  promiseTitle: 'Eine Landingpage, die zu Ihrem Betrieb passt.',
  promises: [
    { title: 'Im Dialog starten', body: 'Ziel, Inhalte und gewünschte Gestaltung schrittweise festlegen.' },
    { title: 'Vorher ansehen', body: 'Änderungen in einer Vorschau prüfen, bevor sie veröffentlicht werden.' },
    { title: 'Backend bleibt unberührt', body: 'Der Ablauf erstellt einen Frontend-Entwurf; Änderungen am bestehenden Backend sind nicht Teil des Scans oder Entwurfs.' },
  ],
  flow: {
    ...APP_BUILDER.flow,
    eyebrow: 'So arbeitet der Landingpage-Builder',
    title: 'Von der Geschäftsidee zur Vorschau.',
    panelLabel: 'Landingpage-Builder · Beispiel',
    fine: 'Beispielablauf. Der aktuelle Builder ist als Preview geführt; eigene Domain, DNS und Rollback sind nicht verfügbar.',
  },
  casesTitle: 'Wofür Betriebe den Builder nutzen.',
  cases: [
    { trade: 'Handwerk', situation: 'Eine Leistung soll verständlich vorgestellt werden.', result: 'Ein bearbeitbarer Seitenentwurf mit klarer Kontaktmöglichkeit.' },
    { trade: 'Lokaler Betrieb', situation: 'Die bestehende Website braucht eine neue Angebotsseite.', result: 'Ein separater Frontend-Entwurf, den das Team vorab prüft.' },
    { trade: 'Neues Angebot', situation: 'Eine neue Dienstleistung geht an den Start.', result: 'Eine Landingpage-Vorschau, die erst nach Freigabe veröffentlicht wird.' },
  ],
  startSteps: [
    { title: 'Beschreiben', body: 'Ziel, Inhalte und gewünschtes Design festlegen.' },
    { title: 'Gestalten', body: 'Den Entwurf bearbeiten und als Vorschau prüfen.' },
    { title: 'Freigeben', body: 'Die Veröffentlichung bleibt an den vorhandenen Freigabeweg gebunden.' },
  ],
  pricingTitle: 'Tarife und Verfügbarkeit im Überblick.',
  limits: 'Der Builder ist eine Preview. Eigene Domain, DNS-Einrichtung und Rollback sind noch nicht verfügbar. Eine separate Buchbarkeit dieses Produkts ist noch nachzuweisen.',
  cta: {
    title: 'Starten Sie mit einem überprüfbaren Entwurf.',
    text: 'Öffnen Sie den vorhandenen Builder und prüfen Sie zuerst die Vorschau.',
    primary: { label: 'Builder-Preview öffnen', to: `/build?source=landingpage-builder-cta` },
    secondary: { label: 'Preise ansehen', to: `/pricing?source=landingpage-builder` },
  },
  faqs: [
    { q: 'Brauche ich Programmierkenntnisse?', a: 'Der Builder ist auf die Bearbeitung im Browser ausgelegt. Der vollständige Funktionsumfang bleibt Preview.' },
    { q: 'Ändert der Builder mein Backend?', a: 'Der Domain-Scan und der hier beschriebene Frontend-Entwurf ändern das bestehende Backend nicht.' },
    { q: 'Kann ich eine eigene Domain verbinden?', a: 'Eigene Domain und DNS-Einrichtung sind laut Implementierungsstatus noch nicht verfügbar.' },
  ],
};

export const PRODUCT_CONTENT: Record<ProductLandingKey, ProductLandingContent> = {
  'landingpage-builder': LANDINGPAGE_BUILDER,
  'app-builder': APP_BUILDER,
  'governance-os': GOVERNANCE_OS,
  'claude-code-optimizer': OPTIMIZER,
};
