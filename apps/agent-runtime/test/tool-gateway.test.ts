import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as contract from '../../../packages/agent-runtime-contracts/src/index.js';
import {
  VOICE_GENESIS_HASH,
  appendEvidenceLink,
  computeEvidenceHash,
} from '../src/voice/evidence-hash.js';
import {
  createMemoryVoiceStore,
  createVoiceToolGateway,
} from '../src/voice/tool-gateway.js';
import { VOICE_TOOL_EXECUTORS } from '../src/voice/tool-executors.js';
import type { VoicePolicyDecision } from '../src/voice-types.js';
import { CONTRACT_TOOL_NAMES } from '../src/voice-provider-types.js';
import { VOICE_AGENT_TOOLS } from '../src/voice-types.js';

function decision(
  overrides: Partial<VoicePolicyDecision> & Pick<VoicePolicyDecision, 'verdict'>,
): VoicePolicyDecision {
  return {
    decisionId: 'dec_1',
    requestId: 'req_1',
    sessionId: 'sess_1',
    tenantId: 'tenant_1',
    reason: 'test',
    risk: 'medium',
    piiDetected: false,
    auditRequired: true,
    trace: [{ check: 'audit', result: 'pass', detail: 'voice.channel.v1' }],
    decidedAt: '2026-10-06T12:00:00.000Z',
    decidedBy: 'policy-engine',
    ...overrides,
  };
}

describe('VoiceToolGateway — Policy-Gates', () => {
  it('führt bei DENY nicht aus und setzt verified=false', async () => {
    const store = createMemoryVoiceStore();
    const gateway = createVoiceToolGateway({ store });
    const result = await gateway.handle({
      tenantId: 'tenant_1',
      botId: 'bot_1',
      sessionId: 'sess_1',
      callId: 'call_deny',
      tool: 'schedule_appointment',
      args: { when: 'Fr 9:00', customer_name: 'Max' },
      decision: decision({ verdict: 'DENY', reason: 'blocked' }),
    });
    assert.equal(result.outcome, 'denied');
    assert.equal(result.verified, false);
    const evidence = await store.listEvidence('tenant_1', 'sess_1');
    assert.ok(evidence.some((e) => e.kind === 'policy.decision'));
    assert.ok(!evidence.some((e) => e.kind === 'tool.result'));
  });

  it('REQUIRE_CONFIRMATION ohne Bestätigung führt nicht aus', async () => {
    const store = createMemoryVoiceStore();
    const gateway = createVoiceToolGateway({ store });
    const result = await gateway.handle({
      tenantId: 'tenant_1',
      botId: 'bot_1',
      sessionId: 'sess_1',
      callId: 'call_conf',
      tool: 'schedule_appointment',
      args: { when: 'Fr 9:00', customer_name: 'Max' },
      decision: decision({ verdict: 'REQUIRE_CONFIRMATION' }),
      confirmed: false,
    });
    assert.equal(result.outcome, 'awaiting_confirmation');
    assert.equal(result.verified, false);
    const evidence = await store.listEvidence('tenant_1', 'sess_1');
    assert.ok(!evidence.some((e) => e.kind === 'tool.result'));
  });

  it('verified nur mit external_ref nach erfolgreicher Ausführung', async () => {
    const store = createMemoryVoiceStore();
    const gateway = createVoiceToolGateway({ store });
    const result = await gateway.handle({
      tenantId: 'tenant_1',
      botId: 'bot_1',
      sessionId: 'sess_1',
      callId: 'call_ok',
      tool: 'schedule_appointment',
      args: { when: '2026-10-10T09:00:00.000Z', customer_name: 'Max Mustermann' },
      decision: decision({ verdict: 'ALLOW', risk: 'medium' }),
    });
    assert.equal(result.outcome, 'executed');
    assert.equal(result.verified, true);
    assert.equal(typeof result.output.appointmentId, 'string');
    assert.ok(String(result.output.appointmentId).length > 0);
  });

  it('verwirft eingeschleustes tenantId/botId in Args', async () => {
    const store = createMemoryVoiceStore();
    const gateway = createVoiceToolGateway({ store });
    const result = await gateway.handle({
      tenantId: 'tenant_1',
      botId: 'bot_1',
      sessionId: 'sess_1',
      callId: 'call_inj',
      tool: 'schedule_appointment',
      args: {
        customer_name: 'Max',
        tenantId: 'tenant_evil',
        botId: 'bot_evil',
      },
      decision: decision({ verdict: 'ALLOW' }),
    });
    assert.equal(result.outcome, 'executed');
    assert.equal(result.verified, true);
    const evidence = await store.listEvidence('tenant_1', 'sess_1');
    assert.ok(!JSON.stringify(evidence).includes('evil'));
  });

  it('unbekanntes Tool → denied ohne Ausführung', async () => {
    const store = createMemoryVoiceStore();
    const gateway = createVoiceToolGateway({ store });
    const result = await gateway.handle({
      tenantId: 'tenant_1',
      botId: 'bot_1',
      sessionId: 'sess_1',
      callId: 'call_x',
      tool: 'transfer_money',
      args: {},
      decision: decision({ verdict: 'ALLOW' }),
    });
    assert.equal(result.outcome, 'denied');
    assert.equal(result.output.reason, 'unknown_tool');
  });
});

describe('VoiceToolGateway — Hash-Kette', () => {
  it('verkettet prev_hash ab GENESIS_HASH', async () => {
    const store = createMemoryVoiceStore();
    const gateway = createVoiceToolGateway({ store });
    await gateway.handle({
      tenantId: 'tenant_1',
      botId: 'bot_1',
      sessionId: 'sess_hash',
      callId: 'call_h1',
      tool: 'lookup_kb',
      args: { query: 'x' },
      decision: decision({ verdict: 'ALLOW', sessionId: 'sess_hash' }),
    });
    const chain = await store.listEvidence('tenant_1', 'sess_hash');
    assert.ok(chain.length >= 3);
    assert.equal(chain[0]!.prevHash, VOICE_GENESIS_HASH);
    assert.equal(chain[0]!.prevHash, contract.GENESIS_HASH);
    for (let i = 1; i < chain.length; i++) {
      assert.equal(chain[i]!.prevHash, chain[i - 1]!.hash);
      assert.equal(chain[i]!.seq, i + 1);
      const recomputed = computeEvidenceHash({
        sessionId: chain[i]!.sessionId,
        tenantId: chain[i]!.tenantId,
        seq: chain[i]!.seq,
        kind: chain[i]!.kind,
        toolRequestId: chain[i]!.toolRequestId,
        payload: chain[i]!.payload,
        prevHash: chain[i]!.prevHash,
        createdAt: chain[i]!.createdAt,
      });
      assert.equal(chain[i]!.hash, recomputed);
    }
  });

  it('GENESIS_HASH ist byte-identisch zum Contract', () => {
    assert.equal(VOICE_GENESIS_HASH, contract.GENESIS_HASH);
    assert.equal(VOICE_GENESIS_HASH, '0'.repeat(64));
    const first = appendEvidenceLink({
      tenantId: 't',
      sessionId: 's',
      seq: 1,
      kind: 'session.start',
      prevHash: VOICE_GENESIS_HASH,
      createdAt: '2026-10-06T00:00:00.000Z',
      payload: {},
    });
    assert.equal(first.prevHash, contract.GENESIS_HASH);
  });
});

describe('VoiceToolExecutors', () => {
  it('lookup_kb/create_ticket/handoff_human/export_transcript sind not_configured', async () => {
    const store = createMemoryVoiceStore();
    for (const tool of ['lookup_kb', 'create_ticket', 'handoff_human', 'export_transcript'] as const) {
      const result = await VOICE_TOOL_EXECUTORS[tool]({
        tenantId: 't',
        botId: 'b',
        sessionId: 's',
        toolRequestId: 'r',
        args: {},
        store,
      });
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.errorCode, 'not_configured');
    }
  });

  it('schedule_appointment schreibt eine Appointment-ID (echtes Backend)', async () => {
    const store = createMemoryVoiceStore();
    const result = await VOICE_TOOL_EXECUTORS.schedule_appointment({
      tenantId: 't',
      botId: 'b',
      sessionId: 's',
      toolRequestId: 'r',
      args: { customer_name: 'Nora Test', when: 'Fr 10:00' },
      store,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(result.externalRef);
      assert.equal(result.output.appointmentId, result.externalRef);
    }
  });
});

describe('Tool-Namen-Parität (Runtime ↔ Contract)', () => {
  it('VOICE_AGENT_TOOLS und CONTRACT_TOOL_NAMES sind byte-gleich zum Contract', () => {
    assert.deepEqual([...VOICE_AGENT_TOOLS], [...contract.CONTRACT_TOOL_NAMES]);
    assert.deepEqual([...CONTRACT_TOOL_NAMES], [...contract.CONTRACT_TOOL_NAMES]);
    assert.ok(!VOICE_AGENT_TOOLS.includes('read_availability' as never));
    assert.ok(!VOICE_AGENT_TOOLS.includes('book_appointment' as never));
  });
});

describe('MemoryVoiceStore — confirmed braucht external_ref', () => {
  it('lehnt confirmed ohne external_ref ab', async () => {
    const store = createMemoryVoiceStore();
    const req = await store.insertToolRequest({
      tenantId: 't1',
      sessionId: 's1',
      providerCallId: 'c1',
      tool: 'schedule_appointment',
      argumentKeys: [],
      args: {},
      verdict: 'ALLOW',
      reason: 'x',
      risk: 'medium',
      policyRef: 'voice.channel.v1',
      trace: [],
      decidedBy: 'policy-engine',
      decidedAt: new Date().toISOString(),
      confirmedBy: null,
      confirmedAt: null,
    });
    const exec = await store.insertExecution({
      tenantId: 't1',
      toolRequestId: req.id,
      status: 'pending',
      externalRef: null,
      errorCode: null,
      verificationStatus: 'unverified',
      verifiedAt: null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
    });
    await assert.rejects(
      store.updateExecution('t1', exec.id, {
        verificationStatus: 'confirmed',
        verifiedAt: new Date().toISOString(),
      }),
      /confirmed requires/,
    );
  });
});
