import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StripeAccountInfo } from '../../src/features/billing/StripeAccountInfo';

describe('StripeAccountInfo', () => {
  const mockOnOpenPortal = vi.fn();

  beforeEach(() => {
    mockOnOpenPortal.mockClear();
    vi.clearAllMocks();
  });

  it('shows "no account" message when stripeCustomerId is null', () => {
    render(
      <StripeAccountInfo
        stripeCustomerId={null}
        stripeSubscriptionId={null}
        status={null}
        cancelAtPeriodEnd={false}
        currentPeriodEnd={null}
        onOpenPortal={mockOnOpenPortal}
        canManage={true}
      />
    );

    expect(screen.getByText(/Kein Stripe-Konto verknüpft/i)).toBeInTheDocument();
  });

  it('displays customer ID when provided', () => {
    render(
      <StripeAccountInfo
        stripeCustomerId="cus_123456"
        stripeSubscriptionId={null}
        status="active"
        cancelAtPeriodEnd={false}
        currentPeriodEnd={null}
        onOpenPortal={mockOnOpenPortal}
        canManage={true}
      />
    );

    expect(screen.getByText('cus_123456')).toBeInTheDocument();
  });

  it('displays subscription ID when provided', () => {
    render(
      <StripeAccountInfo
        stripeCustomerId="cus_123456"
        stripeSubscriptionId="sub_789012"
        status="active"
        cancelAtPeriodEnd={false}
        currentPeriodEnd={null}
        onOpenPortal={mockOnOpenPortal}
        canManage={true}
      />
    );

    expect(screen.getByText('sub_789012')).toBeInTheDocument();
  });

  it('displays status correctly', () => {
    render(
      <StripeAccountInfo
        stripeCustomerId="cus_123456"
        stripeSubscriptionId="sub_789012"
        status="active"
        cancelAtPeriodEnd={false}
        currentPeriodEnd={null}
        onOpenPortal={mockOnOpenPortal}
        canManage={true}
      />
    );

    expect(screen.getByText('Aktiv')).toBeInTheDocument();
  });

  it('shows "Wird gekündigt" badge when cancelAtPeriodEnd is true', () => {
    render(
      <StripeAccountInfo
        stripeCustomerId="cus_123456"
        stripeSubscriptionId="sub_789012"
        status="active"
        cancelAtPeriodEnd={true}
        currentPeriodEnd="2026-08-01"
        onOpenPortal={mockOnOpenPortal}
        canManage={true}
      />
    );

    expect(screen.getByText('Wird gekündigt')).toBeInTheDocument();
  });

  it('displays period end date', () => {
    render(
      <StripeAccountInfo
        stripeCustomerId="cus_123456"
        stripeSubscriptionId="sub_789012"
        status="active"
        cancelAtPeriodEnd={false}
        currentPeriodEnd="2026-08-05"
        onOpenPortal={mockOnOpenPortal}
        canManage={true}
      />
    );

    expect(screen.getByText('5.8.2026')).toBeInTheDocument();
  });

  it('shows "Zum Stripe-Portal" link when canManage is true', () => {
    render(
      <StripeAccountInfo
        stripeCustomerId="cus_123456"
        stripeSubscriptionId={null}
        status="active"
        cancelAtPeriodEnd={false}
        currentPeriodEnd={null}
        onOpenPortal={mockOnOpenPortal}
        canManage={true}
      />
    );

    expect(screen.getByText(/Zum Stripe-Portal/)).toBeInTheDocument();
  });

  it('does not show management info when canManage is false', () => {
    render(
      <StripeAccountInfo
        stripeCustomerId="cus_123456"
        stripeSubscriptionId={null}
        status="active"
        cancelAtPeriodEnd={false}
        currentPeriodEnd={null}
        onOpenPortal={mockOnOpenPortal}
        canManage={false}
      />
    );

    expect(screen.queryByText(/Zum Stripe-Portal/)).not.toBeInTheDocument();
  });

  it('handles different status values', () => {
    const statuses = [
      ['trialing', 'In Testphase'],
      ['past_due', 'Überfällig'],
      ['canceled', 'Gekündigt'],
      ['unpaid', 'Unbezahlt'],
      ['incomplete', 'Unvollständig'],
    ];

    for (const [status, label] of statuses) {
      const { unmount } = render(
        <StripeAccountInfo
          stripeCustomerId="cus_123456"
          stripeSubscriptionId={null}
          status={status}
          cancelAtPeriodEnd={false}
          currentPeriodEnd={null}
          onOpenPortal={mockOnOpenPortal}
          canManage={true}
        />
      );

      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it('renders customer ID section when account is linked', () => {
    render(
      <StripeAccountInfo
        stripeCustomerId="cus_test123"
        stripeSubscriptionId={null}
        status="active"
        cancelAtPeriodEnd={false}
        currentPeriodEnd={null}
        onOpenPortal={mockOnOpenPortal}
        canManage={true}
      />
    );

    expect(screen.getByText('Kunden-ID')).toBeInTheDocument();
    expect(screen.getByText('cus_test123')).toBeInTheDocument();
  });
});
