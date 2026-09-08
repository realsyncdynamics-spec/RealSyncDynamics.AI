import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const KEYS = ['goal', 'hours', 'services', 'handoffPhone', 'notes'] as const;

describe('Bot-Wissen — Schlüsselparität', () => {
  it('Frontend und Edge Function lesen dieselben knowledge-Felder', () => {
    const edge = readFileSync(resolve(__dirname, '../../supabase/functions/_shared/bots.ts'), 'utf8');
    const front = readFileSync(resolve(__dirname, '../../src/features/bots/templates.ts'), 'utf8');

    for (const key of KEYS) {
      expect(edge, `Edge Function kennt knowledge.${key} nicht`).toContain(`k.${key}`);
      expect(front, `Frontend kennt knowledge.${key} nicht`).toContain(`k.${key}`);
    }
  });
});
