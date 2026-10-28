// Marketing Performance Analytics — Client-SDK.
//
// Sendet sanitisierte Funnel-Events an die Supabase-Edge-Function
// `marketing-event`. Fire-and-forget: niemals Rendering blockieren.
//
// Wichtig:
// - Nur nach ausdrücklicher Cookie-Einwilligung (Statistik oder Marketing
//   in `realsync.cookie-consent.v1`).
// - `tenant_id` wird NIE im Body mitgeschickt. Das Backend leitet sie aus dem
//   Authorization-Header (User-JWT → memberships) ab; anonyme Visitor-Events
//   haben `tenant_id = NULL`.

import { getSupabase } from './supabase';
import { sanitizeMetadata } from '../core/marketing-analytics/sanitizeMetadata';
import type {
  MarketingEvent,
  MarketingEventName,
} from '../core/marketing-analytics/types';
import { getSupabaseUrl } from './supabaseUrl';

const SUPABASE_URL = getSupabaseUrl();
const ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/marketing-event` : null;
// PROD-only by default. Set VITE_MARKETING_ANALYTICS_ENABLED=1 to also collect
// in staging/preview builds so funnel changes can be validated pre-prod.
const FORCE_ON = String(import.meta.env.VITE_MARKETING_ANALYTICS_ENABLED ?? '') === '1';
const ENABLED = Boolean(ENDPOINT) && (import.meta.env.PROD || FORCE_ON);

const CONSENT_STORAGE_KEY = 'realsync.cookie-consent.v1';
const CONSENT_VERSION = 1;
const SESSION_KEY = 'realsync.marketing-session.v1';
export const TTFE_START_STORAGE_KEY = 'realsync.ttfe-start.v1';

export type TimeToFirstEvidenceMilestone =
  | 'activation_started'
  | 'organization_saved'
  | 'scope_saved'
  | 'ai_setup_saved'
  | 'first_evidence_ready';

export interface TimeToFirstEvidenceRecord {
  milestone: TimeToFirstEvidenceMilestone;
  recordedAt: string;
  elapsedMs: number | null;
}

/**
 * Prüft, ob der Nutzer in `realsync.cookie-consent.v1` Statistik- oder
 * Marketing-Cookies zugestimmt hat. Ohne Einwilligung findet kein Tracking
 * und keine Session-/Zeitstempel-Speicherung statt.
 */
export function hasMarketingAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as {
      version?: number;
      analytics?: boolean;
      marketing?: boolean;
    };
    const version = typeof parsed.version === 'number' ? parsed.version : 1;
    if (version < CONSENT_VERSION) return false;
    return parsed.analytics === true || parsed.marketing === true;
  } catch {
    return false;
  }
}

function getOrCreateSession(): string {
  if (typeof window === 'undefined') return '';
  try {
    let v = sessionStorage.getItem(SESSION_KEY);
    if (!v) {
      v = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, v);
    }
    return v;
  } catch {
    return '';
  }
}

function readUtm(): Pick<MarketingEvent, 'utm_source' | 'utm_medium' | 'utm_campaign'> {
  if (typeof window === 'undefined') return {};
  const p = new URLSearchParams(window.location.search);
  const out: Record<string, string> = {};
  const s = p.get('utm_source') ?? p.get('source');
  const m = p.get('utm_medium');
  const c = p.get('utm_campaign');
  if (s) out.utm_source = s.slice(0, 100);
  if (m) out.utm_medium = m.slice(0, 100);
  if (c) out.utm_campaign = c.slice(0, 100);
  return out;
}

function referrerHost(): string | undefined {
  if (typeof document === 'undefined' || !document.referrer) return undefined;
  try { return new URL(document.referrer).host.slice(0, 200); } catch { return undefined; }
}

/**
 * Sendet ein Marketing-Event an die Runtime. Best-effort und strikt
 * consent-gegated.
 *
 * Beispiel:
 *   trackMarketingEvent('checkout_started', { plan_key: 'pro_monthly', event_value: 49 });
 */
export function trackMarketingEvent(
  event_name: MarketingEventName,
  extra: Partial<MarketingEvent> = {},
): void {
  if (!hasMarketingAnalyticsConsent()) return;
  if (!ENABLED || !ENDPOINT) return;

  // Strip server-derived fields if a caller accidentally supplies them.
  const { tenant_id: _t, user_id: _u, ...safeExtra } = extra;

  const payload: MarketingEvent = {
    event_name,
    session_hash: getOrCreateSession(),
    referrer_host: referrerHost(),
    ...readUtm(),
    ...safeExtra,
    metadata: sanitizeMetadata(safeExtra.metadata),
  };

  void send(payload);
}

/**
 * Merkt den Startzeitpunkt für Time-to-First-Evidence in `sessionStorage`
 * (nur nach erteiltem Cookie-Consent). Existiert bereits ein Startwert in der
 * Sitzung, bleibt dieser erhalten.
 */
export function markTimeToFirstEvidenceStart(nowIso?: string): string | null {
  if (!hasMarketingAnalyticsConsent() || typeof window === 'undefined') return null;
  try {
    const existing = sessionStorage.getItem(TTFE_START_STORAGE_KEY);
    if (existing && Number.isFinite(Date.parse(existing))) {
      return existing;
    }
    const stamp = nowIso ?? new Date().toISOString();
    sessionStorage.setItem(TTFE_START_STORAGE_KEY, stamp);
    return stamp;
  } catch {
    return null;
  }
}

/**
 * Erfasst einen Zeitstempel für Time-to-First-Evidence im kanonischen
 * Onboarding-/Activation-Pfad (nur nach Cookie-Consent).
 */
export function recordTimeToFirstEvidence(
  milestone: TimeToFirstEvidenceMilestone,
  stepNumber?: number,
  nowIso?: string,
): TimeToFirstEvidenceRecord | null {
  if (!hasMarketingAnalyticsConsent()) return null;
  const recordedAt = nowIso ?? new Date().toISOString();
  const startedAt = markTimeToFirstEvidenceStart(recordedAt);
  const startMs = startedAt ? Date.parse(startedAt) : NaN;
  const endMs = Date.parse(recordedAt);
  const elapsedMs =
    Number.isFinite(startMs) && Number.isFinite(endMs)
      ? Math.max(0, endMs - startMs)
      : null;

  trackMarketingEvent('audit_completed', {
    occurred_at: recordedAt,
    metadata: {
      funnel: 'canonical_onboarding',
      ttfe_milestone: milestone,
      ttfe_recorded_at: recordedAt,
      ...(elapsedMs !== null ? { ttfe_elapsed_ms: elapsedMs } : {}),
      ...(stepNumber !== undefined ? { activation_step: stepNumber } : {}),
    },
  });

  return {
    milestone,
    recordedAt,
    elapsedMs,
  };
}

async function send(payload: MarketingEvent): Promise<void> {
  if (!ENDPOINT) return;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const { data } = await getSupabase().auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch { /* anon visitor — fine */ }

  try {
    await fetch(ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch { /* swallow — tracking must never break the app */ }
}
