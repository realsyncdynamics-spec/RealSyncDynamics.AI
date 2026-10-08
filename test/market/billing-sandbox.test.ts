import { describe, expect, it } from 'vitest';
import { sandboxApply, sandboxListing } from '../../src/features/market/billingSandbox';

describe('billing sandbox', () => {
  it('startet als Starter ohne Add-ons und mit buchbarem WhatsApp', () => {
    const listing = sandboxListing();
    expect(listing.plan.plan_key).toBe('starter');
    expect(listing.totals.monthly_eur).toBe(79);
    const whatsapp = listing.addons.find((a) => a.id === 'whatsapp');
    expect(whatsapp?.status).toBe('bookable');
    expect(whatsapp?.price_eur).toBe(99);
    expect(whatsapp?.preview.new_monthly_eur).toBe(178);
  });

  it('addiert WhatsApp nur im Speicher', () => {
    const booked = sandboxApply([], 'add', 'whatsapp', 1);
    const listing = sandboxListing(booked);
    expect(listing.totals.monthly_eur).toBe(178);
    expect(listing.addons.find((a) => a.id === 'whatsapp')?.status).toBe('booked');
    const weg = sandboxApply(booked, 'remove', 'whatsapp');
    expect(sandboxListing(weg).totals.monthly_eur).toBe(79);
  });
});
