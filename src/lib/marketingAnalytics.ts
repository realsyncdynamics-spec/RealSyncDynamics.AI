// Marketing Performance Analytics — Client-SDK.
//
// Sendet sanitisierte Funnel-Events an die Supabase-Edge-Function
// `marketing-event`. Fire-and-forget: niemals Rendering blockieren.

import { sanitizeMetadata } from '../core/marketing-analytics/sanitizeMetadata';
import type {
  MarketingEvent,
  MarketingEventName,
} from '../core/marketing-analytics/types';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '') as string;
const ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/marketing-event` : null;
const ENABLED = Boolean(ENDPOINT) && import.meta.env.PROD;

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

  const payload: MarketingEvent = {
    event_name,
    session_hash: getOrCreateSession(),
    referrer_host: referrerHost(),
    ...readUtm(),
    ...extra,
    metadata: sanitizeMetadata(extra.metadata),
  };

  try {
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => { /* swallow */ });
  } catch {
    /* swallow */
  }
}
