// @vitest-environment node
/**
 * provision-voice-agent — Regeln (voice-agent-provisioning.ts), ElevenLabs-
 * Client gegen ein Fake-fetch und der Handler gegen ein In-Memory-Repo.
 * Kein Deno, kein Netzwerk, keine Datenbank.
 */
import { describe, expect, it } from 'vitest';
import {
  agentGuaranteeViolations,
  agentName,
  dailyCallLimit,
  desiredStateFor,
  planEnqueue,
  readVoiceEntitlements,
  safeError,
  type AgentPlatformSettings,
  type VoiceEntitlements,
} from '../../supabase/functions/_shared/voice-agent-provisioning';
import { canonicalJson, evidenceContentHash } from '../../supabase/functions/_shared/evidence-hash';
import { timingSafeEqual } from '../../supabase/functions/_shared/timingSafeEqual';
import {
  ELEVENLABS_EU_BASE,
  createElevenLabsClient,
} from '../../supabase/functions/provision-voice-agent/elevenlabs';
import {
  handleProvisionVoiceAgent,
  type AgentPatch,
  type HandlerDeps,
  type ProvisionRepo,
  type VoiceAgentRow,
  type VoiceProviderClient,
} from '../../supabase/functions/provision-voice-agent/handler';

const TENANT = '11111111-2222-4333-8444-555555555555';
const KEY = 'test-provision-key';

describe('Regeln', () => {
  it('liest bots.voice und Minuten aus tenant_entitlements()', () => {
    expect(readVoiceEntitlements([
      { key: 'bots.voice', value: 1 },
      { key: 'limit.bot_voice_minutes_monthly', value: 500 },
    ])).toEqual({ voice: true, monthlyMinutes: 500 });
    expect(readVoiceEntitlements([{ key: 'bots.voice', value: -1 }, { key: 'limit.bot_voice_minutes_monthly', value: -1 }]))
      .toEqual({ voice: true, monthlyMinutes: null });
    expect(readVoiceEntitlements([{ key: 'bots.voice', value: 0 }])).toEqual({ voice: false, monthlyMinutes: null });
    expect(readVoiceEntitlements([])).toEqual({ voice: false, monthlyMinutes: null });
  });

  it('Soll-Zustand folgt nur bots.voice', () => {
    expect(desiredStateFor({ voice: true, monthlyMinutes: 0 })).toBe('active');
    expect(desiredStateFor({ voice: false, monthlyMinutes: 500 })).toBe('suspended');
  });

  it('Tageslimit: abgerundet, mindestens 1, unbegrenzt = kein Limit', () => {
    expect(dailyCallLimit(500)).toBe(5); // 500 / 30 / 3 = 5,55
    expect(dailyCallLimit(2500)).toBe(27);
    expect(dailyCallLimit(10)).toBe(1);
    expect(dailyCallLimit(500, 2)).toBe(8);
    expect(dailyCallLimit(500, 0)).toBe(5); // ungültige Annahme → Default
    expect(dailyCallLimit(null)).toBeNull();
  });

  it('reiht nur echte Wechsel und gescheiterte Zeilen ein', () => {
    expect(planEnqueue(null, 'active')).toEqual({ action: 'insert', desired: 'active' });
    expect(planEnqueue(null, 'suspended')).toEqual({ action: 'none' });
    expect(planEnqueue({ desired_state: 'active', status: 'active' }, 'active')).toEqual({ action: 'none' });
    expect(planEnqueue({ desired_state: 'active', status: 'active' }, 'suspended'))
      .toEqual({ action: 'update', desired: 'suspended' });
    expect(planEnqueue({ desired_state: 'suspended', status: 'suspended' }, 'active'))
      .toEqual({ action: 'update', desired: 'active' });
    expect(planEnqueue({ desired_state: 'active', status: 'failed' }, 'active'))
      .toEqual({ action: 'update', desired: 'active' });
  });

  it('Read-back-Garantien: Auth, keine Aufzeichnung, Aufbewahrung ≤ 7 Tage, Tageslimit', () => {
    expect(agentGuaranteeViolations(templateSettings(), 50)).toEqual([]);
    expect(agentGuaranteeViolations(templateSettings(), null)).toEqual([]);
    expect(agentGuaranteeViolations({}, 5)).toEqual([
      'auth.enable_auth is not true',
      'privacy.record_voice is not false',
      'privacy.retention_days=undefined outside 1..7',
      'call_limits.daily_limit=undefined expected 5',
    ]);
    const s = templateSettings();
    s.privacy!.retention_days = 30;
    expect(agentGuaranteeViolations(s, 50)).toEqual(['privacy.retention_days=30 outside 1..7']);
  });

  it('Agent-Name ist dem Mandanten zuordenbar', () => {
    expect(agentName(TENANT, '  ACME   GmbH ')).toBe('RealSync Voice · ACME GmbH · 11111111');
    expect(agentName(TENANT, null)).toBe('RealSync Voice · Mandant · 11111111');
  });

  it('safeError entfernt Schlüssel', () => {
    expect(safeError(new Error('xi-api-key: sk_abcdef1234567890 rejected'))).not.toMatch(/sk_abcdef/);
    expect(safeError(new Error('Authorization: Bearer abc.def failed'))).toBe('Authorization: [redacted] failed');
    expect(safeError(new Error('got bearer xyz123 back'))).toBe('got Bearer [redacted] back');
    expect(safeError('x'.repeat(900))).toHaveLength(500);
  });
});

describe('ElevenLabs-Client', () => {
  it('dupliziert gegen die EU-Basis und patcht Auth + Limit', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fake = async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(url.endsWith('/duplicate') ? JSON.stringify({ agent_id: 'agent_new' }) : '{}', { status: 200 });
    };
    const client = createElevenLabsClient('sk_test', ELEVENLABS_EU_BASE, fake);
    expect(await client.duplicateAgent('tpl_1', 'Name')).toBe('agent_new');
    await client.updateAgent('agent_new', {
      name: 'Name', tags: ['realsync'],
      platform_settings: { call_limits: { agent_concurrency_limit: 2, daily_limit: 5 } },
    });

    expect(calls[0].url).toBe('https://api.eu.residency.elevenlabs.io/v1/convai/agents/tpl_1/duplicate');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>)['xi-api-key']).toBe('sk_test');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ name: 'Name' });
    expect(calls[1].url).toBe('https://api.eu.residency.elevenlabs.io/v1/convai/agents/agent_new');
    expect(calls[1].init.method).toBe('PATCH');
    expect(JSON.parse(String(calls[1].init.body)).platform_settings).toEqual({
      call_limits: { agent_concurrency_limit: 2, daily_limit: 5 },
    });
  });

  it('liest platform_settings per GET ohne Body', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const client = createElevenLabsClient('k', ELEVENLABS_EU_BASE, async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ agent_id: 'a', platform_settings: templateSettings() }), { status: 200 });
    });
    expect(await client.getAgentSettings('a')).toEqual(templateSettings());
    expect(calls[0].init.method).toBe('GET');
    expect(calls[0].init.body).toBeUndefined();
  });

  it('wirft bei Fehlerstatus und bei fehlender agent_id, ohne den Key zu nennen', async () => {
    const denied = createElevenLabsClient('sk_secret_value', ELEVENLABS_EU_BASE, async () => new Response('nope', { status: 401 }));
    await expect(denied.duplicateAgent('tpl', 'n')).rejects.toThrow(/401/);
    await expect(denied.duplicateAgent('tpl', 'n')).rejects.not.toThrow(/sk_secret_value/);
    const empty = createElevenLabsClient('k', ELEVENLABS_EU_BASE, async () => new Response('{}', { status: 200 }));
    await expect(empty.duplicateAgent('tpl', 'n')).rejects.toThrow(/agent_id/);
  });
});

// ─── In-Memory-Welt ─────────────────────────────────────────────────────────

interface World {
  rows: VoiceAgentRow[];
  ent: VoiceEntitlements;
  bots: Map<string, { enabled: boolean; config: Record<string, unknown> }>;
  evidence: Array<Record<string, unknown>>;
  provider: FakeProvider;
  /** Simuliert den Webhook, der während eines Laufs neu einreiht. */
  onBeforeFinish?: (row: VoiceAgentRow) => void;
  failBotInsert?: string;
}

/** Ausgelesene Vorlage agent_4801m4z42njceeqb9svq930eg42f, Stand 2026-10-15 (read-only). */
function templateSettings(): AgentPlatformSettings {
  return {
    auth: { enable_auth: true, allowlist: [], require_origin_header: true },
    privacy: {
      record_voice: false, retention_days: 7, delete_audio: true, delete_transcript_and_pii: false,
      zero_retention_mode: false, conversation_history_redaction: { enabled: false },
    },
    call_limits: { agent_concurrency_limit: 2, daily_limit: 50, bursting_enabled: false },
  };
}

class FakeProvider implements VoiceProviderClient {
  duplicates: Array<{ template: string; name: string }> = [];
  patches: Array<{ agentId: string; patch: AgentPatch }> = [];
  agents = new Map<string, AgentPlatformSettings>();
  failPatches = 0;
  /** Simuliert einen PATCH, der platform_settings ersetzt statt zu mergen. */
  patchReplacesSettings = false;
  async duplicateAgent(template: string, name: string) {
    this.duplicates.push({ template, name });
    const id = `agent_${this.duplicates.length}`;
    this.agents.set(id, templateSettings());
    return id;
  }
  async getAgentSettings(agentId: string) {
    return structuredClone(this.agents.get(agentId) ?? {});
  }
  async updateAgent(agentId: string, patch: AgentPatch) {
    if (this.failPatches > 0) {
      this.failPatches--;
      throw new Error('elevenlabs PATCH → 503: upstream');
    }
    this.patches.push({ agentId, patch });
    if (!patch.platform_settings) return;
    const cur = this.agents.get(agentId) ?? {};
    this.agents.set(agentId, this.patchReplacesSettings
      ? { call_limits: patch.platform_settings.call_limits }
      : { ...cur, call_limits: { ...cur.call_limits, ...patch.platform_settings.call_limits } });
  }
}

function row(over: Partial<VoiceAgentRow> = {}): VoiceAgentRow {
  return {
    id: 'row-1', tenant_id: TENANT, bot_id: null, provider: 'elevenlabs',
    provider_agent_id: null, template_agent_id: null, desired_state: 'active', status: 'pending',
    stripe_subscription_id: 'sub_1', last_stripe_event_id: 'evt_1', attempts: 0, last_error: null, claimed_at: null,
    ...over,
  };
}

function makeRepo(w: World): ProvisionRepo {
  const find = (id: string) => w.rows.find((r) => r.id === id)!;
  return {
    async getByTenant(t) { return w.rows.find((r) => r.tenant_id === t) ?? null; },
    async listOpen(staleBefore, max) {
      return w.rows.filter((r) => r.status === 'pending'
        || (r.status === 'failed' && r.attempts < max)
        || (r.status === 'provisioning' && (r.claimed_at ?? '') < staleBefore));
    },
    async claim(r, nowIso, staleBefore) {
      const cur = find(r.id);
      const open = cur.status === 'pending' || cur.status === 'failed'
        || (cur.status === 'provisioning' && (cur.claimed_at ?? '') < staleBefore);
      if (!open || cur.attempts !== r.attempts) return null;
      Object.assign(cur, { status: 'provisioning', claimed_at: nowIso, attempts: cur.attempts + 1 });
      return { ...cur };
    },
    async update(id, patch) { Object.assign(find(id), patch); },
    async finish(id, claimedAt, patch) {
      const cur = find(id);
      w.onBeforeFinish?.(cur);
      if (cur.status !== 'provisioning' || cur.claimed_at !== claimedAt) return false;
      Object.assign(cur, patch);
      return true;
    },
    async loadVoiceEntitlements() { return w.ent; },
    async tenantName() { return 'ACME GmbH'; },
    async createVoiceBot() {
      if (w.failBotInsert) throw new Error(w.failBotInsert);
      const id = `bot_${w.bots.size + 1}`;
      w.bots.set(id, { enabled: false, config: {} });
      return id;
    },
    async setBotState(id, enabled, config) { w.bots.set(id, { enabled, config }); },
    async latestEvidenceHash() {
      return (w.evidence.at(-1)?.content_hash as string | undefined) ?? null;
    },
    async appendEvidence(r, expected) {
      const head = (w.evidence.at(-1)?.content_hash as string | undefined) ?? null;
      if (head !== expected) return 'conflict';
      w.evidence.push(r);
      return { id: String(r.id) };
    },
  };
}

function world(over: Partial<World> = {}): World {
  return {
    rows: [row()],
    ent: { voice: true, monthlyMinutes: 500 },
    bots: new Map(),
    evidence: [],
    provider: new FakeProvider(),
    ...over,
  };
}

let clock = Date.parse('2026-10-15T10:00:00Z');
function deps(w: World, over: Partial<HandlerDeps> = {}): HandlerDeps {
  let n = 0;
  return {
    provisionKey: KEY,
    enabled: true,
    templateAgentId: 'tpl_realsync',
    avgCallMinutes: 3,
    repo: makeRepo(w),
    provider: w.provider,
    now: () => new Date((clock += 1000)),
    uuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    timingSafeEqual,
    ...over,
  };
}

const call = (w: World, body: unknown = { tenant_id: TENANT }, over: Partial<HandlerDeps> = {}, auth = `Bearer ${KEY}`) =>
  handleProvisionVoiceAgent({ method: 'POST', authorization: auth, body }, deps(w, over));

describe('Handler: Zugriff', () => {
  it('fail-closed ohne Secret, 401 bei falschem Bearer, 405 bei GET', async () => {
    const w = world();
    expect((await call(w, {}, { provisionKey: undefined })).status).toBe(500);
    expect((await call(w, {}, {}, 'Bearer falsch')).status).toBe(401);
    expect((await call(w, {}, {}, '')).status).toBe(401);
    expect((await handleProvisionVoiceAgent({ method: 'GET', authorization: `Bearer ${KEY}`, body: null }, deps(w))).status).toBe(405);
    expect((await call(w, { tenant_id: 'kein-uuid' })).status).toBe(400);
    expect(w.provider.duplicates).toHaveLength(0);
  });

  it('ausgeschaltet: nichts wird beansprucht oder dupliziert', async () => {
    const w = world();
    const res = await call(w, { tenant_id: TENANT }, { enabled: false });
    expect(res).toEqual({ status: 200, body: { ok: true, disabled: true, processed: 0, outcomes: [] } });
    expect(w.rows[0].status).toBe('pending');
    expect(w.provider.duplicates).toHaveLength(0);
  });
});

describe('Handler: Bereitstellung', () => {
  it('bots-Zeile → Duplikat → Tageslimit → Read-back → Evidenz → active', async () => {
    const w = world();
    const res = await call(w);
    expect(res.status).toBe(200);
    expect(res.body.outcomes).toEqual([{ tenant_id: TENANT, result: 'active', provider_agent_id: 'agent_1' }]);

    expect(w.provider.duplicates).toEqual([{ template: 'tpl_realsync', name: 'RealSync Voice · ACME GmbH · 11111111' }]);
    // Kein auth/privacy im PATCH (geerbt), call_limits vollständig mit Vorlagenwerten.
    expect(w.provider.patches[0].patch).toEqual({
      name: 'RealSync Voice · ACME GmbH · 11111111',
      tags: ['realsync', `tenant:${TENANT}`],
      platform_settings: { call_limits: { agent_concurrency_limit: 2, daily_limit: 5, bursting_enabled: false } },
    });
    expect(w.bots.get('bot_1')).toEqual({ enabled: true, config: { provider: 'elevenlabs', provider_agent_id: 'agent_1' } });

    const r = w.rows[0];
    expect(r).toMatchObject({
      status: 'active', bot_id: 'bot_1', provider_agent_id: 'agent_1', template_agent_id: 'tpl_realsync',
      attempts: 0, last_error: null, claimed_at: null, desired_state: 'active',
    });
    expect(w.evidence).toHaveLength(1);
  });

  it('Evidenz ist an die Mandanten-Kette gehängt und nachrechenbar', async () => {
    const w = world({ evidence: [{ id: 'prev', content_hash: 'a'.repeat(64) }] });
    await call(w);
    const ev = w.evidence[1] as { content_hash: string; previous_hash: string; title: string; evidence_type: string;
      metadata: { snapshot: Record<string, unknown>; hash_method: string } };
    expect(ev.previous_hash).toBe('a'.repeat(64));
    expect(ev.metadata.snapshot.previous_hash).toBe('a'.repeat(64));
    expect(ev.metadata.snapshot).toMatchObject({
      kind: 'voice_agent.provisioned', tenant_id: TENANT, provider_agent_id: 'agent_1',
      template_agent_id: 'tpl_realsync', stripe_subscription_id: 'sub_1', stripe_event_id: 'evt_1',
      config: {
        daily_limit: 5, monthly_minutes: 500,
        verified: {
          auth_enabled: true, require_origin_header: true, record_voice: false, retention_days: 7,
          delete_audio: true, delete_transcript_and_pii: false, zero_retention_mode: false,
          pii_redaction_enabled: false, daily_limit: 5, agent_concurrency_limit: 2,
        },
      },
    });
    expect(ev.content_hash).toBe(await evidenceContentHash(ev.metadata.snapshot));
    expect(canonicalJson(ev.metadata.snapshot)).not.toMatch(/sk_|api_key/i);
    expect(ev.evidence_type).toBe('json');
  });

  it('unbegrenzte Minuten: kein platform_settings im PATCH, Vorlagenlimit bleibt', async () => {
    const w = world({ ent: { voice: true, monthlyMinutes: null } });
    await call(w);
    expect(w.provider.patches[0].patch.platform_settings).toBeUndefined();
    expect(w.rows[0].status).toBe('active');
  });

  it('PATCH setzt Privacy/Auth zurück: Read-back schlägt an, failed, Bot bleibt aus, keine Evidenz', async () => {
    const w = world();
    w.provider.patchReplacesSettings = true;
    await call(w);
    expect(w.rows[0].status).toBe('failed');
    expect(w.rows[0].last_error).toMatch(/agent guarantees violated: auth\.enable_auth is not true; privacy\.record_voice/);
    expect(w.bots.get('bot_1')?.enabled).toBe(false);
    expect(w.evidence).toHaveLength(0);
  });

  it('abgedriftete Vorlage (Aufbewahrung 30 Tage) geht nicht live', async () => {
    const w = world();
    const orig = w.provider.duplicateAgent.bind(w.provider);
    w.provider.duplicateAgent = async (t, n) => {
      const id = await orig(t, n);
      w.provider.agents.get(id)!.privacy!.retention_days = 30;
      return id;
    };
    await call(w);
    expect(w.rows[0]).toMatchObject({ status: 'failed' });
    expect(w.rows[0].last_error).toMatch(/retention_days=30/);
  });

  it('Fehler nach dem Duplizieren: failed, nächster Lauf dupliziert NICHT erneut', async () => {
    const w = world();
    w.provider.failPatches = 1;
    const first = await call(w);
    expect(first.body.outcomes).toMatchObject([{ result: 'failed', provider_agent_id: null }]);
    expect(w.rows[0]).toMatchObject({ status: 'failed', provider_agent_id: 'agent_1', bot_id: 'bot_1', attempts: 1 });
    expect(w.rows[0].last_error).toMatch(/503/);
    expect(w.evidence).toHaveLength(0);

    const second = await call(w, {});
    expect(second.body.outcomes).toMatchObject([{ result: 'active', provider_agent_id: 'agent_1' }]);
    expect(w.provider.duplicates).toHaveLength(1);
    expect(w.bots.size).toBe(1);
  });

  it('Bot-Quota greift: failed mit Grund, kein Agent beim Provider', async () => {
    const w = world({ failBotInsert: 'bots insert: Bot-Kontingent erreicht' });
    await call(w);
    expect(w.rows[0]).toMatchObject({ status: 'failed', last_error: 'bots insert: Bot-Kontingent erreicht' });
    expect(w.provider.duplicates).toHaveLength(0);
  });

  it('ohne Vorlage oder API-Key: failed, sichtbar statt still', async () => {
    const a = world();
    await call(a, { tenant_id: TENANT }, { templateAgentId: undefined });
    expect(a.rows[0].last_error).toMatch(/TEMPLATE_AGENT_ID/);
    const b = world();
    await call(b, { tenant_id: TENANT }, { provider: null });
    expect(b.rows[0].last_error).toMatch(/ELEVENLABS_API_KEY/);
  });

  it('eine bereits aktive Zeile wird nicht noch einmal angefasst', async () => {
    const w = world({ rows: [row({ status: 'active', bot_id: 'bot_1', provider_agent_id: 'agent_1' })] });
    const res = await call(w);
    expect(res.body.outcomes).toEqual([{ tenant_id: TENANT, result: 'skipped' }]);
    expect(w.provider.patches).toHaveLength(0);
  });
});

describe('Handler: Kündigung', () => {
  it('bots.voice weg → Bot aus, Evidenz, suspended — Agent bleibt erhalten', async () => {
    const w = world({
      ent: { voice: false, monthlyMinutes: null },
      rows: [row({ desired_state: 'suspended', bot_id: 'bot_1', provider_agent_id: 'agent_1', template_agent_id: 'tpl_realsync' })],
    });
    w.bots.set('bot_1', { enabled: true, config: {} });
    const res = await call(w);
    expect(res.body.outcomes).toEqual([{ tenant_id: TENANT, result: 'suspended', provider_agent_id: 'agent_1' }]);
    expect(w.bots.get('bot_1')?.enabled).toBe(false);
    expect(w.rows[0]).toMatchObject({ status: 'suspended', provider_agent_id: 'agent_1' });
    expect((w.evidence[0].metadata as { snapshot: { kind: string } }).snapshot.kind).toBe('voice_agent.suspended');
    expect(w.provider.duplicates).toHaveLength(0);
  });

  it('nie bereitgestellt: suspended ohne Evidenz', async () => {
    const w = world({ ent: { voice: false, monthlyMinutes: null } });
    await call(w);
    expect(w.rows[0].status).toBe('suspended');
    expect(w.evidence).toHaveLength(0);
  });

  it('Kündigung während eines Laufs: der Webhook gewinnt, die Zeile bleibt pending', async () => {
    const w = world();
    w.onBeforeFinish = (cur) => {
      Object.assign(cur, { desired_state: 'suspended', status: 'pending', claimed_at: null, attempts: 0 });
      w.onBeforeFinish = undefined;
    };
    await call(w);
    expect(w.rows[0]).toMatchObject({ status: 'pending', desired_state: 'suspended' });

    w.ent = { voice: false, monthlyMinutes: null };
    await call(w, {});
    expect(w.rows[0].status).toBe('suspended');
    expect(w.bots.get('bot_1')?.enabled).toBe(false);
  });
});
