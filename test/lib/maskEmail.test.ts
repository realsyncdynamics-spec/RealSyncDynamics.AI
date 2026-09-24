import { describe, expect, it } from 'vitest';
import { maskEmail } from '../../src/lib/maskEmail';

describe('maskEmail', () => {
  it('masks local part, keeps domain', () => {
    expect(maskEmail('steinerdominik1982@gmail.com')).toBe('s***@gmail.com');
    expect(maskEmail('a@b.co')).toBe('a***@b.co');
  });

  it('handles empty / invalid', () => {
    expect(maskEmail('')).toBe('***');
    expect(maskEmail('nodomain')).toBe('***');
    expect(maskEmail('@x.com')).toBe('***');
  });
});
