import { describe, expect, it } from 'vitest';
import { sandboxApply, sandboxListing } from '../../src/features/market/billingSandbox';

describe('billing sandbox', () => {
  it('startet als Starter ohne Add-ons und mit buchbarer Domain', () => {
    const listing = sandboxListing();
    expect(listing.plan.plan_key).toBe('starter');
    expect(listing.totals.monthly_eur).toBe(79);
    const domain = listing.addons.find((a) => a.id === 'additional_domain');
    expect(domain?.status).toBe('bookable');
    expect(domain?.price_eur).toBe(19);
    expect(domain?.preview.new_monthly_eur).toBe(98);
  });

  it('addiert eine Domain nur im Speicher', () => {
    const booked = sandboxApply([], 'add', 'additional_domain', 1);
    const listing = sandboxListing(booked);
    expect(listing.totals.monthly_eur).toBe(98);
    expect(listing.addons.find((a) => a.id === 'additional_domain')?.status).toBe('booked');
    const weg = sandboxApply(booked, 'remove', 'additional_domain');
    expect(sandboxListing(weg).totals.monthly_eur).toBe(79);
  });
});
