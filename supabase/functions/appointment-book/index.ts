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
//   conversation_ref?: string
// }
//
// Legt eine Terminanfrage (bot_appointments) an. Voraussetzung: der Bot hat
// capabilities.appointments = true. verify_jwt = false.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError, methodNotAllowed } from '../_shared/gateway.ts';
import { resolveBot, upsertConversation, BotError } from '../_shared/bots.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return methodNotAllowed();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json body');
  }

  const tenantId = String(body.tenant_id ?? '');
  const botId = String(body.bot_id ?? '');
  const customerName = typeof body.customer_name === 'string' ? body.customer_name.trim() : '';
  if (!customerName) return jsonError(400, 'BAD_REQUEST', 'customer_name required');

  let requestedAt: string | null = null;
  if (body.requested_at) {
    const d = new Date(String(body.requested_at));
    if (Number.isNaN(d.getTime())) return jsonError(400, 'BAD_REQUEST', 'requested_at must be ISO-8601');
    requestedAt = d.toISOString();
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  try {
    const bot = await resolveBot(admin, tenantId, botId);
    if (!bot.capabilities?.appointments) {
      return jsonError(403, 'CAPABILITY_DISABLED', 'this bot cannot book appointments');
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
    if (error) return jsonError(500, 'INTERNAL', error.message);

    return jsonResponse({ ok: true, appointment_id: data.id, status: data.status });
  } catch (e) {
    if (e instanceof BotError) return jsonError(e.status, e.code, e.message);
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});
