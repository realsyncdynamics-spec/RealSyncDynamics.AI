export type Domain = {
  slug: "ai" | "software" | "industrial";
  title: string;
  eyebrow: string;
  image: string;
  statement: string;
  capabilities: string[];
  cta: { label: string; href: string };
};

export const domains: Domain[] = [
  {
    slug: "ai",
    title: "KI & Agenten",
    eyebrow: "Digitale Kognition",
    image: "/images/domain-ai.jpg",
    statement: "Modelle, Agenten, KI-Anwendungen und autonome Workflows steuern.",
    capabilities: [
      "KI-Governance",
      "Agent-Governance",
      "Modellaufsicht",
      "Policy-Durchsetzung",
      "KI-Verordnung-Controls",
      "Nachweis",
    ],
    cta: { label: "KI-Governance erkunden", href: "/solutions/ai" },
  },
  {
    slug: "software",
    title: "Software",
    eyebrow: "Delivery-Systeme",
    image: "/images/domain-software.jpg",
    statement: "Software-Lebenszyklusereignisse von der Entwicklung bis zum Deployment steuern.",
    capabilities: [
      "CI/CD-Governance",
      "API-Governance",
      "Deployment-Controls",
      "Sicherheits-Policies",
      "Dependency-Controls",
      "Auditierbarkeit",
    ],
    cta: { label: "Software-Governance erkunden", href: "/solutions/software" },
  },
  {
    slug: "industrial",
    title: "Industrie",
    eyebrow: "Physische Operationen",
    image: "/images/domain-industrial.jpg",
    statement: "Physische Operationen an gesteuerte Intelligenz anbinden.",
    capabilities: [
      "Industrietelemetrie",
      "Anomalieerkennung",
      "Predictive Quality",
      "Predictive Maintenance",
      "Energieoptimierung",
      "Operator-Intelligenz",
      "Edge-Governance",
    ],
    cta: { label: "Industrial Intelligence erkunden", href: "/solutions/industrial" },
  },
];

export const domainPacks = [
  { id: "ai", name: "AI Governance Pack", copy: "Modell-, Agent- und Anwendungs-Controls für die Ära der KI-Verordnung." },
  { id: "software", name: "Software Governance Pack", copy: "Policy vom Commit bis zur Runtime für Delivery-Systeme." },
  { id: "industrial", name: "Industrial Operations Pack", copy: "Telemetrie, Anomalie und Operator-Workflows." },
  { id: "quality", name: "Manufacturing Quality Pack", copy: "Predictive-Quality-Signale, an Nachweis gebunden." },
  { id: "energy", name: "Energy Intelligence Pack", copy: "Last, Effizienz und Ausnahme-Governance." },
  { id: "security", name: "Security Pack", copy: "Identität, Isolation und Härtung der Control Plane." },
  { id: "privacy", name: "Privacy Pack", copy: "Zweckbindung und Controls auf Datenereignissen." },
  { id: "regulatory", name: "Regulatory Pack", copy: "Ausführbare Abbildung interner und externer Regeln." },
];

export type ConnectorStatus = "available" | "coming" | "custom";

export type Connector = {
  name: string;
  category: "KI" | "Cloud" | "Software" | "Daten" | "Industrie" | "Sicherheit" | "Business";
  status: ConnectorStatus;
};

export const connectors: Connector[] = [
  { name: "API", category: "Software", status: "available" },
  { name: "SDK", category: "Software", status: "available" },
  { name: "Webhooks", category: "Software", status: "available" },
  { name: "GitHub", category: "Software", status: "coming" },
  { name: "CI/CD", category: "Software", status: "coming" },
  { name: "Cloud", category: "Cloud", status: "coming" },
  { name: "Datenbanken", category: "Daten", status: "coming" },
  { name: "OPC UA", category: "Industrie", status: "coming" },
  { name: "MQTT", category: "Industrie", status: "coming" },
  { name: "MES", category: "Industrie", status: "coming" },
  { name: "SCADA", category: "Industrie", status: "coming" },
  { name: "SPS / PLC", category: "Industrie", status: "coming" },
  { name: "SIEM", category: "Sicherheit", status: "coming" },
  { name: "Model Serving", category: "KI", status: "coming" },
  { name: "Agent Runtime", category: "KI", status: "coming" },
  { name: "Custom Connector", category: "Business", status: "custom" },
];

export const connectorCategories = ["KI", "Cloud", "Software", "Daten", "Industrie", "Sicherheit", "Business"] as const;

export const edgeFlow = [
  { id: "local", label: "Lokales System" },
  { id: "edge", label: "RealSync Edge" },
  { id: "policy", label: "Lokale Policy" },
  { id: "decision", label: "Lokale Entscheidung" },
  { id: "buffer", label: "Puffer / Sync" },
  { id: "cloud", label: "Cloud Runtime" },
];

export const industrialFlow = [
  { id: "ot", label: "SPS · SCADA · MES · Sensoren · Kameras · Maschinen" },
  { id: "edge", label: "RealSync Edge" },
  { id: "runtime", label: "RealSync Runtime" },
  { id: "engines", label: "Policy + Risiko + KI" },
  { id: "ops", label: "Operator / System" },
];

export const industries = [
  {
    slug: "manufacturing",
    title: "Fertigung",
    copy: "Qualität, Energie und Linienereignisse auf derselben Runtime steuern, die auch KI und Software steuert.",
  },
  {
    slug: "automation",
    title: "Industrieautomation",
    copy: "OT-Signale beobachten, Policy auswerten, Nachweis erzeugen — ohne Anspruch auf sicherheitszertifizierte Steuerung.",
  },
  {
    slug: "energy",
    title: "Energie",
    copy: "Last-, Asset- und Ausnahmeereignisse als gesteuerten Systemzustand behandeln.",
  },
  {
    slug: "logistics",
    title: "Logistik",
    copy: "Bewegungs-, Ausnahme- und Automationsereignisse an Policy und Nachweis binden.",
  },
  {
    slug: "finance",
    title: "Finanzdienstleistungen",
    copy: "Modell-, Agent- und Software-Ereignisse unter einem Audit-Graph steuern.",
  },
  {
    slug: "healthcare",
    title: "Gesundheit",
    copy: "Datenschutz, Sicherheit und Software-Controls als ausführbare Policy — nicht als Folien.",
  },
  {
    slug: "software",
    title: "Software",
    copy: "Delivery-Pipelines, APIs und Runtime-Änderungen unter einer Control Plane.",
  },
  {
    slug: "ai",
    title: "KI / Technologie",
    copy: "Model Serving, Agenten und Tool-Nutzung beobachtet, bewertet und nachgewiesen.",
  },
  {
    slug: "public",
    title: "Öffentlicher Sektor",
    copy: "Rechenschaft als Runtime-Eigenschaft: Entscheidung, Akteur, Policy, Nachweis.",
  },
];

export const useCases = [
  { title: "KI-Agenten", copy: "Tool-Nutzung beobachten. Risiko bewerten. Outbound steuern. Nachweis versiegeln." },
  { title: "Fertigungsstraßen", copy: "Telemetrie beobachten. Abweichung bewerten. Alarme steuern. Nachweis versiegeln." },
  { title: "Software-Deployments", copy: "Pipeline-Ereignisse beobachten. Policy bewerten. Promotion steuern. Nachweis versiegeln." },
  { title: "Geschäftsprozesse", copy: "Prozessereignisse beobachten. Ausnahmen bewerten. Freigabe steuern. Nachweis versiegeln." },
  { title: "Industriesensoren", copy: "Signale beobachten. Anomalie bewerten. Eskalation steuern. Nachweis versiegeln." },
  { title: "Cloud-Infrastruktur", copy: "Änderung beobachten. Exposition bewerten. Drift steuern. Nachweis versiegeln." },
  { title: "KI-Modelle", copy: "Inferenz und Eval beobachten. Risikoklasse bewerten. Freigabe steuern. Nachweis versiegeln." },
  { title: "APIs", copy: "Traffic und Schema beobachten. Policy bewerten. Zugriff steuern. Nachweis versiegeln." },
];

export const securityTopics = [
  { title: "Tenant-Isolation", copy: "Harte Grenzen zwischen Kundenumgebungen auf der Control Plane." },
  { title: "RBAC", copy: "Rolle und Scope steuern, wer beobachten, entscheiden oder handeln darf." },
  { title: "Audit-Trails", copy: "Jede privilegierte Handlung ist ein Ereignis im Nachweis-Graph." },
  { title: "Policy-Durchsetzung", copy: "Controls werden ausgeführt. Sie sind keine Hinweisbanner." },
  { title: "Nachweisintegrität", copy: "Hash-verkettete Datensätze machen stilles Umschreiben erkennbar." },
  { title: "Verschlüsselung", copy: "Daten in Transit und at rest unter Standard-Kryptographie." },
  { title: "API-Sicherheit", copy: "Authentifizierter, gescopter, rate-limitierter Control-Plane-Zugriff." },
  { title: "Kontrollierte Automation", copy: "Automationen erben denselben Autorisierungs- und Nachweispfad." },
  { title: "Menschliche Freigabe", copy: "Policy kann einen namentlichen Akteur vor der Aktuierung verlangen." },
  { title: "Edge-Betrieb", copy: "Lokale Auswertung mit gepuffertem, gesteuertem Abgleich." },
];

export const complianceItems = [
  {
    name: "KI-Verordnung",
    copy: "Risikoklasse, Protokollierung, menschliche Aufsicht und Nachweis als ausführbare Controls — kein Checklisten-PDF.",
  },
  {
    name: "DSGVO",
    copy: "Zweck, Zugriff und Aufbewahrung als Policy, ausgewertet auf Datenereignissen.",
  },
  {
    name: "ISO 42001",
    copy: "Pflichten des KI-Managementsystems in dieselbe Runtime abgebildet, die die Arbeit ausführt.",
  },
  {
    name: "Interne Policies",
    copy: "Ihre Regeln kompilieren neben den regulatorischen. Ein Auswertungspfad.",
  },
  {
    name: "Branchenregeln",
    copy: "Sektor-Controls docken als Domain Packs an dieselben Engines an.",
  },
];

export const resources = [
  {
    title: "Architekturbrief",
    kind: "Brief",
    copy: "Wie die Governance-Runtime heterogene Systeme in eine auditierbare Control Plane überführt.",
  },
  {
    title: "Vom Ereignis zum Nachweis",
    kind: "Notiz",
    copy: "Der Control Loop als Betriebsmodell — nicht als Dashboard-Feature.",
  },
  {
    title: "Industrie ohne Überclaim",
    kind: "Notiz",
    copy: "Was Edge-Governance auf dem Hallenboden ist — und was sie nicht ist.",
  },
  {
    title: "KI-Verordnung als ausführbare Policy",
    kind: "Brief",
    copy: "Warum Compliance eine Runtime-Fähigkeit ist, keine eigene Produktkategorie.",
  },
];

export const company = {
  statement:
    "RealSync Dynamics AI ist das Unternehmen. RealSync Runtime ist das Produkt: eine Governance- und Control-Runtime für Organisationen, die KI, Software und industrielle Systeme im selben Betrieb führen. Entwickelt in Deutschland, für europäische Regulierungsrealität — ohne das Produkt auf einen Compliance-Scanner zu reduzieren.",
  principles: [
    { title: "Runtime, kein Reporting", copy: "Beobachtung, Entscheidung und Nachweis liegen im Arbeitspfad." },
    { title: "Eine Architektur", copy: "Domänen erweitern die Runtime. Sie spalten sie nicht." },
    { title: "Kein Überclaim", copy: "Wir erfinden keine Zertifikate, keine Anlagensteuerungsbefugnis und keine Integrationen, die nicht geliefert sind." },
    { title: "Nachweis zuerst", copy: "Was sich nicht rekonstruieren lässt, ist unter Governance nicht geschehen." },
  ],
};
