// bot-widget-token — stellt einem angemeldeten Mandantenmitglied ein
// kurzlebiges HMAC-Widget-Token aus. verify_jwt = true (config.toml).
//
// POST /functions/v1/bot-widget-token
// Authorization: Bearer <Supabase-User-JWT>
// Body: { tenant_id, bot_id, origin, ttl_sec? }
//
// Auth-Muster wie ai-invoke: getUser + memberships-Zeile über den
// User-Client (RLS). Der Bot muss zum Tenant gehören und enabled sein
// (resolveBot). Origin muss in bot.config.allowed_origins stehen —
// sonst wird kein Token ausgestellt. Secret über resolveCronKey
// (BOT_WIDGET_SIGNING_KEY, sonst Vault bot_widget_signing_key), fail-closed.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError, methodNotAllowed } from '../_shared/gateway.ts';
import { resolveBot, BotError } from '../_shared/bots.ts';
import { originAllowed } from '../_shared/bot-budget.ts';
import { mintWidgetToken, WIDGET_TOKEN_DEFAULT_TTL_SEC, WIDGET_TOKEN_MAX_TTL_SEC } from '../_shared/bot-channel-auth.ts';
import { resolveCronKey } from '../_shared/cronKey.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return methodNotAllowed();

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  const userId = userResp.user.id;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json body');
  }

  const tenantId = String(body.tenant_id ?? '');
  const botId = String(body.bot_id ?? '');
  const origin = typeof body.origin === 'string' ? body.origin.trim() : '';
  if (!tenantId || !botId || !origin) {
    return jsonError(400, 'BAD_REQUEST', 'tenant_id, bot_id, origin required');
  }

  const { data: member, error: memberErr } = await userClient
    .from('memberships').select('id')
    .eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  if (memberErr) return jsonError(500, 'INTERNAL', memberErr.message);
  if (!member) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');

  const secret = (await resolveCronKey('BOT_WIDGET_SIGNING_KEY', 'bot_widget_signing_key')).trim();
  if (!secret) return jsonError(500, 'WIDGET_SIGNING_KEY_MISSING', 'widget signing key is not configured');

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  try {
    const bot = await resolveBot(admin, tenantId, botId);
    if (!originAllowed(origin, bot.config)) {
      return jsonError(403, 'ORIGIN_NOT_ALLOWED', 'origin is not in this bot allowed_origins');
    }

    let ttlSec = WIDGET_TOKEN_DEFAULT_TTL_SEC;
    if (body.ttl_sec !== undefined) {
      const n = Number(body.ttl_sec);
      if (!Number.isInteger(n) || n < 1) return jsonError(400, 'BAD_REQUEST', 'ttl_sec must be a positive integer');
      ttlSec = Math.min(n, WIDGET_TOKEN_MAX_TTL_SEC);
    }

    const now = new Date();
    const token = await mintWidgetToken({
      secret,
      tenantId,
      botId: bot.id,
      origin,
      now,
      ttlSec,
    });
    const expiresAt = new Date(now.getTime() + ttlSec * 1000).toISOString();
    return jsonResponse({ ok: true, token, expires_at: expiresAt, ttl_sec: ttlSec });
  } catch (e) {
    if (e instanceof BotError) return jsonError(e.status, e.code, e.message);
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});
