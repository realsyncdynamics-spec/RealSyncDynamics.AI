import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const service = readFileSync('services/playwright-scanner/src/index.ts', 'utf8');
const executor = readFileSync('services/playwright-scanner/src/browserExecutor.ts', 'utf8');
const edge = readFileSync('supabase/functions/browser-execute/index.ts', 'utf8');
const client = readFileSync('src/features/governance/browser/browserExecutorClient.ts', 'utf8');

describe('governed browser executor contract', () => {
  it('keeps browser execution behind the scanner secret and a dedicated /execute route', () => {
    expect(service).toContain("app.post('/execute'");
    expect(service).toContain('SCANNER_SECRET');
    expect(executor).toContain('PRIVATE_NETWORK_BLOCKED');
    expect(executor).toContain('MAX_ACTIONS = 25');
  });

  it('requires real user + tenant membership before the executor is called', () => {
    expect(edge).toContain('requireAuthAndTenant');
    expect(edge.indexOf('requireAuthAndTenant')).toBeLessThan(edge.indexOf("PLAYWRIGHT_SCANNER_URL"));
    expect(edge).toContain('APPROVAL_REQUIRED');
    expect(edge).toContain('APPROVAL_MISMATCH');
    expect(edge).toContain('APPROVAL_ALREADY_USED');
  });

  it('requires approval for click and keeps the client on the user JWT path', () => {
    expect(edge).toContain("action.type === 'click'");
    expect(client).toContain('session.access_token');
    expect(client).toContain('/functions/v1/browser-execute');
    expect(client).not.toContain('service_role');
  });
});
