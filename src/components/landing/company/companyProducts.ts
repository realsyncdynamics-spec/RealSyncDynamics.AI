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
  /** Design-Token der Produktfarbe (company-landing-v5.css, `.rsl5`). */
  accentVar: '--product-governance' | '--product-voice' | '--product-sites';
  /** Farbname für Legende und Screenreader – Farbe nie allein (WCAG 1.4.1). */
  colorName: string;
  /** Anker-ID ohne `#`: Abschnitt (Governance) bzw. Deep-Link auf den Dialog. */
  anchor: string;
}

/**
 * Statusform unabhängig von der Produktfarbe (G2-Freigabe 05.11.2026, E3):
 * Live = gefüllter Punkt · Preview = Ring · Coming Soon = Strich, immer mit Text.
 */
export const STATUS_TAG_CLASS: Record<ImplementationStatus, string> = {
  live: 'tag st-live',
  preview: 'tag st-preview',
  'coming-soon': 'tag st-coming-soon',
};

/** Klasse des Status-Symbols (Punkt/Ring/Strich) für Badges und Statusleiste. */
export const STATUS_DOT_CLASS: Record<ImplementationStatus, string> = {
  live: 'sdot st-live',
  preview: 'sdot st-preview',
  'coming-soon': 'sdot st-coming-soon',
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
    accentVar: '--product-governance',
    colorName: 'Gold',
    anchor: 'p-os',
  }),
  product({
    id: 'voice',
    ssotId: 'voice-agent-onboarding',
    name: 'Voice Agent',
    tabName: 'Voice Agent',
    headline: 'Kein Anruf geht verloren.',
    description: 'Nimmt Anrufe an, notiert Termine, übergibt Notfälle an Sie.',
    accentVar: '--product-voice',
    colorName: 'Blau',
    anchor: 'voice-agent',
  }),
  product({
    id: 'builder',
    ssotId: 'public-frontend-builder',
    name: 'Landingpage Builder',
    tabName: 'Landingpage Builder',
    headline: 'Ihre Webseite, fertig.',
    description: 'Mit Impressum und Datenschutz – von uns gebaut oder selbst im Builder.',
    accentVar: '--product-sites',
    colorName: 'Pink',
    anchor: 'sites',
  }),
];

export function companyProduct(id: CompanyProductId): CompanyProduct {
  return COMPANY_PRODUCTS.find((p) => p.id === id)!;
}

/**
 * Deep-Links auf den Produkt-Dialog: `#voice-agent` → Tab 1, `#sites` → Tab 2.
 * Governance (`#p-os`) ist ein Abschnitt der Seite und öffnet keinen Dialog.
 * Liefert den Tab-Index oder `-1`.
 */
export function dialogTabForHash(hash: string): number {
  const id = hash.replace(/^#/, '');
  if (!id) return -1;
  return COMPANY_PRODUCTS.findIndex((p) => p.id !== 'governance' && p.anchor === id);
}
