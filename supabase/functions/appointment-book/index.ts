// appointment-book — öffentlicher Endpoint zur Terminerfassung durch einen Bot.
//
// POST /functions/v1/appointment-book
// Body: {
//   tenant_id: string (UUID),
//   bot_id: string (UUID),
//   customer_name: string,        // max. 120 Zeichen
//   contact?: string,             // max. 254 Zeichen
//   service?: string,             // max. 120 Zeichen
//   requested_at?: string,        // ISO-8601, -24 h bis +400 Tage
//   notes?: string,               // max. 2000 Zeichen
//   conversation_ref?: string     // max. 128 Zeichen
// }
//
// Wiederholte Anfrage derselben Konversation (gleicher Name, gleicher
// Wunschtermin, noch offen) liefert den bestehenden Termin mit
// duplicate: true — atomar über einen Unique-Index (Migration 20261125190000).
//
// Legt eine Terminanfrage (bot_appointments) an. Voraussetzung: der Bot hat
// capabilities.appointments = true und der Plan trägt bots.appointments.
// verify_jwt = false; Zugriff über das Paar (tenant_id, bot_id), Rate-Limit
// je IP-Hash/Bot und optional allowed_origins. Ablauf: handler.ts.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { resolveBot, upsertConversation } from '../_shared/bots.ts';
import { gateFeature, EntitlementError } from '../_shared/entitlements.ts';
import { clientIpFromHeaders, hashClientIp, originAllowed } from '../_shared/bot-budget.ts';
import { checkAppointmentBotRateLimit, checkAppointmentIpRateLimit } from './ratelimit.ts';
import { createAppointmentHandler, type AppointmentBot } from './handler.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Gleicher Schlüssel wie bot-chat; verlässt die Function nie.
const RATE_LIMIT_SECRET = Deno.env.get('BOT_RATE_LIMIT_SALT') || SERVICE_ROLE;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const handler = createAppointmentHandler({
  now: () => new Date(),
  hashIp: (req) => hashClientIp(clientIpFromHeaders(req.headers), RATE_LIMIT_SECRET, new Date()),
  rateIp: (ipHash) => checkAppointmentIpRateLimit(admin, ipHash),
  rateBot: (ipHash, botId) => checkAppointmentBotRateLimit(admin, ipHash, botId),
  resolveBot: (tenantId, botId) => resolveBot(admin, tenantId, botId) as Promise<AppointmentBot>,
  originAllowed,

  // Capability ist ein kundeneigenes Flag (bot.capabilities?.appointments) —
  // es reicht allein nicht. Ob der Plan die Terminbuchung trägt, entscheidet
  // das Entitlement-Gate darunter (entitlement-reality-map.md §2).
  hasCapability: (bot) => Boolean(bot.capabilities?.appointments),
  gate: async (bot) => {
    try {
      await gateFeature(admin, bot.tenant_id, 'bots.appointments');
      return 'ok';
    } catch (e) {
      if (e instanceof EntitlementError) return 'missing';
      throw e;
    }
  },

  upsertConversation: (bot, externalRef, contactLabel) =>
    upsertConversation(admin, bot as Parameters<typeof upsertConversation>[1], { externalRef, contactLabel }),

  findDuplicate: async (bot, conversationId, input) => {
    let q = admin.from('bot_appointments')
      .select('id, status')
      .eq('tenant_id', bot.tenant_id)
      .eq('bot_id', bot.id)
      .eq('conversation_id', conversationId)
      .eq('customer_name', input.customerName)
      .eq('status', 'requested');
    q = input.requestedAt ? q.eq('requested_at', input.requestedAt) : q.is('requested_at', null);
    const { data, error } = await q.order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error(`duplicate lookup failed: ${error.message}`);
    return (data as { id: string; status: string } | null) ?? null;
  },

  insertAppointment: async (bot, conversationId, input) => {
    const { data, error } = await admin.from('bot_appointments').insert({
      tenant_id: bot.tenant_id,
      bot_id: bot.id,
      conversation_id: conversationId,
      customer_name: input.customerName,
      contact: input.contact,
      service: input.service,
      requested_at: input.requestedAt,
      notes: input.notes,
      metadata: { source: 'bot' },
    }).select('id, status').single<{ id: string; status: string }>();
    // 23505: Unique-Index bot_appointments_open_conversation_uniq (Migration
    // 20261125190000) — gleiche offene Anfrage existiert bereits.
    if (error && (error as { code?: string }).code === '23505') return { conflict: true as const };
    if (error) throw new Error(`insert failed: ${error.message}`);
    return data;
  },

  // Nur Fehlerart und Meldung ins Server-Log, keine Personendaten.
  logError: (scope, err) => {
    console.error(JSON.stringify({ level: 'error', scope, error: err instanceof Error ? err.message : String(err) }));
  },
});

Deno.serve(handler);
