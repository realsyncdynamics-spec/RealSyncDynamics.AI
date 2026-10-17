// Governed Browser Runtime — Policy-Evaluation (rein, deterministisch, getestet).
//
// evaluateBrowserAction() ist die einzige Stelle, die über ALLOW / DENY /
// REQUIRE_APPROVAL einer Browser-Aktion entscheidet. Weder Browser noch
// Planner-Modell noch Executor können das Ergebnis überschreiben: der Handler
// führt nur aus, was hier ALLOW ergibt (oder REQUIRE_APPROVAL mit gültiger,
// atomar verbrauchter Freigabe).
//
// Zwei Ebenen:
//   1. Plattform-Basisregeln `rsd.browser.baseline` (versioniert, im Code)
//   2. Mandanten-Policies aus PDP v2 (governance_policies/ai_policies,
//      Snapshot-Version) — können nur VERSCHÄRFEN (block → DENY,
//      require_approval → REQUIRE_APPROVAL), nie lockern.
// Ist die Mandanten-Ebene nicht bestimmbar, wird fail-closed abgelehnt.

import { actionClass, type BrowserAction } from './actions.ts';
import type { UrlCheck } from './url.ts';

export const BASELINE_POLICY_ID = 'rsd.browser.baseline';
export const BASELINE_POLICY_VERSION = '2026-09-29.1';

export const EXECUTION_LIMITS = {
  maxActionsPerSession: 200,
  maxSessionAgeMs: 60 * 60 * 1000,
  sessionIdleTtlMs: 15 * 60 * 1000,
  maxOpenSessionsPerTenant: 3,
  approvalTtlMs: 15 * 60 * 1000,
  maxMutationsPerRequest: 1,
} as const;

/** Rollen, die eine Browser-Session steuern dürfen. viewer_auditor liest nur. */
export const OPERATOR_ROLES: ReadonlySet<string> = new Set(['owner', 'admin', 'editor', 'dpo']);
/** Rollen, die freigeben und den autonomen Modus nutzen dürften. */
export const APPROVER_ROLES: ReadonlySet<string> = new Set(['owner', 'admin']);

export type AgentMode = 'assist' | 'copilot' | 'autonomous';
export type Decision = 'ALLOW' | 'DENY' | 'REQUIRE_APPROVAL';
export type RiskLevel = 'info' | 'low' | 'medium' | 'high' | 'critical';

/** Ergebnis der Mandanten-Ebene (PDP v2), vom Handler übersetzt. */
export type TenantPolicyOverlay =
  | { status: 'evaluated'; decision: 'allow' | 'warn' | 'block' | 'require_approval' | 'log_only'; policy_id: string | null; snapshot_version: string; reason_text: string | null }
  | { status: 'unavailable'; error_code: string };

export interface BrowserPolicyInput {
  actor: { user_id: string; role: string };
  tenant: { id: string; verified: boolean };
  capability: { mode: AgentMode; mode_allowed: boolean; initiated_by: 'human' | 'planner' };
  target: { page_url: string | null };
  action: BrowserAction;
  risk_context: {
    session_action_count: number;
    session_age_ms: number;
    kill_switch_engaged: boolean;
    /** Nur bei navigate: statische URL-Prüfung (url.ts). */
    url_check?: UrlCheck;
  };
  tenant_policy: TenantPolicyOverlay;
}

export interface BrowserPolicyDecision {
  decision: Decision;
  policy_id: string;
  policy_version: string;
  reason: string;
  reason_text: string;
  risk_level: RiskLevel;
  conditions: string[];
  tenant_snapshot_version: string | null;
}

/**
 * PDP-v2-Ergebnis (evaluateSnapshot) → Mandanten-Ebene. Ohne Treffer gilt die
 * Mandanten-Ebene als „keine zusätzliche Einschränkung" (allow), die
 * Snapshot-Version bleibt als Nachweis erhalten.
 */
export function overlayFromPdpResult(result: {
  decision: 'allow' | 'warn' | 'block' | 'require_approval' | 'log_only';
  primary_policy_id: string | null;
  matched_policy_ids: string[];
  snapshot_version: string;
  reasons: Array<{ text_de?: string }>;
}): TenantPolicyOverlay {
  if (result.matched_policy_ids.length === 0) {
    return { status: 'evaluated', decision: 'allow', policy_id: null, snapshot_version: result.snapshot_version, reason_text: null };
  }
  return {
    status: 'evaluated',
    decision: result.decision,
    policy_id: result.primary_policy_id,
    snapshot_version: result.snapshot_version,
    reason_text: result.reasons[0]?.text_de ?? null,
  };
}

function riskFor(action: BrowserAction): RiskLevel {
  const cls = actionClass(action.type);
  if (cls === 'mutation') return 'high';
  if (cls === 'side_effect') return 'medium';
  if (action.type === 'navigate') return 'low';
  return 'info';
}

function version(overlay: TenantPolicyOverlay): string {
  return overlay.status === 'evaluated'
    ? `${BASELINE_POLICY_VERSION}+tenant:${overlay.snapshot_version}`
    : BASELINE_POLICY_VERSION;
}

function deny(
  input: BrowserPolicyInput,
  reason: string,
  reason_text: string,
  risk: RiskLevel = 'high',
  policy_id = BASELINE_POLICY_ID,
): BrowserPolicyDecision {
  return {
    decision: 'DENY',
    policy_id,
    policy_version: version(input.tenant_policy),
    reason,
    reason_text,
    risk_level: risk,
    conditions: [],
    tenant_snapshot_version: input.tenant_policy.status === 'evaluated' ? input.tenant_policy.snapshot_version : null,
  };
}

const APPROVAL_CONDITIONS = [
  'single_use',
  'bound_to_session',
  'bound_to_page_url',
  `approval_ttl_minutes:${EXECUTION_LIMITS.approvalTtlMs / 60_000}`,
  'approver_roles:owner,admin',
];

export function evaluateBrowserAction(input: BrowserPolicyInput): BrowserPolicyDecision {
  const { action, risk_context: rc } = input;
  const cls = actionClass(action.type);
  const baseRisk = riskFor(action);

  // 1. Notabschaltung schlägt alles.
  if (rc.kill_switch_engaged) {
    return deny(input, 'KILL_SWITCH_ENGAGED', 'Die Browser-Runtime ist per Notabschaltung gestoppt.', 'critical');
  }
  // 2. Ohne verifizierten Mandanten keine Entscheidung zugunsten einer Ausführung.
  if (!input.tenant.verified) {
    return deny(input, 'TENANT_NOT_VERIFIED', 'Mandant ist nicht über eine Mitgliedschaft bestätigt.', 'critical');
  }
  // 3. Rolle.
  if (!OPERATOR_ROLES.has(input.actor.role)) {
    return deny(input, 'ROLE_NOT_PERMITTED', `Die Rolle „${input.actor.role}“ darf keine Browser-Aktionen ausführen.`);
  }
  // 4. Modus.
  if (!input.capability.mode_allowed) {
    return deny(input, 'MODE_NOT_PERMITTED', `Der Modus „${input.capability.mode}“ ist für diesen Mandanten nicht freigeschaltet.`);
  }
  if (input.capability.mode === 'assist' && input.capability.initiated_by === 'planner') {
    return deny(input, 'AUTORUN_NOT_PERMITTED_IN_ASSIST', 'Im Assist-Modus führt nur der Mensch Schritte aus.', 'medium');
  }
  // 5. Ausführungsgrenzen der Session.
  if (rc.session_action_count >= EXECUTION_LIMITS.maxActionsPerSession) {
    return deny(input, 'SESSION_ACTION_LIMIT', `Maximal ${EXECUTION_LIMITS.maxActionsPerSession} Aktionen pro Session.`, 'medium');
  }
  if (rc.session_age_ms >= EXECUTION_LIMITS.maxSessionAgeMs) {
    return deny(input, 'SESSION_MAX_AGE', 'Die Session hat ihre maximale Laufzeit erreicht.', 'medium');
  }
  // 6. Navigationsziel.
  if (action.type === 'navigate') {
    const check = rc.url_check;
    if (!check || !check.ok) {
      return deny(input, 'URL_BLOCKED', check && !check.ok
        ? `Ziel-URL abgelehnt (${check.reason}).`
        : 'Ziel-URL wurde nicht geprüft.');
    }
  }
  // 7. Mandanten-Ebene: fail-closed, wenn nicht bestimmbar.
  const overlay = input.tenant_policy;
  if (overlay.status === 'unavailable') {
    return deny(input, 'POLICY_UNAVAILABLE', 'Mandanten-Policies konnten nicht geladen werden (fail closed).', baseRisk === 'info' ? 'medium' : baseRisk);
  }
  if (overlay.decision === 'block') {
    return deny(
      input,
      'TENANT_POLICY_BLOCK',
      overlay.reason_text ?? 'Eine Mandanten-Policy blockiert diese Aktion.',
      baseRisk === 'info' ? 'medium' : baseRisk,
      overlay.policy_id ?? BASELINE_POLICY_ID,
    );
  }

  const conditions: string[] = [];
  if (overlay.decision === 'warn') conditions.push(`tenant_warn:${overlay.policy_id ?? 'unknown'}`);

  // 8. Mutationen und Nebenwirkungen: immer menschliche Freigabe.
  if (cls === 'mutation' || cls === 'side_effect' || overlay.decision === 'require_approval') {
    const byTenant = cls === 'read_only' && overlay.decision === 'require_approval';
    return {
      decision: 'REQUIRE_APPROVAL',
      policy_id: byTenant ? (overlay.policy_id ?? BASELINE_POLICY_ID) : BASELINE_POLICY_ID,
      policy_version: version(overlay),
      reason: byTenant ? 'TENANT_POLICY_REQUIRES_APPROVAL' : cls === 'mutation' ? 'MUTATION_REQUIRES_APPROVAL' : 'SIDE_EFFECT_REQUIRES_APPROVAL',
      reason_text: byTenant
        ? (overlay.reason_text ?? 'Eine Mandanten-Policy verlangt eine Freigabe.')
        : cls === 'mutation'
          ? 'Klick, Eingabe, Auswahl, Absenden und Upload verändern die Zielseite und brauchen eine menschliche Freigabe.'
          : 'Downloads brauchen eine menschliche Freigabe.',
      risk_level: baseRisk === 'info' ? 'medium' : baseRisk,
      conditions: [...APPROVAL_CONDITIONS, ...conditions],
      tenant_snapshot_version: overlay.snapshot_version,
    };
  }

  // 9. Lesende Aktionen.
  return {
    decision: 'ALLOW',
    policy_id: BASELINE_POLICY_ID,
    policy_version: version(overlay),
    reason: action.type === 'navigate' ? 'PUBLIC_NAVIGATION_ALLOWED' : 'READ_ONLY_ALLOWED',
    reason_text: action.type === 'navigate'
      ? 'Navigation zu einem öffentlichen Ziel ist erlaubt.'
      : 'Lesende Aktion ist erlaubt.',
    risk_level: baseRisk,
    conditions: ['evidence_required', ...conditions],
    tenant_snapshot_version: overlay.snapshot_version,
  };
}
