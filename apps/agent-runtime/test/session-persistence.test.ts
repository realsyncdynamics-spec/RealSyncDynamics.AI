import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  GrokProvider,
  type RealtimeSocketEvent,
  type RealtimeSocketEventType,
  type RealtimeSocketInit,
  type RealtimeSocketLike,
} from '../src/providers/grok-provider.js';
import {
  VoiceSessionRuntime,
  createMemoryVoiceStore,
  createSupabaseVoiceStore,
  createVoiceToolGateway,
  intersectOfferedTools,
  type VoiceSessionStartRequest,
  type VoiceToolClient,
  type VoiceToolHttpOutcome,
  type VoiceToolHttpRequest,
} from '../src/voice/session-runtime.js';
import type { VoiceDbClient } from '../src/voice/supabase-voice-store.js';
import type { VoiceToolDefinition } from '../src/voice-provider-types.js';
import type { VoicePolicyDecision } from '../src/voice-types.js';

const PLACEHOLDER_KEY = 'test-placeholder-not-a-real-key';

const TENANT = '11111111-1111-1111-1111-111111111111';
const BOT = '22222222-2222-2222-2222-222222222222';
const POLICY = 'appointment.booking.v1';
const DISCLOSURE = 'Hinweis: Sie sprechen mit einem KI-Assistenten.';

const TOOL_DEFS: VoiceToolDefinition[] = [
  {
    name: 'lookup_kb',
    description: 'Wissensbasis',
    parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
  {
    name: 'schedule_appointment',
    description: 'Termin',
    parameters: {
      type: 'object',
      properties: { when: { type: 'string' }, customer_name: { type: 'string' } },
    },
  },
];

class MockSocket implements RealtimeSocketLike {
  readyState = 0;
  readonly sent: Array<Record<string, unknown>> = [];
  closeCalls: Array<{ code?: number; reason?: string }> = [];
  private readonly listeners = new Map<RealtimeSocketEventType, Set<(e: RealtimeSocketEvent) => void>>();

  constructor(
    readonly url: string,
    readonly init: RealtimeSocketInit,
  ) {}

  send(data: string): void {
    if (this.readyState !== 1) throw new Error('mock: not open');
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }

  close(code?: number, reason?: string): void {
    this.closeCalls.push({ code, reason });
    if (this.readyState === 3) return;
    this.readyState = 3;
    queueMicrotask(() => this.dispatch('close', { code: code ?? 1000, reason: reason ?? '' }));
  }

  addEventListener(type: RealtimeSocketEventType, l: (e: RealtimeSocketEvent) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(l);
  }

  removeEventListener(type: RealtimeSocketEventType, l: (e: RealtimeSocketEvent) => void): void {
    this.listeners.get(type)?.delete(l);
  }

  open(): void {
    this.readyState = 1;
    this.dispatch('open', {});
  }

  server(msg: Record<string, unknown>): void {
    this.dispatch('message', { data: JSON.stringify(msg) });
  }

  private dispatch(type: RealtimeSocketEventType, e: RealtimeSocketEvent): void {
    for (const l of [...(this.listeners.get(type) ?? [])]) l(e);
  }
}

function policyDecision(
  overrides: Partial<VoicePolicyDecision> & Pick<VoicePolicyDecision, 'verdict' | 'sessionId' | 'tenantId'>,
): VoicePolicyDecision {
  return {
    decisionId: 'dec_persist_1',
    requestId: 'vt_call',
    reason: 'test',
    risk: 'medium',
    piiDetected: false,
    auditRequired: true,
    trace: [{ check: 'audit', result: 'pass', detail: POLICY }],
    decidedAt: '2026-10-06T12:00:00.000Z',
    decidedBy: 'policy-engine',
    ...overrides,
  };
}

function startRequest(overrides: Partial<VoiceSessionStartRequest> = {}): VoiceSessionStartRequest {
  return {
    botId: BOT,
    instructions: 'Du bist Nora.',
    tools: TOOL_DEFS,
    inputAudio: { encoding: 'pcm16', sampleRateHz: 24000 },
    outputAudio: { encoding: 'g711_ulaw', sampleRateHz: 8000 },
    session: {
      killSwitch: false,
      turnCount: 0,
      toolCount: 0,
      rateLimit: { maxTurns: 20, maxTools: 8 },
    },
    consent: { purposes: ['execute_tools', 'store_evidence'], withdrawnAt: null },
    // Caller-Werte, die den Snapshot NICHT überschreiben dürfen:
    tenantId: 'evil-tenant-from-caller',
    disclosureText: 'Fake disclosure from caller',
    model: 'caller-model',
    sessionId: 'caller-session-id',
    correlationId: 'not-a-uuid',
    ...overrides,
  };
}

function seedActiveConfig(
  store: ReturnType<typeof createMemoryVoiceStore>,
  overrides: Partial<Parameters<typeof store.seedBotConfig>[0]> = {},
) {
  store.seedBotConfig({
    tenantId: TENANT,
    botId: BOT,
    provider: 'grok',
    model: 'grok-voice-think-fast-2.0',
    voice: 'eve',
    language: 'de-DE',
    disclosureText: DISCLOSURE,
    policyRef: POLICY,
    offeredTools: ['lookup_kb', 'schedule_appointment'],
    status: 'active',
    ...overrides,
  });
}

interface PersistHarness {
  runtime: VoiceSessionRuntime;
  store: ReturnType<typeof createMemoryVoiceStore>;
  sockets: MockSocket[];
  providerCreateCalls: number;
  voiceToolCalls: VoiceToolHttpRequest[];
}

function persistHarness(
  overrides: {
    store?: ReturnType<typeof createMemoryVoiceStore>;
    voiceToolImpl?: (req: VoiceToolHttpRequest) => Promise<VoiceToolHttpOutcome>;
  } = {},
): PersistHarness {
  const store = overrides.store ?? createMemoryVoiceStore();
  const h: PersistHarness = {
    runtime: undefined as unknown as VoiceSessionRuntime,
    store,
    sockets: [],
    providerCreateCalls: 0,
    voiceToolCalls: [],
  };

  const client: VoiceToolClient = {
    evaluate: async (req) => {
      h.voiceToolCalls.push(req);
      if (overrides.voiceToolImpl) return overrides.voiceToolImpl(req);
      return {
        ok: true,
        verdict: 'ALLOW',
        status: 'accepted',
        decision: policyDecision({
          verdict: 'ALLOW',
          tenantId: req.tenantId,
          sessionId: req.sessionId,
        }),
      };
    },
  };

  const baseProvider = new GrokProvider({
    socketFactory: (url, init) => {
      const s = new MockSocket(url, init);
      h.sockets.push(s);
      return s;
    },
    getApiKey: () => PLACEHOLDER_KEY,
    connectTimeoutMs: 200,
    closeTimeoutMs: 50,
  });

  const provider = new Proxy(baseProvider, {
    get(target, prop, receiver) {
      if (prop === 'createSession') {
        return async (...args: Parameters<GrokProvider['createSession']>) => {
          h.providerCreateCalls += 1;
          return target.createSession(...args);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });

  h.runtime = new VoiceSessionRuntime({
    provider,
    voiceToolClient: client,
    store,
    toolGateway: createVoiceToolGateway({ store }),
    getApiKey: () => PLACEHOLDER_KEY,
  });
  return h;
}

const tick = () => new Promise<void>((r) => setImmediate(r));
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function openPersisted(h: PersistHarness, req: VoiceSessionStartRequest = startRequest()) {
  const pending = h.runtime.startSession(req);
  await tick();
  const socket = h.sockets.at(-1)!;
  socket.open();
  socket.server({ type: 'session.created', session: { id: 'xai_1' } });
  socket.server({ type: 'session.updated', session: {} });
  const session = await pending;
  return { session, socket };
}

function functionCall(callId: string, name: string, args: unknown) {
  return {
    type: 'response.function_call_arguments.done',
    call_id: callId,
    name,
    arguments: typeof args === 'string' ? args : JSON.stringify(args),
  };
}

describe('VoiceSessionRuntime — voice_sessions Persistenz', () => {
  it('startSession schreibt genau eine voice_sessions-Zeile mit Snapshot; Caller überschreibt nicht', async () => {
    const h = persistHarness();
    seedActiveConfig(h.store);
    const { session } = await openPersisted(h, startRequest({
      tenantId: 'evil-tenant',
      disclosureText: 'Caller disclosure',
      model: 'caller-model',
      sessionId: 'caller-sess',
    }));
    const rows = h.store.listSessions(TENANT);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.tenantId, TENANT);
    assert.equal(rows[0]!.botId, BOT);
    assert.equal(rows[0]!.model, 'grok-voice-think-fast-2.0');
    assert.equal(rows[0]!.policyRef, POLICY);
    assert.equal(rows[0]!.provider, 'grok');
    assert.equal(session.sessionId, rows[0]!.id);
    assert.notEqual(session.sessionId, 'caller-sess');
    assert.equal(h.runtime.getSessionContext(session.sessionId)?.tenantId, TENANT);

    const evidence = await h.store.listEvidence(TENANT, session.sessionId);
    assert.ok(evidence.some((e) => e.kind === 'session.start'));
    assert.ok(evidence.some((e) => e.kind === 'disclosure.played'));
    assert.ok(rows[0]!.disclosurePlayedAt);
  });

  it('insertSession wirft → startSession rejected store_error, Provider wird nicht geöffnet', async () => {
    const store = createMemoryVoiceStore();
    seedActiveConfig(store);
    store.insertSession = async () => {
      throw new Error('http_409: voice: tenant mismatch');
    };
    const h = persistHarness({ store });
    await assert.rejects(
      h.runtime.startSession(startRequest()),
      /store_error/,
    );
    assert.equal(h.providerCreateCalls, 0);
    assert.equal(h.sockets.length, 0);
    assert.equal(store.listSessions(TENANT).length, 0);
  });

  it('kein aktiver Config → rejected config_not_found', async () => {
    const h = persistHarness();
    // draft config — nicht aktiv
    seedActiveConfig(h.store, { status: 'draft' });
    await assert.rejects(
      h.runtime.startSession(startRequest()),
      /config_not_found/,
    );
    assert.equal(h.providerCreateCalls, 0);
  });

  it('Tool-Request/Evidence verwenden die voice_sessions-uuid', async () => {
    const h = persistHarness();
    seedActiveConfig(h.store);
    const { session, socket } = await openPersisted(h);
    const voiceSessionId = session.sessionId;

    socket.server(functionCall('call_1', 'lookup_kb', { query: 'Öffnungszeiten' }));
    await wait(30);

    assert.equal(h.voiceToolCalls.length, 1);
    assert.equal(h.voiceToolCalls[0]!.sessionId, voiceSessionId);
    assert.equal(h.voiceToolCalls[0]!.tenantId, TENANT);

    const evidence = await h.store.listEvidence(TENANT, voiceSessionId);
    assert.ok(evidence.some((e) => e.kind === 'tool.request'));
    assert.ok(evidence.every((e) => e.sessionId === voiceSessionId));
  });
});

describe('intersectOfferedTools', () => {
  it('bildet Schnittmenge Contract ∩ offered_tools', () => {
    const tools = intersectOfferedTools(
      ['lookup_kb', 'schedule_appointment', 'evil_tool', 'read_availability'],
      TOOL_DEFS,
    );
    assert.deepEqual(
      tools.map((t) => t.name),
      ['lookup_kb', 'schedule_appointment'],
    );
  });
});

describe('SupabaseVoiceStore — Session-Mapping (Mock-Client)', () => {
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
        const full = {
          ...row,
          id,
          started_at: row.started_at ?? new Date().toISOString(),
          correlation_id: row.correlation_id ?? '33333333-3333-4333-8333-333333333333',
        };
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

  it('resolveSessionContext + insertSession filtern tenant_id und mappen Spalten', async () => {
    const { client, tables } = createMockDb();
    tables.set('voice_bot_configs', [
      {
        tenant_id: TENANT,
        bot_id: BOT,
        provider: 'grok',
        model: 'grok-voice-think-fast-2.0',
        voice: 'eve',
        language: 'de-DE',
        disclosure_text: DISCLOSURE,
        policy_ref: POLICY,
        offered_tools: ['lookup_kb', 'schedule_appointment'],
        status: 'active',
      },
      {
        tenant_id: 'other-tenant',
        bot_id: 'other-bot',
        provider: 'grok',
        model: 'x',
        disclosure_text: DISCLOSURE,
        policy_ref: 'p',
        offered_tools: [],
        status: 'active',
      },
    ]);

    const store = createSupabaseVoiceStore({ client });
    const ctx = await store.resolveSessionContext({ botId: BOT });
    assert.ok(ctx);
    assert.equal(ctx!.tenantId, TENANT);
    assert.equal(ctx!.policyRef, POLICY);
    assert.equal(ctx!.disclosureText, DISCLOSURE);
    assert.deepEqual(ctx!.offeredTools, ['lookup_kb', 'schedule_appointment']);

    // Draft/inactive wird nicht gefunden
    tables.get('voice_bot_configs')![0]!.status = 'paused';
    assert.equal(await store.resolveSessionContext({ botId: BOT }), null);
    tables.get('voice_bot_configs')![0]!.status = 'active';

    const session = await store.insertSession({
      tenantId: TENANT,
      botId: BOT,
      provider: 'grok',
      model: 'grok-voice-think-fast-2.0',
      policyRef: POLICY,
      correlationId: '44444444-4444-4444-8444-444444444444',
    });
    assert.ok(session.id);
    assert.equal(session.tenantId, TENANT);
    assert.equal(session.policyRef, POLICY);

    const inserted = tables.get('voice_sessions')![0]!;
    assert.equal(inserted.tenant_id, TENANT);
    assert.equal(inserted.bot_id, BOT);
    assert.equal(inserted.policy_ref, POLICY);
    assert.equal(inserted.provider, 'grok');

    const updated = await store.updateSessionStatus(TENANT, session.id, {
      status: 'ended',
      endedAt: '2026-10-06T15:00:00.000Z',
      disclosurePlayedAt: '2026-10-06T14:00:00.000Z',
    });
    assert.ok(updated);
    assert.equal(updated!.status, 'ended');
    assert.equal(updated!.disclosurePlayedAt, '2026-10-06T14:00:00.000Z');

    // Fremder Tenant sieht die Session nicht
    assert.equal(await store.updateSessionStatus('other-tenant', session.id, { status: 'failed' }), null);
  });

  it('resolveSessionContext über numberBindingId (active) + tenant-konsistent', async () => {
    const { client, tables } = createMockDb();
    const bindingId = '55555555-5555-4555-8555-555555555555';
    tables.set('voice_number_bindings', [
      {
        id: bindingId,
        tenant_id: TENANT,
        bot_id: BOT,
        status: 'active',
        phone_number_e164: '+491234567890',
      },
    ]);
    tables.set('voice_bot_configs', [
      {
        tenant_id: TENANT,
        bot_id: BOT,
        provider: 'grok',
        model: 'm',
        disclosure_text: DISCLOSURE,
        policy_ref: POLICY,
        offered_tools: ['lookup_kb'],
        status: 'active',
      },
    ]);
    const store = createSupabaseVoiceStore({ client });
    const ctx = await store.resolveSessionContext({ numberBindingId: bindingId });
    assert.ok(ctx);
    assert.equal(ctx!.numberBindingId, bindingId);
    assert.equal(ctx!.tenantId, TENANT);
  });
});
