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
 * Voice-Listenpreise stehen nicht in `shared/pricing.ts`. Die Anzeige im
 * Produkt-Dialog kommt aus `voiceListPrices.ts` (veröffentlichte Produktmappe,
 * kein Checkout).
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
    headline: 'KI sicher einsetzen.',
    description: 'Jede KI-Aktion wird geprüft und protokolliert – nach DSGVO und EU AI Act.',
  }),
  product({
    id: 'voice',
    ssotId: 'voice-agent-onboarding',
    name: 'Voice Agent',
    tabName: 'Voice Agent',
    headline: 'Anliegen aufnehmen.',
    description: 'Web-Konfigurator als Vorschau. Telefonie ist in Vorbereitung – kein zugesagter Anruf, keine feste Terminbuchung.',
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
