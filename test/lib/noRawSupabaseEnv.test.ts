// Regression: Ein Deploy ohne gesetztes VITE_SUPABASE_URL erzeugte Requests
// gegen `/app/undefined/functions/v1/...` (u. a. Browser-Executor im Dashboard).
// Alle Aufrufer müssen die zentralen Helper mit Produktions-Fallback nutzen.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..', 'src');
const ALLOWED = new Set([
  'lib/supabaseUrl.ts',
  'lib/supabase.ts',
  // haben einen eigenen Fallback auf die Produktions-URL
  'pages/integrations/Shopify.tsx',
  'pages/integrations/ShopifySuccess.tsx',
  'pages/integrations/TelegramIntegration.tsx',
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe('Supabase-Basis-URL', () => {
  it('liest VITE_SUPABASE_URL/ANON_KEY nur über getSupabaseUrl()/getSupabaseAnonKey()', () => {
    const offenders = walk(ROOT)
      .map((f) => relative(ROOT, f).replace(/\\/g, '/'))
      .filter((rel) => !ALLOWED.has(rel))
      .filter((rel) =>
        /import\.meta\.env\.VITE_SUPABASE_(URL|ANON_KEY)\b/.test(readFileSync(join(ROOT, rel), 'utf8')),
      );
    expect(offenders).toEqual([]);
  });
});

// Regression: `fetch('/functions/v1/…')` ging relativ gegen den Pages-Host.
// Dort greift der SPA-Fallback (`/*  /index.html  200`) — die Ansicht bekam
// HTML statt JSON und blieb leer (u. a. ISO-42001-, DSGVO-, NIS2-Ansichten).
// Edge Functions laufen über supabase.functions.invoke, postEdgeFunction oder
// `${getSupabaseUrl()}/functions/v1/…`.
describe('Edge-Function-Aufrufe', () => {
  it('rufen /functions/v1 nie relativ zum SPA-Host auf', () => {
    const RELATIVE = /fetch\(\s*['"`]\/functions\/v1\//;
    // Auskommentierter Code ruft nichts auf.
    const code = (rel: string) =>
      readFileSync(join(ROOT, rel), 'utf8')
        .split('\n')
        .filter((line) => !/^\s*(\/\/|\*)/.test(line))
        .join('\n');
    const offenders = walk(ROOT)
      .map((f) => relative(ROOT, f).replace(/\\/g, '/'))
      .filter((rel) => !rel.includes('__tests__/'))
      .filter((rel) => RELATIVE.test(code(rel)));
    expect(offenders).toEqual([]);
  });
});
