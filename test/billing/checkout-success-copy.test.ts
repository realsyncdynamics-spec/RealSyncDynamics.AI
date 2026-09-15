import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SUCCESS = readFileSync(resolve('src/pages/CheckoutSuccess.tsx'), 'utf8');
const DASHBOARD = readFileSync(
  resolve('src/features/governance/dashboard/ComplianceStatusDashboard.tsx'),
  'utf8',
);

describe('CheckoutSuccess — German product copy', () => {
  it('uses German success/error chrome (no English primary CTAs)', () => {
    expect(SUCCESS).toContain('Zahlung erfolgreich');
    expect(SUCCESS).toContain('Jetzt zum Dashboard');
    expect(SUCCESS).toContain('Checkout unvollständig');
    expect(SUCCESS).not.toContain('Payment Successful');
    expect(SUCCESS).not.toContain('Go to Dashboard');
    expect(SUCCESS).not.toContain('Checkout Incomplete');
  });

  it('does not claim Abo aktiv while webhook sync is still pending', () => {
    expect(SUCCESS).toContain('syncPending');
    expect(SUCCESS).toContain('Zahlung bestätigt — Sync ausstehend');
    expect(SUCCESS).toContain('checkout-sync-pending');
    expect(SUCCESS).toContain("params.set('sync', 'pending')");
    expect(SUCCESS).toContain('Sync erneut prüfen');
    // Soft-continue must mark sync=pending — never redirect as unlocked.
    expect(SUCCESS).toMatch(/if \(last\?\.pending\)/);
  });
});

describe('ComplianceStatusDashboard — post-checkout honesty', () => {
  it('shows sync-pending banner instead of Abo aktiv when sync=pending', () => {
    expect(DASHBOARD).toContain('post-checkout-sync-pending');
    expect(DASHBOARD).toContain('Zahlung eingegangen · Abo-Sync ausstehend');
    expect(DASHBOARD).toContain("postCheckoutSync === 'pending'");
    expect(DASHBOARD).toContain('postCheckoutSyncPending');
    // Active CTA remains for the synced path only.
    expect(DASHBOARD).toContain('!postCheckoutSyncPending');
    expect(DASHBOARD).toContain('Abo aktiv');
  });
});
