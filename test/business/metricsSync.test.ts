import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The Edge Function (Deno) imports from supabase/functions/_shared/business-metrics.ts.
// The frontend (Vite) imports from src/lib/business/metrics.ts. They must stay
// logically identical — only the leading comment block may differ.

function stripLeadingCommentBlock(src: string): string {
  // Drop all consecutive lines at the top that start with `//` or are blank.
  const lines = src.split('\n');
  let i = 0;
  while (i < lines.length && (lines[i].startsWith('//') || lines[i].trim() === '')) i++;
  return lines.slice(i).join('\n');
}

describe('metrics module sync (frontend ↔ edge function)', () => {
  it('Deno copy stays in sync with src/lib/business/metrics.ts', () => {
    const frontend = readFileSync(
      resolve(__dirname, '../../src/lib/business/metrics.ts'),
      'utf8',
    );
    const edge = readFileSync(
      resolve(__dirname, '../../supabase/functions/_shared/business-metrics.ts'),
      'utf8',
    );
    expect(stripLeadingCommentBlock(edge)).toBe(stripLeadingCommentBlock(frontend));
  });
});
