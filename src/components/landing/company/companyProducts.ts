import {
  getImplementation,
  STATUS_LABEL,
  type ImplementationStatus,
} from '../../../product/implementation-status';

/**
 * Produkte der Unternehmens-Landing v5 (/unternehmen).
 *
 * Texte aus `design_handoff_realsync_v5/reference/RealSync Dynamics v5.html`;
 * der Status kommt ausschließlich aus `src/product/implementation-status.ts`:
 * - Governance OS      → `app-shell` (Governance OS /app)
 * - Voice Agent        → `voice-agent-onboarding` (Konfigurator; Telefonie
 *                        selbst bleibt `voice-telephony`, Coming Soon)
 * - Landingpage Builder → `public-frontend-builder`
 *
 * Preise erscheinen hier bewusst nicht: Die Voice-Pakete der Onboarding-Seite
 * stehen nicht in `shared/pricing.ts` (AGENTS.md: Preise nur aus der SSoT).
 */

export type CompanyProductId = 'governance' | 'voice' | 'builder';

export interface CompanyProduct {
  id: CompanyProductId;
  /** Eintrag in implementation-status.ts */
  ssotId: string;
  name: string;
  /** Name im Dialog-Tab */
  tabName: string;
  headline: string;
  description: string;
  status: ImplementationStatus;
  statusLabel: string;
}

/** Tag-Stil wie im Handoff: Live gold · Preview gestrichelt · Coming Soon grau. */
export const STATUS_TAG_CLASS: Record<ImplementationStatus, string> = {
  live: 'tag',
  preview: 'tag dash',
  'coming-soon': 'tag gray',
};

/** Ziele der Referenz (`MAP`), relativ auf der Hauptdomain. */
export const COMPANY_LINKS = {
  platform: '/demo-tour/dashboard',
  audit: '/audit',
  builder: '/frontend-builder',
  login: '/login',
  impressum: '/impressum',
  datenschutz: '/datenschutz',
  agb: '/agb',
  widerruf: '/widerruf',
  avv: '/legal/avv',
  subProcessors: '/legal/sub-processors',
  /** Externe Subdomain → neuer Tab (Owner-Freigabe 03.11.2026). */
  voiceOnboarding: 'https://voice.realsyncdynamicsai.de/onboarding.html',
} as const;

function statusOf(ssotId: string): ImplementationStatus {
  const item = getImplementation(ssotId);
  // Fail-closed: fehlt der Eintrag, wird nichts als live dargestellt.
  return item?.status ?? 'coming-soon';
}

function product(p: Omit<CompanyProduct, 'status' | 'statusLabel'>): CompanyProduct {
  const status = statusOf(p.ssotId);
  return { ...p, status, statusLabel: STATUS_LABEL[status] };
}

export const COMPANY_PRODUCTS: readonly CompanyProduct[] = [
  product({
    id: 'governance',
    ssotId: 'app-shell',
    name: 'Governance OS',
    tabName: 'The Governance OS',
    headline: 'KI kontrolliert einsetzen.',
    description: 'Jede KI-Aktion wird geprüft und protokolliert – mit Regeln für DSGVO und EU AI Act.',
  }),
  product({
    id: 'voice',
    ssotId: 'voice-agent-onboarding',
    name: 'Voice Agent',
    tabName: 'Voice Agent',
    headline: 'Kein Anruf geht verloren.',
    description: 'Nimmt Anrufe an, notiert Termine, übergibt Notfälle an Sie.',
  }),
  product({
    id: 'builder',
    ssotId: 'public-frontend-builder',
    name: 'Landingpage Builder',
    tabName: 'Landingpage Builder',
    headline: 'Ihre Webseite, fertig.',
    description: 'Mit Impressum und Datenschutz – von uns gebaut oder selbst im Builder.',
  }),
];

export function companyProduct(id: CompanyProductId): CompanyProduct {
  return COMPANY_PRODUCTS.find((p) => p.id === id)!;
}
