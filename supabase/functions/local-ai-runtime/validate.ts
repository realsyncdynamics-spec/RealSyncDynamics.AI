// Reine Validierung für local-ai-runtime — ohne Deno-Imports, damit vitest
// sie direkt testen kann (test/edge/local-ai-runtime.test.ts).
//
// Grundsatz: fail-closed. Unbekannte Felder werden verworfen, `enabled` ist
// serverseitig nur wahr, wenn der gemeldete Governance-Test bestanden ist.
// Eine Runtime-URL wird bewusst nicht angenommen (LAN-Topologie bleibt lokal).

export const LOCAL_AI_ROLES = ['governance', 'coding', 'vision', 'persistent'] as const;
export type LocalAiRole = (typeof LOCAL_AI_ROLES)[number];

const TEST_OUTCOMES = ['success', 'warning', 'failed'] as const;
type TestOutcome = (typeof TEST_OUTCOMES)[number];

const CHECK_IDS = ['json_valid', 'no_fabricated_source', 'risk_present', 'recommendation_present'] as const;

// Ollama-Modellnamen: name[:tag], optional mit Namespace (user/model:tag).
const MODEL_PATTERN = /^[a-z0-9][a-z0-9._\-/]{0,95}(?::[a-z0-9._\-]{1,31})?$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RegisterProfileInput {
  tenantHint: string | null;
  profileName: string;
  role: LocalAiRole;
  model: string;
  testOverall: TestOutcome | null;
  testRanAt: string | null;
  checks: Array<{ id: (typeof CHECK_IDS)[number]; status: TestOutcome }>;
  enabled: boolean;
}

export type ValidationResult =
  | { ok: true; value: RegisterProfileInput }
  | { ok: false; code: 'BAD_REQUEST'; message: string };

function bad(message: string): ValidationResult {
  return { ok: false, code: 'BAD_REQUEST', message };
}

export function validateRegisterBody(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return bad('body must be an object');
  const b = raw as Record<string, unknown>;
  if (b.action !== 'register_profile') return bad('unknown action');

  let tenantHint: string | null = null;
  if (b.tenant_hint !== undefined && b.tenant_hint !== null) {
    if (typeof b.tenant_hint !== 'string' || !UUID_PATTERN.test(b.tenant_hint)) return bad('tenant_hint must be a uuid');
    tenantHint = b.tenant_hint;
  }

  const profileName = typeof b.profile_name === 'string' ? b.profile_name.trim() : '';
  if (!profileName || profileName.length > 80) return bad('profile_name must be 1–80 characters');

  if (typeof b.role !== 'string' || !(LOCAL_AI_ROLES as readonly string[]).includes(b.role)) return bad('invalid role');
  const role = b.role as LocalAiRole;

  if (typeof b.model !== 'string' || !MODEL_PATTERN.test(b.model)) return bad('invalid model name');

  let testOverall: TestOutcome | null = null;
  let testRanAt: string | null = null;
  const checks: RegisterProfileInput['checks'] = [];
  if (b.test_result !== undefined && b.test_result !== null) {
    const t = b.test_result as Record<string, unknown>;
    if (typeof t !== 'object' || Array.isArray(t)) return bad('test_result must be an object');
    if (!(TEST_OUTCOMES as readonly string[]).includes(t.overall as string)) return bad('invalid test_result.overall');
    if (t.model !== b.model) return bad('test_result.model must match model');
    if (typeof t.ranAt !== 'string' || Number.isNaN(Date.parse(t.ranAt))) return bad('invalid test_result.ranAt');
    testOverall = t.overall as TestOutcome;
    testRanAt = new Date(t.ranAt).toISOString();
    if (Array.isArray(t.checks)) {
      for (const c of t.checks) {
        const cc = c as Record<string, unknown>;
        if (
          cc && typeof cc === 'object' &&
          (CHECK_IDS as readonly string[]).includes(cc.id as string) &&
          (TEST_OUTCOMES as readonly string[]).includes(cc.status as string)
        ) {
          checks.push({ id: cc.id as RegisterProfileInput['checks'][number]['id'], status: cc.status as TestOutcome });
        }
      }
    }
  }

  // Fail-closed: ohne bestandenen Test kein aktiviertes Profil — egal, was der Client meldet.
  const enabled = b.enabled === true && testOverall === 'success';

  return { ok: true, value: { tenantHint, profileName, role, model: b.model, testOverall, testRanAt, checks, enabled } };
}

export type TenantResolution =
  | { ok: true; tenantId: string }
  | { ok: false; status: 400 | 403; code: 'NO_TENANT' | 'MULTIPLE_TENANTS' | 'FORBIDDEN'; message: string };

/**
 * Mandant ausschließlich aus den Mitgliedschaften des verifizierten Nutzers.
 * Ein `tenant_hint` wählt nur unter diesen aus — er begründet nie Zugriff.
 */
export function resolveTenant(memberTenantIds: readonly string[], hint: string | null): TenantResolution {
  if (memberTenantIds.length === 0) return { ok: false, status: 400, code: 'NO_TENANT', message: 'no tenant membership' };
  if (hint) {
    return memberTenantIds.includes(hint)
      ? { ok: true, tenantId: hint }
      : { ok: false, status: 403, code: 'FORBIDDEN', message: 'not a member of this tenant' };
  }
  if (memberTenantIds.length > 1) {
    return { ok: false, status: 400, code: 'MULTIPLE_TENANTS', message: 'multiple tenants — tenant_hint required' };
  }
  return { ok: true, tenantId: memberTenantIds[0] };
}
