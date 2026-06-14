import type { RiskLevel } from '../components/Badge';
import type { RiskItem } from '../components/RiskCard';
import type { EvidenceItem } from '../components/EvidenceCard';
import type { TimelineEvent } from '../components/Timeline';
import type { AgentMessage } from '../components/AgentChatPanel';

export const ORG = {
  name: 'Atelier Nord GmbH',
  plan: 'Enterprise',
  seats: '12 / 25',
};

export const SCORES = {
  overall: 78,
  dsgvo: 84,
  aiAct: 71,
  monitoring: 92,
};

export interface WebsiteAsset {
  id: string;
  domain: string;
  status: RiskLevel;
  score: number;
  lastScan: string;
  pages: number;
  cookies: number;
  trackers: number;
}

export const WEBSITES: WebsiteAsset[] = [
  { id: 'site-1', domain: 'atelier-nord.de', status: 'passed', score: 92, lastScan: 'vor 2 Std.', pages: 184, cookies: 12, trackers: 4 },
  { id: 'site-2', domain: 'shop.atelier-nord.de', status: 'medium', score: 68, lastScan: 'vor 5 Std.', pages: 421, cookies: 27, trackers: 9 },
  { id: 'site-3', domain: 'blog.atelier-nord.de', status: 'high', score: 54, lastScan: 'vor 1 Tag', pages: 96, cookies: 18, trackers: 6 },
  { id: 'site-4', domain: 'app.atelier-nord.de', status: 'critical', score: 38, lastScan: 'vor 3 Tagen', pages: 32, cookies: 9, trackers: 11 },
  { id: 'site-5', domain: 'partner.atelier-nord.de', status: 'passed', score: 88, lastScan: 'vor 6 Std.', pages: 58, cookies: 7, trackers: 2 },
];

export const RISKS: RiskItem[] = [
  {
    id: 'risk-1',
    title: 'Meta Pixel ohne vorherige Einwilligung geladen',
    description: 'Tracking-Skript wird auf app.atelier-nord.de vor Consent-Interaktion initialisiert. Verstoß gegen Art. 6 DSGVO.',
    level: 'critical',
    asset: 'app.atelier-nord.de',
    framework: 'DSGVO Art. 6',
    detectedAt: '12.06.2026',
  },
  {
    id: 'risk-2',
    title: 'KI-System ohne Risikoklassifizierung',
    description: 'Der eingesetzte Empfehlungsalgorithmus im Shop wurde noch nicht gemäß EU AI Act klassifiziert.',
    level: 'high',
    asset: 'shop.atelier-nord.de',
    framework: 'EU AI Act Art. 6',
    detectedAt: '11.06.2026',
  },
  {
    id: 'risk-3',
    title: 'Cookie-Banner verweigert keine granularen Kategorien',
    description: 'Nutzer können Marketing-Cookies nicht einzeln ablehnen — nur „Alle akzeptieren" oder „Alle ablehnen".',
    level: 'high',
    asset: 'blog.atelier-nord.de',
    framework: 'TTDSG §25',
    detectedAt: '10.06.2026',
  },
  {
    id: 'risk-4',
    title: 'Drittland-Transfer zu US-Hosting-Anbieter erkannt',
    description: 'Schriftarten werden von einem US-CDN geladen — kein Standard-Vertragsklausel-Nachweis hinterlegt.',
    level: 'medium',
    asset: 'atelier-nord.de',
    framework: 'DSGVO Art. 44',
    detectedAt: '09.06.2026',
  },
  {
    id: 'risk-5',
    title: 'Datenschutzerklärung verweist auf veraltete Verarbeiter-Liste',
    description: 'Sub-Prozessoren-Liste wurde seit dem letzten Anbieterwechsel nicht aktualisiert.',
    level: 'medium',
    asset: 'atelier-nord.de',
    framework: 'DSGVO Art. 13',
    detectedAt: '08.06.2026',
  },
  {
    id: 'risk-6',
    title: 'TOM-Dokumentation erfolgreich aktualisiert',
    description: 'Technische und organisatorische Maßnahmen wurden geprüft und entsprechen dem aktuellen Stand.',
    level: 'passed',
    asset: 'Organisation',
    framework: 'DSGVO Art. 32',
    detectedAt: '07.06.2026',
  },
];

export const EVIDENCE: EvidenceItem[] = [
  {
    id: 'ev-1',
    title: 'Cookie-Banner Screenshot — app.atelier-nord.de',
    type: 'Screenshot · C2PA-signiert',
    hash: 'sha256:8f3a...d21c',
    capturedAt: '12.06.2026 09:14',
    source: 'Automatisierter Scan',
  },
  {
    id: 'ev-2',
    title: 'Netzwerk-Trace: Drittanbieter-Requests',
    type: 'HAR-Datei',
    hash: 'sha256:1b9e...77af',
    capturedAt: '12.06.2026 09:14',
    source: 'Automatisierter Scan',
  },
  {
    id: 'ev-3',
    title: 'VVT-Export Q2 2026',
    type: 'PDF · Verzeichnis von Verarbeitungstätigkeiten',
    hash: 'sha256:a02d...f9e1',
    capturedAt: '01.06.2026 08:00',
    source: 'Manuelle Freigabe · M. Brandt',
  },
  {
    id: 'ev-4',
    title: 'AI-Act Klassifizierung — Empfehlungsalgorithmus',
    type: 'Risikoklassifizierungs-Report',
    hash: 'sha256:5c71...3bd0',
    capturedAt: '28.05.2026 14:32',
    source: 'AI Use Case Registry',
  },
];

export const MONITORING_EVENTS: TimelineEvent[] = [
  {
    id: 'mon-1',
    title: 'Neuer Tracker auf shop.atelier-nord.de erkannt',
    description: 'Drittanbieter-Skript „analytics.partner.io" wurde neu eingebunden.',
    timestamp: '12.06.2026 · 09:14',
    level: 'high',
  },
  {
    id: 'mon-2',
    title: 'Vollständiger Compliance-Scan abgeschlossen',
    description: '5 Domains, 791 Seiten geprüft. 3 neue Findings.',
    timestamp: '12.06.2026 · 06:00',
    level: 'low',
  },
  {
    id: 'mon-3',
    title: 'AI Use Case „Produktempfehlung" aktualisiert',
    description: 'Modellversion v2.3 wurde in der Registry erfasst und neu klassifiziert.',
    timestamp: '11.06.2026 · 17:42',
    level: 'medium',
  },
  {
    id: 'mon-4',
    title: 'Evidence-Export für Audit erstellt',
    description: 'Prüfpfad-Bundle für externen Wirtschaftsprüfer generiert und signiert.',
    timestamp: '11.06.2026 · 11:05',
    level: 'passed',
  },
  {
    id: 'mon-5',
    title: 'SSL-Zertifikat erneuert',
    description: 'app.atelier-nord.de — automatische Erneuerung erfolgreich.',
    timestamp: '10.06.2026 · 03:00',
    level: 'passed',
  },
  {
    id: 'mon-6',
    title: 'Drittland-Transfer auf atelier-nord.de erkannt',
    description: 'Schriftarten-CDN mit Sitz außerhalb der EU ohne SCC-Nachweis gefunden.',
    timestamp: '09.06.2026 · 14:20',
    level: 'medium',
  },
  {
    id: 'mon-7',
    title: 'Neue Sub-Domain entdeckt',
    description: 'partner.atelier-nord.de wurde automatisch zum Asset-Inventar hinzugefügt.',
    timestamp: '08.06.2026 · 10:02',
    level: 'low',
  },
  {
    id: 'mon-8',
    title: 'Wöchentlicher Compliance-Report verschickt',
    description: 'Zusammenfassung an m.brandt@atelier-nord.de und l.vogel@atelier-nord.de gesendet.',
    timestamp: '07.06.2026 · 07:00',
    level: 'passed',
  },
];

export interface AiUseCase {
  id: string;
  name: string;
  purpose: string;
  riskClass: 'Minimal' | 'Begrenzt' | 'Hoch' | 'Verboten';
  status: RiskLevel;
  owner: string;
}

export const AI_USE_CASES: AiUseCase[] = [
  { id: 'uc-1', name: 'Produktempfehlung Shop', purpose: 'Personalisierte Produktvorschläge im Checkout', riskClass: 'Begrenzt', status: 'medium', owner: 'Team Commerce' },
  { id: 'uc-2', name: 'Support-Chatbot „Kodee"', purpose: 'Automatisierte Erstantwort im Kundensupport', riskClass: 'Begrenzt', status: 'passed', owner: 'Team Support' },
  { id: 'uc-3', name: 'CV-Screening HR-Tool', purpose: 'Vorauswahl von Bewerbungsunterlagen', riskClass: 'Hoch', status: 'high', owner: 'Team People' },
  { id: 'uc-4', name: 'Preisoptimierung Dynamic Pricing', purpose: 'Automatische Preisanpassung nach Nachfrage', riskClass: 'Begrenzt', status: 'medium', owner: 'Team Commerce' },
];

export interface AgentDef {
  id: string;
  name: string;
  role: string;
  status: 'Aktiv' | 'Pausiert' | 'Wartung';
  lastRun: string;
}

export const AGENTS: AgentDef[] = [
  { id: 'agent-1', name: 'Compliance Agent', role: 'Überwacht DSGVO- & AI-Act-Konformität in Echtzeit', status: 'Aktiv', lastRun: 'vor 12 Min.' },
  { id: 'agent-2', name: 'Evidence Agent', role: 'Sammelt & signiert Nachweise (C2PA)', status: 'Aktiv', lastRun: 'vor 2 Std.' },
  { id: 'agent-3', name: 'Risk Watcher', role: 'Erkennt neue Tracker, Drittanbieter & Schwachstellen', status: 'Aktiv', lastRun: 'vor 9 Min.' },
  { id: 'agent-4', name: 'Report Builder', role: 'Erstellt periodische Audit-Reports', status: 'Wartung', lastRun: 'vor 1 Tag' },
];

export interface ReportItem {
  id: string;
  title: string;
  period: string;
  status: RiskLevel;
  generatedAt: string;
}

export const REPORTS: ReportItem[] = [
  { id: 'rep-1', title: 'DSGVO 360°-Audit — Q2 2026', period: 'Apr – Jun 2026', status: 'passed', generatedAt: '01.06.2026' },
  { id: 'rep-2', title: 'EU AI Act Readiness Report', period: 'Mai 2026', status: 'medium', generatedAt: '28.05.2026' },
  { id: 'rep-3', title: 'Cookie & Tracking Compliance', period: 'Mai 2026', status: 'high', generatedAt: '15.05.2026' },
  { id: 'rep-4', title: 'Vendor Risk Assessment', period: 'Q1 2026', status: 'passed', generatedAt: '02.04.2026' },
];

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'Owner' | 'Admin' | 'Compliance Manager' | 'Mitglied';
  status: 'Aktiv' | 'Eingeladen';
}

export const TEAM: TeamMember[] = [
  { id: 'tm-1', name: 'Markus Brandt', email: 'm.brandt@atelier-nord.de', role: 'Owner', status: 'Aktiv' },
  { id: 'tm-2', name: 'Lena Vogel', email: 'l.vogel@atelier-nord.de', role: 'Compliance Manager', status: 'Aktiv' },
  { id: 'tm-3', name: 'Tarek Younes', email: 't.younes@atelier-nord.de', role: 'Admin', status: 'Aktiv' },
  { id: 'tm-4', name: 'Sofia Pereira', email: 's.pereira@atelier-nord.de', role: 'Mitglied', status: 'Eingeladen' },
];

export const AGENT_MESSAGES: AgentMessage[] = [
  {
    id: 'msg-1',
    role: 'agent',
    text: 'Guten Morgen, Markus. Seit dem letzten Login wurden 3 neue Findings erkannt — eines davon kritisch (Meta Pixel auf app.atelier-nord.de).',
    timestamp: '09:15',
  },
  {
    id: 'msg-2',
    role: 'user',
    text: 'Zeig mir die Details zum kritischen Finding.',
    timestamp: '09:16',
  },
  {
    id: 'msg-3',
    role: 'agent',
    text: 'Das Meta Pixel wird unabhängig vom Consent-Status geladen. Empfehlung: Consent-Mode v2 aktivieren und Tag-Trigger an „analytics_storage = granted" koppeln. Ich kann einen Remediation-Task für das Dev-Team erstellen.',
    timestamp: '09:16',
  },
];

export interface PricingPlan {
  id: string;
  name: string;
  price: string;
  priceSuffix: string;
  description: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}

// Plan-Daten gespiegelt aus src/config/pricing.ts (Single Source of Truth).
// Diese 3 Karten sind ein Ausschnitt (Starter/Growth/Agency) des dortigen
// 5-Pakete-Modells (Free → Scale 1.999 €) — Preise/Namen MÜSSEN mit
// PRICING_TIERS übereinstimmen, sonst entsteht "Durcheinander" zwischen
// /os/pricing und /pricing.
export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: '79 €',
    priceSuffix: 'pro Monat',
    description: 'Für kleine Teams, die mit DSGVO-Grundlagen starten.',
    features: [
      '1 Website',
      'Vollständiger DSGVO-Scan mit Paragraphenbezug',
      'DSE-Generator',
      'Monatlicher Re-Scan',
      'E-Mail-Alert bei neuen Findings',
    ],
    cta: 'Jetzt upgraden',
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '249 €',
    priceSuffix: 'pro Monat',
    description: 'Für wachsende Unternehmen mit mehreren Websites und KI-Systemen.',
    features: [
      'Bis zu 3 Domains',
      'Tägliches Monitoring + Drift-Detection',
      'Consent-Timing-Analyse',
      'AI Use Case Registry',
      'Evidence Vault (C2PA)',
      'Risk-Dashboard im Browser',
    ],
    cta: 'Jetzt upgraden',
    highlighted: true,
  },
  {
    id: 'agency',
    name: 'Agency',
    price: '699 €',
    priceSuffix: 'pro Monat',
    description: 'Für Multi-Domain-Teams und Plattformbetreiber, die mehrere Kundenseiten betreuen.',
    features: [
      'Multi-Tenant-Dashboard (10 Kundenseiten)',
      'White-Label-Reports mit eigenem Logo',
      'API + Webhooks für CI/CD',
      'Bulk-Audit für Domain-Portfolios',
      'Priority-Support',
    ],
    cta: '14 Tage Agency testen',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Individuell',
    priceSuffix: 'nach Vereinbarung',
    description: 'Für Konzerne, Agenturen und regulierte Branchen mit Multi-Tenant-Anforderungen.',
    features: [
      'Unbegrenzte Websites',
      'Kontinuierliches Monitoring',
      'White-Label & Multi-Tenant',
      'Dedizierter Compliance Agent',
      'SLA & Audit-Begleitung',
      'Persönlicher Ansprechpartner',
    ],
    cta: 'Vertrieb kontaktieren',
  },
];

export const PRICING_FAQ = [
  {
    q: 'Brauche ich eine Kreditkarte für die Testphase?',
    a: 'Nein. Die 14-tägige Testphase ist vollständig kostenlos und ohne Zahlungsdaten nutzbar.',
  },
  {
    q: 'Kann ich jederzeit upgraden oder kündigen?',
    a: 'Ja, alle Pläne sind monatlich kündbar. Ein Wechsel zwischen Plänen ist jederzeit im Billing-Bereich möglich.',
  },
  {
    q: 'Wo werden meine Daten gespeichert?',
    a: 'Ausschließlich auf Infrastruktur innerhalb der Europäischen Union — DSGVO-konform by Design.',
  },
  {
    q: 'Ist EU AI Act Governance in jedem Plan enthalten?',
    a: 'Die AI Use Case Registry ist ab Growth enthalten. Enterprise bietet zusätzlich dedizierte Risikoklassifizierung und Audit-Begleitung.',
  },
];

export interface AiRiskClass {
  id: string;
  name: string;
  badge: RiskLevel;
  description: string;
  examples: string[];
}

export const AI_RISK_CLASSES: AiRiskClass[] = [
  {
    id: 'minimal',
    name: 'Minimales Risiko',
    badge: 'passed',
    description: 'Keine besonderen Pflichten — freiwillige Verhaltenskodizes empfohlen.',
    examples: ['Spam-Filter', 'Inventory-Management-KI'],
  },
  {
    id: 'limited',
    name: 'Begrenztes Risiko',
    badge: 'low',
    description: 'Transparenzpflichten — Nutzer müssen erkennen können, dass sie mit einer KI interagieren.',
    examples: ['Chatbots', 'Empfehlungssysteme'],
  },
  {
    id: 'high',
    name: 'Hohes Risiko',
    badge: 'high',
    description: 'Konformitätsbewertung, Risikomanagement, menschliche Aufsicht und Registrierung erforderlich.',
    examples: ['CV-Screening', 'Bonitätsprüfung', 'Medizinische Diagnose-Unterstützung'],
  },
  {
    id: 'prohibited',
    name: 'Verbotene Praktiken',
    badge: 'critical',
    description: 'Einsatz ist nach EU AI Act grundsätzlich untersagt.',
    examples: ['Social Scoring', 'Manipulative Verhaltenssteuerung'],
  },
];

export interface ComplianceObligation {
  id: string;
  title: string;
  framework: string;
  status: RiskLevel;
  dueDate: string;
  owner: string;
  description: string;
}

export const COMPLIANCE_OBLIGATIONS: ComplianceObligation[] = [
  {
    id: 'ob-1',
    title: 'Verzeichnis von Verarbeitungstätigkeiten (VVT) aktualisieren',
    framework: 'DSGVO Art. 30',
    status: 'medium',
    dueDate: '30.06.2026',
    owner: 'Lena Vogel',
    description: 'Sub-Prozessoren-Liste enthält veraltete Anbieter — Aktualisierung erforderlich.',
  },
  {
    id: 'ob-2',
    title: 'Datenschutz-Folgenabschätzung für Empfehlungsalgorithmus',
    framework: 'DSGVO Art. 35',
    status: 'high',
    dueDate: '15.07.2026',
    owner: 'Markus Brandt',
    description: 'DSFA für den neuen Empfehlungsalgorithmus im Shop noch nicht durchgeführt.',
  },
  {
    id: 'ob-3',
    title: 'Cookie-Banner auf granulare Einwilligung umstellen',
    framework: 'TTDSG §25',
    status: 'high',
    dueDate: '20.06.2026',
    owner: 'Tarek Younes',
    description: 'Marketing-Cookies müssen separat ablehnbar sein — derzeit nur „Alle" möglich.',
  },
  {
    id: 'ob-4',
    title: 'Risikoklassifizierung CV-Screening-Tool dokumentieren',
    framework: 'EU AI Act Art. 6',
    status: 'critical',
    dueDate: '01.08.2026',
    owner: 'Sofia Pereira',
    description: 'Hochrisiko-KI-System ohne vollständige Konformitätsbewertung im Einsatz.',
  },
  {
    id: 'ob-5',
    title: 'Transparenzhinweis für Support-Chatbot ergänzen',
    framework: 'EU AI Act Art. 52',
    status: 'low',
    dueDate: '10.07.2026',
    owner: 'Lena Vogel',
    description: 'Nutzer müssen klar erkennen, dass „Kodee" ein KI-System ist.',
  },
  {
    id: 'ob-6',
    title: 'TOM-Dokumentation jährlich prüfen',
    framework: 'DSGVO Art. 32',
    status: 'passed',
    dueDate: '01.01.2027',
    owner: 'Markus Brandt',
    description: 'Technische und organisatorische Maßnahmen wurden für 2026 geprüft und freigegeben.',
  },
  {
    id: 'ob-7',
    title: 'Auftragsverarbeitungsverträge (AVV) prüfen',
    framework: 'DSGVO Art. 28',
    status: 'medium',
    dueDate: '15.08.2026',
    owner: 'Tarek Younes',
    description: 'Neue Sub-Prozessoren benötigen aktualisierte AVV-Dokumente.',
  },
  {
    id: 'ob-8',
    title: 'Schulung „EU AI Act Grundlagen" für Produktteam',
    framework: 'EU AI Act Art. 4',
    status: 'low',
    dueDate: '30.09.2026',
    owner: 'Sofia Pereira',
    description: 'KI-Kompetenz-Schulung für alle Mitarbeitenden, die KI-Systeme entwickeln oder betreiben.',
  },
];

export const NAV_GROUPS = [
  {
    label: 'Übersicht',
    items: [
      { id: 'home', label: 'Home', to: '/os/app' },
      { id: 'websites', label: 'Websites', to: '/os/app/websites' },
      { id: 'risks', label: 'Risiken', to: '/os/app/risks' },
    ],
  },
  {
    label: 'Governance',
    items: [
      { id: 'compliance', label: 'Compliance', to: '/os/app/compliance' },
      { id: 'evidence', label: 'Evidence Vault', to: '/os/app/evidence' },
      { id: 'monitoring', label: 'Monitoring', to: '/os/app/monitoring' },
      { id: 'ai-usecases', label: 'AI Use Cases', to: '/os/app/ai-usecases' },
      { id: 'agents', label: 'Agenten', to: '/os/app/agents' },
      { id: 'reports', label: 'Reports', to: '/os/app/reports' },
    ],
  },
  {
    label: 'Organisation',
    items: [
      { id: 'team', label: 'Team', to: '/os/app/team' },
      { id: 'billing', label: 'Billing', to: '/os/app/billing' },
      { id: 'settings', label: 'Einstellungen', to: '/os/app/settings' },
    ],
  },
];
