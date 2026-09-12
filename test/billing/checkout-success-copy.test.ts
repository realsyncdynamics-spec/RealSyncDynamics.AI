import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SUCCESS = readFileSync(resolve('src/pages/CheckoutSuccess.tsx'), 'utf8');

describe('CheckoutSuccess — German product copy', () => {
  it('uses German success/error chrome (no English primary CTAs)', () => {
    expect(SUCCESS).toContain('Zahlung erfolgreich');
    expect(SUCCESS).toContain('Jetzt zum Dashboard');
    expect(SUCCESS).toContain('Checkout unvollständig');
    expect(SUCCESS).not.toContain('Payment Successful');
    expect(SUCCESS).not.toContain('Go to Dashboard');
    expect(SUCCESS).not.toContain('Checkout Incomplete');
  });
});
