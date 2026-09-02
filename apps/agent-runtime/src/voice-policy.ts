import { randomUUID } from 'node:crypto';

import type { PolicyDecision } from './types.js';
import { scanVoicePii } from './voice-pii.js';
import { VOICE_TOOLS } from './voice-tools.js';
import {
  VOICE_AGENT_ID,
  VOICE_AGENT_NAME,
  VOICE_AGENT_TOOLS,
  type VoiceConsent,
  type VoiceConsentPurpose,
  type VoicePolicyDecision,
  type VoicePolicyTraceStep,
  type VoiceRiskLevel,
  type VoiceSessionState,
  type VoiceToolRequest,
  type VoiceVerdict,
} from './voice-types.js';

/**
 * Voice-Policy. LLM / STT / TTS kommen hier nicht vor.
 *
 *   ToolRequest → Kill → Rate → Tenant → Permission → PII → Consent → Risk → Audit
 *   → ALLOW | DENY | REQUIRE_CONFIRMATION
 *
 * Mapping auf den bestehenden Gateway:
 *   ALLOW                → { ok: true,  reviewRequired: false }
 *   REQUIRE_CONFIRMATION → { ok: true,  reviewRequired: true  }
 *   DENY                 → { ok: false, reason: 'denied_by_channel_policy' }
 *
 * evaluate() in policy-engine.ts bleibt die einzige Quelle für /run-agent.
 *
 * defaultVerdict darf den Prüfpfad nicht abbrechen. Sonst bleibt
 * export_transcript (Spec: DENY) vor Consent/Risk stehen und kann nie
 * auf REQUIRE_CONFIRMATION gehoben werden — genau der Fall aus der
 * Architektur: DENY ohne store_evidence, sonst Confirmation.
 */
export function evaluateVoiceToolRequest(input: {
  session: VoiceSessionState;
  request: VoiceToolRequest;
  consent: VoiceConsent | null;
}): VoicePolicyDecision {
  const trace: VoicePolicyTraceStep[] = [];
  const spec = isKnownTool(input.request.tool)
    ? VOICE_TOOLS[input.request.tool]
    : undefined;
  let verdict: VoiceVerdict = spec ? 'ALLOW' : 'DENY';
  let reason = spec ? 'Default-Policy des Tools.' : 'Unbekanntes Tool.';
  let risk: VoiceRiskLevel = spec?.risk ?? 'high';
  const findings = scanVoicePii(input.request.args);
  const piiDetected = findings.length > 0 || Boolean(spec?.piiLikely);

  const fail = (
    check: VoicePolicyTraceStep['check'],
    detail: string,
    why: string,
  ): void => {
    trace.push({ check, result: 'fail', detail });
    verdict = 'DENY';
    reason = why;
  };

  if (input.session.killSwitch) {
    fail('kill_switch', 'Kill Switch aktiv.', 'Kill Switch — keine Tool-Ausführung.');
  } else {
    trace.push({ check: 'kill_switch', result: 'pass', detail: 'Kill Switch aus.' });
  }

  if (verdict !== 'DENY') {
    if (input.session.turnCount >= input.session.rateLimit.maxTurns) {
      fail('rate_limit', 'Turn-Limit erreicht.', 'Rate Limit — Session gedrosselt.');
    } else if (input.session.toolCount >= input.session.rateLimit.maxTools) {
      fail('rate_limit', 'Tool-Limit erreicht.', 'Rate Limit — zu viele Tool-Aufrufe.');
    } else {
      trace.push({
        check: 'rate_limit',
        result: 'pass',
        detail: `${input.session.turnCount}/${input.session.rateLimit.maxTurns} Turns · ${input.session.toolCount}/${input.session.rateLimit.maxTools} Tools`,
      });
    }
  }

  if (verdict !== 'DENY') {
    if (input.request.tenantId !== input.session.tenantId) {
      fail(
        'tenant',
        `Request ${input.request.tenantId} ≠ Session ${input.session.tenantId}`,
        'Tenant-Isolation — Cross-Tenant-Aufruf blockiert.',
      );
    } else {
      trace.push({
        check: 'tenant',
        result: 'pass',
        detail: `Tenant ${input.session.tenantId} gebunden.`,
      });
    }
  }

  if (verdict !== 'DENY') {
    const allowed =
      Boolean(spec) &&
      input.request.agentId === VOICE_AGENT_ID &&
      VOICE_AGENT_TOOLS.includes(input.request.tool);
    if (!spec || !allowed) {
      fail(
        'permission',
        `Tool ${input.request.tool} nicht im Agent-Set.`,
        'Permission — Tool nicht freigegeben.',
      );
    } else {
      trace.push({
        check: 'permission',
        result: 'pass',
        detail: `${spec.label} liegt im Agent-Set von ${VOICE_AGENT_NAME}.`,
      });
    }
  }

  if (verdict !== 'DENY') {
    if (piiDetected) {
      trace.push({
        check: 'pii',
        result: 'flag',
        detail:
          findings.length > 0
            ? `PII erkannt: ${findings.map((f) => f.type).join(', ')}`
            : 'Tool ist piiLikely — Inhalt wird als personenbezogen behandelt.',
      });
    } else {
      trace.push({
        check: 'pii',
        result: 'pass',
        detail: 'Keine PII-Marker in den Argumenten.',
      });
    }
  }

  if (verdict !== 'DENY') {
    const needed: VoiceConsentPurpose[] = ['execute_tools'];
    if (spec?.writes || spec?.name === 'export_transcript') {
      needed.push('store_evidence');
    }
    const granted = new Set(input.consent?.purposes ?? []);
    const missing = needed.filter((p) => !granted.has(p));
    if (!input.consent || input.consent.withdrawnAt) {
      fail('consent', 'Keine aktive Einwilligung.', 'Consent — keine wirksame Einwilligung.');
    } else if (missing.length) {
      fail(
        'consent',
        `Fehlende Zwecke: ${missing.join(', ')}`,
        'Consent — erforderliche Zwecke nicht erteilt.',
      );
    } else {
      trace.push({
        check: 'consent',
        result: 'pass',
        detail: `Zwecke ${needed.join(', ')} erteilt.`,
      });
    }
  }

  if (verdict !== 'DENY') {
    if (
      input.request.tool === 'create_ticket' &&
      String(input.request.args['priority']) === 'high'
    ) {
      risk = 'high';
      verdict = 'REQUIRE_CONFIRMATION';
      reason = 'High-Priority-Ticket — Human Confirmation.';
      trace.push({
        check: 'risk',
        result: 'flag',
        detail: 'Priority high hebt Risiko auf high.',
      });
    } else if (spec?.defaultVerdict === 'REQUIRE_CONFIRMATION') {
      risk = spec.risk === 'low' ? 'medium' : spec.risk;
      verdict = 'REQUIRE_CONFIRMATION';
      reason = `${spec.label} ist bestätigungspflichtig.`;
      trace.push({
        check: 'risk',
        result: 'flag',
        detail: `Default des Tools: ${spec.defaultVerdict}.`,
      });
    } else if (input.request.tool === 'export_transcript') {
      risk = 'high';
      verdict = 'REQUIRE_CONFIRMATION';
      reason = 'Transkript-Export ist high-risk und bestätigungspflichtig.';
      trace.push({
        check: 'risk',
        result: 'flag',
        detail: 'Export verlässt das System — Confirmation.',
      });
    } else {
      trace.push({
        check: 'risk',
        result: 'pass',
        detail: `Risiko ${risk} unter der Decke high.`,
      });
    }
  }

  if (verdict !== 'DENY') {
    trace.push({
      check: 'audit',
      result: 'pass',
      detail: 'Evidence-Event ist für jede Tool-Aktion Pflicht.',
    });
  } else if (!trace.some((s) => s.check === 'audit')) {
    trace.push({
      check: 'audit',
      result: 'flag',
      detail: 'Denied Actions werden trotzdem als Evidence geschrieben.',
    });
  }

  return {
    decisionId: randomUUID(),
    requestId: input.request.requestId,
    sessionId: input.session.sessionId,
    tenantId: input.session.tenantId,
    verdict,
    reason,
    risk,
    piiDetected,
    auditRequired: true,
    trace,
    decidedAt: new Date().toISOString(),
    decidedBy: 'policy-engine',
  };
}

export function toGatewayDecision(verdict: VoiceVerdict): PolicyDecision {
  if (verdict === 'ALLOW') return { ok: true, reviewRequired: false };
  if (verdict === 'REQUIRE_CONFIRMATION') return { ok: true, reviewRequired: true };
  return { ok: false, reason: 'denied_by_channel_policy' };
}

function isKnownTool(value: string): value is keyof typeof VOICE_TOOLS {
  return Object.prototype.hasOwnProperty.call(VOICE_TOOLS, value);
}
