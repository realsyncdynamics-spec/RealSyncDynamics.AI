// order-intake — öffentlicher Endpoint zur Bestellannahme durch einen Bot.
//
// Der bestehende allgemeine Pfad bleibt kompatibel. Für
// config.vertical = "restaurant" gilt ein strengerer Vertrag:
//
//   - Request sendet nur item_id + qty, keine Preise.
//   - Preise/Verfügbarkeit/Währung/Liefergebühr kommen aus bots.config.
//   - customer confirmation ist vor dem Insert verpflichtend.
//   - erst der erfolgreiche DB-Insert bestätigt die Annahme in RealSync.
//
// verify_jwt = false; Bot/Tenant-Zuordnung wird über resolveBot geprüft.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError, methodNotAllowed } from '../_shared/gateway.ts';
import { resolveBot, upsertConversation, BotError } from '../_shared/bots.ts';
import { gateFeature, EntitlementError } from '../_shared/entitlements.ts';
import { resolveRestaurantOrder, RestaurantOrderError } from '../_shared/restaurant.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface LegacyOrderItem { name: string; qty?: number; price?: number }

function computeLegacyTotal(items: LegacyOrderItem[]): number {
  return items.reduce((sum, it) => {
    const qty = typeof it.qty === 'number' && it.qty > 0 ? it.qty : 1;
    const price = typeof it.price === 'number' ? it.price : 0;
    return sum + qty * price;
  }, 0);
}

function parseLegacyItems(rawItems: unknown[]): LegacyOrderItem[] {
  return rawItems
    .filter((it): it is Record<string, unknown> => !!it && typeof it === 'object' && !Array.isArray(it))
    .map((it) => ({
      name: String(it.name ?? '').trim(),
      qty: typeof it.qty === 'number' ? it.qty : undefined,
      price: typeof it.price === 'number' ? it.price : undefined,
    }))
    .filter((it) => it.name);
}

function restaurantRequestContainsClientPricing(body: Record<string, unknown>, rawItems: unknown[]): boolean {
  if (
    Object.prototype.hasOwnProperty.call(body, 'total_amount') ||
    Object.prototype.hasOwnProperty.call(body, 'currency') ||
    Object.prototype.hasOwnProperty.call(body, 'delivery_fee')
  ) return true;

  return rawItems.some((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
    const row = raw as Record<string, unknown>;
    return (
      Object.prototype.hasOwnProperty.call(row, 'price') ||
      Object.prototype.hasOwnProperty.call(row, 'unit_price') ||
      Object.prototype.hasOwnProperty.call(row, 'line_total')
    );
  });
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
  if (rawItems.length === 0) return jsonError(400, 'BAD_REQUEST', 'at least one item required');

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  try {
    const bot = await resolveBot(admin, tenantId, botId);
    if (!bot.capabilities?.orders) {
      return jsonError(403, 'CAPABILITY_DISABLED', 'this bot cannot take orders');
    }

    try {
      await gateFeature(admin, bot.tenant_id, 'bots.orders');
    } catch (e) {
      if (e instanceof EntitlementError) {
        return jsonError(403, 'ENTITLEMENT_MISSING', 'Bestellannahme ist im Plan dieses Arbeitsbereichs nicht enthalten (bots.orders).');
      }
      throw e;
    }

    const isRestaurant = bot.config?.vertical === 'restaurant';

    let items: unknown[];
    let totalAmount: number;
    let currency: string;
    let orderMetadata: Record<string, unknown> = { source: 'bot' };

    if (isRestaurant) {
      if (body.confirmed !== true) {
        return jsonError(409, 'CUSTOMER_CONFIRMATION_REQUIRED', 'restaurant order requires explicit customer confirmation');
      }

      if (restaurantRequestContainsClientPricing(body, rawItems)) {
        return jsonError(
          400,
          'CLIENT_PRICING_NOT_ALLOWED',
          'restaurant order prices, currency and totals are resolved by the server',
        );
      }

      const resolved = resolveRestaurantOrder(bot.config, rawItems, body.fulfillment);
      const deliveryAddress = typeof body.delivery_address === 'string'
        ? body.delivery_address.trim()
        : '';

      if (resolved.fulfillment === 'delivery' && !deliveryAddress) {
        return jsonError(400, 'DELIVERY_ADDRESS_REQUIRED', 'delivery_address required for delivery');
      }

      items = resolved.items;
      totalAmount = resolved.total_amount;
      currency = resolved.currency;
      orderMetadata = {
        source: 'bot',
        vertical: 'restaurant',
        pricing_authority: 'bots.config.restaurant.menu',
        customer_confirmed: true,
        fulfillment: resolved.fulfillment,
        subtotal: resolved.subtotal,
        delivery_fee: resolved.delivery_fee,
        delivery_address: resolved.fulfillment === 'delivery' ? deliveryAddress : null,
        estimated_delivery_minutes: resolved.estimated_delivery_minutes,
        payment_method: typeof body.payment_method === 'string' ? body.payment_method.slice(0, 40) : null,
      };
    } else {
      const legacyItems = parseLegacyItems(rawItems);
      if (legacyItems.length === 0) return jsonError(400, 'BAD_REQUEST', 'at least one valid item required');
      items = legacyItems;
      totalAmount = typeof body.total_amount === 'number' ? body.total_amount : computeLegacyTotal(legacyItems);
      currency = body.currency ? String(body.currency).slice(0, 3).toUpperCase() : 'EUR';
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
      metadata: orderMetadata,
    }).select('id, status, total_amount, currency').single();

    if (error) return jsonError(500, 'INTERNAL', error.message);

    return jsonResponse({
      ok: true,
      order_id: data.id,
      status: data.status,
      total_amount: data.total_amount,
      currency: data.currency,
      ...(isRestaurant ? {
        fulfillment: orderMetadata.fulfillment,
        pricing_authority: orderMetadata.pricing_authority,
        persisted: true,
      } : {}),
    });
  } catch (e) {
    if (e instanceof RestaurantOrderError) return jsonError(e.status, e.code, e.message);
    if (e instanceof BotError) return jsonError(e.status, e.code, e.message);
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});
