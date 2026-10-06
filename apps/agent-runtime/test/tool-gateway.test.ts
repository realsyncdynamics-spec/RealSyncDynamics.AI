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
  createSupabaseVoiceStore,
  createSupabaseVoiceStoreFromEnv,
  createVoiceToolGateway,
} from '../src/voice/tool-gateway.js';
import type { VoiceDbClient } from '../src/voice/supabase-voice-store.js';
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

  it('verified nur nach Re-Read (id + tenant_id) mit external_ref', async () => {
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
    const apptId = String(result.output.appointmentId);
    const reRead = await store.getAppointment('tenant_1', apptId);
    assert.ok(reRead);
    assert.equal(reRead!.id, apptId);
    assert.equal(reRead!.tenantId, 'tenant_1');
  });

  it('Re-Read-Mismatch → failed / mismatch / verified=false', async () => {
    const store = createMemoryVoiceStore();
    const originalGet = store.getAppointment.bind(store);
    store.getAppointment = async () => null;
    const gateway = createVoiceToolGateway({ store });
    const result = await gateway.handle({
      tenantId: 'tenant_1',
      botId: 'bot_1',
      sessionId: 'sess_1',
      callId: 'call_mismatch',
      tool: 'schedule_appointment',
      args: { customer_name: 'Max', when: 'Fr 9:00' },
      decision: decision({ verdict: 'ALLOW' }),
    });
    assert.equal(result.outcome, 'failed');
    assert.equal(result.verified, false);
    assert.equal(result.output.reason, 'verification_mismatch');
    // Restore sanity: original store still has the row under tenant.
    store.getAppointment = originalGet;
  });

  it('ohne Store → failed/not_configured, keine Ausführung, verified=false', async () => {
    const gateway = createVoiceToolGateway({ env: {} });
    const result = await gateway.handle({
      tenantId: 'tenant_1',
      botId: 'bot_1',
      sessionId: 'sess_1',
      callId: 'call_ns',
      tool: 'schedule_appointment',
      args: { customer_name: 'Max', when: 'Fr 9:00' },
      decision: decision({ verdict: 'ALLOW' }),
    });
    assert.equal(result.outcome, 'failed');
    assert.equal(result.verified, false);
    assert.equal(result.output.reason, 'not_configured');
  });

  it('createVoiceToolGateway ohne Memory-Default (kein env → not_configured)', async () => {
    const fromEnv = createSupabaseVoiceStoreFromEnv({ env: {} });
    assert.equal(fromEnv, null);
    const gateway = createVoiceToolGateway({ env: { SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' } });
    const result = await gateway.handle({
      tenantId: 't',
      botId: 'b',
      sessionId: 's',
      callId: 'c',
      tool: 'lookup_kb',
      args: { query: 'x' },
      decision: decision({ verdict: 'ALLOW', tenantId: 't', sessionId: 's' }),
    });
    assert.equal(result.outcome, 'failed');
    assert.equal(result.output.reason, 'not_configured');
  });

  it('fehlt customer_name → invalid_arguments, keine Ausführung', async () => {
    const store = createMemoryVoiceStore();
    const gateway = createVoiceToolGateway({ store });
    const result = await gateway.handle({
      tenantId: 'tenant_1',
      botId: 'bot_1',
      sessionId: 'sess_1',
      callId: 'call_noname',
      tool: 'schedule_appointment',
      args: { when: 'Fr 9:00' },
      decision: decision({ verdict: 'ALLOW' }),
    });
    assert.equal(result.outcome, 'failed');
    assert.equal(result.verified, false);
    assert.equal(result.output.reason, 'invalid_arguments');
    const evidence = await store.listEvidence('tenant_1', 'sess_1');
    assert.ok(evidence.some((e) => e.kind === 'tool.result'));
    assert.ok(
      evidence.some(
        (e) => e.kind === 'verification.result' && e.payload.verification_status === 'failed',
      ),
    );
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

  it('Evidence ist je tenantId+sessionId getrennt', async () => {
    const store = createMemoryVoiceStore();
    await store.appendEvidence({
      tenantId: 'tenant_a',
      sessionId: 'shared_sess',
      kind: 'session.start',
      payload: { who: 'a' },
    });
    await store.appendEvidence({
      tenantId: 'tenant_b',
      sessionId: 'shared_sess',
      kind: 'session.start',
      payload: { who: 'b' },
    });
    const a = await store.listEvidence('tenant_a', 'shared_sess');
    const b = await store.listEvidence('tenant_b', 'shared_sess');
    assert.equal(a.length, 1);
    assert.equal(b.length, 1);
    assert.equal(a[0]!.prevHash, VOICE_GENESIS_HASH);
    assert.equal(b[0]!.prevHash, VOICE_GENESIS_HASH);
    assert.equal(a[0]!.payload.who, 'a');
    assert.equal(b[0]!.payload.who, 'b');
    assert.notEqual(a[0]!.hash, b[0]!.hash);
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

  it('schedule_appointment schreibt eine Appointment-ID und ist re-readable', async () => {
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
      const row = await store.getAppointment('t', result.externalRef);
      assert.ok(row);
      assert.equal(row!.customerName, 'Nora Test');
    }
  });

  it('schedule_appointment ohne Name → invalid_arguments (kein Anrufer-Default)', async () => {
    const store = createMemoryVoiceStore();
    const result = await VOICE_TOOL_EXECUTORS.schedule_appointment({
      tenantId: 't',
      botId: 'b',
      sessionId: 's',
      toolRequestId: 'r',
      args: { when: 'Fr 10:00' },
      store,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.errorCode, 'invalid_arguments');
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

describe('SupabaseVoiceStore — gemockter Client (kein Netzwerk)', () => {
  function createMockDb(): {
    client: VoiceDbClient;
    tables: Map<string, Array<Record<string, unknown>>>;
  } {
    const tables = new Map<string, Array<Record<string, unknown>>>();
    const ensure = (t: string) => {
      if (!tables.has(t)) tables.set(t, []);
      return tables.get(t)!;
    };
    const matches = (row: Record<string, unknown>, filters: Record<string, string>) =>
      Object.entries(filters).every(([k, v]) => String(row[k]) === v);

    const client: VoiceDbClient = {
      async insert(table, row) {
        const id = typeof row.id === 'string' ? row.id : `id_${ensure(table).length + 1}`;
        const full = { ...row, id };
        ensure(table).push(full);
        return full;
      },
      async update(table, patch, filters) {
        const list = ensure(table);
        const idx = list.findIndex((r) => matches(r, filters));
        if (idx < 0) throw new Error(`mock: ${table} update miss`);
        list[idx] = { ...list[idx]!, ...patch };
        return list[idx]!;
      },
      async selectOne(table, _columns, filters) {
        return ensure(table).find((r) => matches(r, filters)) ?? null;
      },
      async selectMany(table, _columns, filters, order) {
        let rows = ensure(table).filter((r) => matches(r, filters));
        if (order) {
          rows = [...rows].sort((a, b) => {
            const av = Number(a[order.column] ?? 0);
            const bv = Number(b[order.column] ?? 0);
            return order.ascending ? av - bv : bv - av;
          });
          if (order.limit) rows = rows.slice(0, order.limit);
        }
        return rows;
      },
    };
    return { client, tables };
  }

  it('schreibt voice_* + bot_appointments tenant-gescoped und verkettet Evidence', async () => {
    const { client, tables } = createMockDb();
    const store = createSupabaseVoiceStore({ client });

    const req = await store.insertToolRequest({
      tenantId: '11111111-1111-1111-1111-111111111111',
      sessionId: '22222222-2222-2222-2222-222222222222',
      providerCallId: 'call_sb',
      tool: 'schedule_appointment',
      argumentKeys: ['customer_name'],
      args: { customer_name: 'Eva' },
      verdict: 'ALLOW',
      reason: 'ok',
      risk: 'medium',
      policyRef: 'voice.channel.v1',
      trace: [{ check: 'audit', result: 'pass', detail: 'voice.channel.v1' }],
      decidedBy: 'policy-engine',
      decidedAt: '2026-10-06T12:00:00.000Z',
      confirmedBy: null,
      confirmedAt: null,
    });
    assert.ok(req.id);

    const e1 = await store.appendEvidence({
      tenantId: req.tenantId,
      sessionId: req.sessionId,
      kind: 'tool.request',
      toolRequestId: req.id,
      payload: { tool: 'schedule_appointment' },
    });
    assert.equal(e1.prevHash, VOICE_GENESIS_HASH);
    assert.match(e1.hash, /^[0-9a-f]{64}$/);

    const e2 = await store.appendEvidence({
      tenantId: req.tenantId,
      sessionId: req.sessionId,
      kind: 'policy.decision',
      toolRequestId: req.id,
      payload: { verdict: 'ALLOW' },
    });
    assert.equal(e2.prevHash, e1.hash);
    assert.equal(e2.seq, 2);

    const exec = await store.insertExecution({
      tenantId: req.tenantId,
      toolRequestId: req.id,
      status: 'pending',
      externalRef: null,
      errorCode: null,
      verificationStatus: 'unverified',
      verifiedAt: null,
      startedAt: '2026-10-06T12:00:01.000Z',
      finishedAt: null,
    });

    const appt = await store.insertAppointment({
      tenantId: req.tenantId,
      botId: '33333333-3333-3333-3333-333333333333',
      customerName: 'Eva',
      notes: 'test',
    });
    const reRead = await store.getAppointment(req.tenantId, appt.id);
    assert.ok(reRead);
    assert.equal(reRead!.tenantId, req.tenantId);

    await store.updateExecution(req.tenantId, exec.id, {
      status: 'succeeded',
      externalRef: appt.id,
      verificationStatus: 'confirmed',
      verifiedAt: '2026-10-06T12:00:02.000Z',
      finishedAt: '2026-10-06T12:00:02.000Z',
    });

    // Spaltennamen wie in Migration 20260928130000 / bots_foundation
    const toolRows = tables.get('voice_tool_requests')!;
    assert.equal(toolRows[0]!.tenant_id, req.tenantId);
    assert.equal(toolRows[0]!.decided_by, 'policy-engine');
    assert.ok(Array.isArray(toolRows[0]!.argument_keys));

    const execRows = tables.get('voice_executions')!;
    assert.equal(execRows[0]!.tool_request_id, req.id);
    assert.equal(execRows[0]!.external_ref, appt.id);
    assert.equal(execRows[0]!.verification_status, 'confirmed');

    const evRows = tables.get('voice_evidence')!;
    assert.equal(evRows[0]!.prev_hash, VOICE_GENESIS_HASH);
    assert.match(String(evRows[0]!.hash), /^[0-9a-f]{64}$/);

    const apptRows = tables.get('bot_appointments')!;
    assert.equal(apptRows[0]!.customer_name, 'Eva');
    assert.equal(apptRows[0]!.tenant_id, req.tenantId);

    // Fremder Tenant sieht den Termin nicht
    assert.equal(await store.getAppointment('other-tenant', appt.id), null);
  });

  it('createSupabaseVoiceStoreFromEnv ohne Credentials → null', () => {
    assert.equal(createSupabaseVoiceStoreFromEnv({ env: {} }), null);
    assert.equal(
      createSupabaseVoiceStoreFromEnv({
        env: { SUPABASE_URL: 'https://example.supabase.co' },
      }),
      null,
    );
  });
});
