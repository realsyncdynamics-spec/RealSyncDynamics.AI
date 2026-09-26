export interface RestaurantMenuItem {
  id: string;
  name: string;
  price: number;
  available: boolean;
}

export interface RestaurantOrderRequestItem {
  item_id: string;
  qty?: number;
}

export interface ResolvedRestaurantOrderItem {
  item_id: string;
  name: string;
  qty: number;
  unit_price: number;
  line_total: number;
}

export interface RestaurantOrderResolution {
  items: ResolvedRestaurantOrderItem[];
  subtotal: number;
  delivery_fee: number;
  total_amount: number;
  currency: string;
  fulfillment: 'pickup' | 'delivery';
  estimated_delivery_minutes: number | null;
}

export class RestaurantOrderError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(message: string, code: string, status = 400, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asText(value: unknown, max = 160): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

function asNonNegativeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function moneyToCents(value: number): number {
  return Math.round(value * 100);
}

function centsToMoney(value: number): number {
  return Number((value / 100).toFixed(2));
}

export function getRestaurantConfig(config: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!config || config.vertical !== 'restaurant') return null;
  return asRecord(config.restaurant) ?? {};
}

export function getRestaurantMenu(config: Record<string, unknown> | null | undefined): RestaurantMenuItem[] {
  const restaurant = getRestaurantConfig(config);
  if (!restaurant || !Array.isArray(restaurant.menu)) return [];

  const seen = new Set<string>();
  const items: RestaurantMenuItem[] = [];

  for (const raw of restaurant.menu.slice(0, 200)) {
    const row = asRecord(raw);
    if (!row) continue;
    const id = asText(row.id, 100);
    const name = asText(row.name, 160);
    const price = asNonNegativeNumber(row.price);
    if (!id || !name || price === null || seen.has(id)) continue;
    seen.add(id);
    items.push({
      id,
      name,
      price: centsToMoney(moneyToCents(price)),
      available: row.available !== false,
    });
  }

  return items;
}

export function resolveRestaurantOrder(
  config: Record<string, unknown> | null | undefined,
  rawItems: unknown,
  requestedFulfillment?: unknown,
): RestaurantOrderResolution {
  const restaurant = getRestaurantConfig(config);
  if (!restaurant) {
    throw new RestaurantOrderError('restaurant vertical is not configured', 'RESTAURANT_NOT_CONFIGURED', 400);
  }

  const menu = getRestaurantMenu(config);
  if (menu.length === 0) {
    throw new RestaurantOrderError('restaurant menu is empty', 'MENU_EMPTY', 409);
  }

  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new RestaurantOrderError('at least one item required', 'BAD_REQUEST', 400);
  }
  if (rawItems.length > 50) {
    throw new RestaurantOrderError('too many order lines', 'BAD_REQUEST', 400);
  }

  const menuById = new Map(menu.map((item) => [item.id, item]));
  const quantities = new Map<string, number>();

  for (const raw of rawItems) {
    const row = asRecord(raw);
    const itemId = asText(row?.item_id, 100);
    const qtyRaw = row?.qty ?? 1;
    const qty = typeof qtyRaw === 'number' && Number.isInteger(qtyRaw) ? qtyRaw : NaN;

    if (!itemId || !Number.isFinite(qty) || qty < 1 || qty > 100) {
      throw new RestaurantOrderError('invalid restaurant order item', 'INVALID_ITEM', 400);
    }

    const item = menuById.get(itemId);
    if (!item) {
      throw new RestaurantOrderError('menu item not found', 'ITEM_NOT_FOUND', 409, { item_id: itemId });
    }
    if (!item.available) {
      throw new RestaurantOrderError('menu item is unavailable', 'ITEM_UNAVAILABLE', 409, { item_id: itemId });
    }

    quantities.set(itemId, (quantities.get(itemId) ?? 0) + qty);
    if ((quantities.get(itemId) ?? 0) > 100) {
      throw new RestaurantOrderError('item quantity exceeds limit', 'INVALID_ITEM', 400, { item_id: itemId });
    }
  }

  const orderMode = restaurant.order_mode === 'pickup'
    ? 'pickup'
    : restaurant.order_mode === 'delivery'
      ? 'delivery'
      : 'both';

  let fulfillment: 'pickup' | 'delivery';
  if (orderMode === 'pickup') fulfillment = 'pickup';
  else if (orderMode === 'delivery') fulfillment = 'delivery';
  else if (requestedFulfillment === 'pickup' || requestedFulfillment === 'delivery') fulfillment = requestedFulfillment;
  else throw new RestaurantOrderError('fulfillment required', 'FULFILLMENT_REQUIRED', 400);

  if (requestedFulfillment && requestedFulfillment !== fulfillment) {
    throw new RestaurantOrderError('fulfillment is not available', 'FULFILLMENT_NOT_ALLOWED', 409);
  }

  const currencyRaw = asText(restaurant.currency, 3)?.toUpperCase();
  const currency = currencyRaw && /^[A-Z]{3}$/.test(currencyRaw) ? currencyRaw : 'EUR';

  const items: ResolvedRestaurantOrderItem[] = [];
  let subtotalCents = 0;

  for (const [itemId, qty] of quantities) {
    const item = menuById.get(itemId)!;
    const unitCents = moneyToCents(item.price);
    const lineCents = unitCents * qty;
    subtotalCents += lineCents;
    items.push({
      item_id: item.id,
      name: item.name,
      qty,
      unit_price: centsToMoney(unitCents),
      line_total: centsToMoney(lineCents),
    });
  }

  const minimumOrder = asNonNegativeNumber(restaurant.minimum_order);
  if (minimumOrder !== null && subtotalCents < moneyToCents(minimumOrder)) {
    throw new RestaurantOrderError(
      'minimum order value not reached',
      'MINIMUM_ORDER_NOT_MET',
      409,
      { minimum_order: centsToMoney(moneyToCents(minimumOrder)), subtotal: centsToMoney(subtotalCents), currency },
    );
  }

  const deliveryFee = fulfillment === 'delivery'
    ? asNonNegativeNumber(restaurant.delivery_fee) ?? 0
    : 0;
  const deliveryFeeCents = moneyToCents(deliveryFee);
  const estimated = asNonNegativeNumber(restaurant.estimated_delivery_minutes);

  return {
    items,
    subtotal: centsToMoney(subtotalCents),
    delivery_fee: centsToMoney(deliveryFeeCents),
    total_amount: centsToMoney(subtotalCents + deliveryFeeCents),
    currency,
    fulfillment,
    estimated_delivery_minutes: estimated === null ? null : Math.round(estimated),
  };
}
