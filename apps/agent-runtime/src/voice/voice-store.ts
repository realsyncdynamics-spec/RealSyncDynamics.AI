/**
 * Persistenz-Port für Voice Tool Gateway (PR 4).
 *
 * apps/agent-runtime hatte bisher keinen DB-Zugriff. Der Port hält
 * Service-Role-Schreiben tenant-gescoped; Tests nutzen MemoryVoiceStore.
 * Optional: SupabaseVoiceStore (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
 */

import { randomUUID } from 'node:crypto';

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

export interface VoiceStore {
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
}

/** In-Memory-Store für Unit-Tests und Betrieb ohne DB-Credentials. */
export function createMemoryVoiceStore(): VoiceStore {
  const requests = new Map<string, VoiceToolRequestRow>();
  const executions = new Map<string, VoiceExecutionRow>();
  const evidenceBySession = new Map<string, VoiceEvidenceRecord[]>();
  const appointments = new Map<string, AppointmentInsert & { id: string }>();

  const scopedKey = (tenantId: string, id: string) => `${tenantId}:${id}`;

  return {
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
      const list = evidenceBySession.get(input.sessionId) ?? [];
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
      evidenceBySession.set(input.sessionId, list);
      return record;
    },

    async listEvidence(tenantId, sessionId) {
      return (evidenceBySession.get(sessionId) ?? []).filter((e) => e.tenantId === tenantId);
    },

    async insertAppointment(row) {
      if (!row.tenantId || !row.botId || !row.customerName?.trim()) {
        throw new Error('voice-store: appointment requires tenantId, botId, customerName');
      }
      const id = randomUUID();
      appointments.set(scopedKey(row.tenantId, id), { ...row, id });
      return { id };
    },
  };
}
