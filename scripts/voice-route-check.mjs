/**
 * Pure read-only classifier for the public Company Voice Pages Functions.
 * A valid HTTP status alone is not sufficient: Cloudflare may serve the SPA
 * index.html for a missing API route. Never log response bodies or secrets.
 */
export const VOICE_ROUTES = Object.freeze(['/api/company-voice', '/api/company-voice/live']);

export function classifyVoiceApiResponse({ route, method = 'GET', status, contentType, body = '' }) {
  if (!VOICE_ROUTES.includes(route)) return null;
  const type = String(contentType ?? '').toLowerCase();

  if (type.includes('text/html') || /^\s*<(?:!doctype\s+html|html\b)/i.test(body)) {
    return { ok: false, state: 'SPA_HTML_FALLBACK' };
  }

  // Cloudflare may handle HEAD differently; only GET determines API health.
  if (method !== 'GET') return { ok: null, state: 'HEAD_ADVISORY' };

  if (!type.includes('application/json')) {
    return { ok: false, state: 'API_NOT_JSON' };
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return { ok: false, state: 'INVALID_JSON' };
  }

  if (route === '/api/company-voice') {
    if (status === 200 && payload?.ok === true && Array.isArray(payload.facts)) {
      return { ok: true, state: 'PUBLIC_API_OK' };
    }
    return { ok: false, state: 'PUBLIC_API_UNEXPECTED' };
  }

  const code = payload?.error?.code;
  if (status === 503 && payload?.ok === false && code === 'LIVE_VOICE_DISABLED') {
    return { ok: true, state: 'LIVE_FAIL_CLOSED' };
  }
  if (status === 426 && payload?.ok === false && code === 'UPGRADE_REQUIRED') {
    // This only proves the Function route is reachable, NOT audio E2E.
    return { ok: true, state: 'LIVE_UPGRADE_REQUIRED' };
  }
  return { ok: false, state: 'LIVE_UNEXPECTED' };
}
