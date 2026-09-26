// Pure, side-effect-free logic for ai-act-auto-classify — vitest-importable.
// No Deno / jsr imports. Identity and tenant membership are NOT decided here:
// that is the canonical resolver `requireAuthAndTenant` (_shared/auth.ts).
// This module only contains the cheap pre-filter in front of it, the body
// validation, the ownership check of the ai_system row and the scoring.

/**
 * Roles allowed to trigger the classification. The function WRITES
 * (ai_act_assessments, ai_systems.latest_assessment_id) with service_role,
 * so it follows the governance write convention (governance-resources,
 * integration-credentials, microsoft365-connect): owner / admin only.
 */
export const WRITE_ROLES: readonly string[] = ['owner', 'admin'];

export interface Rejection {
  status: number;
  code: string;
  message: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

export function isRejection(v: unknown): v is Rejection {
  return typeof v === 'object' && v !== null && 'status' in v && 'code' in v;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const parsed: unknown = JSON.parse(atob(padded));
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Reject-only pre-filter, evaluated BEFORE any database access.
 *
 * It never grants access: a `null` result only means "looks like a user
 * session, let the canonical resolver verify it" (auth.getUser() inside
 * requireAuthAndTenant). The payload is read unverified, which is fine for a
 * reject decision. It turns away:
 *   - missing / non-Bearer Authorization headers
 *   - the public anon key (role=anon) and the service_role key: both are valid
 *     project JWTs and pass the platform gate (verify_jwt = true), but neither
 *     is a user
 *   - opaque API keys (sb_publishable_… / sb_secret_…) and non-JWT garbage
 *   - JWTs without a subject
 */
export function rejectNonUserBearer(authHeader: string | null | undefined): Rejection | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { status: 401, code: 'UNAUTHORIZED', message: 'missing or invalid Authorization header' };
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return { status: 401, code: 'UNAUTHORIZED', message: 'missing bearer token' };
  }
  if (token.startsWith('sb_publishable_') || token.startsWith('sb_secret_')) {
    return { status: 401, code: 'UNAUTHORIZED', message: 'user session required' };
  }
  const payload = decodeJwtPayload(token);
  if (!payload) {
    return { status: 401, code: 'UNAUTHORIZED', message: 'invalid token' };
  }
  const role = payload.role;
  if (role === 'anon' || role === 'service_role') {
    return { status: 401, code: 'UNAUTHORIZED', message: 'user session required' };
  }
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    return { status: 401, code: 'UNAUTHORIZED', message: 'user session required' };
  }
  return null;
}

export interface ClassifyRequest {
  aiSystemId: string;
  /** Unverified claim — only ever passed to requireAuthAndTenant. */
  tenantIdClaim: string;
}

export function parseClassifyBody(body: unknown): ClassifyRequest | Rejection {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { status: 400, code: 'BAD_REQUEST', message: 'JSON object body required' };
  }
  const b = body as Record<string, unknown>;
  if (!isUuid(b.tenant_id)) {
    return { status: 400, code: 'BAD_REQUEST', message: 'tenant_id (uuid) required' };
  }
  if (!isUuid(b.ai_system_id)) {
    return { status: 400, code: 'BAD_REQUEST', message: 'ai_system_id (uuid) required' };
  }
  return { aiSystemId: b.ai_system_id, tenantIdClaim: b.tenant_id };
}

export interface AiSystemRow {
  id: string;
  tenant_id: string;
  purpose?: string | null;
  data_types?: unknown;
}

/**
 * The ai_system must exist AND belong to the verified tenant. A foreign
 * system answers exactly like a missing one (404), so the endpoint is no
 * existence oracle for other tenants' ids.
 */
export function checkSystemOwnership(
  row: AiSystemRow | null | undefined,
  aiSystemId: string,
  verifiedTenantId: string,
): Rejection | null {
  if (!row || row.id !== aiSystemId || row.tenant_id !== verifiedTenantId) {
    return { status: 404, code: 'NOT_FOUND', message: 'AI system not found' };
  }
  return null;
}

export interface Indicators {
  personal_data: boolean;
  large_scale_processing: boolean;
  special_category_data: boolean;
  minors_data: boolean;
  employment_context: boolean;
  education_training: boolean;
  law_enforcement: boolean;
  critical_infrastructure: boolean;
}

export type Classification = 'minimal_risk' | 'limited_risk' | 'high_risk';
export type Recommendation = 'allowed' | 'requires_approval';

export interface ClassificationResult {
  indicators: Indicators;
  riskScore: number;
  classification: Classification;
  recommendation: Recommendation;
}

/**
 * Heuristic scoring — unchanged from the previous inline implementation,
 * except that the score is clamped to 100 (ai_act_assessments has
 * CHECK overall_risk_score BETWEEN 0 AND 100; the raw sum can reach 175).
 */
export function classifySystem(sys: Pick<AiSystemRow, 'purpose' | 'data_types'>): ClassificationResult {
  const dataTypes = Array.isArray(sys.data_types)
    ? sys.data_types.filter((v): v is string => typeof v === 'string')
    : [];
  const purpose = typeof sys.purpose === 'string' ? sys.purpose.toLowerCase() : '';

  const indicators: Indicators = {
    personal_data: dataTypes.includes('personal_data'),
    large_scale_processing: dataTypes.length > 3,
    special_category_data: dataTypes.includes('special_category'),
    minors_data: dataTypes.includes('minors'),
    employment_context: purpose.includes('employment'),
    education_training: purpose.includes('education'),
    law_enforcement: purpose.includes('law enforcement'),
    critical_infrastructure: purpose.includes('critical'),
  };

  let raw = 0;
  if (indicators.personal_data) raw += 15;
  if (indicators.large_scale_processing) raw += 20;
  if (indicators.special_category_data) raw += 25;
  if (indicators.minors_data) raw += 30;
  if (indicators.employment_context) raw += 15;
  if (indicators.education_training) raw += 10;
  if (indicators.law_enforcement) raw += 35;
  if (indicators.critical_infrastructure) raw += 25;
  const riskScore = Math.min(100, raw);

  let classification: Classification = 'minimal_risk';
  let recommendation: Recommendation = 'allowed';
  if (riskScore >= 50) {
    classification = 'high_risk';
    recommendation = 'requires_approval';
  } else if (riskScore >= 25) {
    classification = 'limited_risk';
  }

  return { indicators, riskScore, classification, recommendation };
}
