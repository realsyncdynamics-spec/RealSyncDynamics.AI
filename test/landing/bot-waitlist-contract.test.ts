import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../..');
const salesLead = readFileSync(resolve(root, 'supabase/functions/sales-lead/index.ts'), 'utf8');
const migration = readFileSync(resolve(root, 'supabase/migrations/20260819000100_waitlist_bots_interest.sql'), 'utf8');
const waitlistForm = readFileSync(resolve(root, 'src/components/landing/WaitlistForm.tsx'), 'utf8');

const BOT = 'bots';

describe('Bot-Warteliste — use_case contract', () => {
  it('frontend sends the canonical bots interest value', () => {
    expect(waitlistForm).toContain('bots');
  });

  it('sales-lead accepts bots instead of mapping it to other', () => {
    expect(salesLead).toMatch(/WAITLIST_INTERESTS\s*=\s*\[[^\]]*['"]bots['"]/s);
    expect(salesLead).toContain('WAITLIST_INTERESTS.includes(interestRaw)');
  });

  it('database constraint accepts the same canonical value', () => {
    expect(migration).toContain("'bots'");
    expect(migration).toContain('waitlist_signups_interest_check');
  });

  it('the three layers use one canonical value', () => {
    expect(waitlistForm).toContain(BOT);
    expect(salesLead).toContain(BOT);
    expect(migration).toContain(BOT);
  });
});
