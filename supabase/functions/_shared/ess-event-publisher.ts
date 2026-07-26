/**
 * ESS Event Publisher — Publish canonical events to runtime_events_v2.
 *
 * Provides event publishing for agent lifecycle:
 * - agent.started, agent.iteration, agent.completed, agent.failed
 * - tool.requested, tool.approved, tool.denied, tool.started, tool.completed, tool.failed
 * - approval.requested, approval.decision, approval.timeout
 * - compliance.*, audit.*, system.*
 *
 * All events include:
 * - Hash chain integrity (previous_hash linking)
 * - Trace causality (trace_id + span_id)
 * - Tenant isolation via RLS
 * - Optional C2PA signatures (stubbed for now)
 */

import { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { v4 as uuidv4 } from 'npm:uuid@9.0.0';

export type EventCategory = 'agent' | 'tool' | 'approval' | 'compliance' | 'audit' | 'system';

export interface EventPublishOptions {
  traceId: string;
  spanId: string;
  tenantId: string;
  userId?: string;
  parentEventId?: string;
  sign?: boolean;
}

export interface AgentEventPayload {
  agent_id: string;
  iteration?: number;
  message?: string;
  error?: string;
  tokens_input?: number;
  tokens_output?: number;
  duration_ms?: number;
}

export interface ToolEventPayload {
  tool_name: string;
  tool_input?: Record<string, unknown>;
  tool_output?: Record<string, unknown>;
  error?: string;
  duration_ms?: number;
}

/**
 * Publish an event to runtime_events_v2 via the canonical publish_event() stored procedure.
 */
export async function publishEvent(
  admin: SupabaseClient,
  eventType: string,
  category: EventCategory,
  occurredAt: Date,
  tenantId: string,
  traceId: string,
  spanId: string,
  actorType: 'user' | 'agent' | 'system' | 'integration',
  actorId: string,
  sourceService: 'edge-function' | 'apps-agent-runtime' | 'webhook' | 'scheduler' | 'ui',
  payload: Record<string, unknown>,
  options?: {
    userId?: string;
    parentEventId?: string;
    sourceFunction?: string;
    sourceRegion?: string;
    tags?: Record<string, string>;
    sign?: boolean;
  },
): Promise<{ event_id: string; hash: string; trace_id: string } | null> {
  const { data, error } = await admin.rpc('publish_event', {
    p_event_type: eventType,
    p_category: category,
    p_occurred_at: occurredAt.toISOString(),
    p_tenant_id: tenantId,
    p_trace_id: traceId,
    p_span_id: spanId,
    p_actor_type: actorType,
    p_actor_id: actorId,
    p_source_service: sourceService,
    p_payload: payload,
    p_parent_event_id: options?.parentEventId,
    p_user_id: options?.userId,
    p_tags: options?.tags,
    p_sign: options?.sign ?? false,
  });

  if (error) {
    console.error('publish_event failed:', error.message);
    return null;
  }

  return data as { event_id: string; hash: string; trace_id: string } | null;
}

/**
 * Publish agent.started event.
 */
export async function publishAgentStarted(
  admin: SupabaseClient,
  eventOpts: EventPublishOptions & { agentId: string; sourceFunction: string },
): Promise<string | null> {
  const result = await publishEvent(
    admin,
    'agent.started',
    'agent',
    new Date(),
    eventOpts.tenantId,
    eventOpts.traceId,
    eventOpts.spanId,
    'agent',
    eventOpts.agentId,
    'edge-function',
    { agent_id: eventOpts.agentId },
    {
      userId: eventOpts.userId,
      sourceFunction: eventOpts.sourceFunction,
    },
  );
  return result?.event_id ?? null;
}

/**
 * Publish agent.iteration event (multi-turn conversation step).
 */
export async function publishAgentIteration(
  admin: SupabaseClient,
  eventOpts: EventPublishOptions & { agentId: string; iteration: number; message: string },
): Promise<string | null> {
  const result = await publishEvent(
    admin,
    'agent.iteration',
    'agent',
    new Date(),
    eventOpts.tenantId,
    eventOpts.traceId,
    eventOpts.spanId,
    'agent',
    eventOpts.agentId,
    'edge-function',
    {
      agent_id: eventOpts.agentId,
      iteration: eventOpts.iteration,
      message: eventOpts.message,
    },
    { userId: eventOpts.userId, parentEventId: eventOpts.parentEventId },
  );
  return result?.event_id ?? null;
}

/**
 * Publish agent.completed event.
 */
export async function publishAgentCompleted(
  admin: SupabaseClient,
  eventOpts: EventPublishOptions & {
    agentId: string;
    tokensInput?: number;
    tokensOutput?: number;
    durationMs: number;
  },
): Promise<string | null> {
  const result = await publishEvent(
    admin,
    'agent.completed',
    'agent',
    new Date(),
    eventOpts.tenantId,
    eventOpts.traceId,
    eventOpts.spanId,
    'agent',
    eventOpts.agentId,
    'edge-function',
    {
      agent_id: eventOpts.agentId,
      tokens_input: eventOpts.tokensInput,
      tokens_output: eventOpts.tokensOutput,
      duration_ms: eventOpts.durationMs,
    },
    { userId: eventOpts.userId },
  );
  return result?.event_id ?? null;
}

/**
 * Publish agent.failed event.
 */
export async function publishAgentFailed(
  admin: SupabaseClient,
  eventOpts: EventPublishOptions & {
    agentId: string;
    error: string;
    durationMs: number;
  },
): Promise<string | null> {
  const result = await publishEvent(
    admin,
    'agent.failed',
    'agent',
    new Date(),
    eventOpts.tenantId,
    eventOpts.traceId,
    eventOpts.spanId,
    'agent',
    eventOpts.agentId,
    'edge-function',
    {
      agent_id: eventOpts.agentId,
      error: eventOpts.error,
      duration_ms: eventOpts.durationMs,
    },
    { userId: eventOpts.userId },
  );
  return result?.event_id ?? null;
}

/**
 * Publish tool.requested event.
 */
export async function publishToolRequested(
  admin: SupabaseClient,
  eventOpts: EventPublishOptions & { toolName: string; toolInput?: Record<string, unknown> },
): Promise<string | null> {
  const result = await publishEvent(
    admin,
    'tool.requested',
    'tool',
    new Date(),
    eventOpts.tenantId,
    eventOpts.traceId,
    eventOpts.spanId,
    'agent',
    eventOpts.traceId, // actor is the agent trace
    'edge-function',
    {
      tool_name: eventOpts.toolName,
      tool_input: eventOpts.toolInput,
    },
    { parentEventId: eventOpts.parentEventId },
  );
  return result?.event_id ?? null;
}

/**
 * Publish tool.completed event.
 */
export async function publishToolCompleted(
  admin: SupabaseClient,
  eventOpts: EventPublishOptions & {
    toolName: string;
    toolOutput?: Record<string, unknown>;
    durationMs: number;
  },
): Promise<string | null> {
  const result = await publishEvent(
    admin,
    'tool.completed',
    'tool',
    new Date(),
    eventOpts.tenantId,
    eventOpts.traceId,
    eventOpts.spanId,
    'agent',
    eventOpts.traceId,
    'edge-function',
    {
      tool_name: eventOpts.toolName,
      tool_output: eventOpts.toolOutput,
      duration_ms: eventOpts.durationMs,
    },
    { parentEventId: eventOpts.parentEventId },
  );
  return result?.event_id ?? null;
}

/**
 * Publish tool.failed event.
 */
export async function publishToolFailed(
  admin: SupabaseClient,
  eventOpts: EventPublishOptions & {
    toolName: string;
    error: string;
    durationMs: number;
  },
): Promise<string | null> {
  const result = await publishEvent(
    admin,
    'tool.failed',
    'tool',
    new Date(),
    eventOpts.tenantId,
    eventOpts.traceId,
    eventOpts.spanId,
    'agent',
    eventOpts.traceId,
    'edge-function',
    {
      tool_name: eventOpts.toolName,
      error: eventOpts.error,
      duration_ms: eventOpts.durationMs,
    },
    { parentEventId: eventOpts.parentEventId },
  );
  return result?.event_id ?? null;
}

/**
 * Verify event trace integrity by checking hash chain.
 */
export async function verifyEventTrace(
  admin: SupabaseClient,
  traceId: string,
): Promise<{
  trace_id: string;
  total_events: number;
  integrity_errors: number;
  valid: boolean;
} | null> {
  const { data, error } = await admin.rpc('verify_event_trace', {
    p_trace_id: traceId,
  });

  if (error) {
    console.error('verify_event_trace failed:', error.message);
    return null;
  }

  return data;
}

/**
 * Get full event trace ordered by occurrence time (causality replay).
 */
export async function getEventTrace(
  admin: SupabaseClient,
  traceId: string,
): Promise<Array<{
  event_id: string;
  event_type: string;
  occurred_at: string;
  actor_type: string;
  actor_id: string;
  category: string;
  payload: Record<string, unknown>;
  hash: string;
}> | null> {
  const { data, error } = await admin.rpc('get_event_trace', {
    p_trace_id: traceId,
  });

  if (error) {
    console.error('get_event_trace failed:', error.message);
    return null;
  }

  return data;
}

/**
 * Generate new trace ID for execution (unique per agent run).
 */
export function generateTraceId(): string {
  return uuidv4();
}

/**
 * Generate new span ID for event within trace (unique per event in trace).
 */
export function generateSpanId(): string {
  return uuidv4();
}
