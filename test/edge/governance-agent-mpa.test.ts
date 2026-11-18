// MP-A — Shell-Assistent (governance-agent, op chat): Policy vor und
// Evidence-Kette um die Tool-Schleife, beide fail-closed.

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  AGENT_CHAT_FEATURE,
  agentEvidenceInput,
  runGovernedAgentTurn,
  type AgentLoopResult,
  type GovernedTurnDeps,
} from '../../supabase/functions/_shared/agentGovernance.ts';
import type { AiEvidenceEventInsert } from '../../supabase/functions/_shared/aiGateway/callEvidence.ts';
import type { GuardedDecision } from '../../supabase/functions/_shared/aiGateway/pdpGuard.ts';

const TENANT = '11111111-1111-1111-1111-111111111111';
const USER = '22222222-2222-2222-2222-222222222222';
const MESSAGE = 'Welche DSFA ist für unser Bewerbertool fällig?';
const ctx = { tenantId: TENANT, userId: USER, message: MESSAGE, provider: 'anthropic', model: 'claude-sonnet' };
const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

const allow: GuardedDecision = { decision: 'allow', reasons: [], matched_policy_ids: [], primary_policy_id: null };
const loopOk: AgentLoopResult = { ok: true, model: 'claude-sonnet', inputTokens: 100, outputTokens: 20 };

function setup(over: Partial<GovernedTurnDeps<GuardedDecision>> = {}) {
  const rows: AiEvidenceEventInsert[] = [];
  const deps: GovernedTurnDeps<GuardedDecision> = {
    mode: 'enforce',
    decide: async () => allow,
    recordEvidence: async (row) => { rows.push(row); },
    newId: () => 'req-1',
    log: () => {},
    ...over,
  };
  const loop = vi.fn(async () => loopOk);
  return { rows, deps, loop };
}

describe('MP-A runGovernedAgentTurn', () => {
  it('Erfolg: started → Schleife → ai:call, request_id überall gleich', async () => {
    const { rows, deps, loop } = setup();
    const r = await runGovernedAgentTurn(deps, ctx, loop);
    expect(r.kind).toBe('ran');
    expect(r.requestId).toBe('req-1');
    expect(loop).toHaveBeenCalledOnce();
    expect(rows.map((x) => x.event_type)).toEqual(['ai:call_started', 'ai:call']);
    for (const row of rows) {
      expect(row.tenant_id).toBe(TENANT);
      expect(row.evidence.request_id).toBe('req-1');
      expect(row.evidence.feature).toBe(AGENT_CHAT_FEATURE);
      expect(row.evidence.residency).toBe('cloud');
    }
    expect(rows[1].evidence.total_tokens).toBe(120);
  });

  it('input_sha256 = SHA-256 der auf 4.000 Zeichen gekürzten Nachricht', async () => {
    const long = 'ä'.repeat(4500);
    const { rows, deps, loop } = setup();
    await runGovernedAgentTurn(deps, { ...ctx, message: long }, loop);
    expect(rows[1].evidence.input_sha256).toBe(sha(long.slice(0, 4000)));
    expect(rows[1].evidence.input_length).toBe(4000);
    expect(agentEvidenceInput(long)).toHaveLength(4000);
  });

  it('Evidence enthält weder Nachricht noch Antwort', async () => {
    const { rows, deps } = setup();
    await runGovernedAgentTurn(deps, ctx, async () => ({ ...loopOk }));
    const json = JSON.stringify(rows);
    expect(json).not.toContain(MESSAGE);
    expect(json).not.toContain('Bewerbertool');
  });

  it('PDP block (enforce): kein Provider, 403, ai:call_blocked', async () => {
    const { rows, deps, loop } = setup({
      decide: async () => ({ decision: 'block', reasons: [{ text_de: 'Verboten' }], matched_policy_ids: ['p'], primary_policy_id: null }),
    });
    const r = await runGovernedAgentTurn(deps, ctx, loop);
    expect(r).toMatchObject({ kind: 'denied', status: 403, code: 'POLICY_BLOCKED' });
    expect(loop).not.toHaveBeenCalled();
    expect(rows.map((x) => x.event_type)).toEqual(['ai:call_blocked']);
  });

  it('PDP require_approval (enforce): 403 APPROVAL_REQUIRED, kein Provider', async () => {
    const { deps, loop } = setup({
      decide: async () => ({ decision: 'require_approval', reasons: [], matched_policy_ids: [], primary_policy_id: null }),
    });
    const r = await runGovernedAgentTurn(deps, ctx, loop);
    expect(r).toMatchObject({ kind: 'denied', status: 403, code: 'APPROVAL_REQUIRED' });
    expect(loop).not.toHaveBeenCalled();
  });

  it('PDP-Fehler: 503 fail-closed, kein Provider, keine Evidence', async () => {
    const { rows, deps, loop } = setup({ mode: 'shadow', decide: async () => { throw new Error('db down'); } });
    const r = await runGovernedAgentTurn(deps, ctx, loop);
    expect(r).toMatchObject({ kind: 'denied', status: 503, code: 'POLICY_UNAVAILABLE' });
    expect(loop).not.toHaveBeenCalled();
    expect(rows).toHaveLength(0);
  });

  it('Shadow-Block wird nicht durchgesetzt', async () => {
    const { deps, loop } = setup({
      mode: 'shadow',
      decide: async () => ({ decision: 'block', reasons: [], matched_policy_ids: [], primary_policy_id: null }),
    });
    expect((await runGovernedAgentTurn(deps, ctx, loop)).kind).toBe('ran');
    expect(loop).toHaveBeenCalledOnce();
  });

  it('Reservierung schlägt fehl: 503 EVIDENCE_UNAVAILABLE, kein Provider', async () => {
    const { deps, loop } = setup({ recordEvidence: async () => { throw new Error('insert failed'); } });
    const r = await runGovernedAgentTurn(deps, ctx, loop);
    expect(r).toMatchObject({ kind: 'evidence_unavailable', status: 503 });
    expect(loop).not.toHaveBeenCalled();
  });

  it('Abschluss schlägt fehl: 503 EVIDENCE_WRITE_FAILED', async () => {
    let n = 0;
    const { deps, loop } = setup({
      recordEvidence: async () => { n++; if (n === 2) throw new Error('insert failed'); },
    });
    const r = await runGovernedAgentTurn(deps, ctx, loop);
    expect(r).toMatchObject({ kind: 'evidence_write_failed', status: 503, code: 'EVIDENCE_WRITE_FAILED' });
  });

  it('fehlgeschlagene Schleife → ai:call_failed mit Fehlercode', async () => {
    const { rows, deps } = setup();
    await runGovernedAgentTurn(deps, ctx, async () => ({ ...loopOk, ok: false, errorCode: 'llm_error' }));
    expect(rows[1].event_type).toBe('ai:call_failed');
    expect(rows[1].evidence.error_code).toBe('llm_error');
  });

  it('Modus off: keine PDP-Abfrage, Evidence trotzdem', async () => {
    const decide = vi.fn(async () => allow);
    const { rows, deps, loop } = setup({ mode: 'off', decide });
    expect((await runGovernedAgentTurn(deps, ctx, loop)).kind).toBe('ran');
    expect(decide).not.toHaveBeenCalled();
    expect(rows).toHaveLength(2);
  });
});

describe('MP-A Quelltext-Wächter governance-agent', () => {
  const src = readFileSync('supabase/functions/governance-agent/index.ts', 'utf8');

  it('chat läuft durch runGovernedAgentTurn und liefert request_id', () => {
    expect(src).toContain('runGovernedAgentTurn<');
    expect(src).toMatch(/request_id: requestId,\n\s+response: finalText/);
  });

  it('Abschluss-Fehler hält die Antwort zurück, speichert nur den Verlauf vor dem Zug', () => {
    expect(src).toContain("jsonError(503, 'EVIDENCE_WRITE_FAILED'");
    expect(src).toContain("history: governed.kind === 'ran' ? history : priorHistory,");
  });

  it('Sitzung wird auch im Fehlerpfad angelegt und der agent_runs-Insert geprüft', () => {
    expect(src).not.toMatch(/if \(governed\.kind === 'ran'\) \{\n\s+await admin\.from\('agent_sessions'\)/);
    expect(src).toContain('const { error: runInsertError } = await admin.from(\'agent_runs\').insert(');
    expect(src).toContain("event: 'insert_failed'");
  });
});
