/**
 * Gemeinsame Typen fuer die Promotion-Engine. Alle Content-Module
 * exportieren Arrays dieser Typen — so kann ein spaeterer Posting-
 * Bot oder Newsletter-Generator die Inhalte typsicher laden.
 *
 * KEINE Auto-Posting-Logik in diesem Verzeichnis — nur Inhalte.
 */

export type Channel =
  | 'linkedin'
  | 'youtube_shorts'
  | 'cold_email'
  | 'newsletter'
  | 'seo_landing';

export type Persona =
  | 'founder'
  | 'dsb_external'
  | 'dsb_internal'
  | 'agency_owner'
  | 'kanzlei'
  | 'kmu_geschaeftsfuehrung'
  | 'compliance_lead'
  | 'developer';

export type ContentTheme =
  | 'evidence_runtime'
  | 'real_finding'
  | 'ai_act'
  | 'dsgvo_risk'
  | 'consent_timing'
  | 'agent_governance'
  | 'founder_learning'
  | 'partner_program';

export type CTAKey =
  | 'free_audit'
  | 'pricing'
  | 'partners'
  | 'docs_evidence'
  | 'contact_sales';

/**
 * Single Source of Truth fuer alle CTAs der Promotion-Engine.
 * Wer einen neuen Posting-Channel anbindet, mapped diesen Key auf
 * eine vollstaendige URL — keine inline-Strings im Content.
 */
export const CTA_TARGETS: Record<CTAKey, { label: string; href: string }> = {
  free_audit:     { label: 'Kostenlosen Check starten', href: '/audit' },
  pricing:        { label: 'Pläne ansehen',             href: '/pricing' },
  partners:       { label: 'Partner-Pilot anfragen',    href: '/partners' },
  docs_evidence:  { label: 'Evidence-Modell lesen',     href: '/evidence' },
  contact_sales:  { label: 'Sales kontaktieren',        href: '/contact-sales' },
};

export interface ContentAsset {
  id: string;
  channel: Channel;
  theme: ContentTheme;
  persona: Persona[];
  cta: CTAKey;
}
