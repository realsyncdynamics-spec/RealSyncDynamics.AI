import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const productionScanner = readFileSync('deploy/playwright-scanner/server.ts', 'utf8');
const productionExecutor = readFileSync('deploy/playwright-scanner/executor.ts', 'utf8');
const edge = readFileSync('supabase/functions/browser-execute/index.ts', 'utf8');
const client = readFileSync('src/features/governance/browser/browserExecutorClient.ts', 'utf8');
const productionRegistry = readFileSync('src/config/production-edge-functions.ts', 'utf8');

describe('governed browser executor contract', () => {
  it('keeps production browser execution behind the scanner secret and /execute', () => {
    expect(productionScanner).toContain("url === '/execute'");
    expect(productionScanner).toContain('SCANNER_API_KEY');
    expect(productionScanner).toContain('executeBrowserActions');
    expect(productionExecutor).toContain('PRIVATE_NETWORK_BLOCKED');
    expect(productionExecutor).toContain('MAX_ACTIONS = 25');
    expect(productionExecutor).toContain("context.route('**/*', routeGuard)");
  });

  it('requires real user + tenant membership before executor access', () => {
    expect(edge).toContain('requireAuthAndTenant');
    expect(edge.indexOf('requireAuthAndTenant')).toBeLessThan(edge.indexOf("PLAYWRIGHT_SCANNER_URL"));
    expect(edge).toContain('APPROVAL_REQUIRED');
    expect(edge).toContain('APPROVAL_MISMATCH');
    expect(edge).toContain('APPROVAL_ALREADY_USED');
    expect(edge).toContain("MUTATING_ACTIONS");
    expect(edge).toContain("'click', 'type', 'select'");
  });

  it('does not persist typed values or inline screenshots as governance evidence', () => {
    expect(edge).toContain('redactActions');
    expect(edge).toContain('[redacted:');
    expect(edge).toContain('sanitizeExecutorPayload');
    expect(edge).toContain("key === 'screenshot_base64'");
    expect(edge).toContain("persisted_inline: false");
    expect(edge).toContain("browser:v1:");
  });

  it('keeps the browser client on the user JWT path and exposes a health probe', () => {
    expect(client).toContain('session.access_token');
    expect(client).toContain('/functions/v1/browser-execute');
    expect(client).toContain("op: 'health'");
    expect(client).not.toContain('service_role');
  });

  it('records browser-execute as measured production state', () => {
    expect(productionRegistry).toContain("'browser-execute'");
    expect(productionRegistry).toContain('EDGE_FUNCTIONS_OBSERVED_MAX = 191');
    expect(productionRegistry).not.toContain("{ slug: 'browser-execute'");
  });
});
