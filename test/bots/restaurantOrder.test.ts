import { describe, expect, it } from 'vitest';
import {
  getRestaurantMenu,
  resolveRestaurantOrder,
  RestaurantOrderError,
} from '../../supabase/functions/_shared/restaurant';

const config = {
  vertical: 'restaurant',
  restaurant: {
    currency: 'EUR',
    order_mode: 'both',
    minimum_order: 15,
    delivery_fee: 2.5,
    estimated_delivery_minutes: 40,
    menu: [
      { id: 'salami-large', name: 'Pizza Salami groß', price: 12.9, available: true },
      { id: 'cola-1l', name: 'Cola 1l', price: 3.5, available: true },
      { id: 'tiramisu', name: 'Tiramisu', price: 5.9, available: false },
    ],
  },
};

describe('restaurant order resolver', () => {
  it('uses only server-side menu prices and adds configured delivery fee', () => {
    const out = resolveRestaurantOrder(config, [
      { item_id: 'salami-large', qty: 1, price: 0.01 },
      { item_id: 'cola-1l', qty: 1 },
    ], 'delivery');

    expect(out.items).toEqual([
      { item_id: 'salami-large', name: 'Pizza Salami groß', qty: 1, unit_price: 12.9, line_total: 12.9 },
      { item_id: 'cola-1l', name: 'Cola 1l', qty: 1, unit_price: 3.5, line_total: 3.5 },
    ]);
    expect(out.subtotal).toBe(16.4);
    expect(out.delivery_fee).toBe(2.5);
    expect(out.total_amount).toBe(18.9);
    expect(out.currency).toBe('EUR');
    expect(out.estimated_delivery_minutes).toBe(40);
  });

  it('rejects unavailable and unknown menu items', () => {
    expect(() => resolveRestaurantOrder(config, [{ item_id: 'tiramisu', qty: 1 }], 'pickup'))
      .toThrowError(RestaurantOrderError);
    expect(() => resolveRestaurantOrder(config, [{ item_id: 'unknown', qty: 1 }], 'pickup'))
      .toThrowError(RestaurantOrderError);
  });

  it('enforces minimum order before delivery fee', () => {
    try {
      resolveRestaurantOrder(config, [{ item_id: 'cola-1l', qty: 1 }], 'delivery');
      throw new Error('expected MINIMUM_ORDER_NOT_MET');
    } catch (error) {
      expect(error).toBeInstanceOf(RestaurantOrderError);
      expect((error as RestaurantOrderError).code).toBe('MINIMUM_ORDER_NOT_MET');
    }
  });

  it('enforces configured fulfillment mode', () => {
    const pickupOnly = {
      ...config,
      restaurant: { ...config.restaurant, order_mode: 'pickup' },
    };
    expect(() => resolveRestaurantOrder(pickupOnly, [{ item_id: 'salami-large', qty: 2 }], 'delivery'))
      .toThrowError(RestaurantOrderError);
  });

  it('deduplicates ids, rejects malformed menu rows and rounds money to cents', () => {
    const menu = getRestaurantMenu({
      vertical: 'restaurant',
      restaurant: {
        menu: [
          { id: 'a', name: 'A', price: 1.005, available: true },
          { id: 'a', name: 'Duplicate', price: 99, available: true },
          { id: '', name: 'Bad', price: 2 },
        ],
      },
    });
    expect(menu).toEqual([{ id: 'a', name: 'A', price: 1, available: true }]);
  });
});
