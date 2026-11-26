// REA im Shell-Assistenten: mit request_id (MP-A) → Hash-Kette, sonst agent_runs.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const hook = readFileSync('src/features/governance/AgentWidget/useAgentChat.ts', 'utf8');
const source = readFileSync('src/features/rea/supabaseSource.ts', 'utf8');

describe('REA im Assistenten', () => {
  it('nutzt attestCall, wenn der Server eine request_id liefert', () => {
    expect(hook).toMatch(/if \(requestId\) \{[\s\S]*attestCall\(source, \{ tenantId, traceId: requestId, input: message\.slice\(0, 4000\) \}\)/);
    expect(hook).toContain('result.data.request_id');
  });

  it('fällt ohne request_id auf agent_runs zurück', () => {
    expect(hook).toContain('return attestAgentRun(source, { tenantId, sessionId, message, sentAt });');
  });

  it('belegt nur den Abschluss-Eintrag ai:call, nicht ai:call_started', () => {
    expect(source).toContain(".eq('event_type', 'ai:call')");
  });
});
