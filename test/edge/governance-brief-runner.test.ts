// Daily-Brief (Nachfolger von #1592): Payload des Governance-Brief-Runners
// und lesbarer Fehlertext im Runner-Report / Function-Log.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Pfade relativ zum Repo-Root (URL-Auflösung über das Modul scheitert unter jsdom).
const repoFile = (p: string) => resolve(__dirname, '../..', p);

describe('Governance-Brief-Runner — Payload und Fehlertext', () => {
  const src = readFileSync(repoFile('supabase/functions/_shared/agents/governanceBriefRunner.ts'), 'utf8');

  it('sendet input als String und den Systemprompt in system_prompt', () => {
    expect(src).not.toMatch(/input:\s*\{\s*system/);
    expect(src).toMatch(/input:\s*user,/);
    expect(src).toMatch(/system_prompt:\s*system,/);
    expect(src).toMatch(/tenant_id:\s*tenantId/);
    expect(src).toContain("internalGatewayConfig('agent-os-runner'");
  });

  it('describeGatewayError liefert Status + stabilen Code + gekürzte Meldung', async () => {
    const { describeGatewayError } = await import('../../supabase/functions/_shared/agents/governanceBriefRunner.ts');
    const resp = new Response(JSON.stringify({ ok: false, error: { code: 'UPSTREAM_REJECTED', message: 'm'.repeat(500) } }), { status: 502 });
    const msg = await describeGatewayError(resp);
    expect(msg.startsWith('ai-gateway 502 UPSTREAM_REJECTED: ')).toBe(true);
    expect(msg.length).toBeLessThan(260);
    expect(await describeGatewayError(new Response('not json', { status: 500 }))).toBe('ai-gateway 500: not json');
  });

  it('agent-os-runner schreibt brief_failed ins Function-Log', () => {
    const runner = readFileSync(repoFile('supabase/functions/agent-os-runner/index.ts'), 'utf8');
    expect(runner).toContain("event: 'brief_failed'");
  });
});
