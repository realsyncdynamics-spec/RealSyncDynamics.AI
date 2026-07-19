// Marketing Performance Analytics Runtime — gemeinsame Typen.
//
// Hinweis: Compliance-Findings dieser Runtime sind technische Heuristiken
// zur internen Qualitaetskontrolle und stellen KEINE Rechtsberatung dar.

export type MarketingEventName =
  | 'page_view'
  | 'lead_captured'
  | 'audit_started'
  | 'audit_completed'
  | 'pricing_viewed'
  | 'checkout_started'
  | 'checkout_completed'
  | 'subscription_cancelled';

export type AttributionModel = 'last_touch' | 'first_touch' | 'linear';

export type FindingSeverity = 'info' | 'low' | 'medium' | 'high';

export interface MarketingEvent {
  event_name: MarketingEventName;
  event_value?: number;
  currency?: string;
  plan_key?: string;
  addons?: string[];
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer_host?: string;
  session_hash?: string;
  user_id?: string;
  tenant_id?: string;
  metadata?: Record<string, unknown>;
  occurred_at?: string;
}

export interface AttributionTouchpoint {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  occurred_at: string;
}

export interface AttributionSession {
  session_hash: string;
  touchpoints: AttributionTouchpoint[];
  revenue_eur: number;
  converted: boolean;
}

export interface AttributionSnapshot {
  model: AttributionModel;
  window_start: string;
  window_end: string;
  rows: AttributionRow[];
}

export interface AttributionRow {
  utm_source: string;
  utm_medium?: string;
  utm_campaign?: string;
  touchpoints: number;
  conversions: number;
  revenue_eur: number;
}

export interface ComplianceFinding {
  rule_id: string;
  severity: FindingSeverity;
  summary: string;
  evidence: Record<string, unknown>;
}

export interface AnomalyResult {
  isAnomaly: boolean;
  value: number;
  mean: number;
  stdDev: number;
  zScore: number;
}

/**
 * Klarstellung fuer UI/Reports: Compliance-Auswertungen der Runtime sind
 * Werkzeug-Output, keine Rechtsberatung. Immer im Report zeigen.
 */
export const COMPLIANCE_DISCLAIMER =
  'Diese Auswertung ist eine technische Heuristik und stellt keine Rechtsberatung dar. ' +
  'Fuer rechtsverbindliche Bewertungen wenden Sie sich an qualifizierte Fachleute.';
