// Governed Browser Runtime — serverseitiger Capability-Check (rein, getestet).
//
// Beantwortet can_assist / can_copilot / can_autonomous mit reasons[] aus
// geprüften Zuständen. Das Frontend darf keinen Modus aus eigenem State
// freischalten; es zeigt nur, was hier berechnet wurde.

import { BROWSER_ACTION_TYPES, actionClass, type BrowserActionType } from './actions.ts';
import { APPROVER_ROLES, OPERATOR_ROLES } from './policy.ts';
import type { ExecutorHealth } from './executor.ts';

export type CapabilityReason =
  | 'TENANT_NOT_VERIFIED'
  | 'ROLE_NOT_PERMITTED'
  | 'ENTITLEMENT_REQUIRED'
  | 'ENTITLEMENT_UNAVAILABLE'
  | 'KILL_SWITCH_ENGAGED'
  | 'EXECUTOR_OFFLINE'
  | 'EXECUTOR_DEGRADED'
  | 'EXECUTOR_BUSY'
  | 'POLICY_ENGINE_INACTIVE'
  | 'EVIDENCE_STORE_UNAVAILABLE'
  | 'APPROVAL_POLICY_MISSING'
  | 'SESSION_VISUALIZATION_UNAVAILABLE'
  | 'EXECUTION_LIMITS_MISSING'
  | 'KILL_SWITCH_MISSING'
  | 'ACTION_NOT_SUPPORTED_BY_EXECUTOR'
  | 'FILE_SOURCE_NOT_CONFIGURED';

export interface CapabilityInput {
  tenantVerified: boolean;
  role: string | null;
  entitlement: { key: string; status: 'granted' | 'denied' | 'unavailable' };
  killSwitch: { engaged: boolean; available: boolean };
  executor: ExecutorHealth;
  policyEngine: { baselineActive: boolean; tenantSnapshotLoaded: boolean };
  evidenceStore: { available: boolean };
  /** Eine ausdrücklich definierte Autonomie-/Freigabe-Policy des Mandanten. */
  autonomyPolicyDefined: boolean;
  executionLimitsDefined: boolean;
  /** Governed Upload braucht eine mandantengebundene Dateiquelle. */
  uploadSourceConfigured: boolean;
}

export interface ActionAvailability {
  available: boolean;
  reason: CapabilityReason | null;
  requires_approval: boolean;
}

export interface CapabilityReport {
  can_assist: boolean;
  can_copilot: boolean;
  can_autonomous: boolean;
  reasons: { assist: CapabilityReason[]; copilot: CapabilityReason[]; autonomous: CapabilityReason[] };
  actions: Record<BrowserActionType, ActionAvailability>;
}

const EXECUTOR_ONLINE: ReadonlySet<ExecutorHealth['status']> = new Set(['ready', 'busy']);

function executorReason(executor: ExecutorHealth): CapabilityReason | null {
  if (executor.status === 'ready') return null;
  if (executor.status === 'busy') return 'EXECUTOR_BUSY';
  if (executor.status === 'degraded') return 'EXECUTOR_DEGRADED';
  return 'EXECUTOR_OFFLINE';
}

export function computeCapabilities(input: CapabilityInput): CapabilityReport {
  const base: CapabilityReason[] = [];
  if (!input.tenantVerified) base.push('TENANT_NOT_VERIFIED');
  if (!input.role || !OPERATOR_ROLES.has(input.role)) base.push('ROLE_NOT_PERMITTED');
  if (input.entitlement.status === 'denied') base.push('ENTITLEMENT_REQUIRED');
  if (input.entitlement.status === 'unavailable') base.push('ENTITLEMENT_UNAVAILABLE');
  if (input.killSwitch.engaged) base.push('KILL_SWITCH_ENGAGED');

  const assist = [...base];

  const copilot = [...base];
  const exReason = executorReason(input.executor);
  // Co-Pilot läuft auch bei ausgelastetem Executor (Warteschlange des Nutzers),
  // nicht aber offline/degraded.
  if (!EXECUTOR_ONLINE.has(input.executor.status)) copilot.push(exReason ?? 'EXECUTOR_OFFLINE');
  if (!input.policyEngine.baselineActive || !input.policyEngine.tenantSnapshotLoaded) copilot.push('POLICY_ENGINE_INACTIVE');
  if (!input.evidenceStore.available) copilot.push('EVIDENCE_STORE_UNAVAILABLE');

  const autonomous = [...copilot];
  if (input.executor.status === 'busy') autonomous.push('EXECUTOR_BUSY');
  if (input.role && !APPROVER_ROLES.has(input.role) && !autonomous.includes('ROLE_NOT_PERMITTED')) {
    autonomous.push('ROLE_NOT_PERMITTED');
  }
  if (!input.autonomyPolicyDefined) autonomous.push('APPROVAL_POLICY_MISSING');
  if (!input.executor.capabilities.includes('frame')) autonomous.push('SESSION_VISUALIZATION_UNAVAILABLE');
  if (!input.executionLimitsDefined) autonomous.push('EXECUTION_LIMITS_MISSING');
  if (!input.killSwitch.available) autonomous.push('KILL_SWITCH_MISSING');

  const actions = {} as Record<BrowserActionType, ActionAvailability>;
  for (const type of BROWSER_ACTION_TYPES) {
    const requires_approval = actionClass(type) !== 'read_only';
    let reason: CapabilityReason | null = base[0] ?? null;
    if (!reason && !EXECUTOR_ONLINE.has(input.executor.status)) reason = exReason ?? 'EXECUTOR_OFFLINE';
    if (!reason && !input.evidenceStore.available) reason = 'EVIDENCE_STORE_UNAVAILABLE';
    if (!reason && !input.policyEngine.tenantSnapshotLoaded) reason = 'POLICY_ENGINE_INACTIVE';
    if (!reason && type === 'upload' && !input.uploadSourceConfigured) reason = 'FILE_SOURCE_NOT_CONFIGURED';
    const executorName = type === 'extract' ? 'read_text' : type;
    if (!reason && !input.executor.capabilities.includes(executorName)) reason = 'ACTION_NOT_SUPPORTED_BY_EXECUTOR';
    actions[type] = { available: reason === null, reason, requires_approval };
  }

  return {
    can_assist: assist.length === 0,
    can_copilot: copilot.length === 0,
    can_autonomous: autonomous.length === 0,
    reasons: { assist, copilot, autonomous: [...new Set(autonomous)] },
    actions,
  };
}
