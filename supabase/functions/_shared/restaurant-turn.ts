import {
  getRestaurantMenu,
  resolveRestaurantOrder,
  type RestaurantOrderResolution,
} from './restaurant.ts';

export interface RestaurantOrderDraft {
  items: Array<{ item_id: string; qty: number }>;
  fulfillment?: 'pickup' | 'delivery';
  delivery_address?: string;
  customer_name?: string;
  notes?: string;
}

export interface RestaurantTurnProposal {
  reply: string;
  order_draft: RestaurantOrderDraft | null;
  ready_for_confirmation: boolean;
}

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function normalizeRestaurantOrderDraft(
  config: Record<string, unknown> | null | undefined,
  value: unknown,
): RestaurantOrderDraft | null {
  const row = record(value);
  if (!row) return null;

  const allowedIds = new Set(getRestaurantMenu(config).map((item) => item.id));
  const rawItems = Array.isArray(row.items) ? row.items : [];
  const items: Array<{ item_id: string; qty: number }> = [];
  const quantities = new Map<string, number>();

  for (const raw of rawItems.slice(0, 50)) {
    const item = record(raw);
    if (!item) continue;
    const itemId = text(item.item_id, 100);
    const qty = typeof item.qty === 'number' && Number.isInteger(item.qty) ? item.qty : 1;
    if (!itemId || !allowedIds.has(itemId) || qty < 1 || qty > 100) continue;
    quantities.set(itemId, Math.min(100, (quantities.get(itemId) ?? 0) + qty));
  }

  for (const [item_id, qty] of quantities) items.push({ item_id, qty });

  const fulfillment = row.fulfillment === 'delivery' || row.fulfillment === 'pickup'
    ? row.fulfillment
    : undefined;

  return {
    items,
    fulfillment,
    delivery_address: text(row.delivery_address, 500),
    customer_name: text(row.customer_name, 160),
    notes: text(row.notes, 1000),
  };
}

function stripFence(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

export function parseRestaurantTurnProposal(
  config: Record<string, unknown> | null | undefined,
  output: string,
): RestaurantTurnProposal | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFence(output));
  } catch {
    return null;
  }
  const row = record(parsed);
  if (!row) return null;
  const reply = text(row.reply, 2000);
  if (!reply) return null;

  return {
    reply,
    order_draft: normalizeRestaurantOrderDraft(config, row.order_draft),
    ready_for_confirmation: row.ready_for_confirmation === true,
  };
}

function normalizedConfirmation(value: string): string {
  return value
    .toLocaleLowerCase('de-DE')
    .replace(/[.,!?;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const CONFIRMATIONS = new Set([
  'ja',
  'ja bitte',
  'ja bestellen',
  'ja bitte bestellen',
  'bestätigen',
  'bestellung bestätigen',
  'bestellung abschicken',
  'bitte abschicken',
  'verbindlich bestellen',
]);

const REJECTIONS = new Set([
  'nein',
  'nein danke',
  'nicht bestellen',
  'abbrechen',
  'bestellung abbrechen',
  'noch nicht',
  'ändern',
  'bestellung ändern',
  'ich möchte ändern',
]);

export function isExplicitRestaurantOrderConfirmation(value: string): boolean {
  return CONFIRMATIONS.has(normalizedConfirmation(value));
}

export function isExplicitRestaurantOrderRejection(value: string): boolean {
  return REJECTIONS.has(normalizedConfirmation(value));
}

export function buildRestaurantTurnProtocol(currentDraft: RestaurantOrderDraft | null): string {
  return [
    '[Restaurant-Order-Protokoll]',
    'Du darfst keine Bestellung ausführen. Du lieferst nur einen strukturierten Vorschlag.',
    'Antworte ausschließlich mit genau einem JSON-Objekt, ohne Markdown und ohne zusätzlichen Text.',
    'Schema:',
    '{"reply":"kurze natürliche Antwort","order_draft":{"items":[{"item_id":"id-aus-menü","qty":1}],"fulfillment":"pickup|delivery","delivery_address":"...","customer_name":"...","notes":"..."},"ready_for_confirmation":false}',
    'order_draft muss bei einer laufenden Bestellung immer den vollständigen aktuellen Draft enthalten, nicht nur die Änderung.',
    'Verwende ausschließlich item_id aus dem aktuellen Menü. Erfinde keine Preise, IDs, Produkte oder Verfügbarkeiten.',
    'Setze ready_for_confirmation=true nur wenn Produkte, Fulfillment, Kundenname und bei Lieferung die Lieferadresse vollständig sind.',
    'Schreibe niemals confirmed=true und behaupte niemals, die Bestellung sei bereits gespeichert oder angenommen.',
    `Aktueller Draft: ${JSON.stringify(currentDraft ?? { items: [] })}`,
  ].join('\n');
}

export function canQuoteRestaurantDraft(draft: RestaurantOrderDraft): boolean {
  if (!draft.customer_name || draft.items.length === 0 || !draft.fulfillment) return false;
  if (draft.fulfillment === 'delivery' && !draft.delivery_address) return false;
  return true;
}

export function buildRestaurantQuotePayload(
  resolution: RestaurantOrderResolution,
  draft: RestaurantOrderDraft,
): Record<string, unknown> {
  return {
    items: resolution.items.map((item) => ({
      item_id: item.item_id,
      name: item.name,
      qty: item.qty,
      unit_price: item.unit_price,
      line_total: item.line_total,
    })),
    fulfillment: resolution.fulfillment,
    delivery_address: resolution.fulfillment === 'delivery' ? draft.delivery_address ?? null : null,
    customer_name: draft.customer_name ?? null,
    notes: draft.notes ?? null,
    subtotal: resolution.subtotal,
    delivery_fee: resolution.delivery_fee,
    total_amount: resolution.total_amount,
    currency: resolution.currency,
  };
}

export function resolveRestaurantDraftQuote(
  config: Record<string, unknown> | null | undefined,
  draft: RestaurantOrderDraft,
): RestaurantOrderResolution {
  return resolveRestaurantOrder(config, draft.items, draft.fulfillment);
}

export function formatRestaurantQuote(
  resolution: RestaurantOrderResolution,
  draft: RestaurantOrderDraft,
): string {
  const currency = resolution.currency || 'EUR';
  const money = (value: number) => new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
  }).format(value);
  const lines = resolution.items.map((item) => `${item.qty}× ${item.name} – ${money(item.line_total)}`);
  const customer = draft.customer_name ? `Bestellung für ${draft.customer_name}. ` : '';
  const fulfillment = resolution.fulfillment === 'delivery'
    ? `Lieferung an ${draft.delivery_address}`
    : 'Abholung';
  const fee = resolution.delivery_fee > 0 ? ` inklusive ${money(resolution.delivery_fee)} Liefergebühr` : '';
  const eta = resolution.estimated_delivery_minutes !== null
    ? ` Der aktuelle Lieferzeit-Richtwert liegt bei ca. ${resolution.estimated_delivery_minutes} Minuten.`
    : '';
  const notes = draft.notes ? ` Hinweis: ${draft.notes}.` : '';

  return `Ich fasse zusammen: ${customer}${lines.join(', ')}. ${fulfillment}. Gesamt: ${money(resolution.total_amount)}${fee}.${notes}${eta} Soll ich die Bestellung verbindlich abschicken? Bitte antworten Sie mit „Ja“.`;
}
