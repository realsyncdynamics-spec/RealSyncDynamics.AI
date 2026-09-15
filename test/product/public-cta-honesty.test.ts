import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkoutHrefForPlan, planById } from '../../shared/pricing';

const NOT_FOUND = readFileSync(resolve('src/pages/NotFoundPage.tsx'), 'utf8');
const WELCOME = readFileSync(resolve('src/pages/Welcome.tsx'), 'utf8');

describe('Public CTAs — no pilot query', () => {
  it('checkoutHrefForPlan never appends pilot=true', () => {
    for (const id of ['starter', 'growth', 'agency'] as const) {
      const href = checkoutHrefForPlan(planById(id), { source: 'pricing' });
      expect(href).toMatch(/^\/checkout\//);
      expect(href).not.toMatch(/pilot=/);
    }
  });
});

describe('Dark/Gold/Cream public chrome', () => {
  it('NotFoundPage primary CTA is cream, not cyan', () => {
    expect(NOT_FOUND).toContain('bg-[#e8ddc8]');
    expect(NOT_FOUND).not.toContain('bg-cyan-400');
  });

  it('Welcome primary actions are cream/gold, not indigo/purple/white', () => {
    expect(WELCOME).toContain('Jetzt generieren');
    expect(WELCOME).toContain('bg-[#e8ddc8]');
    expect(WELCOME).not.toContain('bg-indigo-500');
    expect(WELCOME).not.toMatch(/bg-white px-6 py-3/);
  });
});
