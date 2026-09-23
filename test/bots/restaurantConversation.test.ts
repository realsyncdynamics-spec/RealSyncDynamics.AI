import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import {
  buildRestaurantQuotePayload,
  canQuoteRestaurantDraft,
  formatRestaurantQuote,
  isExplicitRestaurantOrderConfirmation,
  isExplicitRestaurantOrderRejection,
  normalizeRestaurantOrderDraft,
  parseRestaurantTurnProposal,
  resolveRestaurantDraftQuote,
} from '../../supabase/functions/_shared/restaurant-turn';

const config = {
  vertical: 'restaurant',
  restaurant: {
    currency: 'EUR',
    order_mode: 'both',
    minimum_order: 10,
    delivery_fee: 2.5,
    estimated_delivery_minutes: 40,
    menu: [
      { id: 'salami-large', name: 'Pizza Salami groß', price: 12.9, available: true },
      { id: 'cola-1l', name: 'Cola 1l', price: 3.5, available: true },
      { id: 'tiramisu', name: 'Tiramisu', price: 5.9, available: false },
    ],
  },
};

describe('restaurant conversation protocol', () => {
  it('accepts only explicit confirmation phrases', () => {
    expect(isExplicitRestaurantOrderConfirmation('Ja.')).toBe(true);
    expect(isExplicitRestaurantOrderConfirmation('Ja, bitte bestellen!')).toBe(true);
    expect(isExplicitRestaurantOrderConfirmation('Bestellung abschicken')).toBe(true);
    expect(isExplicitRestaurantOrderConfirmation('okay')).toBe(false);
    expect(isExplicitRestaurantOrderConfirmation('vielleicht')).toBe(false);
  });

  it('recognizes explicit rejection without treating edits as confirmation', () => {
    expect(isExplicitRestaurantOrderRejection('Nein danke')).toBe(true);
    expect(isExplicitRestaurantOrderRejection('Bestellung abbrechen')).toBe(true);
    expect(isExplicitRestaurantOrderRejection('Bestellung ändern')).toBe(true);
    expect(isExplicitRestaurantOrderRejection('ohne Zwiebeln')).toBe(false);
  });

  it('normalizes model proposals to known menu ids and strips price authority', () => {
    const draft = normalizeRestaurantOrderDraft(config, {
      items: [
        { item_id: 'salami-large', qty: 1, price: 0.01 },
        { item_id: 'salami-large', qty: 2 },
        { item_id: 'invented', qty: 9 },
      ],
      fulfillment: 'delivery',
      delivery_address: 'Musterstraße 15',
      customer_name: 'Dominik Steiner',
      notes: 'ohne Zwiebeln',
      total_amount: 0.01,
    });

    expect(draft).toEqual({
      items: [{ item_id: 'salami-large', qty: 3 }],
      fulfillment: 'delivery',
      delivery_address: 'Musterstraße 15',
      customer_name: 'Dominik Steiner',
      notes: 'ohne Zwiebeln',
    });
  });

  it('parses fenced JSON but keeps the order proposal non-authoritative', () => {
    const proposal = parseRestaurantTurnProposal(config, `\`\`\`json
{
  "reply": "Ich habe die Bestellung vorbereitet.",
  "order_draft": {
    "items": [{"item_id":"salami-large","qty":1,"unit_price":0.01}],
    "fulfillment":"pickup",
    "customer_name":"Max"
  },
  "ready_for_confirmation": true
}
\`\`\``);

    expect(proposal?.reply).toBe('Ich habe die Bestellung vorbereitet.');
    expect(proposal?.order_draft?.items).toEqual([{ item_id: 'salami-large', qty: 1 }]);
    expect(proposal?.ready_for_confirmation).toBe(true);
  });

  it('requires the complete server-side confirmation shape', () => {
    expect(canQuoteRestaurantDraft({
      items: [{ item_id: 'salami-large', qty: 1 }],
      fulfillment: 'delivery',
      customer_name: 'Max',
    })).toBe(false);

    expect(canQuoteRestaurantDraft({
      items: [{ item_id: 'salami-large', qty: 1 }],
      fulfillment: 'delivery',
      delivery_address: 'Musterstraße 15',
      customer_name: 'Max',
    })).toBe(true);
  });

  it('binds name, product identity, price, address and notes into the quote payload', () => {
    const draft = {
      items: [{ item_id: 'salami-large', qty: 1 }],
      fulfillment: 'delivery' as const,
      delivery_address: 'Musterstraße 15',
      customer_name: 'Max Mustermann',
      notes: 'ohne Zwiebeln',
    };
    const resolution = resolveRestaurantDraftQuote(config, draft);
    const payload = buildRestaurantQuotePayload(resolution, draft);

    expect(payload).toMatchObject({
      customer_name: 'Max Mustermann',
      notes: 'ohne Zwiebeln',
      fulfillment: 'delivery',
      delivery_address: 'Musterstraße 15',
      total_amount: 15.4,
      currency: 'EUR',
    });
    expect(payload.items).toEqual([
      {
        item_id: 'salami-large',
        name: 'Pizza Salami groß',
        qty: 1,
        unit_price: 12.9,
        line_total: 12.9,
      },
    ]);

    const summary = formatRestaurantQuote(resolution, draft);
    expect(summary).toContain('Bestellung für Max Mustermann');
    expect(summary).toContain('Pizza Salami groß');
    expect(summary).toContain('Musterstraße 15');
    expect(summary).toContain('ohne Zwiebeln');
    expect(summary).toContain('15,40');
    expect(summary).toContain('Bitte antworten Sie mit „Ja“');
  });
});

const FUNCTIONS = resolve(__dirname, '../../supabase/functions');
const CHANNELS = [
  'bot-chat/index.ts',
  'bot-voice-webhook/index.ts',
  'whatsapp-webhook/index.ts',
];

describe('restaurant execution is downstream of the existing PEP', () => {
  for (const file of CHANNELS) {
    it(`${file}: PEP runs before restaurant orchestration`, () => {
      const source = readFileSync(join(FUNCTIONS, file), 'utf8');
      const pep = source.indexOf('await enforceBotMessage(');
      const restaurant = source.indexOf('await runRestaurantConversationTurn(');
      expect(pep).toBeGreaterThan(-1);
      expect(restaurant).toBeGreaterThan(-1);
      expect(pep).toBeLessThan(restaurant);
    });
  }

  it('shared orchestrator requires explicit confirmation and server quote validation before insert', () => {
    const source = readFileSync(
      join(FUNCTIONS, '_shared/restaurant-conversation.ts'),
      'utf8',
    );
    const confirm = source.indexOf('isExplicitRestaurantOrderConfirmation(userText)');
    const resolve = source.indexOf('resolveRestaurantDraftQuote(bot.config, state.draft)');
    const persist = source.indexOf('const order = await persistConfirmedOrder(');

    expect(confirm).toBeGreaterThan(-1);
    expect(resolve).toBeGreaterThan(confirm);
    expect(persist).toBeGreaterThan(resolve);
    expect(source).toContain("gateFeature(admin, bot.tenant_id, 'bots.orders')");
    expect(source).toContain("pricing_authority: 'bots.config.restaurant.menu'");
    expect(source).toContain("confirmation_mode: 'explicit_text'");
  });

  it('conversation execution uses a deterministic UUID and handles duplicate insert conflicts', () => {
    const source = readFileSync(
      join(FUNCTIONS, '_shared/restaurant-conversation.ts'),
      'utf8',
    );
    expect(source).toContain('uuidFromHash');
    expect(source).toContain("code === '23505'");
    expect(source).toContain('draft_revision');
    expect(source).toContain('quote_hash');
  });
});
