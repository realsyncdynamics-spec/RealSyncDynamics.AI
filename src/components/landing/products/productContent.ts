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
import { checkoutHrefForPlan, planById } from '@/shared/pricing';
import type { ProductPage } from './productLandingShared';
import { EXTENDED_PRODUCT_CONTENT } from './productExtensions';

const GOVERNANCE_LAUNCH = planById('governance_launch');
const GOVERNANCE_LAUNCH_CHECKOUT = GOVERNANCE_LAUNCH
  ? checkoutHrefForPlan(GOVERNANCE_LAUNCH, { source: 'governance-os-product' })
  : '/pricing?source=governance-os-product';

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
  /** Geplante Module zeigen keine allgemeinen Abos als kaufbare Einzelprodukte. */
  pricingMode?: 'roadmap';
  /** Ehrliche Grenzen, direkt unter den Preisen. */
  limits: string;
  cta: { title: string; text: string; primary: ProductLink; secondary: ProductLink };
  faqs: ReadonlyArray<{ q: string; a: string }>;
}

const LANDINGPAGE_BUILDER_SOURCE = 'landingpage-builder';
const APP_BUILDER_SOURCE = 'app-builder';
const GOVERNANCE_SOURCE = 'governance-os';
const OPTIMIZER_SOURCE = 'cco-landing';

export const LANDINGPAGE_BUILDER: ProductLandingContent = {
  key: 'landingpage-builder',
  source: LANDINGPAGE_BUILDER_SOURCE,
  name: 'Landingpage-Builder',
  audience: 'Für Betriebe, die eine neue Website gestalten möchten',
  h1: ['Ihre Website.', 'Aus Ihrer Idee gebaut.'],
  lead:
    'Im Landingpage-Builder entwickeln Sie aus Ihrer Geschäftsidee einen eigenständigen Website-Entwurf. Inhalte und Gestaltung prüfen Sie zuerst in der Vorschau.',
  primary: { label: 'Landingpage erstellen', to: `/build?kind=landing&source=${LANDINGPAGE_BUILDER_SOURCE}` },
  secondary: { label: 'So läuft es ab', to: '#ablauf' },
  status: [
    { label: 'Builder', registryId: 'web-builder' },
    { label: 'Freischaltung je Tarif', registryId: 'builder-entitlement-gate' },
  ],
  stageTag: 'Landingpage-Builder · Entwurf',
  stageCaption: 'Entwurf → Vorschau → Freigabe → live',
  promiseTitle: 'Eine Website, die zu Ihrem Betrieb passt.',
  promises: [
    { title: 'Inhalte selbst gestalten', body: 'Geschäftsidee, Texte und gewünschter Stil bilden den Ausgangspunkt.' },
    { title: 'Erst die Vorschau', body: 'Jede Änderung landet zuerst in einer Vorschau, die Sie in Ruhe prüfen.' },
    { title: 'Freigabe bleibt bei Ihnen', body: 'Sie prüfen den Entwurf in der Vorschau. Der Veröffentlichungsstatus hängt vom freigegebenen Projektumfang ab.' },
  ],
  flow: {
    eyebrow: 'So arbeitet der Landingpage-Builder',
    title: 'Von der Idee zur Seite.',
    text: 'Klicken Sie sich durch die vier Schritte. Rechts sehen Sie, was nach jedem Schritt vorliegt.',
    panelLabel: 'Landingpage-Builder · Beispiel',
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
        action: 'Der Builder stellt den Stand als Vorschau bereit.',
        result: 'Eine Vorschau, die Sie vor der Veröffentlichung prüfen.',
      },
      {
        title: 'Freigabe',
        action: 'Sie prüfen den Entwurf und entscheiden über den nächsten Schritt.',
        result: 'Eine Veröffentlichung wird nur angezeigt, wenn sie im Projektstatus freigeschaltet ist.',
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
    { title: 'Öffnen', body: 'Geschäftsidee und Inhalte als Ausgangspunkt eingeben.' },
    { title: 'Gestalten', body: 'Entwurf anpassen und in der Vorschau prüfen.' },
    { title: 'Nächsten Schritt wählen', body: 'Verfügbarkeit und Veröffentlichung im Projektstatus prüfen.' },
  ],
  pricingTitle: 'Tarife im Überblick.',
  limits:
    'Der Landingpage-Builder ist vom App Builder getrennt. Der verfügbare Entwurf, Veröffentlichung, eigene Domain, DNS und Rücksetzen richten sich nach dem aktuellen Projektstatus.',
  cta: {
    title: 'Ihre Website beginnt mit Ihrer Idee.',
    text: 'Öffnen Sie den App Builder und sehen Sie Ihren Betrieb zuerst in der Vorschau.',
    primary: { label: 'Landingpage-Builder öffnen', to: `/build?kind=landing&source=${LANDINGPAGE_BUILDER_SOURCE}-cta` },
    secondary: { label: 'Preise ansehen', to: `/pricing?source=${LANDINGPAGE_BUILDER_SOURCE}` },
  },
  faqs: [
    {
      q: 'Brauche ich Programmierkenntnisse?',
      a: 'Der Einstieg beginnt mit Geschäftsidee, Inhalten und gewünschtem Stil. Der aktuelle Funktionsumfang hängt vom Builder-Status ab.',
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

export const APP_BUILDER: ProductLandingContent = {
  key: 'app-builder',
  source: APP_BUILDER_SOURCE,
  name: 'App Builder',
  audience: 'Für Betriebe mit eigenen digitalen Abläufen',
  h1: ['Ihre Anwendung.', 'Für Ihren Arbeitsalltag.'],
  lead: 'Der App Builder ist der Einstieg für eigene Web-Anwendungen. Beschreiben Sie, welchen Ablauf Ihre Anwendung unterstützen soll, und prüfen Sie den verfügbaren Entwurf vor einer Freigabe.',
  primary: { label: 'App Builder öffnen', to: `/build?kind=web_app&source=${APP_BUILDER_SOURCE}` },
  secondary: { label: 'So läuft es ab', to: '#ablauf' },
  status: [{ label: 'Builder', registryId: 'web-builder' }, { label: 'Freischaltung je Tarif', registryId: 'builder-entitlement-gate' }],
  stageTag: 'App Builder · Entwurf',
  stageCaption: 'Ablauf → Anwendung → Vorschau → Freigabe',
  promiseTitle: 'Ein eigener digitaler Ablauf.',
  promises: [
    { title: 'Mit dem Ablauf beginnen', body: 'Beschreiben Sie, welche Aufgabe die Anwendung in Ihrem Betrieb unterstützen soll.' },
    { title: 'Entwurf prüfen', body: 'Prüfen Sie den erzeugten Stand und passen Sie den Umfang an, bevor etwas freigegeben wird.' },
    { title: 'Freigabe bleibt bei Ihnen', body: 'Veröffentlichung und Tarifzugang richten sich nach dem verfügbaren Projektstatus.' },
  ],
  flow: {
    eyebrow: 'So arbeitet der App Builder',
    title: 'Vom Ablauf zur Anwendung.',
    text: 'Der Beispielablauf zeigt die Trennung zwischen Idee, Entwurf und Ihrer Freigabe.',
    panelLabel: 'App Builder · Beispiel',
    steps: [
      { title: 'Idee', action: 'Sie beschreiben die Aufgabe, die Ihre Anwendung lösen soll.', result: 'Ein klarer Ausgangspunkt für den Entwurf.' },
      { title: 'Entwurf', action: 'Der Builder stellt einen ersten Anwendungsentwurf bereit.', result: 'Ein Stand, den Sie prüfen und weiter beschreiben können.' },
      { title: 'Vorschau', action: 'Sie prüfen den verfügbaren Funktionsumfang.', result: 'Offene Punkte sind sichtbar, bevor Sie entscheiden.' },
      { title: 'Freigabe', action: 'Sie geben den nächsten Schritt selbst frei.', result: 'Kein automatisches Live-Schalten ohne Ihre Entscheidung.' },
    ],
    fine: 'Beispielablauf zur Veranschaulichung. Verfügbarkeit und Umfang richten sich nach dem aktuellen Projektstatus.',
  },
  casesTitle: 'Wofür Betriebe ihn nutzen.',
  cases: [
    { trade: 'Handwerk', situation: 'Ein wiederkehrender interner Ablauf kostet Zeit.', result: 'Ein digitaler Entwurf macht den Ablauf prüfbar.' },
    { trade: 'Dienstleistung', situation: 'Anfragen benötigen mehrere manuelle Schritte.', result: 'Ein Anwendungsentwurf bündelt den vorgesehenen Ablauf.' },
    { trade: 'Kleines Team', situation: 'Informationen liegen in verschiedenen Listen.', result: 'Ein klar abgegrenzter Anwendungsfall wird zuerst sichtbar gemacht.' },
  ],
  startSteps: [
    { title: 'Anwendungsfall beschreiben', body: 'Legen Sie fest, welche Aufgabe die Anwendung unterstützen soll.' },
    { title: 'Entwurf ansehen', body: 'Prüfen Sie den Stand und die verfügbaren Funktionen.' },
    { title: 'Nächsten Schritt freigeben', body: 'Sie entscheiden über Weiterentwicklung und Veröffentlichung.' },
  ],
  pricingTitle: 'Tarife im Überblick.',
  limits: 'Der App Builder ist eine Preview. Datenbank, Integrationen, Anmeldung und Veröffentlichung sind nur enthalten, wenn sie im konkreten Projektstatus nachweislich verfügbar sind.',
  cta: {
    title: 'Starten Sie mit einem klaren Anwendungsfall.',
    text: 'Öffnen Sie den App Builder und prüfen Sie den verfügbaren Entwurf.',
    primary: { label: 'App Builder öffnen', to: `/build?kind=web_app&source=${APP_BUILDER_SOURCE}-cta` },
    secondary: { label: 'Preise ansehen', to: `/pricing?source=${APP_BUILDER_SOURCE}` },
  },
  faqs: [
    { q: 'Brauche ich Programmierkenntnisse?', a: 'Der Builder soll den Einstieg ohne Code ermöglichen. Welche Funktionen freigeschaltet sind, zeigt der aktuelle Projektstatus.' },
    { q: 'Wird die Anwendung automatisch veröffentlicht?', a: 'Nein. Veröffentlichung benötigt eine ausdrückliche Freigabe und hängt vom verfügbaren Publish-Status ab.' },
    { q: 'Ist der App Builder dasselbe wie der Landingpage-Builder?', a: 'Nein. Der Landingpage-Builder erstellt Website-Entwürfe. Der App Builder richtet sich an eigene digitale Abläufe und Anwendungen.' },
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
  primary: { label: 'Governance Launch buchen', to: GOVERNANCE_LAUNCH_CHECKOUT },
  secondary: { label: 'Kostenlosen Scan starten', to: `/audit?source=${GOVERNANCE_SOURCE}` },
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
  pricingTitle: 'Governance OS direkt buchen.',
  limits:
    'In Vorbereitung: dauerhafte Überwachung Ihrer Domain mit täglichem Re-Scan. Heute prüft der Scan einmalig.',
  cta: {
    title: 'Wo steht Ihr Betrieb heute?',
    text: 'Der Governance Scan zeigt es. Kostenlos und ohne Konto.',
    primary: { label: 'Governance Launch buchen', to: GOVERNANCE_LAUNCH_CHECKOUT },
    secondary: { label: 'Kostenlosen Scan starten', to: `/audit?source=${GOVERNANCE_SOURCE}-cta` },
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

export const PRODUCT_CONTENT: Record<ProductLandingKey, ProductLandingContent> = {
  'landingpage-builder': LANDINGPAGE_BUILDER,
  'app-builder': APP_BUILDER,
  'governance-os': GOVERNANCE_OS,
  'claude-code-optimizer': OPTIMIZER,
  ...EXTENDED_PRODUCT_CONTENT,
};
