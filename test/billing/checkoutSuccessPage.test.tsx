import { describe, beforeEach, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

type QueryResult = { data: unknown; error: Error | null };

let grantResult: QueryResult;
let subscriptionResult: QueryResult;

vi.mock('../../src/core/access/TenantProvider', () => ({
  useTenant: () => ({ activeTenantId: 'tenant-1' }),
}));

vi.mock('../../src/lib/supabase', () => ({
  getSupabase: () => ({
    from: (table: string) => ({
      select: () => {
        const result = table === 'entitlement_grants' ? grantResult : subscriptionResult;
        const query = {
          eq: vi.fn(() => query),
          order: vi.fn(() => query),
          limit: vi.fn(() => query),
          maybeSingle: vi.fn().mockResolvedValue(result),
        };
        return query;
      },
    }),
  }),
}));

import { CheckoutSuccessPage } from '../../src/features/billing/CheckoutSuccessPage';

function renderSuccess(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/checkout/success${search}`]}>
      <CheckoutSuccessPage />
    </MemoryRouter>,
  );
}

describe('CheckoutSuccessPage', () => {
  beforeEach(() => {
    grantResult = { data: null, error: null };
    subscriptionResult = { data: null, error: null };
  });

  it('confirms an active one-time grant by Stripe Checkout Session ID', async () => {
    grantResult = { data: { plan_key: 'governance_launch' }, error: null };
    subscriptionResult = {
      data: { plan_key: 'growth', status: 'active', trial_end: null },
      error: null,
    };

    const { getByText, queryByText } = renderSuccess('?session_id=cs_one_time&plan_key=governance_launch');

    await waitFor(() => expect(getByText('Einmalige Freischaltung bestätigt')).toBeTruthy());
    expect(getByText(/Governance Launch ist dauerhaft/)).toBeTruthy();
    expect(getByText('Growth ansehen')).toBeTruthy();
    expect(queryByText('Abonnement bestätigt')).toBeNull();
  });

  it('keeps recurring subscriptions on their existing confirmation path', async () => {
    subscriptionResult = {
      data: { plan_key: 'growth', status: 'trialing', trial_end: '2026-09-01T00:00:00.000Z' },
      error: null,
    };

    const { getByText } = renderSuccess('?session_id=cs_subscription&plan_key=growth');

    await waitFor(() => expect(getByText('Abonnement bestätigt')).toBeTruthy());
    expect(getByText(/Growth ist trialing/)).toBeTruthy();
  });

  it('shows a retryable fulfillment state while a one-time webhook is pending', async () => {
    const { getByText } = renderSuccess('?session_id=cs_pending&plan_key=governance_launch');

    await waitFor(() => expect(getByText('Freischaltung wird abgeschlossen')).toBeTruthy());
    expect(getByText('Status aktualisieren')).toBeTruthy();
  });
});
