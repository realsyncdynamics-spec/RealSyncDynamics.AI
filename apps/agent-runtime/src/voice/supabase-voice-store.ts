/**
 * Supabase VoiceStore (PR 4) — schreibt in voice_tool_requests, voice_executions,
 * voice_evidence und bot_appointments (Migration 20260928130000 + bots_foundation).
 *
 * Credentials nur aus Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — nie loggen.
 * Jede Query filtert nach tenant_id. Evidence-Hash/prev_hash clientseitig,
 * damit die Hex-CHECK-Constraints der DB akzeptiert werden.
 */

import {
  VOICE_GENESIS_HASH,
  appendEvidenceLink,
  type VoiceEvidenceRecord,
} from './evidence-hash.js';
import type {
  AppointmentInsert,
  AppointmentRow,
  VoiceExecutionRow,
  VoiceStore,
  VoiceToolRequestRow,
} from './voice-store.js';
import type { VoiceToolName } from '../voice-types.js';

/** Minimaler PostgREST-Client — in Tests gemockt, keine Netzwerk-Calls. */
export interface VoiceDbClient {
  insert(
    table: string,
    row: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  update(
    table: string,
    patch: Record<string, unknown>,
    filters: Record<string, string>,
  ): Promise<Record<string, unknown>>;
  selectOne(
    table: string,
    columns: string,
    filters: Record<string, string>,
  ): Promise<Record<string, unknown> | null>;
  selectMany(
    table: string,
    columns: string,
    filters: Record<string, string>,
    order?: { column: string; ascending: boolean; limit?: number },
  ): Promise<Record<string, unknown>[]>;
}

export interface SupabaseVoiceStoreOptions {
  client: VoiceDbClient;
}

export function createSupabaseVoiceStore(options: SupabaseVoiceStoreOptions): VoiceStore {
  const db = options.client;

  return {
    async insertToolRequest(row) {
      const inserted = await db.insert('voice_tool_requests', {
        ...(row.id ? { id: row.id } : {}),
        tenant_id: row.tenantId,
        session_id: row.sessionId,
        provider_call_id: row.providerCallId,
        tool: row.tool,
        argument_keys: row.argumentKeys,
        args: row.args,
        verdict: row.verdict,
        reason: row.reason,
        risk: row.risk,
        policy_ref: row.policyRef,
        trace: row.trace,
        decided_by: 'policy-engine',
        decided_at: row.decidedAt,
        confirmed_by: row.confirmedBy,
        confirmed_at: row.confirmedAt,
      });
      return mapToolRequest(inserted);
    },

    async confirmToolRequest(tenantId, toolRequestId, confirmedBy) {
      const existing = await db.selectOne('voice_tool_requests', '*', {
        id: toolRequestId,
        tenant_id: tenantId,
      });
      if (!existing) return null;
      const mapped = mapToolRequest(existing);
      if (mapped.verdict !== 'REQUIRE_CONFIRMATION') return null;
      if (mapped.confirmedAt) return mapped;
      const updated = await db.update(
        'voice_tool_requests',
        {
          confirmed_by: confirmedBy,
          confirmed_at: new Date().toISOString(),
        },
        { id: toolRequestId, tenant_id: tenantId },
      );
      return mapToolRequest(updated);
    },

    async getToolRequest(tenantId, toolRequestId) {
      const row = await db.selectOne('voice_tool_requests', '*', {
        id: toolRequestId,
        tenant_id: tenantId,
      });
      return row ? mapToolRequest(row) : null;
    },

    async insertExecution(row) {
      const inserted = await db.insert('voice_executions', {
        ...(row.id ? { id: row.id } : {}),
        tenant_id: row.tenantId,
        tool_request_id: row.toolRequestId,
        status: row.status,
        external_ref: row.externalRef,
        error_code: row.errorCode,
        verification_status: row.verificationStatus,
        verified_at: row.verifiedAt,
        started_at: row.startedAt,
        finished_at: row.finishedAt,
      });
      return mapExecution(inserted);
    },

    async updateExecution(tenantId, executionId, patch) {
      const body: Record<string, unknown> = {};
      if (patch.status !== undefined) body.status = patch.status;
      if (patch.externalRef !== undefined) body.external_ref = patch.externalRef;
      if (patch.errorCode !== undefined) body.error_code = patch.errorCode;
      if (patch.verificationStatus !== undefined) body.verification_status = patch.verificationStatus;
      if (patch.verifiedAt !== undefined) body.verified_at = patch.verifiedAt;
      if (patch.finishedAt !== undefined) body.finished_at = patch.finishedAt;
      const updated = await db.update('voice_executions', body, {
        id: executionId,
        tenant_id: tenantId,
      });
      return mapExecution(updated);
    },

    async appendEvidence(input) {
      const latest = await db.selectMany(
        'voice_evidence',
        'seq,hash',
        { tenant_id: input.tenantId, session_id: input.sessionId },
        { column: 'seq', ascending: false, limit: 1 },
      );
      const prev = latest[0];
      const prevHash =
        typeof prev?.hash === 'string' && /^[0-9a-f]{64}$/.test(prev.hash)
          ? prev.hash
          : VOICE_GENESIS_HASH;
      const seq = typeof prev?.seq === 'number' ? prev.seq + 1 : 1;
      const record = appendEvidenceLink({
        tenantId: input.tenantId,
        sessionId: input.sessionId,
        seq,
        kind: input.kind,
        toolRequestId: input.toolRequestId,
        payload: input.payload,
        prevHash,
      });
      if (record.tenantId !== input.tenantId) {
        throw new Error('supabase-voice-store: tenant mismatch on evidence');
      }
      const inserted = await db.insert('voice_evidence', {
        id: record.id,
        tenant_id: record.tenantId,
        session_id: record.sessionId,
        seq: record.seq,
        kind: record.kind,
        tool_request_id: record.toolRequestId,
        payload: record.payload,
        prev_hash: record.prevHash,
        hash: record.hash,
        created_at: record.createdAt,
      });
      return mapEvidence(inserted, record);
    },

    async listEvidence(tenantId, sessionId) {
      const rows = await db.selectMany(
        'voice_evidence',
        '*',
        { tenant_id: tenantId, session_id: sessionId },
        { column: 'seq', ascending: true },
      );
      return rows.map((r) => mapEvidence(r));
    },

    async insertAppointment(row: AppointmentInsert) {
      if (!row.tenantId || !row.botId || !row.customerName?.trim()) {
        throw new Error('supabase-voice-store: appointment requires tenantId, botId, customerName');
      }
      const inserted = await db.insert('bot_appointments', {
        tenant_id: row.tenantId,
        bot_id: row.botId,
        customer_name: row.customerName.trim(),
        contact: row.contact ?? null,
        service: row.service ?? null,
        requested_at: row.requestedAt ?? null,
        notes: row.notes ?? null,
        metadata: row.metadata ?? {},
        status: 'requested',
      });
      const id = String(inserted.id ?? '');
      if (!id) throw new Error('supabase-voice-store: appointment insert returned no id');
      return { id };
    },

    async getAppointment(tenantId, appointmentId) {
      const row = await db.selectOne('bot_appointments', 'id,tenant_id,bot_id,customer_name,status', {
        id: appointmentId,
        tenant_id: tenantId,
      });
      if (!row) return null;
      return {
        id: String(row.id),
        tenantId: String(row.tenant_id),
        botId: String(row.bot_id),
        customerName: String(row.customer_name),
        status: String(row.status ?? 'requested'),
      } satisfies AppointmentRow;
    },
  };
}

export interface CreateSupabaseVoiceStoreFromEnvOptions {
  env?: NodeJS.Dict<string | undefined>;
  fetchImpl?: typeof fetch;
}

/**
 * Baut den Store aus SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * Fehlen die Env-Vars → null (Caller fail-closed, kein Memory-Fallback).
 */
export function createSupabaseVoiceStoreFromEnv(
  options: CreateSupabaseVoiceStoreFromEnvOptions = {},
): VoiceStore | null {
  const env = options.env ?? process.env;
  const url = typeof env.SUPABASE_URL === 'string' ? env.SUPABASE_URL.trim() : '';
  const key =
    typeof env.SUPABASE_SERVICE_ROLE_KEY === 'string'
      ? env.SUPABASE_SERVICE_ROLE_KEY.trim()
      : '';
  if (!url || !key) return null;
  const client = createPostgrestVoiceDbClient({
    baseUrl: url.replace(/\/$/, ''),
    serviceRoleKey: key,
    fetchImpl: options.fetchImpl ?? fetch,
  });
  return createSupabaseVoiceStore({ client });
}

export interface PostgrestClientOptions {
  baseUrl: string;
  serviceRoleKey: string;
  fetchImpl?: typeof fetch;
}

/** PostgREST über fetch — Service-Role nur im Authorization-Header, nie geloggt. */
export function createPostgrestVoiceDbClient(options: PostgrestClientOptions): VoiceDbClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const restBase = `${options.baseUrl.replace(/\/$/, '')}/rest/v1`;

  async function request(
    table: string,
    init: {
      method: string;
      prefer?: string;
      query?: string;
      body?: Record<string, unknown>;
    },
  ): Promise<unknown> {
    const headers: Record<string, string> = {
      apikey: options.serviceRoleKey,
      Authorization: `Bearer ${options.serviceRoleKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (init.prefer) headers.Prefer = init.prefer;
    const url = `${restBase}/${table}${init.query ? `?${init.query}` : ''}`;
    const res = await fetchImpl(url, {
      method: init.method,
      headers,
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
    if (!res.ok) {
      // Keine Secrets/Bodies in die Exception — nur Status.
      throw new Error(`supabase-voice-store: ${table} http_${res.status}`);
    }
    if (res.status === 204) return null;
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text) as unknown;
  }

  function filterQuery(filters: Record<string, string>): string {
    return Object.entries(filters)
      .map(([k, v]) => `${encodeURIComponent(k)}=eq.${encodeURIComponent(v)}`)
      .join('&');
  }

  return {
    async insert(table, row) {
      const data = await request(table, {
        method: 'POST',
        prefer: 'return=representation',
        body: row,
      });
      const rowOut = Array.isArray(data) ? data[0] : data;
      if (!rowOut || typeof rowOut !== 'object') {
        throw new Error(`supabase-voice-store: ${table} insert returned empty`);
      }
      return rowOut as Record<string, unknown>;
    },

    async update(table, patch, filters) {
      const data = await request(table, {
        method: 'PATCH',
        prefer: 'return=representation',
        query: filterQuery(filters),
        body: patch,
      });
      const rowOut = Array.isArray(data) ? data[0] : data;
      if (!rowOut || typeof rowOut !== 'object') {
        throw new Error(`supabase-voice-store: ${table} update returned empty`);
      }
      return rowOut as Record<string, unknown>;
    },

    async selectOne(table, columns, filters) {
      const data = await request(table, {
        method: 'GET',
        query: `select=${encodeURIComponent(columns)}&${filterQuery(filters)}&limit=1`,
      });
      if (!Array.isArray(data) || data.length === 0) return null;
      const row = data[0];
      return row && typeof row === 'object' ? (row as Record<string, unknown>) : null;
    },

    async selectMany(table, columns, filters, order) {
      const parts = [
        `select=${encodeURIComponent(columns)}`,
        filterQuery(filters),
      ];
      if (order) {
        parts.push(`order=${encodeURIComponent(order.column)}.${order.ascending ? 'asc' : 'desc'}`);
        if (order.limit) parts.push(`limit=${order.limit}`);
      }
      const data = await request(table, {
        method: 'GET',
        query: parts.join('&'),
      });
      if (!Array.isArray(data)) return [];
      return data.filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null);
    },
  };
}

function mapToolRequest(row: Record<string, unknown>): VoiceToolRequestRow {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    sessionId: String(row.session_id),
    providerCallId: String(row.provider_call_id ?? ''),
    tool: row.tool as VoiceToolName,
    argumentKeys: Array.isArray(row.argument_keys) ? (row.argument_keys as string[]) : [],
    args:
      typeof row.args === 'object' && row.args !== null && !Array.isArray(row.args)
        ? (row.args as Record<string, unknown>)
        : {},
    verdict: row.verdict as VoiceToolRequestRow['verdict'],
    reason: String(row.reason ?? ''),
    risk: row.risk as VoiceToolRequestRow['risk'],
    policyRef: String(row.policy_ref ?? ''),
    trace: Array.isArray(row.trace) ? (row.trace as VoiceToolRequestRow['trace']) : [],
    decidedBy: 'policy-engine',
    decidedAt: String(row.decided_at ?? ''),
    confirmedBy: (row.confirmed_by as VoiceToolRequestRow['confirmedBy']) ?? null,
    confirmedAt: row.confirmed_at ? String(row.confirmed_at) : null,
  };
}

function mapExecution(row: Record<string, unknown>): VoiceExecutionRow {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    toolRequestId: String(row.tool_request_id),
    status: row.status as VoiceExecutionRow['status'],
    externalRef: row.external_ref == null ? null : String(row.external_ref),
    errorCode: row.error_code == null ? null : String(row.error_code),
    verificationStatus: row.verification_status as VoiceExecutionRow['verificationStatus'],
    verifiedAt: row.verified_at ? String(row.verified_at) : null,
    startedAt: String(row.started_at ?? ''),
    finishedAt: row.finished_at ? String(row.finished_at) : null,
  };
}

function mapEvidence(
  row: Record<string, unknown>,
  fallback?: VoiceEvidenceRecord,
): VoiceEvidenceRecord {
  return {
    id: String(row.id ?? fallback?.id ?? ''),
    tenantId: String(row.tenant_id ?? fallback?.tenantId ?? ''),
    sessionId: String(row.session_id ?? fallback?.sessionId ?? ''),
    seq: Number(row.seq ?? fallback?.seq ?? 0),
    kind: (row.kind ?? fallback?.kind) as VoiceEvidenceRecord['kind'],
    toolRequestId:
      row.tool_request_id == null
        ? (fallback?.toolRequestId ?? null)
        : String(row.tool_request_id),
    payload:
      typeof row.payload === 'object' && row.payload !== null && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : (fallback?.payload ?? {}),
    prevHash: String(row.prev_hash ?? fallback?.prevHash ?? ''),
    hash: String(row.hash ?? fallback?.hash ?? ''),
    createdAt: String(row.created_at ?? fallback?.createdAt ?? ''),
  };
}
