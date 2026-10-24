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
import { VOICE_TOOL_EXECUTORS } from '../src/voice/tool-executors.js';
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
    allowWriteTools?: boolean;
    /** Kein toolGateway injizieren — die Runtime baut ihr Gateway wie in Produktion selbst. */
    defaultGateway?: boolean;
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
          requestId: req.requestId,
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
    ...(overrides.defaultGateway
      ? {}
      : { toolGateway: createVoiceToolGateway({ store, allowWriteTools: overrides.allowWriteTools }) }),
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

  it('closeSession und session.closed finalisieren nur einmal (kein doppeltes session.end)', async () => {
    const h = persistHarness();
    seedActiveConfig(h.store);
    const { session } = await openPersisted(h);
    const voiceSessionId = session.sessionId;

    await h.runtime.closeSession(voiceSessionId);
    await wait(30);
    // Zweites close ist no-op (Session schon entfernt).
    await h.runtime.closeSession(voiceSessionId);
    await wait(20);

    const evidence = await h.store.listEvidence(TENANT, voiceSessionId);
    const ends = evidence.filter((e) => e.kind === 'session.end');
    assert.equal(ends.length, 1);
    const rows = h.store.listSessions(TENANT);
    assert.equal(rows[0]!.status, 'ended');
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

describe('resolveToolPolicyContext — Kill-Switch aus dem Store (SEC-05)', () => {
  /** Liest während des /voice-tool-Aufrufs den Policy-Kontext wie das Gateway. */
  function capturingHarness(store = createMemoryVoiceStore()) {
    const contexts: Array<Awaited<ReturnType<VoiceSessionRuntime['resolveToolPolicyContext']>>> = [];
    const h = persistHarness({
      store,
      voiceToolImpl: async (req) => {
        contexts.push(await h.runtime.resolveToolPolicyContext(req.sessionId, req.requestId, req.tool));
        return { ok: false, reason: 'test_stop' };
      },
    });
    return { h, contexts };
  }

  it('Kill-Switch, der nach dem Start in voice_sessions gesetzt wird, greift beim nächsten Call', async () => {
    const c = capturingHarness();
    seedActiveConfig(c.h.store);
    const { session, socket } = await openPersisted(c.h);

    socket.server(functionCall('call_1', 'lookup_kb', { query: 'a' }));
    await wait(20);
    assert.equal(c.contexts[0]?.session.killSwitch, false);

    await c.h.store.updateSessionStatus(TENANT, session.sessionId, { killSwitch: true });
    socket.server(functionCall('call_2', 'lookup_kb', { query: 'b' }));
    await wait(20);
    assert.equal(c.contexts[1]?.session.killSwitch, true);
  });

  it('Lesefehler oder fehlende Zeile → Kill-Switch gilt als aktiv (fail-closed)', async () => {
    const store = createMemoryVoiceStore();
    seedActiveConfig(store);
    const c = capturingHarness(store);
    const { socket } = await openPersisted(c.h);

    store.getSession = async () => {
      throw new Error('http_503');
    };
    socket.server(functionCall('call_err', 'lookup_kb', { query: 'a' }));
    await wait(20);
    assert.equal(c.contexts[0]?.session.killSwitch, true);

    store.getSession = async () => null;
    socket.server(functionCall('call_gone', 'lookup_kb', { query: 'b' }));
    await wait(20);
    assert.equal(c.contexts[1]?.session.killSwitch, true);
  });

  it('Mandant, Zähler und Limits kommen aus der Session, nicht vom Caller', async () => {
    const c = capturingHarness();
    seedActiveConfig(c.h.store);
    const { session, socket } = await openPersisted(c.h);
    socket.server(functionCall('call_1', 'lookup_kb', { query: 'a' }));
    await wait(20);
    const ctx = c.contexts[0]!;
    assert.equal(ctx.session.sessionId, session.sessionId);
    assert.equal(ctx.session.tenantId, TENANT);
    assert.equal(ctx.session.toolCount, 0);
    assert.deepEqual(ctx.session.rateLimit, { maxTurns: 20, maxTools: 8 });
    assert.equal(ctx.session.grant?.botId, BOT);
  });
});

describe('Kill-Switch zwischen Entscheidung und Executor (SEC-05 Härtung)', () => {
  type Mode = 'none' | 'kill_before_executor' | 'read_error' | 'write_tools_off';

  async function run(mode: Mode) {
    const store = createMemoryVoiceStore();
    seedActiveConfig(store);
    let appointments = 0;
    const insertAppointment = store.insertAppointment.bind(store);
    store.insertAppointment = async (row) => {
      appointments += 1;
      return insertAppointment(row);
    };
    const h = persistHarness({ store, allowWriteTools: mode !== 'write_tools_off' });
    const { session, socket } = await openPersisted(h);

    if (mode === 'kill_before_executor') {
      // Kill-Switch aus einem anderen Prozess, nachdem /voice-tool ALLOW
      // entschieden hat und während das Gateway die Ausführung vorbereitet.
      const insertExecution = store.insertExecution.bind(store);
      store.insertExecution = async (row) => {
        await store.updateSessionStatus(TENANT, session.sessionId, { killSwitch: true });
        return insertExecution(row);
      };
    }
    if (mode === 'read_error') {
      store.getSession = async () => {
        throw new Error('http_503');
      };
    }

    socket.server(
      functionCall('call_appt', 'schedule_appointment', {
        customer_name: 'Max',
        when: '2026-10-10T09:00:00.000Z',
      }),
    );
    await wait(50);
    const evidence = await store.listEvidence(TENANT, session.sessionId);
    return { appointments, result: evidence.filter((e) => e.kind === 'tool.result').at(-1)?.payload };
  }

  it('Kill-Switch nach der Entscheidung → keine Ausführung, Evidence blocked', async () => {
    const { appointments, result } = await run('kill_before_executor');
    assert.equal(appointments, 0);
    assert.deepEqual(result, { status: 'blocked', reason: 'session_inactive' });
  });

  it('Lesefehler beim zweiten Check → keine Ausführung (fail-closed)', async () => {
    const { appointments, result } = await run('read_error');
    assert.equal(appointments, 0);
    assert.deepEqual(result, { status: 'blocked', reason: 'session_inactive' });
  });

  it('ohne Kill-Switch wird ausgeführt und verifiziert', async () => {
    const { appointments, result } = await run('none');
    assert.equal(appointments, 1);
    assert.equal(result?.status, 'succeeded');
  });

  it('schreibende Tools sind ohne allowWriteTools gesperrt (Default)', async () => {
    const { appointments, result } = await run('write_tools_off');
    assert.equal(appointments, 0);
    assert.deepEqual(result, { status: 'blocked', reason: 'write_tool_disabled' });
  });
});

describe('Produktionspfad ohne injiziertes Gateway (SEC-05 Regression)', () => {
  // Wie gateway.ts → new VoiceSessionRuntime(): Die Runtime baut ihr Gateway
  // selbst (createVoiceToolGateway({ store })). Bricht, sobald eine
  // Produktionsinitialisierung schreibende Tools freischaltet.
  async function runDefault(callId: string, tool: string, args: Record<string, unknown>) {
    const store = createMemoryVoiceStore();
    seedActiveConfig(store);
    const writes = { appointments: 0, executions: 0, executorCalls: 0 };
    const insertAppointment = store.insertAppointment.bind(store);
    store.insertAppointment = async (row) => {
      writes.appointments += 1;
      return insertAppointment(row);
    };
    const insertExecution = store.insertExecution.bind(store);
    store.insertExecution = async (row) => {
      writes.executions += 1;
      return insertExecution(row);
    };
    const original = VOICE_TOOL_EXECUTORS.schedule_appointment;
    VOICE_TOOL_EXECUTORS.schedule_appointment = async (ctx) => {
      writes.executorCalls += 1;
      return original(ctx);
    };
    try {
      const h = persistHarness({ store, defaultGateway: true });
      const { session, socket } = await openPersisted(h);
      socket.server(functionCall(callId, tool, args));
      await wait(50);
      const evidence = await store.listEvidence(TENANT, session.sessionId);
      const sent = socket.sent.find(
        (m) => (m.item as { call_id?: string } | undefined)?.call_id === callId,
      );
      const output = JSON.parse((sent?.item as { output: string }).output) as {
        outcome: string;
        verified: boolean;
        output: Record<string, unknown>;
      };
      return { h, writes, evidence, output };
    } finally {
      VOICE_TOOL_EXECUTORS.schedule_appointment = original;
    }
  }

  it('schedule_appointment → write_tool_disabled: kein Termin, kein Executor, Grund in der Evidence', async () => {
    const { h, writes, evidence, output } = await runDefault('call_prod_write', 'schedule_appointment', {
      customer_name: 'Max',
      when: '2026-10-10T09:00:00.000Z',
    });

    // Die Policy hat ALLOW entschieden — gesperrt hat das Gateway, nicht die Policy.
    assert.equal(h.voiceToolCalls.length, 1);
    assert.equal(writes.appointments, 0, 'kein Datensatz in bot_appointments');
    assert.equal(writes.executorCalls, 0, 'kein Aufruf des schreibenden Executors');
    assert.equal(writes.executions, 0, 'keine voice_executions-Zeile');

    assert.deepEqual(output, {
      outcome: 'denied',
      verified: false,
      output: { reason: 'write_tool_disabled', verdict: 'ALLOW' },
    });

    // Nachvollziehbar: Anfrage, Entscheidung und Sperrgrund an derselben toolRequestId.
    const request = evidence.find((e) => e.kind === 'tool.request');
    const decision = evidence.find((e) => e.kind === 'policy.decision');
    const result = evidence.find((e) => e.kind === 'tool.result');
    assert.equal(request?.payload.provider_call_id, 'call_prod_write');
    assert.equal(request?.payload.tool, 'schedule_appointment');
    assert.equal(decision?.payload.verdict, 'ALLOW');
    assert.deepEqual(result?.payload, { status: 'blocked', reason: 'write_tool_disabled' });
    assert.ok(request?.toolRequestId);
    assert.equal(decision?.toolRequestId, request?.toolRequestId);
    assert.equal(result?.toolRequestId, request?.toolRequestId);
  });

  it('Gegenprobe: lesendes Tool passiert die Schreibsperre im selben Aufbau', async () => {
    const { writes, evidence, output } = await runDefault('call_prod_read', 'lookup_kb', { query: 'x' });
    assert.equal(writes.executions, 1, 'Executor-Pfad erreicht (Guard der Session vorhanden)');
    assert.equal(writes.appointments, 0);
    assert.equal(output.output.reason, 'not_configured');
    assert.notEqual(
      evidence.find((e) => e.kind === 'tool.result')?.payload.reason,
      'write_tool_disabled',
    );
  });
});
