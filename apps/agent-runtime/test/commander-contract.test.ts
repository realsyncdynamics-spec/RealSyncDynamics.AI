import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseVoiceCommanderProposal } from '../src/voice/commander-contract.js';

const trustedAgents = ['sales-agent', 'research-agent'];

describe('Voice Commander proposal parsing (never execution)', () => {
  it('accepts a simple inbox request as proposal only', () => {
    assert.deepEqual(parseVoiceCommanderProposal({ intent: 'read_inbox' }, trustedAgents), {
      ok: true, status: 'proposal_only', candidate: { intent: 'read_inbox' },
    });
  });

  it('accepts a bounded task draft for an agent in the trusted catalogue', () => {
    assert.deepEqual(
      parseVoiceCommanderProposal({
        intent: 'propose_task', agent: 'research-agent',
        instruction: '  Erstelle eine Marktübersicht.  ',
      }, trustedAgents),
      {
        ok: true, status: 'proposal_only',
        candidate: {
          intent: 'propose_task', agent: 'research-agent',
          instruction: 'Erstelle eine Marktübersicht.',
        },
      },
    );
  });

  it('never returns permission, execution or a fabricated task ID', () => {
    const outcome = parseVoiceCommanderProposal({
      intent: 'propose_task', agent: 'sales-agent', instruction: 'Leads priorisieren',
    }, trustedAgents);
    assert.equal(outcome.status, 'proposal_only');
    assert.equal('task_id' in outcome, false);
    assert.equal('authorized' in outcome, false);
  });

  it('rejects authoritative tenant or user claims embedded in model output', () => {
    for (const field of ['tenantId', 'tenant_id', 'role', 'userId', 'approved']) {
      assert.equal(
        parseVoiceCommanderProposal({ intent: 'read_inbox', [field]: 'admin' }, trustedAgents).ok,
        false,
        field,
      );
    }
  });

  it('rejects execution overrides and external URLs', () => {
    for (const field of ['execute', 'tool', 'url', 'grant', 'bypassPolicy']) {
      assert.equal(
        parseVoiceCommanderProposal({
          intent: 'propose_task', agent: 'sales-agent',
          instruction: 'Neue Kunden suchen', [field]: true,
        }, trustedAgents).ok,
        false,
        field,
      );
    }
  });

  it('rejects unknown agents even if syntactically valid', () => {
    const result = parseVoiceCommanderProposal({
      intent: 'propose_task', agent: 'finance-agent', instruction: 'Alles bezahlen',
    }, trustedAgents);
    assert.deepEqual(result, {
      ok: false, status: 'rejected', reason: 'agent_not_available',
    });
  });

  it('rejects empty trusted agent catalogue', () => {
    const result = parseVoiceCommanderProposal({
      intent: 'propose_task', agent: 'sales-agent', instruction: 'Leads suchen',
    }, []);
    assert.equal(result.ok, false);
  });

  it('rejects blank, non-string and oversized instructions', () => {
    for (const instruction of ['', '   ', 12, { text: 'hello' }, 'x'.repeat(1201)]) {
      const result = parseVoiceCommanderProposal({
        intent: 'propose_task', agent: 'sales-agent', instruction,
      }, trustedAgents);
      assert.deepEqual(result, {
        ok: false, status: 'rejected', reason: 'invalid_instruction',
      });
    }
  });

  it('rejects malicious agent labels and extra fields', () => {
    for (const agent of ['../sales', '__proto__', 'Sales Agent', 'a'.repeat(65)]) {
      assert.equal(parseVoiceCommanderProposal({
        intent: 'propose_task', agent, instruction: 'Test',
      }, trustedAgents).ok, false);
    }
    const payload = JSON.parse('{"intent":"read_inbox","__proto__":{"approved":true}}');
    assert.equal(parseVoiceCommanderProposal(payload, trustedAgents).ok, false);
  });

  it('rejects invalid input and unknown intent', () => {
    for (const input of [null, [], 'hello', 5, { intent: 'send_email' }, {}]) {
      assert.equal(parseVoiceCommanderProposal(input, trustedAgents).ok, false);
    }
  });
});
