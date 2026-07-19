// Findings adapter — thin read/write surface for the Finding domain entity.
//
// Backed by migration 20260610000000_findings_domain_entity.sql:
//   - public.findings table (RLS deny-by-default + tenant-member-read
//     + service-role-mutate)
//
// This adapter is pure-logic where possible; the Supabase admin client
// is passed as a structural parameter (AdminLike) so vitest can mock
// it without pulling in Deno-only specifiers.
//
// Scope of this PR (PR 1 of the MVP-domain sequence):
//   - recordFinding   (insert)
//   - listFindings    (read; tenant-scoped, optional filters)
//   - updateFindingStatus (single-row status transition)
//
// Out of scope here:
//   - Scanner orchestration (PR 2 — ScanRun → Finding pipeline)
//   - Evidence-ref resolver (PR 3)
//   - PDF report mapping (PR 4)
//   - UI surfaces (PR 5)
//   - Automatic runtime_events emission on insert — callers may
//     stamp a correlation_id and emit their own runtime_event so
//     spec_version + event_tier stay caller-controlled. A helper
//     `emitCorrelatedRuntimeEvent` lives in a future PR.

interface QueryBuilderChain {
  eq?: (col: string, val: unknown) => QueryBuilderChain;
  order?: (col: string, opts: { ascending: boolean }) => QueryBuilderChain;
  limit?: (n: number) => Promise<{ data: unknown; error: { message: string } | null }>;
  then<T>(onfulfilled?: (val: { data: unknown; error: { message: string } | null }) => T): Promise<T>;
}

export interface AdminLike {
  from(table: string): {
    insert(row: Record<string, unknown>): Promise<{
      data:  unknown;
      error: { message: string } | null;
    }>;
    select(cols: string): {
      eq(col: string, val: unknown): QueryBuilderChain;
    };
    update(patch: Record<string, unknown>): {
      eq(col: string, val: unknown): Promise<{ error: { message: string } | null }>;
    };
  };
}

// ─────────────────────────────────────────────────────────────────────
// Types — mirror src/types/governance/finding.ts. Duplicated minimally
// because Edge Functions run under Deno and cannot import from src/.
// The fields below MUST stay in sync with the TS module.
// ─────────────────────────────────────────────────────────────────────

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type FindingStatus   =
  | 'open' | 'acknowledged' | 'fixed' | 'false_positive' | 'ignored' | 'resolved';
export type FindingCategory =
  | 'consent' | 'tracker' | 'ai_act' | 'tom' | 'dpa'
  | 'accessibility' | 'security' | 'transparency' | 'data_quality'
  | 'documentation' | 'other';
export type FindingEvidenceLevel =
  | 'observed' | 'inferred' | 'reported' | 'unverifiable';
export type FindingVerificationStatus =
  | 'verified' | 'partial' | 'unverified' | 'disputed';

export interface NewFinding {
  tenant_id:       string;
  website_id?:     string | null;
  scan_run_id?:    string | null;
  category:        FindingCategory;
  severity:        FindingSeverity;
  status?:         FindingStatus;
  detector:        string;
  evidence_ref?:   string | null;
  summary:         string;
  raw_payload?:    Record<string, unknown> | null;
  confidence_score?:    number;
  evidence_level?:      FindingEvidenceLevel;
  verification_status?: FindingVerificationStatus;
  correlation_id?: string | null;
}

export interface FindingRow {
  id:              string;
  tenant_id:       string;
  website_id:      string | null;
  scan_run_id:     string | null;
  category:        FindingCategory;
  severity:        FindingSeverity;
  status:          FindingStatus;
  detector:        string;
  evidence_ref:    string | null;
  summary:         string;
  raw_payload:     Record<string, unknown> | null;
  confidence_score:    number;
  evidence_level:      FindingEvidenceLevel;
  verification_status: FindingVerificationStatus;
  correlation_id:  string | null;
  created_at:      string;
  updated_at:      string;
}

// ─────────────────────────────────────────────────────────────────────
// recordFinding
// ─────────────────────────────────────────────────────────────────────

const VALID_CATEGORIES: ReadonlySet<FindingCategory> = new Set([
  'consent', 'tracker', 'ai_act', 'tom', 'dpa',
  'accessibility', 'security', 'transparency', 'data_quality',
  'documentation', 'other',
]);
const VALID_SEVERITIES: ReadonlySet<FindingSeverity> = new Set([
  'critical', 'high', 'medium', 'low', 'info',
]);
const VALID_STATUSES: ReadonlySet<FindingStatus> = new Set([
  'open', 'acknowledged', 'fixed', 'false_positive', 'ignored', 'resolved',
]);
const VALID_EVIDENCE_LEVELS: ReadonlySet<FindingEvidenceLevel> = new Set([
  'observed', 'inferred', 'reported', 'unverifiable',
]);
const VALID_VERIFICATION_STATUSES: ReadonlySet<FindingVerificationStatus> = new Set([
  'verified', 'partial', 'unverified', 'disputed',
]);

export async function recordFinding(
  admin: AdminLike,
  f:     NewFinding,
): Promise<{ ok: boolean; error?: string }> {
  // Defensive validation — the DB CHECK would reject these too, but
  // surfacing the error in code gives a clearer test failure path and
  // saves an RTT to Postgres for obviously-malformed input.
  if (!f.tenant_id)               return { ok: false, error: 'tenant_id required' };
  if (!VALID_CATEGORIES.has(f.category)) return { ok: false, error: `invalid category: ${f.category}` };
  if (!VALID_SEVERITIES.has(f.severity)) return { ok: false, error: `invalid severity: ${f.severity}` };
  if (f.status && !VALID_STATUSES.has(f.status)) return { ok: false, error: `invalid status: ${f.status}` };
  if (!f.detector)                return { ok: false, error: 'detector required' };
  if (!f.summary)                 return { ok: false, error: 'summary required' };
  if (f.summary.length > 1000)    return { ok: false, error: 'summary too long (>1000 chars)' };
  if (f.evidence_level && !VALID_EVIDENCE_LEVELS.has(f.evidence_level)) {
    return { ok: false, error: `invalid evidence_level: ${f.evidence_level}` };
  }
  if (f.verification_status && !VALID_VERIFICATION_STATUSES.has(f.verification_status)) {
    return { ok: false, error: `invalid verification_status: ${f.verification_status}` };
  }
  if (typeof f.confidence_score === 'number') {
    if (!Number.isFinite(f.confidence_score) || f.confidence_score < 0 || f.confidence_score > 1) {
      return { ok: false, error: `confidence_score must be 0..1, got ${f.confidence_score}` };
    }
  }

  const row = {
    tenant_id:      f.tenant_id,
    website_id:     f.website_id     ?? null,
    scan_run_id:    f.scan_run_id    ?? null,
    category:       f.category,
    severity:       f.severity,
    status:         f.status         ?? 'open',
    detector:       f.detector,
    evidence_ref:   f.evidence_ref   ?? null,
    summary:        f.summary,
    raw_payload:    f.raw_payload    ?? null,
    // Leave undefined when not supplied — DB DEFAULT fires
    // (confidence_score=1.0, evidence_level='observed',
    // verification_status='unverified'). Explicit values override.
    confidence_score:    f.confidence_score    ?? undefined,
    evidence_level:      f.evidence_level      ?? undefined,
    verification_status: f.verification_status ?? undefined,
    correlation_id: f.correlation_id ?? null,
  };

  const { error } = await admin.from('findings').insert(row);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────
// listFindings — tenant-scoped, filterable. Caller MUST already have
// authenticated + verified tenant membership; the RLS policy on the
// table is a backstop, not the primary auth gate.
// ─────────────────────────────────────────────────────────────────────

export interface ListFindingsFilter {
  tenant_id:  string;
  status?:    FindingStatus;
  severity?:  FindingSeverity;
  category?:  FindingCategory;
  website_id?: string;
  limit?:     number;            // max 200; default 50
}

export async function listFindings(
  admin: AdminLike,
  f:     ListFindingsFilter,
): Promise<{ ok: true; rows: FindingRow[] } | { ok: false; error: string }> {
  if (!f.tenant_id) return { ok: false, error: 'tenant_id required' };
  const limit = Math.min(Math.max(f.limit ?? 50, 1), 200);

  // Adapter intentionally avoids the supabase-js builder shape that
  // unit-tests would need to mock; the mock in tests/edge/findings.test.ts
  // returns the rows directly. Real usage chains .eq()/.order()/.limit().
  // The structural AdminLike type permits both shapes.
  let q: QueryBuilderChain = admin.from('findings').select('*').eq('tenant_id', f.tenant_id);
  if (f.status)     q = q.eq?.('status',     f.status)     ?? q;
  if (f.severity)   q = q.eq?.('severity',   f.severity)   ?? q;
  if (f.category)   q = q.eq?.('category',   f.category)   ?? q;
  if (f.website_id) q = q.eq?.('website_id', f.website_id) ?? q;
  if (q.order)  q = q.order('created_at', { ascending: false });
  if (q.limit)  q = q.limit(limit);

  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data as FindingRow[]) ?? [] };
}

// ─────────────────────────────────────────────────────────────────────
// updateFindingStatus — single-row status transition. Caller validates
// against FINDING_NEXT_STATUS (TS-side constant in
// src/types/governance/finding.ts); this adapter just persists.
// ─────────────────────────────────────────────────────────────────────

export async function updateFindingStatus(
  admin:  AdminLike,
  findingId: string,
  next:   FindingStatus,
): Promise<{ ok: boolean; error?: string }> {
  if (!findingId)               return { ok: false, error: 'findingId required' };
  if (!VALID_STATUSES.has(next)) return { ok: false, error: `invalid status: ${next}` };

  const { error } = await admin
    .from('findings')
    .update({ status: next })
    .eq('id', findingId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
