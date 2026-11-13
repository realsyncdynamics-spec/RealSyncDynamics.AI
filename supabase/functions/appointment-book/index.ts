// appointment-book — öffentlicher Endpoint zur Terminerfassung durch einen Bot.
//
// POST /functions/v1/appointment-book
// Body: {
//   tenant_id: string,
//   bot_id: string,
//   customer_name: string,
//   contact?: string,
//   service?: string,
//   requested_at?: string,        // ISO-8601
//   notes?: string,
//   conversation_ref?: string,
//   widget_token?: string
// }
//
// Legt eine Terminanfrage (bot_appointments) an. Voraussetzung: der Bot hat
// capabilities.appointments = true. verify_jwt = false. Zugriff über
// Widget-Token plus Pflicht-Origin in config.allowed_origins.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError, methodNotAllowed, buildCorsHeaders } from '../_shared/gateway.ts';
import { resolveBot, upsertConversation, BotError } from '../_shared/bots.ts';
import { gateFeature, EntitlementError } from '../_shared/entitlements.ts';
import {
  checkBotRateLimit, checkIpRateLimit, clientIpFromHeaders, hashClientIp,
} from '../_shared/bot-budget.ts';
import {
  assertBotBrowserAccess, BOT_WIDGET_CORS_EXTRA_HEADERS,
} from '../_shared/bot-channel-auth.ts';
import { resolveCronKey } from '../_shared/cronKey.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RATE_LIMIT_SECRET = Deno.env.get('BOT_RATE_LIMIT_SALT') || SERVICE_ROLE;
const cors = buildCorsHeaders('POST, OPTIONS', BOT_WIDGET_CORS_EXTRA_HEADERS);

async function widgetSigningKey(): Promise<string> {
  return (await resolveCronKey('BOT_WIDGET_SIGNING_KEY', 'bot_widget_signing_key')).trim();
}

function rateLimited(scope: string): Response {
  const status = scope === 'unavailable' ? 503 : 429;
  const code = scope === 'unavailable' ? 'RATE_LIMIT_UNAVAILABLE' : 'RATE_LIMITED';
  const res = jsonError(status, code, 'Zu viele Anfragen. Bitte kurz warten und erneut versuchen.', cors);
  if (status === 429) res.headers.set('Retry-After', '60');
  return res;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req, cors);
  if (preflight) return preflight;
  if (req.method !== 'POST') return methodNotAllowed(cors);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json body', cors);
  }

  const tenantId = String(body.tenant_id ?? '');
  const botId = String(body.bot_id ?? '');
  const customerName = typeof body.customer_name === 'string' ? body.customer_name.trim() : '';
  if (!customerName) return jsonError(400, 'BAD_REQUEST', 'customer_name required', cors);

  let requestedAt: string | null = null;
  if (body.requested_at) {
    const d = new Date(String(body.requested_at));
    if (Number.isNaN(d.getTime())) return jsonError(400, 'BAD_REQUEST', 'requested_at must be ISO-8601', cors);
    requestedAt = d.toISOString();
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const ipHash = await hashClientIp(clientIpFromHeaders(req.headers), RATE_LIMIT_SECRET, new Date());
  const ipDecision = await checkIpRateLimit(admin, ipHash);
  if (!ipDecision.allowed) return rateLimited(ipDecision.scope);

  try {
    const bot = await resolveBot(admin, tenantId, botId);

    const access = await assertBotBrowserAccess({
      secret: await widgetSigningKey(),
      req,
      body,
      tenantId,
      botId,
      botConfig: bot.config,
    });
    if (!access.ok) return jsonError(access.status, access.code, access.message, cors);

    const botDecision = await checkBotRateLimit(admin, ipHash, bot.id);
    if (!botDecision.allowed) return rateLimited(botDecision.scope);

    if (!bot.capabilities?.appointments) {
      return jsonError(403, 'CAPABILITY_DISABLED', 'this bot cannot book appointments', cors);
    }

    // Entitlement-Gate (AP9, Welle 1): `bot.capabilities.appointments` ist ein
    // kundeneigenes Flag, das der Kunde im Browser selbst setzt — es fragt
    // ihn, ob er darf (entitlement-reality-map.md §2). Ob der Plan die
    // Terminbuchung trägt, entscheidet allein `bots.appointments`.
    try {
      await gateFeature(admin, bot.tenant_id, 'bots.appointments');
    } catch (e) {
      if (e instanceof EntitlementError) {
        return jsonError(403, 'ENTITLEMENT_MISSING', 'Terminbuchung ist im Plan dieses Arbeitsbereichs nicht enthalten (bots.appointments).', cors);
      }
      throw e;
    }

    const conversationRef = body.conversation_ref ? String(body.conversation_ref) : null;
    const conversationId = conversationRef
      ? await upsertConversation(admin, bot, { externalRef: conversationRef, contactLabel: customerName })
      : null;

    const { data, error } = await admin.from('bot_appointments').insert({
      tenant_id: bot.tenant_id,
      bot_id: bot.id,
      conversation_id: conversationId,
      customer_name: customerName,
      contact: body.contact ? String(body.contact) : null,
      service: body.service ? String(body.service) : null,
      requested_at: requestedAt,
      notes: body.notes ? String(body.notes) : null,
      metadata: { source: 'bot' },
    }).select('id, status').single<{ id: string; status: string }>();
    if (error) return jsonError(500, 'INTERNAL', error.message, cors);

    return jsonResponse({ ok: true, appointment_id: data.id, status: data.status }, 200, cors);
  } catch (e) {
    if (e instanceof BotError) return jsonError(e.status, e.code, e.message, cors);
    return jsonError(500, 'INTERNAL', (e as Error).message, cors);
  }
});
