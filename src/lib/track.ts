// Lightweight pageview tracking — fires on every route change to Supabase
// Edge Function `track-pageview`. DSGVO-konform via IP-Hash, kein Cookie.
//
// Usage in App.tsx (inside <BrowserRouter>):
//   useTrackPageview();

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ENDPOINT = `${SUPABASE_URL}/functions/v1/track-pageview`;

// Skip in dev to avoid polluting analytics with HMR refreshes. Auch
// deaktivieren, wenn VITE_SUPABASE_URL fehlt — sonst feuert der Tracker
// gegen `undefined/functions/v1/track-pageview` (404, Konsolen-Error).
const ENABLED = import.meta.env.PROD && Boolean(SUPABASE_URL);

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

export function useTrackPageview() {
  const location = useLocation();

  useEffect(() => {
    if (!ENABLED || typeof window === 'undefined') return;

    // Best-effort fire-and-forget. Errors are swallowed — pageview tracking
    // must never break the app or block render.
    const payload = {
      path: location.pathname,
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
  }, [location.pathname]);
}
