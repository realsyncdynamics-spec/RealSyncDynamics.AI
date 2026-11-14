import {
  getImplementation,
  STATUS_LABEL,
  type ImplementationStatus,
} from '../../../product/implementation-status';
import { COMPANY } from '../../../config/company';
import { ADDONS, formatNetVatGrossEur, PLANS, pricingTaxNote, type PricingTaxMode } from '@/shared/pricing';

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
 * Preise: nur das Voice-Add-on aus `shared/pricing.ts` (`voiceAddonOffer`).
 * Die Voice-Pakete der Onboarding-Seite (Starter/Professional/Kanzlei) stehen
 * nicht in der SSoT und erscheinen hier ohne Preis (AGENTS.md).
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
    // Telefonie ist `voice-telephony` (Coming Soon): Texte versprechen keine
    // laufende Telefonannahme. Live/Preview ist nur das Onboarding.
    headline: 'Telefonannahme in Vorbereitung.',
    description: 'Anrufe annehmen, Termine notieren, Notfälle übergeben – Branche und Stimme legen Sie schon im Onboarding fest.',
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

export interface VoiceAddonOffer {
  /** Folgt dem Steuermodus: EXEMPT „150 €“, EU_STANDARD „150 € netto zzgl. 19 % USt (178,50 € brutto)“. */
  price: string;
  /** Zusatz aus der SSoT, z. B. „/ Monat zzgl. 0,25 € pro Minute“. */
  priceNote: string;
  /** Pläne, zu denen das Add-on angeboten wird (Namen aus `PLANS`). */
  planNames: string[];
  /** Steuerhinweis für `COMPANY.taxMode` (bei EXEMPT der § 19-Hinweis). */
  taxNote: string;
}

/**
 * Preis des Voice-Add-ons ausschließlich aus `shared/pricing.ts`.
 * Netto/USt/Brutto bzw. § 19 UStG folgen `PRICING_TAX_MODE` – hier wird
 * kein Steuertext hart codiert. Fehlt das Add-on, gibt es keinen Preis.
 */
export function voiceAddonOffer(mode: PricingTaxMode = COMPANY.taxMode): VoiceAddonOffer | null {
  const addon = ADDONS.find((a) => a.id === 'voice');
  if (!addon) return null;
  return {
    price: formatNetVatGrossEur(addon.priceEur, mode),
    priceNote: addon.priceNote,
    planNames: addon.availableFor.map((id) => PLANS.find((p) => p.id === id)?.name ?? id),
    taxNote: pricingTaxNote(mode),
  };
}
