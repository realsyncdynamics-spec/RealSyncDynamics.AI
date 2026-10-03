// Lightweight pageview tracking — fires on route change to Supabase
// Edge Function `track-pageview` **only after analytics consent**.
//
// Usage in App.tsx (inside <BrowserRouter>):
//   useTrackPageview();

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getSupabaseUrl } from './supabaseUrl';

// getSupabaseUrl() fällt auf die Produktions-URL zurück, wenn VITE_SUPABASE_URL
// im Build fehlt — sonst geht der Beacon relativ gegen den SPA-Host (503).
const ENDPOINT = `${getSupabaseUrl()}/functions/v1/track-pageview`;

const CONSENT_STORAGE_KEY = 'realsync.cookie-consent.v1';
const CONSENT_EVENT = 'realsync:consent-changed';
const CONSENT_VERSION = 1;

// Skip in dev to avoid polluting analytics with HMR refreshes.
const ENABLED = import.meta.env.PROD;

function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as {
      version?: number;
      analytics?: boolean;
    };
    const version = typeof parsed.version === 'number' ? parsed.version : 1;
    if (version < CONSENT_VERSION) return false;
    return parsed.analytics === true;
  } catch {
    return false;
  }
}

function readUtm(): { utm_source?: string; utm_medium?: string; utm_campaign?: string } {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const out: { utm_source?: string; utm_medium?: string; utm_campaign?: string } = {};
  const src = params.get('utm_source') ?? params.get('source');
  const med = params.get('utm_medium');
  const cmp = params.get('utm_campaign');
  if (src) out.utm_source = src.slice(0, 100);
  if (med) out.utm_medium = med.slice(0, 100);
  if (cmp) out.utm_campaign = cmp.slice(0, 100);
  return out;
}

function sendPageview(pathname: string): void {
  if (!ENABLED || typeof window === 'undefined') return;
  // Kein Tracking vor Einwilligung — auch nicht als „cookieless" Beacon.
  if (!hasAnalyticsConsent()) return;

  const payload = {
    path: pathname,
    referrer: document.referrer || undefined,
    ...readUtm(),
  };

  // Use fetch with keepalive so it survives navigation. No await.
  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => { /* swallow */ });
}

export function useTrackPageview() {
  const location = useLocation();

  useEffect(() => {
    sendPageview(location.pathname);

    // Nach Consent-Entscheidung denselben Path nachsenden (erster Aufruf
    // vor dem Banner war bewusst unterdrückt).
    const onConsent = () => sendPageview(location.pathname);
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, [location.pathname]);
}
