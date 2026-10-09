import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(__dirname, '../../e2e/landing-signup-checkout.spec.ts'),
  'utf8',
);

describe('E2E credential hygiene', () => {
  it('loads signup credentials only from environment variables', () => {
    expect(source).toContain("process.env.E2E_TEST_EMAIL");
    expect(source).toContain("process.env.E2E_TEST_PASSWORD");
    expect(source).toContain("test.skip(");
    expect(source).not.toMatch(/const\s+TEST_EMAIL\s*=\s*['"][^'"]+@[^'"]+['"]/);
    expect(source).not.toMatch(/const\s+TEST_PASSWORD\s*=\s*['"][^'"]+['"]/);
  });
});
