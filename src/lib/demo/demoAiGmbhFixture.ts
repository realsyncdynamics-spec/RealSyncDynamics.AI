/**
 * Demo-Workspace-Fixture für "DemoAI GmbH" — öffentliche read-only Vorschau.
 *
 * Alle Daten sind statisch und nicht-sensibel. Sie demonstrieren das
 * Governance OS in Echtzeit-Ansicht ohne Login.
 *
 * Wird verwendet für:
 * - PublicWorkspacePreview bei Demo-Session
 * - Read-only Wrapper für /app/* Routes
 * - Registrierungs-Prompts bei gesperrten Aktionen
 */

export interface AiSystem {
  id: string;
  name: string;
  class: 'high-risk' | 'limited-risk' | 'minimal-risk';
  status: 'compliant' | 'non-compliant' | 'in-progress';
  description: string;
}

export interface Risk {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  source: 'dsgvo' | 'ai-act' | 'vendor' | 'internal';
  status: 'open' | 'in-progress' | 'resolved';
  daysOpen: number;
}

export interface Scan {
  id: string;
  domain: string;
  timestamp: string;
  findingsCount: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface DemoWorkspace {
  org: {
    name: string;
    governanceScore: number;
    trend: number;
    description: string;
  };
  aiSystems: AiSystem[];
  risks: Risk[];
  monitoring: {
    scansLast24h: number;
    newTrackersDetected: number;
    consentDrifts: number;
    lastScanAt: string;
  };
  compliance: {
    dsgvo: { percent: number; open: number };
    aiAct: { percent: number; open: number };
  };
}

export const DEMO_AI_GMBH: DemoWorkspace = {
  org: {
    name: 'DemoAI GmbH',
    governanceScore: 74,
    trend: 8,
    description: 'Beispielorganisation zur Demonstration des Governance OS',
  },
  aiSystems: [
    {
      id: 'ai-001',
      name: 'GPT-4-basierter Kundenservice-Bot',
      class: 'high-risk',
      status: 'non-compliant',
      description: 'Automatisierte Kundenunterstützung mit externem LLM-Provider',
    },
    {
      id: 'ai-002',
      name: 'Interne Recruiting-KI',
      class: 'limited-risk',
      status: 'compliant',
      description: 'Kandidaten-Screening und Job-Matching-System',
    },
    {
      id: 'ai-003',
      name: 'Produkt-Empfehlungs-Engine',
      class: 'minimal-risk',
      status: 'compliant',
      description: 'Personalisierte Produktempfehlungen auf Website',
    },
  ],
  risks: [
    {
      id: 'risk-001',
      severity: 'critical',
      title: 'Meta Pixel: Drittlandtransfer undokumentiert',
      source: 'dsgvo',
      status: 'in-progress',
      daysOpen: 3,
    },
    {
      id: 'risk-002',
      severity: 'high',
      title: 'Google Analytics ohne gültigen DPA',
      source: 'dsgvo',
      status: 'open',
      daysOpen: 14,
    },
    {
      id: 'risk-003',
      severity: 'high',
      title: 'Chatbot: Kein Transparenzhinweis auf KI-Nutzung',
      source: 'ai-act',
      status: 'open',
      daysOpen: 7,
    },
    {
      id: 'risk-004',
      severity: 'medium',
      title: 'Sub-Prozessor Stripe: AVV veraltet (Q1/2026)',
      source: 'vendor',
      status: 'in-progress',
      daysOpen: 5,
    },
    {
      id: 'risk-005',
      severity: 'medium',
      title: 'Recruiting-KI: Bias-Assessment fehlt',
      source: 'ai-act',
      status: 'open',
      daysOpen: 21,
    },
    {
      id: 'risk-006',
      severity: 'medium',
      title: 'Consent-Banner: Opt-out nicht prominent',
      source: 'dsgvo',
      status: 'resolved',
      daysOpen: 0,
    },
    {
      id: 'risk-007',
      severity: 'low',
      title: 'Datenschutzerklärung: Recruiting-KI-Kapitel outdated',
      source: 'dsgvo',
      status: 'open',
      daysOpen: 30,
    },
  ],
  monitoring: {
    scansLast24h: 4,
    newTrackersDetected: 2,
    consentDrifts: 1,
    lastScanAt: new Date(Date.now() - 18 * 60000).toISOString(), // 18 Minuten ago
  },
  compliance: {
    dsgvo: { percent: 78, open: 4 },
    aiAct: { percent: 61, open: 3 },
  },
};
