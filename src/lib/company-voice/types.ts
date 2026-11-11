/**
 * Öffentliche Unternehmensinfos für die Landing-Demo.
 * Keine Telefonie, keine privaten Dokumente, keine Bucket-Inhalte.
 */

export const PUBLIC_FACT_IDS = [
  'company.founder',
  'company.legalForm',
  'company.tradeRegisteredOn',
  'company.seat',
  'product.summary',
  'product.boundaries',
  'pricing.selfService',
  'pricing.freeAudit',
  'service.webdesign',
  'timeManager.publicNote',
] as const;

export type PublicFactId = (typeof PUBLIC_FACT_IDS)[number];

/** Preise und Identität bleiben an der Repo-Quelle. Nur diese ID darf der Second Brain ergänzen. */
export const REMOTE_ADDABLE_FACT_ID = 'timeManager.publicNote' satisfies PublicFactId;

export type FactOrigin = 'curated' | 'second-brain';

export interface PublicFact {
  id: PublicFactId;
  text: string;
  origin: FactOrigin;
}

export type FactsSource = 'curated' | 'second-brain-staging';

export interface CompanyVoicePayload {
  ok: true;
  source: FactsSource;
  /** Generative KI ist in diesem Stand immer aus. */
  ai: 'disabled';
  facts: PublicFact[];
  disclaimer: string;
}

export interface AnswerContext {
  /** Entspricht `BETA.active && BETA.publicOffer` auf der Startseite. */
  publicBeta?: boolean;
  betaEndsLabel?: string;
}

export interface CompanyAnswer {
  covered: boolean;
  text: string;
  link?: { href: string; label: string };
  usedFactIds: readonly PublicFactId[];
}

export interface CompanyVoiceEnv {
  SECOND_BRAIN_STAGING_URL?: string;
  SECOND_BRAIN_READ_ENABLED?: string;
  /** Vorbereitet, schaltet in diesem Stand keinen Modellaufruf frei. */
  SECOND_BRAIN_AI_ENABLED?: string;
}

export const COMPANY_VOICE_DISCLAIMER =
  'Keine Rechtsberatung und keine Konformitätszusage. Antworten nur aus freigegebenen Unternehmensinfos.';

export const CONTACT_PATH = '/kontakt';
export const PRICING_HREF = '#preise';
export const WEBDESIGN_HREF = '/contact-sales?intent=webdesign';
export const WEBDESIGN_LINK_LABEL = 'Individuelles Webdesign anfragen';
