// provision-voice-agent — Ablauf ohne Deno-Runtime, Netzwerk oder DB.
// Repo und Provider werden injiziert (repo.ts / elevenlabs.ts), getestet in
// test/edge/provision-voice-agent.test.ts.
//
// Je Zeile in public.tenant_voice_agents:
//   1. beanspruchen (pending/failed → provisioning; hängende Claims nach
//      STALE_CLAIM_MS erneut) — zwei parallele Läufe bearbeiten nie dieselbe Zeile
//   2. Soll-Zustand aus tenant_entitlements() neu bestimmen (bots.voice)
//   3a. aktiv:  bots-Zeile sicherstellen (aus) → Vorlage duplizieren (agent_id
//       sofort speichern) → Name/Tags/Tageslimit setzen → Read-back fail-closed
//       (Auth an, keine Aufzeichnung, Aufbewahrung ≤ 7 Tage, Limit)
//   3b. gesperrt: nichts beim Provider
//   4. Abschluss atomar per finish_tenant_voice_agent(): Claim prüfen →
//      Evidenz anhängen → Bot schalten → Status. Ein überholter Lauf ändert
//      nichts; ohne Beleg wird kein Bot eingeschaltet.
//   5. Fehler: 'failed' + last_error, Bot aus (fail-closed); der nächste Lauf
//      setzt fort, wo der letzte aufgehört hat (bot_id / provider_agent_id).
//
// Reconcile (Aufruf ohne tenant_id, pg_cron): zusätzlich abgeschlossene
// Zeilen rotierend gegen die Entitlements prüfen — abgelaufene Grants und
// geänderte Minuten kommen ohne Stripe-Ereignis an.

import { EVIDENCE_HASH_METHOD, evidenceContentHash } from '../_shared/evidence-hash.ts';
import {
  MAX_PROVISION_ATTEMPTS,
  STALE_CLAIM_MS,
  agentGuaranteeViolations,
  agentName,
  settingsForEvidence,
  type AgentPlatformSettings,
  dailyCallLimit,
  desiredStateFor,
  safeError,
  settledRowIsStale,
  type VoiceAgentStatus,
  type VoiceDesiredState,
  type VoiceEntitlements,
} from '../_shared/voice-agent-provisioning.ts';

export const EVIDENCE_TITLE_PROVISIONED = 'Voice-Agent bereitgestellt';
export const EVIDENCE_TITLE_SUSPENDED = 'Voice-Agent gesperrt';
const EVIDENCE_APPEND_ATTEMPTS = 3;
const RECONCILE_BATCH = 20;

export interface VoiceAgentRow {
  id: string;
  tenant_id: string;
  bot_id: string | null;
  provider: 'elevenlabs';
  provider_agent_id: string | null;
  template_agent_id: string | null;
  desired_state: VoiceDesiredState;
  status: VoiceAgentStatus;
  stripe_subscription_id: string | null;
  last_stripe_event_id: string | null;
  attempts: number;
  last_error: string | null;
  claimed_at: string | null;
  config_snapshot: Record<string, unknown> | null;
}

export type FinishResult = 'ok' | 'lost_claim' | 'evidence_conflict';

export interface FinishRun {
  id: string;
  claimedAt: string;
  status: 'active' | 'suspended' | 'failed';
  /** null = Bot nicht anfassen. */
  botEnabled: boolean | null;
  botConfig: Record<string, unknown> | null;
  configSnapshot: Record<string, unknown> | null;
  lastError: string | null;
  evidence: Record<string, unknown> | null;
  expectedPreviousHash: string | null;
}

export interface ProvisionRepo {
  getByTenant(tenantId: string): Promise<VoiceAgentRow | null>;
  /** Offene Zeilen: pending, failed unter MAX_PROVISION_ATTEMPTS, hängende provisioning. */
  listOpen(staleBefore: string, maxAttempts: number, limit: number): Promise<VoiceAgentRow[]>;
  /**
   * Atomarer Übergang nach 'provisioning'. Liefert null, wenn ein anderer Lauf
   * schneller war (WHERE-Bedingung greift nach dem Row-Lock erneut).
   */
  claim(row: VoiceAgentRow, nowIso: string, staleBefore: string): Promise<VoiceAgentRow | null>;
  /** Zwischenstände (bot_id, provider_agent_id) — Fakten, unabhängig vom Ausgang. */
  update(id: string, patch: Record<string, unknown>): Promise<void>;
  /** finish_tenant_voice_agent(): Claim → Evidenz → Bot → Status in einer Transaktion. */
  finishRun(input: FinishRun): Promise<FinishResult>;
  /** Abgeschlossene Zeilen (active / suspended), älteste Prüfung zuerst. */
  listSettled(limit: number): Promise<VoiceAgentRow[]>;
  /** settled → pending, nur wenn der Status noch unverändert ist. */
  requeue(row: VoiceAgentRow): Promise<VoiceAgentRow | null>;
  markReconciled(id: string): Promise<void>;
  loadVoiceEntitlements(tenantId: string): Promise<VoiceEntitlements>;
  tenantName(tenantId: string): Promise<string | null>;
  /** Neue bots-Zeile, ausgeschaltet — eingeschaltet wird nur im Abschluss. */
  createVoiceBot(tenantId: string, name: string): Promise<string>;
  latestEvidenceHash(tenantId: string): Promise<string | null>;
}

/**
 * Bewusst ohne `auth` und `privacy`: beides erbt das Duplikat von der
 * abgenommenen Vorlage. `call_limits` geht vollständig (Werte der Vorlage +
 * neues Tageslimit), falls der Provider Unterobjekte ersetzt statt zu mergen.
 */
export interface AgentPatch {
  name: string;
  tags: string[];
  platform_settings?: {
    call_limits: NonNullable<AgentPlatformSettings['call_limits']> & { daily_limit: number };
  };
}

export interface VoiceProviderClient {
  duplicateAgent(templateAgentId: string, name: string): Promise<string>;
  getAgentSettings(agentId: string): Promise<AgentPlatformSettings>;
  updateAgent(agentId: string, patch: AgentPatch): Promise<void>;
}

export interface HandlerDeps {
  /** Wert des Function-Secrets VOICE_PROVISION_KEY (Vault voice_provision_key). */
  provisionKey: string | undefined;
  /**
   * VOICE_PROVISIONING_ENABLED === 'true'. Kundenagenten erben Aufbewahrung,
   * Aufzeichnung, LLM und Parallelität der Vorlage — solange die Vorlage nicht
   * abgenommen ist, bleibt jede Zeile 'pending' und nichts wird dupliziert.
   */
  enabled: boolean;
  templateAgentId: string | undefined;
  avgCallMinutes: number;
  repo: ProvisionRepo;
  provider: VoiceProviderClient | null;
  now: () => Date;
  uuid: () => string;
  timingSafeEqual: (a: string, b: string) => boolean;
}

export interface HandlerRequest {
  method: string;
  authorization: string | null;
  body: unknown;
}

export interface HandlerResponse {
  status: number;
  body: Record<string, unknown>;
}

export interface RowOutcome {
  tenant_id: string;
  result: 'active' | 'suspended' | 'failed' | 'skipped' | 'unchanged';
  provider_agent_id?: string | null;
  error?: string;
}

export async function handleProvisionVoiceAgent(
  req: HandlerRequest,
  deps: HandlerDeps,
): Promise<HandlerResponse> {
  if (req.method !== 'POST') return { status: 405, body: { error: 'POST only' } };
  if (!deps.provisionKey) {
    return { status: 500, body: { error: 'VOICE_PROVISION_KEY not configured' } };
  }
  const token = (req.authorization ?? '').replace(/^Bearer\s+/i, '');
  if (!token || !deps.timingSafeEqual(token, deps.provisionKey)) {
    return { status: 401, body: { error: 'internal only' } };
  }

  const tenantId = readTenantId(req.body);
  if (tenantId === 'invalid') return { status: 400, body: { error: 'tenant_id must be a uuid' } };
  if (!deps.enabled) {
    // Kein Fehler: die Zeilen warten, der erste Lauf nach Freigabe holt sie ab.
    return { status: 200, body: { ok: true, disabled: true, processed: 0, outcomes: [] } };
  }

  const now = deps.now();
  const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS).toISOString();

  let rows: VoiceAgentRow[];
  const outcomes: RowOutcome[] = [];
  if (tenantId) {
    const row = await deps.repo.getByTenant(tenantId);
    rows = row ? [row] : [];
  } else {
    rows = await deps.repo.listOpen(staleBefore, MAX_PROVISION_ATTEMPTS, RECONCILE_BATCH);
    for (const settled of await deps.repo.listSettled(RECONCILE_BATCH)) {
      const ent = await deps.repo.loadVoiceEntitlements(settled.tenant_id);
      if (!settledRowIsStale(settled, ent, deps.avgCallMinutes)) {
        await deps.repo.markReconciled(settled.id);
        outcomes.push({ tenant_id: settled.tenant_id, result: 'unchanged', provider_agent_id: settled.provider_agent_id });
        continue;
      }
      const requeued = await deps.repo.requeue(settled);
      if (requeued) rows.push(requeued);
    }
  }

  for (const row of rows) {
    outcomes.push(await processRow(row, deps, staleBefore));
  }
  return { status: 200, body: { ok: true, processed: outcomes.length, outcomes } };
}

function readTenantId(body: unknown): string | null | 'invalid' {
  if (!body || typeof body !== 'object') return null;
  const raw = (body as Record<string, unknown>).tenant_id;
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    return 'invalid';
  }
  return raw.toLowerCase();
}

export async function processRow(
  row: VoiceAgentRow,
  deps: HandlerDeps,
  staleBefore: string,
): Promise<RowOutcome> {
  const { repo } = deps;
  const nowIso = deps.now().toISOString();
  const claimed = await repo.claim(row, nowIso, staleBefore);
  if (!claimed) return { tenant_id: row.tenant_id, result: 'skipped' };

  try {
    const ent = await repo.loadVoiceEntitlements(claimed.tenant_id);
    const desired = desiredStateFor(ent);
    if (desired === 'active') return await activate(claimed, ent, deps);
    return await suspend(claimed, deps);
  } catch (err) {
    const error = safeError(err);
    // Fail-closed: ein gescheiterter Lauf lässt keinen Bot eingeschaltet —
    // auch keinen, der vorher lief und nur neu konfiguriert werden sollte.
    await repo.finishRun({
      id: claimed.id,
      claimedAt: claimed.claimed_at ?? nowIso,
      status: 'failed',
      botEnabled: false,
      botConfig: null,
      configSnapshot: null,
      lastError: error,
      evidence: null,
      expectedPreviousHash: null,
    });
    return { tenant_id: claimed.tenant_id, result: 'failed', provider_agent_id: claimed.provider_agent_id, error };
  }
}

async function activate(row: VoiceAgentRow, ent: VoiceEntitlements, deps: HandlerDeps): Promise<RowOutcome> {
  const { repo } = deps;
  if (!deps.provider) throw new Error('ELEVENLABS_API_KEY not configured');
  const templateAgentId = row.template_agent_id ?? deps.templateAgentId;
  if (!templateAgentId) throw new Error('ELEVENLABS_VOICE_TEMPLATE_AGENT_ID not configured');

  const name = agentName(row.tenant_id, await repo.tenantName(row.tenant_id));

  let botId = row.bot_id;
  if (!botId) {
    botId = await repo.createVoiceBot(row.tenant_id, name);
    await repo.update(row.id, { bot_id: botId });
  }

  let agentId = row.provider_agent_id;
  if (!agentId) {
    agentId = await deps.provider.duplicateAgent(templateAgentId, name);
    // Sofort sichern: scheitert ein späterer Schritt, dupliziert der nächste
    // Lauf nicht erneut, sondern setzt beim vorhandenen Agenten fort.
    await repo.update(row.id, { provider_agent_id: agentId, template_agent_id: templateAgentId });
  }

  const daily = dailyCallLimit(ent.monthlyMinutes, deps.avgCallMinutes);
  const before = await deps.provider.getAgentSettings(agentId);
  const patch: AgentPatch = {
    name,
    tags: ['realsync', `tenant:${row.tenant_id}`],
    ...(daily === null
      ? {}
      : { platform_settings: { call_limits: { ...(before.call_limits ?? {}), daily_limit: daily } } }),
  };
  await deps.provider.updateAgent(agentId, patch);

  // Read-back: belegt wird, was beim Provider tatsächlich gilt.
  const after = await deps.provider.getAgentSettings(agentId);
  const violations = agentGuaranteeViolations(after, daily);
  if (violations.length > 0) {
    throw new Error(`agent guarantees violated: ${violations.join('; ')}`);
  }

  const config = {
    name,
    daily_limit: daily,
    monthly_minutes: ent.monthlyMinutes,
    avg_call_minutes: deps.avgCallMinutes,
    verified: settingsForEvidence(after),
  };
  const result = await finishWithEvidence(deps, row, {
    status: 'active',
    botEnabled: true,
    botConfig: { provider: 'elevenlabs', provider_agent_id: agentId },
    configSnapshot: config,
    evidence: {
      kind: 'voice_agent.provisioned',
      title: EVIDENCE_TITLE_PROVISIONED,
      botId,
      agentId,
      templateAgentId,
      config,
    },
  });
  if (result === 'lost_claim') return { tenant_id: row.tenant_id, result: 'skipped', provider_agent_id: agentId };
  return { tenant_id: row.tenant_id, result: 'active', provider_agent_id: agentId };
}

async function suspend(row: VoiceAgentRow, deps: HandlerDeps): Promise<RowOutcome> {
  // Ein nie bereitgestellter Agent hinterlässt nichts, was zu belegen wäre.
  const hasSomething = Boolean(row.bot_id || row.provider_agent_id);
  const result = await finishWithEvidence(deps, row, {
    status: 'suspended',
    botEnabled: false,
    botConfig: { provider: 'elevenlabs', provider_agent_id: row.provider_agent_id },
    configSnapshot: null,
    evidence: hasSomething
      ? {
        kind: 'voice_agent.suspended',
        title: EVIDENCE_TITLE_SUSPENDED,
        botId: row.bot_id,
        agentId: row.provider_agent_id,
        templateAgentId: row.template_agent_id,
        config: null,
      }
      : null,
  });
  if (result === 'lost_claim') return { tenant_id: row.tenant_id, result: 'skipped', provider_agent_id: row.provider_agent_id };
  return { tenant_id: row.tenant_id, result: 'suspended', provider_agent_id: row.provider_agent_id };
}

interface EvidenceInput {
  kind: 'voice_agent.provisioned' | 'voice_agent.suspended';
  title: string;
  botId: string | null;
  agentId: string | null;
  templateAgentId: string | null;
  config: Record<string, unknown> | null;
}

interface FinishInput {
  status: 'active' | 'suspended';
  botEnabled: boolean;
  botConfig: Record<string, unknown>;
  configSnapshot: Record<string, unknown> | null;
  evidence: EvidenceInput | null;
}

/**
 * Abschluss mit Beleg an der governance_evidence-Kette des Mandanten
 * (gleiche Konvention wie email-auth-rescan: JCS-Snapshot, previous_hash im
 * Snapshot, Append nur am aktuellen Kettenkopf). Evidenz, Bot und Status
 * gehen in EINER Transaktion; bewegt sich der Kettenkopf, wird neu gehasht.
 * Scheitert das dauerhaft, scheitert der Lauf — ohne Beleg gilt der Agent
 * nicht als bereitgestellt.
 */
async function finishWithEvidence(deps: HandlerDeps, row: VoiceAgentRow, input: FinishInput): Promise<'ok' | 'lost_claim'> {
  const { repo } = deps;
  const base = {
    id: row.id,
    claimedAt: row.claimed_at!,
    status: input.status,
    botEnabled: input.botEnabled,
    botConfig: input.botConfig,
    configSnapshot: input.configSnapshot,
    lastError: null,
  };
  if (!input.evidence) {
    const r = await repo.finishRun({ ...base, evidence: null, expectedPreviousHash: null });
    if (r === 'evidence_conflict') throw new Error('finish without evidence reported evidence_conflict');
    return r;
  }
  const evidenceId = deps.uuid();
  const occurredAt = deps.now().toISOString();
  for (let attempt = 0; attempt < EVIDENCE_APPEND_ATTEMPTS; attempt++) {
    const previousHash = await repo.latestEvidenceHash(row.tenant_id);
    const evidence = await evidenceRow(row, input.evidence, evidenceId, occurredAt, previousHash);
    const r = await repo.finishRun({ ...base, evidence, expectedPreviousHash: previousHash });
    if (r !== 'evidence_conflict') return r;
  }
  throw new Error('evidence chain head kept moving — retry later');
}

async function evidenceRow(
  row: VoiceAgentRow,
  input: EvidenceInput,
  evidenceId: string,
  occurredAt: string,
  previousHash: string | null,
): Promise<Record<string, unknown>> {
  const snapshot: Record<string, unknown> = {
    kind: input.kind,
    evidence_id: evidenceId,
    tenant_id: row.tenant_id,
    voice_agent_id: row.id,
    bot_id: input.botId,
    provider: row.provider,
    provider_agent_id: input.agentId,
    template_agent_id: input.templateAgentId,
    config: input.config,
    stripe_subscription_id: row.stripe_subscription_id,
    stripe_event_id: row.last_stripe_event_id,
    actor: 'provision-voice-agent',
    occurred_at: occurredAt,
    previous_hash: previousHash,
  };
  const contentHash = await evidenceContentHash(snapshot);
  return {
    id: evidenceId,
    tenant_id: row.tenant_id,
    event_id: null,
    asset_id: null,
    evidence_type: 'json',
    title: input.title,
    storage_path: null,
    content_hash: contentHash,
    previous_hash: previousHash,
    metadata: { snapshot, hash_method: EVIDENCE_HASH_METHOD, source: 'provision-voice-agent' },
  };
}
