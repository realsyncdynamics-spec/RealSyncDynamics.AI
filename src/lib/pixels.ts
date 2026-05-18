// Marketing-Pixel-Loader — DSGVO-konform via Consent-Gating.
//
// Lädt externe Tracking-Pixel (Meta, TikTok, GA4, Google Ads, LinkedIn)
// AUSSCHLIESSLICH nach explizitem Marketing-Consent. Pageview-Tracking via
// `lib/track.ts` (Supabase, kein Cookie) bleibt davon unabhängig.
//
// Pixel-IDs kommen aus Vite-Env-Vars. Fehlt eine ID → Pixel wird übersprungen
// (no-op). So kann jede Plattform unabhängig aktiviert werden.

const STORAGE_KEY = 'realsync.cookie-consent.v1';
const CONSENT_EVENT = 'realsync:consent-changed';

type Consent = {
  decided_at: string;
  necessary: true;
  analytics: boolean;
  marketing: boolean;
};

type StandardEvent =
  | 'PageView'
  | 'Lead'              // Free-Tool genutzt
  | 'CompleteRegistration' // Pro-Trial gestartet
  | 'InitiateCheckout'  // Stripe-Checkout geöffnet
  | 'Purchase';         // Stripe-Checkout completed

type EventPayload = {
  value?: number;
  currency?: string;
  content_name?: string;
  transaction_id?: string;
};

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
    ttq?: { track: (event: string, payload?: Record<string, unknown>) => void; load?: (id: string) => void; page?: () => void };
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    lintrk?: (action: string, payload?: Record<string, unknown>) => void;
    _linkedin_partner_id?: string;
    _linkedin_data_partner_ids?: string[];
  }
}

function readConsent(): Consent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Consent;
  } catch {
    return null;
  }
}

function injectScript(src: string, attrs: Record<string, string> = {}): void {
  const s = document.createElement('script');
  s.src = src;
  s.async = true;
  for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
  document.head.appendChild(s);
}

// ---------- Meta Pixel ----------

function loadMetaPixel(pixelId: string): void {
  if (window.fbq) return;
  /* eslint-disable */
  // @ts-expect-error — Meta-Standard-Snippet (vendor code)
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  const fbq = window.fbq as ((...args: unknown[]) => void) | undefined;
  fbq?.('init', pixelId);
  fbq?.('track', 'PageView');
}

// ---------- TikTok Pixel ----------

function loadTikTokPixel(pixelId: string): void {
  if (window.ttq) return;
  /* eslint-disable */
  // @ts-expect-error — TikTok-Standard-Snippet (vendor code)
  !function (w, d, t) { w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load(e);ttq.page()}(window, document, 'ttq');
  /* eslint-enable */
  const ttq = window.ttq as { load?: (id: string) => void; page?: () => void } | undefined;
  ttq?.load?.(pixelId);
  ttq?.page?.();
}

// ---------- Google: GA4 + Google Ads (gemeinsamer gtag.js) ----------

function loadGoogleTag(ga4Id: string | null, googleAdsId: string | null): void {
  if (window.gtag) {
    // gtag bereits geladen — nur zusätzliche Properties registrieren
    if (ga4Id) window.gtag('config', ga4Id, { anonymize_ip: true });
    if (googleAdsId) window.gtag('config', googleAdsId);
    return;
  }
  const primaryId = ga4Id ?? googleAdsId;
  if (!primaryId) return;

  injectScript(`https://www.googletagmanager.com/gtag/js?id=${primaryId}`);
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag(): void {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };

  // Consent Mode v2 — Default explizit auf granted setzen (Banner hat bereits zugestimmt).
  // Vor Consent würde das Modul nicht aufgerufen, daher hier 'granted'.
  window.gtag('consent', 'default', {
    ad_storage: 'granted',
    ad_user_data: 'granted',
    ad_personalization: 'granted',
    analytics_storage: 'granted',
  });

  window.gtag('js', new Date());
  if (ga4Id) window.gtag('config', ga4Id, { anonymize_ip: true });
  if (googleAdsId) window.gtag('config', googleAdsId);
}

// ---------- LinkedIn Insight Tag ----------

function loadLinkedInInsight(partnerId: string): void {
  if (window.lintrk) return;
  window._linkedin_partner_id = partnerId;
  window._linkedin_data_partner_ids = window._linkedin_data_partner_ids ?? [];
  window._linkedin_data_partner_ids.push(partnerId);
  /* eslint-disable */
  // @ts-expect-error — LinkedIn-Standard-Snippet (vendor code)
  (function(l) { if (!l) {window.lintrk=function(a,b){window.lintrk.q.push([a,b])};window.lintrk.q=[]}var s=document.getElementsByTagName("script")[0];var b=document.createElement("script");b.type="text/javascript";b.async=true;b.src="https://snap.licdn.com/li.lms-analytics/insight.min.js";s.parentNode.insertBefore(b,s)})(window.lintrk);
  /* eslint-enable */
}

// ---------- Public API ----------

let pixelsLoaded = { analytics: false, marketing: false };

/**
 * Lädt Pixel basierend auf Consent. Idempotent — kann beliebig oft aufgerufen werden.
 * Wird automatisch beim Module-Load + bei Consent-Änderungen ausgeführt.
 */
export function applyConsent(): void {
  const consent = readConsent();
  if (!consent) return;

  const env = import.meta.env;
  const META_ID = env.VITE_META_PIXEL_ID as string | undefined;
  const TIKTOK_ID = env.VITE_TIKTOK_PIXEL_ID as string | undefined;
  const GA4_ID = env.VITE_GA4_MEASUREMENT_ID as string | undefined;
  const GADS_ID = env.VITE_GOOGLE_ADS_ID as string | undefined;
  const LINKEDIN_ID = env.VITE_LINKEDIN_PARTNER_ID as string | undefined;

  // Analytics-Kategorie: GA4 (anonyme Nutzungsstatistik)
  if (consent.analytics && !pixelsLoaded.analytics) {
    if (GA4_ID) loadGoogleTag(GA4_ID, null);
    pixelsLoaded.analytics = true;
  }

  // Marketing-Kategorie: alle Conversion- und Remarketing-Pixel
  if (consent.marketing && !pixelsLoaded.marketing) {
    if (META_ID) loadMetaPixel(META_ID);
    if (TIKTOK_ID) loadTikTokPixel(TIKTOK_ID);
    if (GADS_ID) loadGoogleTag(GA4_ID ?? null, GADS_ID);
    if (LINKEDIN_ID) loadLinkedInInsight(LINKEDIN_ID);
    pixelsLoaded.marketing = true;
  }
}

/**
 * Sendet ein Standard-Event an alle geladenen Pixel-Plattformen.
 * Vor Consent / fehlender Pixel-ID = no-op.
 *
 * @example
 *   trackConversion('Lead', { content_name: 'dsgvo_audit' });
 *   trackConversion('Purchase', { value: 149, currency: 'EUR', transaction_id: stripeId });
 */
export function trackConversion(event: StandardEvent, payload: EventPayload = {}): void {
  if (typeof window === 'undefined') return;
  const consent = readConsent();
  if (!consent?.marketing) return;

  // Meta
  if (window.fbq) {
    window.fbq('track', event, payload);
  }

  // TikTok — Mapping FB-Standard → TikTok-Standard
  if (window.ttq) {
    const tiktokMap: Record<StandardEvent, string> = {
      PageView: 'ViewContent',
      Lead: 'SubmitForm',
      CompleteRegistration: 'CompleteRegistration',
      InitiateCheckout: 'InitiateCheckout',
      Purchase: 'CompletePayment',
    };
    window.ttq.track(tiktokMap[event], payload as Record<string, unknown>);
  }

  // Google Ads — Conversion Label kommt aus Env (campaign-spezifisch)
  if (window.gtag) {
    const labelEnv: Partial<Record<StandardEvent, string>> = {
      Lead: import.meta.env.VITE_GOOGLE_ADS_LABEL_LEAD as string | undefined,
      CompleteRegistration: import.meta.env.VITE_GOOGLE_ADS_LABEL_TRIAL as string | undefined,
      Purchase: import.meta.env.VITE_GOOGLE_ADS_LABEL_PURCHASE as string | undefined,
    } as Partial<Record<StandardEvent, string>>;
    const label = labelEnv[event];
    const sendTo = label && import.meta.env.VITE_GOOGLE_ADS_ID
      ? `${import.meta.env.VITE_GOOGLE_ADS_ID}/${label}`
      : undefined;
    if (sendTo) {
      window.gtag('event', 'conversion', {
        send_to: sendTo,
        value: payload.value,
        currency: payload.currency,
        transaction_id: payload.transaction_id,
      });
    }
    // GA4 Standard-Event mitschicken (für Audience-Segmentierung)
    const ga4Map: Record<StandardEvent, string> = {
      PageView: 'page_view',
      Lead: 'generate_lead',
      CompleteRegistration: 'sign_up',
      InitiateCheckout: 'begin_checkout',
      Purchase: 'purchase',
    };
    window.gtag('event', ga4Map[event], payload);
  }

  // LinkedIn — Conversion-IDs sind kampagnenspezifisch (separate Env-Vars)
  if (window.lintrk) {
    const liEnv: Partial<Record<StandardEvent, string>> = {
      Lead: import.meta.env.VITE_LINKEDIN_CONVERSION_LEAD as string | undefined,
      CompleteRegistration: import.meta.env.VITE_LINKEDIN_CONVERSION_TRIAL as string | undefined,
      Purchase: import.meta.env.VITE_LINKEDIN_CONVERSION_PURCHASE as string | undefined,
    } as Partial<Record<StandardEvent, string>>;
    const conversionId = liEnv[event];
    if (conversionId) window.lintrk('track', { conversion_id: Number(conversionId) });
  }
}

/**
 * React-Hook: Initialisiert Pixel beim Mount + reagiert auf Consent-Änderungen.
 * Wird einmalig im App-Root aufgerufen.
 */
export function initMarketingPixels(): void {
  if (typeof window === 'undefined') return;
  applyConsent();
  captureClickIds();

  // Storage-Event feuert in anderen Tabs. Custom-Event triggern wir aus
  // dem Consent-Banner (siehe CookieConsent.tsx — emitConsentChanged()).
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) applyConsent();
  });
  window.addEventListener(CONSENT_EVENT, () => { applyConsent(); captureClickIds(); });
}

/**
 * Wird aus CookieConsent.tsx gefeuert nachdem User-Wahl gespeichert wurde.
 * Same-Tab-Update (storage-Event feuert nur cross-tab).
 */
export function emitConsentChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT));
}

// ---------- Click-ID-Capture + Enhanced Conversions ----------

const CLICK_ID_KEY = 'realsync.click-ids.v1';
const CLICK_ID_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

type ClickIds = { gclid?: string; fbclid?: string; ttclid?: string; t: number };

/**
 * Persistiert `gclid`/`fbclid`/`ttclid` aus der URL für spätere
 * Server-Side-Click-Conversion-Uploads. Nur mit Marketing-Consent.
 * Idempotent — überschreibt nur, wenn neue ID vorhanden ist.
 */
function captureClickIds(): void {
  const consent = readConsent();
  if (!consent?.marketing) return;
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  const gclid = params.get('gclid') ?? undefined;
  const fbclid = params.get('fbclid') ?? undefined;
  const ttclid = params.get('ttclid') ?? undefined;
  if (!gclid && !fbclid && !ttclid) return;
  try {
    const prev = readClickIdsRaw() ?? { t: Date.now() } as ClickIds;
    const next: ClickIds = {
      gclid: gclid ?? prev.gclid,
      fbclid: fbclid ?? prev.fbclid,
      ttclid: ttclid ?? prev.ttclid,
      t: Date.now(),
    };
    localStorage.setItem(CLICK_ID_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}

function readClickIdsRaw(): ClickIds | null {
  try {
    const raw = localStorage.getItem(CLICK_ID_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ClickIds;
    if (Date.now() - parsed.t > CLICK_ID_MAX_AGE_MS) {
      localStorage.removeItem(CLICK_ID_KEY);
      return null;
    }
    return parsed;
  } catch { return null; }
}

/**
 * Aktuelle Click-IDs für Übergabe an Stripe-Checkout-Metadata oder
 * andere Server-Side-Attribution-Calls. Leeres Objekt wenn ohne Consent
 * oder keine ID gesammelt.
 */
export function getClickIds(): { gclid?: string; fbclid?: string; ttclid?: string } {
  const v = readClickIdsRaw();
  if (!v) return {};
  const { gclid, fbclid, ttclid } = v;
  return { gclid, fbclid, ttclid };
}

async function sha256Hex(v: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v.trim().toLowerCase()));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Google Ads Enhanced Conversions for Web — muss VOR dem Conversion-Event
 * aufgerufen werden. Hashed PII wird an gtag übergeben; Google matched
 * intern gegen eingeloggte Google-Accounts.
 *
 * Signifikant höhere Match-Rate post iOS 14.5 / Ad-Blocker.
 *
 * @example
 *   await setEnhancedConversionData({ email });
 *   trackConversion('InitiateCheckout', { value: 79, currency: 'EUR' });
 */
export async function setEnhancedConversionData(user: { email?: string; phone?: string }): Promise<void> {
  if (typeof window === 'undefined') return;
  const consent = readConsent();
  if (!consent?.marketing) return;
  const gtag = window.gtag;
  if (!gtag) return;
  const user_data: Record<string, string> = {};
  if (user.email) user_data.sha256_email_address = await sha256Hex(user.email);
  if (user.phone) user_data.sha256_phone_number = await sha256Hex(user.phone);
  if (Object.keys(user_data).length === 0) return;
  gtag('set', 'user_data', user_data);
}

