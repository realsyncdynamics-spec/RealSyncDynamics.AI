/**
 * Persistenz-Port für Voice Tool Gateway + Session-Persistenz.
 *
 * MemoryVoiceStore: nur explizit in Tests injizieren — nie als Produktiv-Default.
 * Produktion: SupabaseVoiceStore (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
 */

import { randomUUID } from 'node:crypto';

import type { VoiceProviderId } from '../voice-provider-types.js';
import type { VoicePolicyDecision, VoiceRiskLevel, VoiceToolName, VoiceVerdict } from '../voice-types.js';
import {
  VOICE_GENESIS_HASH,
  appendEvidenceLink,
  type VoiceEvidenceKind,
  type VoiceEvidenceRecord,
} from './evidence-hash.js';

export interface VoiceToolRequestRow {
  id: string;
  tenantId: string;
  sessionId: string;
  providerCallId: string;
  tool: VoiceToolName;
  argumentKeys: string[];
  args: Record<string, unknown>;
  verdict: VoiceVerdict;
  reason: string;
  risk: VoiceRiskLevel;
  policyRef: string;
  trace: VoicePolicyDecision['trace'];
  decidedBy: 'policy-engine';
  decidedAt: string;
  confirmedBy: 'caller' | 'staff' | null;
  confirmedAt: string | null;
}

export interface VoiceExecutionRow {
  id: string;
  tenantId: string;
  toolRequestId: string;
  status: 'pending' | 'succeeded' | 'failed' | 'timeout';
  externalRef: string | null;
  errorCode: string | null;
  verificationStatus: 'unverified' | 'confirmed' | 'mismatch' | 'failed';
  verifiedAt: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface AppointmentInsert {
  tenantId: string;
  botId: string;
  customerName: string;
  contact?: string | null;
  service?: string | null;
  requestedAt?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AppointmentRow {
  id: string;
  tenantId: string;
  botId: string;
  customerName: string;
  status: string;
}

export type VoiceSessionStatus =
  | 'idle'
  | 'consent_required'
  | 'listening'
  | 'transcribing'
  | 'reasoning'
  | 'policy_check'
  | 'awaiting_confirmation'
  | 'speaking'
  | 'killed'
  | 'rate_limited'
  | 'ended'
  | 'failed';

export interface VoiceSessionContext {
  tenantId: string;
  botId: string;
  numberBindingId: string | null;
  provider: VoiceProviderId;
  model: string;
  voice: string | null;
  language: string;
  policyRef: string;
  disclosureText: string;
  offeredTools: string[];
}

export type ResolveSessionContextQuery =
  | { botId: string; numberBindingId?: never }
  | { numberBindingId: string; botId?: never };

export interface VoiceSessionInsert {
  tenantId: string;
  botId: string;
  numberBindingId?: string | null;
  provider: VoiceProviderId;
  model: string;
  policyRef: string;
  correlationId?: string;
  providerSessionRef?: string | null;
  telephonyCallRef?: string | null;
  status?: VoiceSessionStatus;
  consentPurposes?: string[];
  killSwitch?: boolean;
  disclosurePlayedAt?: string | null;
}

export interface VoiceSessionRow {
  id: string;
  tenantId: string;
  botId: string;
  numberBindingId: string | null;
  provider: VoiceProviderId;
  model: string;
  policyRef: string;
  providerSessionRef: string | null;
  telephonyCallRef: string | null;
  correlationId: string;
  status: VoiceSessionStatus;
  disclosurePlayedAt: string | null;
  consentPurposes: string[];
  killSwitch: boolean;
  startedAt: string;
  endedAt: string | null;
}

export type VoiceSessionStatusPatch = Partial<{
  status: VoiceSessionStatus;
  disclosurePlayedAt: string | null;
  endedAt: string | null;
  providerSessionRef: string | null;
  killSwitch: boolean;
}>;

export interface VoiceBotConfigSeed {
  tenantId: string;
  botId: string;
  provider: VoiceProviderId;
  model: string;
  voice?: string | null;
  language?: string;
  disclosureText: string;
  policyRef: string;
  offeredTools?: string[];
  status?: 'draft' | 'active' | 'paused';
}

export interface VoiceNumberBindingSeed {
  id?: string;
  tenantId: string;
  botId: string;
  phoneNumberE164: string;
  telephonyProvider?: 'telnyx' | 'twilio' | 'sip' | 'test';
  status?: 'pending' | 'active' | 'released';
}

export interface VoiceStore {
  resolveSessionContext(query: ResolveSessionContextQuery): Promise<VoiceSessionContext | null>;
  insertSession(row: VoiceSessionInsert): Promise<VoiceSessionRow>;
  updateSessionStatus(
    tenantId: string,
    sessionId: string,
    patch: VoiceSessionStatusPatch,
  ): Promise<VoiceSessionRow | null>;
  insertToolRequest(row: Omit<VoiceToolRequestRow, 'id'> & { id?: string }): Promise<VoiceToolRequestRow>;
  confirmToolRequest(
    tenantId: string,
    toolRequestId: string,
    confirmedBy: 'caller' | 'staff',
  ): Promise<VoiceToolRequestRow | null>;
  getToolRequest(tenantId: string, toolRequestId: string): Promise<VoiceToolRequestRow | null>;
  insertExecution(row: Omit<VoiceExecutionRow, 'id'> & { id?: string }): Promise<VoiceExecutionRow>;
  updateExecution(
    tenantId: string,
    executionId: string,
    patch: Partial<Pick<VoiceExecutionRow, 'status' | 'externalRef' | 'errorCode' | 'verificationStatus' | 'verifiedAt' | 'finishedAt'>>,
  ): Promise<VoiceExecutionRow>;
  appendEvidence(input: {
    tenantId: string;
    sessionId: string;
    kind: VoiceEvidenceKind;
    toolRequestId?: string | null;
    payload?: Record<string, unknown>;
  }): Promise<VoiceEvidenceRecord>;
  listEvidence(tenantId: string, sessionId: string): Promise<VoiceEvidenceRecord[]>;
  insertAppointment(row: AppointmentInsert): Promise<{ id: string }>;
  /** Re-Read zur Verifikation: nur Treffer mit id + tenant_id. */
  getAppointment(tenantId: string, appointmentId: string): Promise<AppointmentRow | null>;
}

export interface MemoryVoiceStore extends VoiceStore {
  seedBotConfig(config: VoiceBotConfigSeed): void;
  seedNumberBinding(binding: VoiceNumberBindingSeed): string;
  listSessions(tenantId: string): VoiceSessionRow[];
}

/** In-Memory-Store — ausschließlich für Unit-Tests (explizit injizieren). */
export function createMemoryVoiceStore(): MemoryVoiceStore {
  const requests = new Map<string, VoiceToolRequestRow>();
  const executions = new Map<string, VoiceExecutionRow>();
  const evidenceByTenantSession = new Map<string, VoiceEvidenceRecord[]>();
  const appointments = new Map<string, AppointmentInsert & { id: string; status: string }>();
  const configsByBot = new Map<string, VoiceBotConfigSeed & { status: 'draft' | 'active' | 'paused' }>();
  const bindings = new Map<string, VoiceNumberBindingSeed & { id: string; status: 'pending' | 'active' | 'released' }>();
  const sessions = new Map<string, VoiceSessionRow>();

  const scopedKey = (tenantId: string, id: string) => `${tenantId}:${id}`;
  const evidenceKey = (tenantId: string, sessionId: string) => `${tenantId}:${sessionId}`;

  function configToContext(
    config: VoiceBotConfigSeed & { status: string },
    numberBindingId: string | null,
  ): VoiceSessionContext {
    return {
      tenantId: config.tenantId,
      botId: config.botId,
      numberBindingId,
      provider: config.provider,
      model: config.model,
      voice: config.voice ?? null,
      language: config.language ?? 'de-DE',
      policyRef: config.policyRef,
      disclosureText: config.disclosureText,
      offeredTools: [...(config.offeredTools ?? [])],
    };
  }

  return {
    seedBotConfig(config) {
      configsByBot.set(config.botId, {
        ...config,
        status: config.status ?? 'active',
        offeredTools: [...(config.offeredTools ?? [])],
      });
    },

    seedNumberBinding(binding) {
      const id = binding.id ?? randomUUID();
      bindings.set(id, {
        ...binding,
        id,
        status: binding.status ?? 'active',
        telephonyProvider: binding.telephonyProvider ?? 'test',
      });
      return id;
    },

    listSessions(tenantId) {
      return [...sessions.values()].filter((s) => s.tenantId === tenantId);
    },

    async resolveSessionContext(query) {
      if ('numberBindingId' in query && query.numberBindingId) {
        const binding = bindings.get(query.numberBindingId);
        if (!binding || binding.status !== 'active') return null;
        const config = configsByBot.get(binding.botId);
        if (!config || config.status !== 'active') return null;
        if (config.tenantId !== binding.tenantId) return null;
        return configToContext(config, binding.id);
      }
      if ('botId' in query && query.botId) {
        const config = configsByBot.get(query.botId);
        if (!config || config.status !== 'active') return null;
        return configToContext(config, null);
      }
      return null;
    },

    async insertSession(row) {
      if (!row.tenantId || !row.botId || !row.model || !row.policyRef || !row.provider) {
        throw new Error('voice-store: session requires tenantId, botId, provider, model, policyRef');
      }
      const id = randomUUID();
      const full: VoiceSessionRow = {
        id,
        tenantId: row.tenantId,
        botId: row.botId,
        numberBindingId: row.numberBindingId ?? null,
        provider: row.provider,
        model: row.model,
        policyRef: row.policyRef,
        providerSessionRef: row.providerSessionRef ?? null,
        telephonyCallRef: row.telephonyCallRef ?? null,
        correlationId: row.correlationId ?? randomUUID(),
        status: row.status ?? 'idle',
        disclosurePlayedAt: row.disclosurePlayedAt ?? null,
        consentPurposes: [...(row.consentPurposes ?? [])],
        killSwitch: row.killSwitch ?? false,
        startedAt: new Date().toISOString(),
        endedAt: null,
      };
      sessions.set(scopedKey(full.tenantId, id), full);
      return full;
    },

    async updateSessionStatus(tenantId, sessionId, patch) {
      const key = scopedKey(tenantId, sessionId);
      const row = sessions.get(key);
      if (!row || row.tenantId !== tenantId) return null;
      const next: VoiceSessionRow = { ...row, ...patch };
      sessions.set(key, next);
      return next;
    },

    async insertToolRequest(row) {
      const id = row.id ?? randomUUID();
      const full: VoiceToolRequestRow = { ...row, id, decidedBy: 'policy-engine' };
      requests.set(scopedKey(full.tenantId, id), full);
      return full;
    },

    async confirmToolRequest(tenantId, toolRequestId, confirmedBy) {
      const key = scopedKey(tenantId, toolRequestId);
      const row = requests.get(key);
      if (!row || row.tenantId !== tenantId) return null;
      if (row.verdict !== 'REQUIRE_CONFIRMATION') return null;
      if (row.confirmedAt) return row;
      const updated: VoiceToolRequestRow = {
        ...row,
        confirmedBy,
        confirmedAt: new Date().toISOString(),
      };
      requests.set(key, updated);
      return updated;
    },

    async getToolRequest(tenantId, toolRequestId) {
      const row = requests.get(scopedKey(tenantId, toolRequestId));
      return row && row.tenantId === tenantId ? row : null;
    },

    async insertExecution(row) {
      const req = requests.get(scopedKey(row.tenantId, row.toolRequestId));
      if (!req || req.tenantId !== row.tenantId) {
        throw new Error('voice-store: tool_request not found for tenant');
      }
      const allowed =
        req.verdict === 'ALLOW' ||
        (req.verdict === 'REQUIRE_CONFIRMATION' && req.confirmedAt !== null);
      if (!allowed) {
        throw new Error('voice-store: execution denied by policy gate');
      }
      const id = row.id ?? randomUUID();
      const full: VoiceExecutionRow = { ...row, id };
      executions.set(scopedKey(row.tenantId, id), full);
      return full;
    },

    async updateExecution(tenantId, executionId, patch) {
      const key = scopedKey(tenantId, executionId);
      const row = executions.get(key);
      if (!row || row.tenantId !== tenantId) {
        throw new Error('voice-store: execution not found for tenant');
      }
      const next: VoiceExecutionRow = { ...row, ...patch };
      if (
        next.verificationStatus === 'confirmed' &&
        !(next.status === 'succeeded' && next.externalRef && next.verifiedAt)
      ) {
        throw new Error('voice-store: confirmed requires succeeded + external_ref + verified_at');
      }
      executions.set(key, next);
      return next;
    },

    async appendEvidence(input) {
      const key = evidenceKey(input.tenantId, input.sessionId);
      const list = evidenceByTenantSession.get(key) ?? [];
      const prevHash = list.length === 0 ? VOICE_GENESIS_HASH : list[list.length - 1]!.hash;
      const record = appendEvidenceLink({
        tenantId: input.tenantId,
        sessionId: input.sessionId,
        seq: list.length + 1,
        kind: input.kind,
        toolRequestId: input.toolRequestId,
        payload: input.payload,
        prevHash,
      });
      if (record.tenantId !== input.tenantId) {
        throw new Error('voice-store: tenant mismatch on evidence');
      }
      list.push(record);
      evidenceByTenantSession.set(key, list);
      return record;
    },

    async listEvidence(tenantId, sessionId) {
      return [...(evidenceByTenantSession.get(evidenceKey(tenantId, sessionId)) ?? [])];
    },

    async insertAppointment(row) {
      if (!row.tenantId || !row.botId || !row.customerName?.trim()) {
        throw new Error('voice-store: appointment requires tenantId, botId, customerName');
      }
      const id = randomUUID();
      appointments.set(scopedKey(row.tenantId, id), {
        ...row,
        id,
        status: 'requested',
      });
      return { id };
    },

    async getAppointment(tenantId, appointmentId) {
      const row = appointments.get(scopedKey(tenantId, appointmentId));
      if (!row || row.tenantId !== tenantId) return null;
      return {
        id: row.id,
        tenantId: row.tenantId,
        botId: row.botId,
        customerName: row.customerName,
        status: row.status,
      };
    },
  };
}
