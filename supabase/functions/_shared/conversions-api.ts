// Server-side conversion fan-out — Meta CAPI + Google Ads Enhanced Conversions + TikTok Events API.
//
// Warum server-side?
// - iOS 14.5+ ATT blockt clientseitige Pixel
// - Ad-Blocker blockieren `fbevents.js` / `analytics.tiktok.com`
// - Webhooks feuern garantiert — keine verlorenen Purchase-Events durch Browser-Close
//
// Wann verwenden?
// Bei Server-bestätigten Events (Stripe webhook). Für Client-Events (Lead, ViewContent)
// bleibt clientseitiges Tracking in `src/lib/pixels.ts` ausreichend.
//
// Event-Dedup: Jeder Call hier sollte dieselbe `eventId` wie ein potentieller
// Client-Pixel-Event nutzen (z.B. Stripe `session.id`), damit Meta dedupliziert.

import { sha256Hex } from './hash.ts';

export interface ServerConversion {
  /** Standard event name (Meta) — maps to other platforms internally. */
  eventName: 'Purchase' | 'Subscribe' | 'CompleteRegistration';
  /** Unique event ID for deduplication across client + server pixels. */
  eventId: string;
  /** Unix seconds, when the event happened. */
  eventTime: number;
  /** Monetary value (after tax). */
  value: number;
  /** ISO 4217. */
  currency: string;
  /** User identifiers — will be SHA256-hashed before send. */
  user: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    city?: string;
    country?: string; // 2-letter ISO
    /** Pass-through if available — improves match quality but unhashed. */
    clientIp?: string;
    userAgent?: string;
    /** Meta fbp/fbc click-IDs from the Stripe session URL params if forwarded. */
    fbp?: string;
    fbc?: string;
  };
  /** Source URL (e.g. successUrl). */
  sourceUrl?: string;
}

async function hashOrUndef(v: string | undefined): Promise<string | undefined> {
  if (!v) return undefined;
  return sha256Hex(v.trim().toLowerCase());
}

/** Meta Conversions API — https://developers.facebook.com/docs/marketing-api/conversions-api */
async function sendMeta(event: ServerConversion): Promise<void> {
  const PIXEL_ID = Deno.env.get('META_PIXEL_ID');
  const ACCESS_TOKEN = Deno.env.get('META_CAPI_ACCESS_TOKEN');
  if (!PIXEL_ID || !ACCESS_TOKEN) return;

  const user_data: Record<string, unknown> = {
    em: event.user.email ? [await hashOrUndef(event.user.email)] : undefined,
    ph: event.user.phone ? [await hashOrUndef(event.user.phone)] : undefined,
    fn: await hashOrUndef(event.user.firstName),
    ln: await hashOrUndef(event.user.lastName),
    ct: await hashOrUndef(event.user.city),
    country: await hashOrUndef(event.user.country),
    client_ip_address: event.user.clientIp,
    client_user_agent: event.user.userAgent,
    fbp: event.user.fbp,
    fbc: event.user.fbc,
  };
  for (const k of Object.keys(user_data)) if (user_data[k] === undefined) delete user_data[k];

  const body = {
    data: [{
      event_name: event.eventName,
      event_id: event.eventId,
      event_time: event.eventTime,
      action_source: 'website',
      event_source_url: event.sourceUrl,
      user_data,
      custom_data: { currency: event.currency, value: event.value },
    }],
  };

  const url = `https://graph.facebook.com/v20.0/${PIXEL_ID}/events?access_token=${encodeURIComponent(ACCESS_TOKEN)}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    console.warn('[conversions-api] meta send failed:', resp.status, await resp.text());
  }
}

/** Google Ads Enhanced Conversions for Web — uses gtag-compatible payload via Google Ads API. */
async function sendGoogleAds(event: ServerConversion): Promise<void> {
  // Google Ads server-side Enhanced Conversions need the Customer ID + Developer Token +
  // an OAuth2 refresh-token flow. Implementation deferred until we have those credentials.
  // The clientside path (src/lib/pixels.ts → gtag conversion) covers ~70% of attribution
  // and Google Ads automatically deduplicates with Enhanced Conversions if added later.
  void event;
}

/** TikTok Events API — https://business-api.tiktok.com/portal/docs?id=1771101303285761 */
async function sendTikTok(event: ServerConversion): Promise<void> {
  const PIXEL_CODE = Deno.env.get('TIKTOK_PIXEL_ID');
  const ACCESS_TOKEN = Deno.env.get('TIKTOK_EVENTS_API_TOKEN');
  if (!PIXEL_CODE || !ACCESS_TOKEN) return;

  const eventNameMap: Record<ServerConversion['eventName'], string> = {
    Purchase: 'CompletePayment',
    Subscribe: 'Subscribe',
    CompleteRegistration: 'CompleteRegistration',
  };

  const body = {
    event_source: 'web',
    event_source_id: PIXEL_CODE,
    data: [{
      event: eventNameMap[event.eventName],
      event_time: event.eventTime,
      event_id: event.eventId,
      user: {
        email: await hashOrUndef(event.user.email),
        phone: await hashOrUndef(event.user.phone),
        ip: event.user.clientIp,
        user_agent: event.user.userAgent,
      },
      properties: {
        currency: event.currency,
        value: event.value,
      },
      page: { url: event.sourceUrl },
    }],
  };

  const resp = await fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Access-Token': ACCESS_TOKEN },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    console.warn('[conversions-api] tiktok send failed:', resp.status, await resp.text());
  }
}

/**
 * Fan-out to all configured ad platforms. Errors per-platform are logged
 * but do not propagate — one failed pixel must not roll back the Stripe sync.
 */
export async function reportServerConversion(event: ServerConversion): Promise<void> {
  await Promise.allSettled([
    sendMeta(event),
    sendGoogleAds(event),
    sendTikTok(event),
  ]);
}
