/**
 * Fail-closed governance wrapper around bolt.diy actions.
 *
 * RealSync-specific. bolt.diy itself has no tenant, no EU AI Act risk
 * class, no Prüfpfad. Every action the engine wants to run must pass
 * here first. If identity is missing, the decision is block — never
 * a silent allow.
 *
 * Does not call production APIs. The audit records are the contract
 * the existing Evidence Vault / audit export can ingest later.
 */

import type {
  AuditRecord,
  BoltAction,
  GateResult,
  GovernanceContext,
  RiskClass,
} from './types';
import { findSecretLeak, isProductionShell, normalizeProjectPath } from './path-guard';

const HIGH_RISK = [
  /biometric/i,
  /gesichtserkennung/i,
  /credit\s*scor/i,
  /kreditwürdig/i,
  /social\s*scoring/i,
  /recruiting\s+entscheid/i,
];

const UNACCEPTABLE = [
  /social\s*credit/i,
  /subliminal/i,
  /emotion\s*recognition\s+at\s+work/i,
];

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq}`;
}

export function classifyPrompt(prompt: string): RiskClass {
  if (UNACCEPTABLE.some((re) => re.test(prompt))) return 'unacceptable';
  if (HIGH_RISK.some((re) => re.test(prompt))) return 'high';
  if (/\b(auth|login|personenbezogen|dsgvo|health|gesundheit)\b/i.test(prompt)) return 'limited';
  return 'minimal';
}

export function evaluateAction(
  ctx: GovernanceContext,
  action: BoltAction,
  actionId: string,
  promptRisk: RiskClass,
): GateResult {
  if (!ctx.authenticated) {
    return {
      decision: 'block',
      reason: 'Keine Sitzung — Builder ist hinter Auth.',
      riskClass: promptRisk,
      control: 'auth.session',
      actionId,
    };
  }
  if (!ctx.tenantVerified || !ctx.tenantId) {
    return {
      decision: 'block',
      reason: 'Kein verifizierter Mandant. tenant_id kommt nie aus der URL.',
      riskClass: promptRisk,
      control: 'tenant.verified',
      actionId,
    };
  }
  if (!ctx.entitlementBuilder) {
    return {
      decision: 'block',
      reason: 'Entitlement siteos.builder fehlt.',
      riskClass: promptRisk,
      control: 'entitlement.siteos.builder',
      actionId,
    };
  }
  if (promptRisk === 'unacceptable') {
    return {
      decision: 'block',
      reason: 'Unzulässige KI-Praxis (EU AI Act Art. 5).',
      riskClass: promptRisk,
      control: 'ai-act.article-5',
      actionId,
    };
  }
  if (promptRisk === 'high') {
    return {
      decision: 'require_approval',
      reason: 'Hochrisiko-System — menschliche Freigabe vor Ausführung.',
      riskClass: promptRisk,
      control: 'ai-act.high-risk-gate',
      actionId,
    };
  }

  if (action.type === 'file') {
    const path = normalizeProjectPath(action.filePath);
    if (!path) {
      return {
        decision: 'block',
        reason: `Pfad abgewiesen: ${action.filePath || '(leer)'}`,
        riskClass: promptRisk,
        control: 'path.normalize',
        actionId,
      };
    }
    const leak = findSecretLeak(action.content);
    if (leak) {
      return {
        decision: 'block',
        reason: `Geheimnis-Muster «${leak}» im Dateiinhalt.`,
        riskClass: promptRisk,
        control: 'secret.scan',
        actionId,
      };
    }
  }

  if (action.type === 'shell' || action.type === 'start' || action.type === 'build') {
    if (isProductionShell(action.content)) {
      return {
        decision: 'block',
        reason: 'Produktive Infrastruktur-Befehle sind im Builder verboten.',
        riskClass: promptRisk,
        control: 'backstop.no-prod-infra',
        actionId,
      };
    }
  }

  if (action.type === 'supabase') {
    if (action.operation === 'query') {
      return {
        decision: 'block',
        reason: 'Supabase-Query aus dem Builder würde die Produktivdatenbank treffen.',
        riskClass: promptRisk,
        control: 'backstop.no-prod-db',
        actionId,
      };
    }
    return {
      decision: 'require_approval',
      reason: 'Migration wird nur als Datei vorgeschlagen, nie angewandt.',
      riskClass: promptRisk,
      control: 'supabase.migration-file-only',
      actionId,
    };
  }

  if (action.type === 'shell' || action.type === 'start' || action.type === 'build') {
    return {
      decision: 'require_approval',
      reason: 'WebContainer-Backend ist deaktiviert (keine COOP/COEP / keine Prod-Infra). Befehl wird protokolliert, nicht ausgeführt.',
      riskClass: promptRisk,
      control: 'runtime.webcontainer-disabled',
      actionId,
    };
  }

  return {
    decision: 'allow',
    reason: 'Dateiaktion im Projektbaum, Governance-Gate passiert.',
    riskClass: promptRisk,
    control: 'builder.file-write',
    actionId,
  };
}

export function auditFromGate(
  ctx: GovernanceContext,
  gate: GateResult,
  event: string,
  detail: string,
  evidenceSha256?: string,
): AuditRecord {
  return {
    id: nextId('aud'),
    at: new Date().toISOString(),
    tenantId: ctx.tenantId,
    sessionId: ctx.sessionId,
    actorId: ctx.actorId,
    event,
    decision: gate.decision,
    riskClass: gate.riskClass,
    control: gate.control,
    detail,
    evidenceSha256,
  };
}

export function recordEvent(
  ctx: GovernanceContext,
  event: string,
  detail: string,
  riskClass: RiskClass = 'minimal',
  evidenceSha256?: string,
): AuditRecord {
  return {
    id: nextId('aud'),
    at: new Date().toISOString(),
    tenantId: ctx.tenantId,
    sessionId: ctx.sessionId,
    actorId: ctx.actorId,
    event,
    decision: 'recorded',
    riskClass,
    control: 'pruefpfad.append',
    detail,
    evidenceSha256,
  };
}
