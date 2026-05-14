// Marketing Performance Analytics — Client-SDK.
//
// Sendet sanitisierte Funnel-Events an die Supabase-Edge-Function
// `marketing-event`. Fire-and-forget: niemals Rendering blockieren.
//
// Wichtig: tenant_id wird NIE im Body mitgeschickt. Das Backend leitet
// sie aus dem Authorization-Header (User-JWT → memberships) ab; anonyme
// Visitor-Events haben tenant_id = NULL.

import { getSupabase } from './supabase';
import { sanitizeMetadata } from '../core/marketing-analytics/sanitizeMetadata';
import type {
  MarketingEvent,
  MarketingEventName,
} from '../core/marketing-analytics/types';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '') as string;
const ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/marketing-event` : null;
// PROD-only by default. Set VITE_MARKETING_ANALYTICS_ENABLED=1 to also collect
// in staging/preview builds so funnel changes can be validated pre-prod.
const FORCE_ON = String(import.meta.env.VITE_MARKETING_ANALYTICS_ENABLED ?? '') === '1';
const ENABLED = Boolean(ENDPOINT) && (import.meta.env.PROD || FORCE_ON);

const SESSION_KEY = 'realsync.marketing-session.v1';

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
 * Sendet ein Marketing-Event an die Runtime. Best-effort.
 *
 * Beispiel:
 *   trackMarketingEvent('checkout_started', { plan_key: 'pro_monthly', event_value: 49 });
 */
export function trackMarketingEvent(
  event_name: MarketingEventName,
  extra: Partial<MarketingEvent> = {},
): void {
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
