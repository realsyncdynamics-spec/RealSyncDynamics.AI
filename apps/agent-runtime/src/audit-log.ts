import { randomUUID } from 'node:crypto';
import type { AuditEvent, DenyReason, RunAgentRequest } from './types.js';

interface EmitInput {
  status: 'accepted' | 'denied';
  reviewRequired: boolean;
  reason: DenyReason | null;
  request: Pick<
    RunAgentRequest,
    'tenantId' | 'agentId' | 'taskType' | 'requestedTool' | 'requestId'
  >;
  /** Verdikt des Policy Decision Point, falls er befragt wurde (P1-5). */
  pdp?: { decision: string; mode: string; reason: string | null };
}

/**
 * Schreibt ein strukturiertes JSON-Audit-Event nach stdout.
 *
 * Keine Persistenz in dieser PR — Forwarding via stdout-Collector
 * (loki/Vector/Datadog) ist Sache der Infra-PR. Wichtig: niemals
 * Secrets, Tokens, oder den Bearer-Header in den Log-Body schreiben.
 */
export function emitAuditEvent(input: EmitInput): AuditEvent {
  const event: AuditEvent = {
    event_id: randomUUID(),
    event_type: 'agent_run_request',
    tenant_id: input.request.tenantId,
    agent_id: input.request.agentId,
    task_type: input.request.taskType,
    requested_tool: input.request.requestedTool,
    status: input.status,
    review_required: input.reviewRequired,
    timestamp: new Date().toISOString(),
    reason: input.reason,
    request_id: input.request.requestId,
    ...(input.pdp
      ? {
          pdp_decision: input.pdp.decision,
          pdp_mode: input.pdp.mode,
          pdp_reason: input.pdp.reason,
        }
      : {}),
  };

  process.stdout.write(`${JSON.stringify(event)}\n`);
  return event;
}
