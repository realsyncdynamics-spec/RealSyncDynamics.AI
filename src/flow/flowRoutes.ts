/**
 * flowRoutes — Zentrale Flow-Logik für den geführten, seitenbasierten Navigationspfad.
 *
 * Jede relevante Nutzeraktion (Button, CTA, Menüpunkt, Card) verweist auf eine
 * eindeutige Flow-ID. Zu jeder ID gehört eine eigene Zielseite unter `/flow/<slug>`,
 * die dem Nutzer drei Fragen beantwortet:
 *   1. Wo bin ich?        → `clicked` + `title`
 *   2. Warum bin ich hier? → `explanation`
 *   3. Was kann ich tun?  → `primary` / `secondary` / `extraActions`
 *
 * Die Flow-Seiten sind die verbindende Erzählschicht. An den richtigen Stellen
 * übergeben sie an die real existierende Funktionalität (z. B. `/audit`,
 * `/pricing`, `/checkout/:plan`, `/os/login`, `/app`) — es werden keine
 * bestehenden Kernfunktionen ersetzt oder entfernt.
 */

/** Prozess-Stufen für die Fortschrittsanzeige (Status/Progress). */
export const FLOW_STAGES = [
  { key: 'scan', label: 'Scan' },
  { key: 'ergebnis', label: 'Ergebnis' },
  { key: 'anmeldung', label: 'Anmeldung' },
  { key: 'paket', label: 'Paket' },
  { key: 'checkout', label: 'Checkout' },
  { key: 'dashboard', label: 'Dashboard' },
] as const;

export type FlowStageKey = (typeof FLOW_STAGES)[number]['key'];

/** Zustand, den eine Flow-Seite beim Betreten in den Flow-Context schreibt. */
export interface FlowStateEffect {
  scanDomain?: string;
  scanStarted?: boolean;
  scanCompleted?: boolean;
  loginIntent?: boolean;
  selectedPlan?: string;
  checkoutStatus?: 'idle' | 'started' | 'success' | 'cancelled';
}

/** Eine einzelne Aktion (Button/Link) auf einer Flow-Seite. */
export interface FlowAction {
  /** Sichtbares Label. */
  label: string;
  /** Zielpfad — interne Flow-Route (`/flow/...`) oder bestehende App-Route. */
  to: string;
  /** Kurze Erläuterung, was dieser Schritt bewirkt. */
  hint?: string;
  /** Markiert eine Aktion, die an bestehende Funktionalität übergibt. */
  external?: boolean;
}

/** Vollständige Definition einer Flow-Station. */
export interface FlowStep {
  /** Eindeutige Flow-ID, z. B. `landing.startScan`. */
  id: string;
  /** URL-Slug hinter `/flow/`, z. B. `start-scan`. */
  slug: string;
  /** Button-/CTA-Label, das zu dieser Station führt. */
  label: string;
  /** Ausgangsseite (Herkunft), rein informativ. */
  fromPage: string;
  /** Seitentitel. */
  title: string;
  /** „Was wurde geklickt?“ — kurze Einordnung. */
  clicked: string;
  /** „Was passiert hier?“ — Erklärungstext. */
  explanation: string;
  /** Prozess-Stufe für den Fortschrittsbalken. */
  stage: FlowStageKey;
  /** Primärer nächster Schritt. */
  primary?: FlowAction;
  /** Sekundärer Schritt (i. d. R. „Zurück“). */
  secondary?: FlowAction;
  /** Weitere optionale Aktionen. */
  extraActions?: FlowAction[];
  /** Zustand, der beim Betreten gespeichert wird. */
  stateEffect?: FlowStateEffect;
}

const FLOW_BASE = '/flow';
const flow = (slug: string) => `${FLOW_BASE}/${slug}`;

/**
 * Zentrale Flow-Tabelle. Key = Flow-ID.
 * Die Reihenfolge bildet den logischen Hauptpfad ab.
 */
export const FLOW_STEPS: Record<string, FlowStep> = {
  // ── Scan-Pfad ──────────────────────────────────────────────────────────
  'landing.startScan': {
    id: 'landing.startScan',
    slug: 'start-scan',
    label: 'Scan starten',
    fromPage: 'Startseite',
    title: 'Compliance-Scan starten',
    clicked: 'Du hast „Scan starten“ auf der Startseite geklickt.',
    explanation:
      'Der kostenlose Scan prüft deine Website auf DSGVO- und EU-AI-Act-Risiken: ' +
      'Cookies vor Einwilligung, Tracker, unsichere Datenflüsse und fehlende ' +
      'Nachweise. Du brauchst dafür kein Konto — nur deine Domain. Im nächsten ' +
      'Schritt gibst du die zu prüfende Adresse ein.',
    stage: 'scan',
    primary: { label: 'Weiter: Domain eingeben', to: flow('scan-domain') },
    secondary: { label: 'Zurück zur Startseite', to: '/' },
    extraActions: [
      { label: 'Preise ansehen', to: flow('pricing-intro'), hint: 'Erst die Pakete vergleichen.' },
    ],
  },

  'scan.domain': {
    id: 'scan.domain',
    slug: 'scan-domain',
    label: 'Domain eingeben',
    fromPage: 'Scan starten',
    title: 'Domain eingeben',
    clicked: 'Du bist bereit, eine Domain für den Scan einzugeben.',
    explanation:
      'Auf der Scan-Seite trägst du deine Website-Adresse (z. B. deine-domain.de) ' +
      'ein und startest die Prüfung. Der Scanner lädt die Seite, analysiert ' +
      'Tracking- und Consent-Verhalten und erstellt einen Prüfpfad. Über den ' +
      'Button unten gelangst du zur echten Scan-Eingabe.',
    stage: 'scan',
    primary: { label: 'Zur Scan-Eingabe', to: '/audit', external: true, hint: 'Öffnet die echte Domain-Eingabe.' },
    secondary: { label: 'Zurück', to: flow('start-scan') },
    extraActions: [
      { label: 'Ablauf ansehen (Scan läuft)', to: flow('scan-running'), hint: 'Vorschau des Prozesses.' },
    ],
  },

  'scan.running': {
    id: 'scan.running',
    slug: 'scan-running',
    label: 'Scan läuft',
    fromPage: 'Domain eingeben',
    title: 'Der Scan läuft',
    clicked: 'Dein Scan wurde gestartet.',
    explanation:
      'Während der Scan läuft, ruft die Runtime deine Seite auf, erfasst gesetzte ' +
      'Cookies und Netzwerkaufrufe vor der Einwilligung und gleicht sie gegen ' +
      'DSGVO- und AI-Act-Regeln ab. Das dauert in der Regel nur wenige Sekunden. ' +
      'Anschließend siehst du das Ergebnis.',
    stage: 'scan',
    stateEffect: { scanStarted: true },
    primary: { label: 'Weiter: Ergebnis ansehen', to: flow('report') },
    secondary: { label: 'Zurück', to: flow('scan-domain') },
  },

  'scan.finished': {
    id: 'scan.finished',
    slug: 'report',
    label: 'Scan-Ergebnis',
    fromPage: 'Scan läuft',
    title: 'Dein Scan-Ergebnis',
    clicked: 'Der Scan ist abgeschlossen — hier ist dein Ergebnis.',
    explanation:
      'Das Ergebnis zeigt gefundene Risiken nach Schweregrad, einen Compliance-Score ' +
      'und konkrete Findings mit Prüfpfad. Die vollständige, interaktive Auswertung ' +
      'inklusive Herkunftsnachweis öffnest du über den echten Report. Danach ' +
      'erklären wir dir die nächsten Maßnahmen.',
    stage: 'ergebnis',
    stateEffect: { scanCompleted: true },
    primary: { label: 'Weiter: Maßnahmen erklären', to: flow('measures') },
    secondary: { label: 'Zurück', to: flow('scan-running') },
    extraActions: [
      { label: 'Vollständigen Report öffnen', to: '/audit', external: true },
    ],
  },

  'scan.measures': {
    id: 'scan.measures',
    slug: 'measures',
    label: 'Maßnahmen erklären',
    fromPage: 'Scan-Ergebnis',
    title: 'Empfohlene Maßnahmen',
    clicked: 'Du möchtest wissen, wie du die gefundenen Risiken behebst.',
    explanation:
      'Zu jedem Finding gibt es eine erklärte Maßnahme: welches Dokument fehlt, ' +
      'welcher Tracker blockiert werden muss, welcher Nachweis erzeugt wird. Um ' +
      'Maßnahmen dauerhaft umzusetzen, zu dokumentieren und zu überwachen, legst ' +
      'du ein Konto an und wählst ein passendes Paket.',
    stage: 'ergebnis',
    primary: { label: 'Weiter: Anmelden', to: flow('login') },
    secondary: { label: 'Zurück', to: flow('report') },
    extraActions: [
      { label: 'Direkt Paket wählen', to: flow('choose-plan') },
    ],
  },

  // ── Login-Pfad ─────────────────────────────────────────────────────────
  'landing.login': {
    id: 'landing.login',
    slug: 'login',
    label: 'Anmelden',
    fromPage: 'Startseite',
    title: 'Anmelden',
    clicked: 'Du hast „Anmelden“ geklickt.',
    explanation:
      'Mit deinem Konto speicherst du Scans, Maßnahmen und Nachweise dauerhaft und ' +
      'erhältst Zugriff auf dein persönliches Dashboard. Die Anmeldung läuft über ' +
      'die sichere Auth-Seite (Magic-Link/Passwort). Nach dem Login geht es weiter ' +
      'zur Paketwahl oder direkt ins Dashboard.',
    stage: 'anmeldung',
    stateEffect: { loginIntent: true },
    primary: { label: 'Zur Anmeldung', to: '/os/login', external: true, hint: 'Öffnet die echte Login-Seite.' },
    secondary: { label: 'Zurück zur Startseite', to: '/' },
    extraActions: [
      { label: 'Weiter zur Paketwahl', to: flow('choose-plan') },
      { label: 'Direkt ins Dashboard', to: flow('dashboard') },
    ],
  },

  // ── Pricing-Pfad ───────────────────────────────────────────────────────
  'landing.pricing': {
    id: 'landing.pricing',
    slug: 'pricing-intro',
    label: 'Preise ansehen',
    fromPage: 'Startseite',
    title: 'Preise & Pakete',
    clicked: 'Du hast „Preise ansehen“ geklickt.',
    explanation:
      'Hier erfährst du, wie die Pakete aufgebaut sind: Starter für den Einstieg, ' +
      'Growth für wachsende Teams, Agency für Agenturen mit mehreren Mandanten. ' +
      'Auf der Preisseite vergleichst du alle Leistungen im Detail. Anschließend ' +
      'wählst du dein Paket und startest den Checkout.',
    stage: 'paket',
    primary: { label: 'Zur Preisübersicht', to: '/pricing', external: true, hint: 'Öffnet die echte Preisseite.' },
    secondary: { label: 'Zurück zur Startseite', to: '/' },
    extraActions: [
      { label: 'Paket auswählen', to: flow('choose-plan') },
    ],
  },

  'pricing.choosePlan': {
    id: 'pricing.choosePlan',
    slug: 'choose-plan',
    label: 'Paket auswählen',
    fromPage: 'Preise & Pakete',
    title: 'Paket auswählen',
    clicked: 'Du wählst jetzt dein Paket.',
    explanation:
      'Wähle das Paket, das zu deinem Bedarf passt. Auf der folgenden Paket-Erklärseite ' +
      'siehst du genau, was enthalten ist und was der Checkout kostet, bevor du zu ' +
      'Stripe weitergeleitet wirst. Du kannst die Wahl jederzeit ändern.',
    stage: 'paket',
    primary: { label: 'Starter wählen', to: flow('checkout/starter') },
    secondary: { label: 'Zurück', to: flow('pricing-intro') },
    extraActions: [
      { label: 'Growth wählen', to: flow('checkout/growth') },
      { label: 'Agency wählen', to: flow('checkout/agency') },
    ],
  },

  // ── Checkout-Pfad ──────────────────────────────────────────────────────
  'pricing.checkoutStarter': {
    id: 'pricing.checkoutStarter',
    slug: 'checkout/starter',
    label: 'Starter buchen',
    fromPage: 'Paket auswählen',
    title: 'Paket „Starter“',
    clicked: 'Du hast das Paket „Starter“ ausgewählt.',
    explanation:
      'Starter enthält den fortlaufenden Compliance-Scan, Dokumenten-Generatoren und ' +
      'dein persönliches Dashboard. Über den Button unten startest du den sicheren ' +
      'Stripe-Checkout. Nach erfolgreicher Zahlung landest du automatisch in deinem ' +
      'Dashboard.',
    stage: 'checkout',
    stateEffect: { selectedPlan: 'starter', checkoutStatus: 'started' },
    primary: { label: 'Checkout starten (Starter)', to: '/checkout/starter', external: true, hint: 'Öffnet den echten Stripe-Checkout.' },
    secondary: { label: 'Zurück zur Paketwahl', to: flow('choose-plan') },
    extraActions: [
      { label: 'Zahlung erfolgreich?', to: flow('checkout-success') },
      { label: 'Abgebrochen?', to: flow('checkout-cancelled') },
    ],
  },

  'pricing.checkoutGrowth': {
    id: 'pricing.checkoutGrowth',
    slug: 'checkout/growth',
    label: 'Growth buchen',
    fromPage: 'Paket auswählen',
    title: 'Paket „Growth“',
    clicked: 'Du hast das Paket „Growth“ ausgewählt.',
    explanation:
      'Growth erweitert Starter um mehr Websites, Monitoring und Team-Funktionen. ' +
      'Über den Button unten startest du den sicheren Stripe-Checkout. Nach ' +
      'erfolgreicher Zahlung landest du automatisch in deinem Dashboard.',
    stage: 'checkout',
    stateEffect: { selectedPlan: 'growth', checkoutStatus: 'started' },
    primary: { label: 'Checkout starten (Growth)', to: '/checkout/growth', external: true, hint: 'Öffnet den echten Stripe-Checkout.' },
    secondary: { label: 'Zurück zur Paketwahl', to: flow('choose-plan') },
    extraActions: [
      { label: 'Zahlung erfolgreich?', to: flow('checkout-success') },
      { label: 'Abgebrochen?', to: flow('checkout-cancelled') },
    ],
  },

  'pricing.checkoutAgency': {
    id: 'pricing.checkoutAgency',
    slug: 'checkout/agency',
    label: 'Agency buchen',
    fromPage: 'Paket auswählen',
    title: 'Paket „Agency“',
    clicked: 'Du hast das Paket „Agency“ ausgewählt.',
    explanation:
      'Agency ist für Agenturen mit mehreren Mandanten: Multi-Tenant-Verwaltung, ' +
      'White-Label-Reports und erweiterte Nachweise. Über den Button unten startest ' +
      'du den sicheren Stripe-Checkout. Nach erfolgreicher Zahlung landest du ' +
      'automatisch in deinem Dashboard.',
    stage: 'checkout',
    stateEffect: { selectedPlan: 'agency', checkoutStatus: 'started' },
    primary: { label: 'Checkout starten (Agency)', to: '/checkout/agency', external: true, hint: 'Öffnet den echten Stripe-Checkout.' },
    secondary: { label: 'Zurück zur Paketwahl', to: flow('choose-plan') },
    extraActions: [
      { label: 'Zahlung erfolgreich?', to: flow('checkout-success') },
      { label: 'Abgebrochen?', to: flow('checkout-cancelled') },
    ],
  },

  'checkout.success': {
    id: 'checkout.success',
    slug: 'checkout-success',
    label: 'Zahlung erfolgreich',
    fromPage: 'Stripe-Checkout',
    title: 'Zahlung erfolgreich',
    clicked: 'Deine Zahlung war erfolgreich.',
    explanation:
      'Dein Paket ist jetzt aktiv. Wir haben dein Konto freigeschaltet und dein ' +
      'Dashboard vorbereitet. Dort siehst du dein aktives Paket, deine Scans, ' +
      'Reports, Nachweise und die nächsten Schritte. Über den Button unten geht es ' +
      'direkt in dein persönliches Dashboard.',
    stage: 'dashboard',
    stateEffect: { checkoutStatus: 'success' },
    primary: { label: 'Ins Dashboard', to: flow('dashboard') },
    secondary: { label: 'Paket ändern', to: flow('choose-plan') },
  },

  'checkout.cancelled': {
    id: 'checkout.cancelled',
    slug: 'checkout-cancelled',
    label: 'Checkout abgebrochen',
    fromPage: 'Stripe-Checkout',
    title: 'Checkout abgebrochen',
    clicked: 'Der Checkout wurde abgebrochen — es wurde nichts abgebucht.',
    explanation:
      'Kein Problem: Es wurde keine Zahlung durchgeführt. Du kannst dein Paket erneut ' +
      'wählen und den Checkout jederzeit neu starten. Wenn du unsicher bist, welches ' +
      'Paket passt, sieh dir noch einmal die Preisübersicht an.',
    stage: 'checkout',
    stateEffect: { checkoutStatus: 'cancelled' },
    primary: { label: 'Paket erneut wählen', to: flow('choose-plan') },
    secondary: { label: 'Preise ansehen', to: flow('pricing-intro') },
  },

  // ── Dashboard ──────────────────────────────────────────────────────────
  'app.dashboard': {
    id: 'app.dashboard',
    slug: 'dashboard',
    label: 'Dashboard öffnen',
    fromPage: 'Zahlung erfolgreich',
    title: 'Dein persönliches Dashboard',
    clicked: 'Du bist am Ziel des Flows angekommen.',
    explanation:
      'Im Dashboard läuft alles zusammen: Dein aktives Paket, dein zuletzt ' +
      'durchgeführter Scan, deine Reports, dein Evidence-/Nachweis-Bereich, dein ' +
      'Compliance-Status und die Einstellungen. Von hier aus startest du neue Scans, ' +
      'exportierst Nachweise und verwaltest dein Team. Über den Button unten öffnest ' +
      'du das echte Dashboard.',
    stage: 'dashboard',
    primary: { label: 'Dashboard öffnen', to: '/app', external: true, hint: 'Öffnet dein echtes Dashboard.' },
    secondary: { label: 'Zurück zur Startseite', to: '/' },
    extraActions: [
      { label: 'Neuen Scan starten', to: flow('start-scan') },
    ],
  },
};

/** Alle Flow-Steps als Array (Reihenfolge = Definitionsreihenfolge). */
export const FLOW_STEP_LIST: FlowStep[] = Object.values(FLOW_STEPS);

/** Slug → FlowStep (für die dynamische Route `/flow/*`). */
const BY_SLUG: Record<string, FlowStep> = FLOW_STEP_LIST.reduce(
  (acc, step) => {
    acc[step.slug] = step;
    return acc;
  },
  {} as Record<string, FlowStep>,
);

/** Findet einen Flow-Step anhand seines Slugs (Pfad hinter `/flow/`). */
export function getFlowStepBySlug(slug: string | undefined): FlowStep | undefined {
  if (!slug) return undefined;
  return BY_SLUG[slug.replace(/^\/+|\/+$/g, '')];
}

/** Findet einen Flow-Step anhand seiner ID. */
export function getFlowStepById(id: string): FlowStep | undefined {
  return FLOW_STEPS[id];
}

/** Baut den Ziel-Pfad zu einer Flow-ID (für den zentralen Handler). */
export function flowPath(id: string): string {
  const step = FLOW_STEPS[id];
  return step ? flow(step.slug) : '/';
}

/** Index einer Stufe in der Fortschrittsleiste (0-basiert). */
export function stageIndex(stage: FlowStageKey): number {
  return FLOW_STAGES.findIndex((s) => s.key === stage);
}
