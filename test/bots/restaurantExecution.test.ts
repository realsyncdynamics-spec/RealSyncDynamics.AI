import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  executeRestaurantOrder,
  executeRestaurantTarget,
  initialRestaurantExecutionState,
  type RestaurantExecutionAdapter,
  type RestaurantExecutionOrder,
} from '../../supabase/functions/_shared/restaurant-execution';

const order: RestaurantExecutionOrder = {
  order_id: '00000000-0000-5000-8000-000000000001',
  tenant_id: 'tenant-1',
  bot_id: 'bot-1',
  customer_name: 'Max Mustermann',
  contact: '+491234567',
  items: [{ item_id: 'pizza', name: 'Pizza', qty: 1, unit_price: 12.9, line_total: 12.9 }],
  total_amount: 12.9,
  currency: 'EUR',
  fulfillment: 'pickup',
  delivery_address: null,
  notes: null,
};

function adapter(
  target: 'pos' | 'kitchen',
  verifyStatus: 'pending' | 'accepted' | 'failed',
): RestaurantExecutionAdapter {
  return {
    id: `test-${target}`,
    target,
    async submit() {
      return { submission_id: 'submission-1', external_id: 'external-1' };
    },
    async verify() {
      return {
        status: verifyStatus,
        external_id: 'external-1',
        ...(verifyStatus === 'failed' ? { error_code: 'REJECTED' } : {}),
      };
    },
  };
}

describe('restaurant execution adapter contract', () => {
  it('starts fail-honest: POS and kitchen are not configured', () => {
    expect(initialRestaurantExecutionState()).toEqual({
      version: 1,
      pos: {
        status: 'not_configured',
        adapter_id: null,
        external_id: null,
        submitted_at: null,
        verified_at: null,
        error_code: null,
      },
      kitchen: {
        status: 'not_configured',
        adapter_id: null,
        external_id: null,
        submitted_at: null,
        verified_at: null,
        error_code: null,
      },
    });
  });

  it('does not claim accepted when submission exists but verification is pending', async () => {
    const state = await executeRestaurantTarget(adapter('pos', 'pending'), order);
    expect(state.status).toBe('pending');
    expect(state.adapter_id).toBe('test-pos');
    expect(state.external_id).toBe('external-1');
    expect(state.verified_at).toBeTruthy();
  });

  it('marks accepted only after the adapter verification says accepted', async () => {
    const state = await executeRestaurantTarget(adapter('kitchen', 'accepted'), order);
    expect(state.status).toBe('accepted');
    expect(state.adapter_id).toBe('test-kitchen');
    expect(state.external_id).toBe('external-1');
    expect(state.verified_at).toBeTruthy();
  });

  it('captures submission failure without pretending an external order exists', async () => {
    const failing: RestaurantExecutionAdapter = {
      id: 'broken-pos',
      target: 'pos',
      async submit() {
        throw Object.assign(new Error('offline'), { code: 'POS_OFFLINE' });
      },
      async verify() {
        throw new Error('must not run');
      },
    };

    const state = await executeRestaurantTarget(failing, order);
    expect(state.status).toBe('failed');
    expect(state.external_id).toBeNull();
    expect(state.error_code).toBe('POS_OFFLINE');
  });

  it('keeps POS and kitchen results independent', async () => {
    const state = await executeRestaurantOrder(order, {
      pos: adapter('pos', 'accepted'),
      kitchen: adapter('kitchen', 'failed'),
    });

    expect(state.pos.status).toBe('accepted');
    expect(state.kitchen.status).toBe('failed');
  });

  it('does not execute anything when adapters are absent', async () => {
    const state = await executeRestaurantOrder(order, {});
    expect(state.pos.status).toBe('not_configured');
    expect(state.kitchen.status).toBe('not_configured');
  });
});

describe('restaurant order creation initializes execution evidence', () => {
  it('conversation orders initialize POS and kitchen state', () => {
    const source = readFileSync(
      resolve(__dirname, '../../supabase/functions/_shared/restaurant-conversation.ts'),
      'utf8',
    );
    expect(source).toContain("import { initialRestaurantExecutionState } from './restaurant-execution.ts'");
    expect(source).toContain('execution: initialRestaurantExecutionState()');
  });

  it('order-intake initializes the same execution state', () => {
    const source = readFileSync(
      resolve(__dirname, '../../supabase/functions/order-intake/index.ts'),
      'utf8',
    );
    expect(source).toContain("import { initialRestaurantExecutionState } from '../_shared/restaurant-execution.ts'");
    expect(source).toContain('execution: initialRestaurantExecutionState()');
  });

  it('no provider-specific POS or kitchen network endpoint is hard-coded in the adapter contract', () => {
    const source = readFileSync(
      resolve(__dirname, '../../supabase/functions/_shared/restaurant-execution.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/https?:\/\//);
    expect(source).not.toContain('fetch(');
    expect(source).not.toMatch(/lightspeed|orderbird|ready2order/i);
  });
});
