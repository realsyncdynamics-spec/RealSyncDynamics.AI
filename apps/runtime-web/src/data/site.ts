export const brand = {
  company: "RealSync Dynamics AI",
  product: "RealSync Runtime",
  name: "RealSync Runtime",
  short: "Runtime",
  wordmarkTop: "REALSYNC",
  wordmarkBottom: "RUNTIME",
  domain: "realsyncdynamicsai.de",
  productOf: "Ein Produkt von RealSync Dynamics AI",
  tagline: "Governance- und Control-Runtime für KI, Software und industrielle Systeme.",
  headline: "Eine Runtime.\nSteuern Sie jedes intelligente System.",
  subheadline:
    "RealSync Runtime verbindet KI, Software, Agenten und industrielle Systeme zu einer gesteuerten Control Plane — beobachtet Ereignisse, setzt Policies durch, bewertet Risiko und erzeugt nachprüfbare Nachweise.",
  trust: ["KI", "Agenten", "Software", "Industrie"],
  ctaPrimary: "Runtime erkunden",
  ctaSecondary: "Angebot anfordern",
};

export type NavLink = {
  label: string;
  href: string;
  description?: string;
};

export type MegaColumn = {
  title: string;
  items: NavLink[];
};

export type NavItem = {
  label: string;
  href: string;
  mega?: MegaColumn[];
};

export const platformMega: MegaColumn[] = [
  {
    title: "Governance Runtime",
    items: [
      { label: "Beobachten", href: "/platform/observe", description: "Ereignisse aus jedem angebundenen System aufnehmen." },
      { label: "Verstehen", href: "/platform/understand", description: "Signale zu operativem Kontext korrelieren." },
      { label: "Bewerten", href: "/platform/assess", description: "Risiko gegen den lebenden Policy-Stand scoren." },
      { label: "Steuern", href: "/platform/govern", description: "Innerhalb autorisierter Grenzen entscheiden." },
      { label: "Durchsetzen", href: "/platform/enforce", description: "Nur freigegebene Aktionen ausführen." },
      { label: "Nachweis", href: "/platform/evidence", description: "Jede Entscheidung im Audit-Graph versiegeln." },
      { label: "Optimieren", href: "/platform/optimize", description: "Aus Ergebnissen lernen, ohne stille Policy-Drift." },
    ],
  },
  {
    title: "Kern-Engines",
    items: [
      { label: "Event Engine", href: "/technology#event", description: "Normierte Ereignisfläche." },
      { label: "Policy Engine", href: "/technology#policy", description: "Maschinenlesbare Controls." },
      { label: "Risk Engine", href: "/technology#risk", description: "Lebendes, mehrdimensionales Risiko." },
      { label: "Decision Engine", href: "/technology#decision", description: "Gesteuerte Entscheidung." },
      { label: "Control Engine", href: "/technology#control", description: "Autorisierte Aktuierung." },
      { label: "Evidence Engine", href: "/technology#evidence", description: "Unveränderliche Ereigniskette." },
      { label: "Automation Engine", href: "/technology#automation", description: "Kontrollierte Workflows." },
    ],
  },
  {
    title: "Infrastruktur",
    items: [
      { label: "Konnektoren", href: "/connectors", description: "Systeme anbinden, die Sie bereits betreiben." },
      { label: "Edge Runtime", href: "/edge", description: "Lokale Policy nah an der Quelle." },
      { label: "API", href: "/technology#api", description: "Control-Plane-API der Runtime." },
      { label: "SDK", href: "/technology#sdk", description: "Governance in Ihren Stack einbetten." },
      { label: "Tenant-Isolation", href: "/security", description: "Harte Grenzen zwischen Mandanten." },
      { label: "Audit-Graph", href: "/platform/evidence", description: "Verketteter Nachweis jeder Handlung." },
    ],
  },
];

export const nav: NavItem[] = [
  { label: "Produkt", href: "/platform", mega: platformMega },
  {
    label: "Lösungen",
    href: "/solutions",
    mega: [
      {
        title: "Domänen",
        items: [
          { label: "KI & Agenten", href: "/solutions/ai", description: "Modelle, Agenten und autonome Workflows steuern." },
          { label: "Software", href: "/solutions/software", description: "Den Software-Lebenszyklus vom Commit bis Runtime steuern." },
          { label: "Industrie", href: "/solutions/industrial", description: "Physische Operationen an gesteuerte Intelligenz anbinden." },
        ],
      },
      {
        title: "Fähigkeiten",
        items: [
          { label: "Copilot", href: "/#copilot", description: "Nachweisgestützter Operator-Assistent." },
          { label: "Live-Simulation", href: "/#simulation", description: "Die Runtime in Echtzeit denken sehen." },
          { label: "Dashboard-Vorschau", href: "/dashboard", description: "Operative Oberfläche mit Beispieldaten." },
        ],
      },
    ],
  },
  { label: "Technologie", href: "/technology" },
  {
    label: "Branchen",
    href: "/industries",
    mega: [
      {
        title: "Sektoren",
        items: [
          { label: "Fertigung", href: "/industries/manufacturing" },
          { label: "Industrieautomation", href: "/industries/automation" },
          { label: "Energie", href: "/industries/energy" },
          { label: "Logistik", href: "/industries/logistics" },
          { label: "Finanzdienstleistungen", href: "/industries/finance" },
        ],
      },
      {
        title: "Weitere",
        items: [
          { label: "Gesundheit", href: "/industries/healthcare" },
          { label: "Software", href: "/industries/software" },
          { label: "KI / Technologie", href: "/industries/ai" },
          { label: "Öffentlicher Sektor", href: "/industries/public" },
        ],
      },
    ],
  },
  { label: "Pakete", href: "/pricing" },
  { label: "Unternehmen", href: "/company" },
];

export const footerColumns: { title: string; items: NavLink[] }[] = [
  {
    title: "Produkt",
    items: [
      { label: "RealSync Runtime", href: "/platform" },
      { label: "Control Loop", href: "/#loop" },
      { label: "Evidence Engine", href: "/platform/evidence" },
      { label: "Risk Engine", href: "/technology#risk" },
      { label: "Edge Runtime", href: "/edge" },
    ],
  },
  {
    title: "Lösungen",
    items: [
      { label: "KI-Governance", href: "/solutions/ai" },
      { label: "Software-Governance", href: "/solutions/software" },
      { label: "Industrial Intelligence", href: "/solutions/industrial" },
      { label: "Domain Packs", href: "/#packs" },
    ],
  },
  {
    title: "Branchen",
    items: [
      { label: "Fertigung", href: "/industries/manufacturing" },
      { label: "Energie", href: "/industries/energy" },
      { label: "Finanzdienstleistungen", href: "/industries/finance" },
      { label: "Öffentlicher Sektor", href: "/industries/public" },
    ],
  },
  {
    title: "Technologie",
    items: [
      { label: "Architektur", href: "/technology" },
      { label: "Konnektoren", href: "/connectors" },
      { label: "API & SDK", href: "/technology#api" },
      { label: "Sicherheit", href: "/security" },
    ],
  },
  {
    title: "Unternehmen",
    items: [
      { label: "Ökosystem", href: "/company" },
      { label: "Ressourcen", href: "/resources" },
      { label: "Pakete & Preise", href: "/pricing" },
      { label: "Kontakt", href: "/demo" },
    ],
  },
  {
    title: "Rechtliches",
    items: [
      { label: "Datenschutz", href: "/legal/privacy" },
      { label: "Sicherheit", href: "/security" },
      { label: "Compliance", href: "/compliance" },
      { label: "Impressum", href: "/legal/imprint" },
    ],
  },
];
