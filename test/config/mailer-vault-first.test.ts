import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else if (entry.name.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

describe('Resend vault-first mailer', () => {
  const root = join(process.cwd(), 'supabase/functions');
  const files = walk(root);

  it('keeps api.resend.com only in _shared/mailer.ts', () => {
    const offenders = files.filter((f) => {
      if (f.endsWith('_shared/mailer.ts')) return false;
      return readFileSync(f, 'utf8').includes('api.resend.com');
    });
    expect(offenders).toEqual([]);
  });

  it('does not read RESEND_API_KEY outside mailer.ts', () => {
    const offenders = files.filter((f) => {
      if (f.endsWith('_shared/mailer.ts')) return false;
      const text = readFileSync(f, 'utf8');
      return text.includes("Deno.env.get('RESEND_API_KEY')") || text.includes('Deno.env.get("RESEND_API_KEY")');
    });
    expect(offenders).toEqual([]);
  });
});
