// Handoff packet builders + validators (agent → agent transfer).

import type { HandoffPacket } from './types';

export interface CreateHandoffArgs {
  source_agent: string;
  target_agent: string;
  task_id: string;
  context_summary: string;
  known_facts?: string[];
  open_questions?: string[];
  recommended_next_step: string;
  payload?: Record<string, unknown>;
}

let _counter = 0;
function nextId(prefix: string): string {
  _counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${_counter.toString(36)}`;
}

export function createHandoff(args: CreateHandoffArgs): HandoffPacket {
  const errors = validateHandoffArgs(args);
  if (errors.length > 0) {
    throw new Error(`createHandoff: ${errors.join('; ')}`);
  }
  return {
    id:                    nextId('handoff'),
    source_agent:          args.source_agent,
    target_agent:          args.target_agent,
    task_id:               args.task_id,
    context_summary:       args.context_summary,
    known_facts:           args.known_facts          ?? [],
    open_questions:        args.open_questions       ?? [],
    recommended_next_step: args.recommended_next_step,
    payload:               args.payload,
    status:                'pending',
    created_at:            new Date().toISOString(),
  };
}

export function validateHandoffArgs(args: CreateHandoffArgs): string[] {
  const errors: string[] = [];
  if (!args.source_agent)         errors.push('source_agent required');
  if (!args.target_agent)         errors.push('target_agent required');
  if (args.source_agent === args.target_agent)
    errors.push('source_agent must differ from target_agent');
  if (!args.task_id)              errors.push('task_id required');
  if (!args.context_summary)      errors.push('context_summary required');
  if (args.context_summary.length > 2048)
    errors.push('context_summary too long (max 2048)');
  if (!args.recommended_next_step) errors.push('recommended_next_step required');
  return errors;
}

export function transitionHandoff(
  packet: HandoffPacket,
  to: HandoffPacket['status'],
): HandoffPacket {
  if (packet.status === to) return packet;
  if (packet.status === 'completed' || packet.status === 'rejected') {
    throw new Error(`handoff ${packet.id} already in terminal state ${packet.status}`);
  }
  return {
    ...packet,
    status: to,
    resolved_at: (to === 'completed' || to === 'rejected') ? new Date().toISOString() : packet.resolved_at,
  };
}
