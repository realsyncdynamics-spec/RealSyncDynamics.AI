/**
 * Creative Studio pilot gateway for xAI image/video generation.
 *
 * This endpoint is intentionally FAIL CLOSED: it requires an explicit feature
 * toggle, a secret API key and an explicit user allowlist, in addition to
 * Supabase Auth + verified tenant membership. No credentials reach the client.
 *
 * IMPORTANT: keep the pilot allowlist until server-enforced entitlements,
 * atomic quota reservations, metering and storage retention are implemented.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

type Body = {
  action?: 'image' | 'video' | 'status';
  tenant_id?: string;
  prompt?: string;
  aspect_ratio?: string;
  duration?: number;
  request_id?: string;
  proof?: string;
};

const ACCEPTED_ASPECT_RATIOS = new Set(['1:1', '16:9', '9:16', '4:3', '3:4']);
const encoder = new TextEncoder();

async function proofFor(apiKey: string, userId: string, requestId: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', encoder.encode(apiKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(
    `realsync:media:v1:${userId}:${requestId}`,
  )));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function equalHex(a: string, b: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(a) || !/^[a-f0-9]{64}$/.test(b)) return false;
  let mismatch = 0;
  for (let i = 0; i < 64; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

async function xaiRequest(apiKey: string, path: string, init?: RequestInit) {
  const response = await fetch(`https://api.x.ai/v1/${path}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error(`xAI responded with HTTP ${response.status}`);
  return await response.json() as Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST only');

  // Billing protection: new deployments cannot spend anything until explicitly enabled.
  const apiKey = Deno.env.get('XAI_API_KEY');
  const allowed = new Set(
    (Deno.env.get('CREATIVE_STUDIO_ALLOWED_USER_IDS') || '')
      .split(',').map((id) => id.trim()).filter(Boolean),
  );
  if (Deno.env.get('CREATIVE_STUDIO_ENABLED') !== 'true' || !apiKey || allowed.size === 0) {
    return jsonError(503, 'NOT_ENABLED', 'KI-Medienerstellung ist noch nicht freigeschaltet.');
  }

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'Anmeldung erforderlich.');
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: auth } }, auth: { persistSession: false } },
  );
  const { data: { user }, error: userError } = await userClient.auth.getUser(auth.slice(7));
  if (userError || !user) return jsonError(401, 'UNAUTHORIZED', 'Sitzung ungültig.');
  if (!allowed.has(user.id)) return jsonError(403, 'NOT_IN_PILOT', 'Derzeit nur für freigeschaltete Pilotkonten.');

  let body: Body;
  try { body = await req.json() as Body; } catch { return jsonError(400, 'BAD_REQUEST', 'Ungültiges JSON.'); }
  if (!body || !['image', 'video', 'status'].includes(body.action ?? '')) {
    return jsonError(400, 'BAD_REQUEST', 'Ungültige Aktion.');
  }
  if (!body.tenant_id || !/^[0-9a-f-]{36}$/i.test(body.tenant_id)) {
    return jsonError(400, 'BAD_REQUEST', 'Mandant erforderlich.');
  }

  // Validate membership under existing RLS; the frontend tenant ID is never trusted.
  const { data: member, error: memberError } = await userClient
    .from('memberships').select('id').eq('tenant_id', body.tenant_id)
    .eq('user_id', user.id).maybeSingle();
  if (memberError) return jsonError(500, 'MEMBERSHIP_CHECK_FAILED', 'Mandant konnte nicht geprüft werden.');
  if (!member) return jsonError(403, 'FORBIDDEN', 'Kein Zugriff auf diesen Mandanten.');

  if (body.action === 'status') {
    if (!body.request_id || !/^[0-9a-z-]{8,128}$/i.test(body.request_id) || !body.proof) {
      return jsonError(400, 'BAD_REQUEST', 'Ungültige Videoanfrage.');
    }
    const expected = await proofFor(apiKey, user.id, body.request_id);
    if (!equalHex(expected, body.proof)) return jsonError(403, 'FORBIDDEN', 'Videoanfrage nicht autorisiert.');
    try {
      const result = await xaiRequest(apiKey, `videos/${encodeURIComponent(body.request_id)}`);
      const status = result.status;
      if (!['pending', 'done', 'failed', 'expired'].includes(String(status))) {
        return jsonError(502, 'UPSTREAM', 'Unbekannter Videostatus.');
      }
      const video = result.video as { url?: unknown } | undefined;
      return jsonResponse({
        ok: true,
        status,
        video_url: status === 'done' && typeof video?.url === 'string' ? video.url : null,
      });
    } catch (e) {
      console.error('creative-studio: video status error', String((e as Error).message).slice(0, 120));
      return jsonError(502, 'UPSTREAM', 'Der Videostatus ist vorübergehend nicht verfügbar.');
    }
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (prompt.length < 10 || prompt.length > 2000) {
    return jsonError(400, 'BAD_REQUEST', 'Prompt muss 10 bis 2000 Zeichen haben.');
  }
  const ratio = body.aspect_ratio ?? '16:9';
  if (!ACCEPTED_ASPECT_RATIOS.has(ratio)) return jsonError(400, 'BAD_REQUEST', 'Ungültiges Seitenverhältnis.');

  try {
    if (body.action === 'image') {
      const result = await xaiRequest(apiKey, 'images/generations', {
        method: 'POST',
        body: JSON.stringify({
          model: 'grok-imagine-image-2.0', prompt, aspect_ratio: ratio, n: 1,
        }),
      });
      const images = result.data as Array<{ url?: unknown }> | undefined;
      const url = images?.[0]?.url;
      if (typeof url !== 'string' || !url.startsWith('https://')) {
        return jsonError(502, 'UPSTREAM', 'Provider hat keine Bild-URL geliefert.');
      }
      return jsonResponse({ ok: true, type: 'image', image_url: url, temporary: true });
    }

    const duration = body.duration ?? 5;
    if (![5, 8, 10].includes(duration)) return jsonError(400, 'BAD_REQUEST', 'Ungültige Videolänge.');
    const result = await xaiRequest(apiKey, 'videos/generations', {
      method: 'POST',
      body: JSON.stringify({
        model: 'grok-imagine-video-1.5-lite',
        prompt, duration, aspect_ratio: ratio, resolution: '480p',
      }),
    });
    const requestId = result.request_id;
    if (typeof requestId !== 'string' || !/^[0-9a-z-]{8,128}$/i.test(requestId)) {
      return jsonError(502, 'UPSTREAM', 'Provider hat keine Videoauftrags-ID geliefert.');
    }
    return jsonResponse({
      ok: true, type: 'video', status: 'pending', request_id: requestId,
      proof: await proofFor(apiKey, user.id, requestId),
    });
  } catch (e) {
    console.error('creative-studio: generation error', String((e as Error).message).slice(0, 120));
    return jsonError(502, 'UPSTREAM', 'Generierung konnte nicht gestartet werden.');
  }
});
