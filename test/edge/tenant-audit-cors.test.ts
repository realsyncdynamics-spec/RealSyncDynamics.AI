/**
 * Regression: „Scan-Dienst nicht erreichbar" unter /app/websites.
 *
 * Der Client schickt `X-Tenant-Id` an tenant-audit. Erlaubt der CORS-Preflight
 * den Header nicht, blockiert der Browser den POST und fetch() wirft — die
 * Function läuft nie. Hier wird gesichert, dass jeder eigene Request-Header
 * des Clients in der Preflight-Antwort von tenant-audit steht.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildCorsHeaders } from '../../supabase/functions/_shared/gateway';

const ROOT = resolve(__dirname, '../..');
const FN_SRC = readFileSync(resolve(ROOT, 'supabase/functions/tenant-audit/index.ts'), 'utf8');
const CLIENT_SRC = readFileSync(resolve(ROOT, 'src/features/governance/scans/scansApi.ts'), 'utf8');

function allowList(headers: Record<string, string>): string[] {
  return headers['Access-Control-Allow-Headers'].split(',').map((h) => h.trim().toLowerCase());
}

describe('buildCorsHeaders', () => {
  it('keeps the standard headers by default', () => {
    expect(allowList(buildCorsHeaders())).toEqual(['authorization', 'x-client-info', 'apikey', 'content-type']);
  });

  it('appends extra headers', () => {
    expect(allowList(buildCorsHeaders('POST, OPTIONS', ['x-tenant-id']))).toContain('x-tenant-id');
  });
});

describe('tenant-audit preflight', () => {
  it('answers OPTIONS with the x-tenant-id allow-list', () => {
    expect(FN_SRC).toMatch(/buildCorsHeaders\('POST, OPTIONS', \['x-tenant-id'\]\)/);
    expect(FN_SRC).toMatch(/handleOptions\(req, preflightHeaders\)/);
  });

  it('allows every header the client sends', () => {
    const triggerBlock = CLIENT_SRC.slice(CLIENT_SRC.indexOf('export async function triggerTenantAudit'));
    const headersBlock = triggerBlock.slice(triggerBlock.indexOf('headers:'), triggerBlock.indexOf('body:'));
    const sent = [...headersBlock.matchAll(/'([A-Za-z-]+)':/g)].map((m) => m[1].toLowerCase());
    expect(sent).toContain('x-tenant-id');
    const allowed = allowList(buildCorsHeaders('POST, OPTIONS', ['x-tenant-id']));
    for (const h of sent) expect(allowed).toContain(h);
  });
});
