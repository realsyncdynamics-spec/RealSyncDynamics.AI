// order-intake — öffentlicher Endpoint zur Bestellannahme durch einen Bot.
//
// POST /functions/v1/order-intake
// Body: {
//   tenant_id: string,
//   bot_id: string,
//   customer_name: string,
//   contact?: string,
//   items: Array<{ name: string, qty?: number, price?: number }>,
//   currency?: string,            // Default EUR
//   notes?: string,
//   conversation_ref?: string
// }
//
// Legt eine Bestellung (bot_orders) an. Voraussetzung: der Bot hat
// capabilities.orders = true. total_amount wird aus items berechnet, falls
// nicht mitgeliefert. verify_jwt = false.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError, methodNotAllowed } from '../_shared/gateway.ts';
import { resolveBot, upsertConversation, BotError } from '../_shared/bots.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface OrderItem { name: string; qty?: number; price?: number }

function computeTotal(items: OrderItem[]): number {
  return items.reduce((sum, it) => {
    const qty = typeof it.qty === 'number' && it.qty > 0 ? it.qty : 1;
    const price = typeof it.price === 'number' ? it.price : 0;
    return sum + qty * price;
  }, 0);
}

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

  const rawItems = Array.isArray(body.items) ? body.items : [];
  const items: OrderItem[] = rawItems
    .filter((it): it is Record<string, unknown> => !!it && typeof it === 'object')
    .map((it) => ({
      name: String((it as Record<string, unknown>).name ?? '').trim(),
      qty: typeof (it as Record<string, unknown>).qty === 'number' ? (it as Record<string, unknown>).qty as number : undefined,
      price: typeof (it as Record<string, unknown>).price === 'number' ? (it as Record<string, unknown>).price as number : undefined,
    }))
    .filter((it) => it.name);
  if (items.length === 0) return jsonError(400, 'BAD_REQUEST', 'at least one item required');

  const totalAmount = typeof body.total_amount === 'number' ? body.total_amount : computeTotal(items);
  const currency = body.currency ? String(body.currency).slice(0, 3).toUpperCase() : 'EUR';

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  try {
    const bot = await resolveBot(admin, tenantId, botId);
    if (!bot.capabilities?.orders) {
      return jsonError(403, 'CAPABILITY_DISABLED', 'this bot cannot take orders');
    }

    const conversationRef = body.conversation_ref ? String(body.conversation_ref) : null;
    const conversationId = conversationRef
      ? await upsertConversation(admin, bot, { externalRef: conversationRef, contactLabel: customerName })
      : null;

    const { data, error } = await admin.from('bot_orders').insert({
      tenant_id: bot.tenant_id,
      bot_id: bot.id,
      conversation_id: conversationId,
      customer_name: customerName,
      contact: body.contact ? String(body.contact) : null,
      items,
      total_amount: totalAmount,
      currency,
      notes: body.notes ? String(body.notes) : null,
      metadata: { source: 'bot' },
    }).select('id, status, total_amount, currency').single();
    if (error) return jsonError(500, 'INTERNAL', error.message);

    return jsonResponse({
      ok: true,
      order_id: data.id,
      status: data.status,
      total_amount: data.total_amount,
      currency: data.currency,
    });
  } catch (e) {
    if (e instanceof BotError) return jsonError(e.status, e.code, e.message);
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});
