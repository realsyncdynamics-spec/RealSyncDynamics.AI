// Agent OS — Postgres adapter (Phase B persistence).
//
// Wraps a Supabase client into an AgentOsPersistHook. Each save*
// method maps the in-memory record shape to an upsert against the
// corresponding `agent_*` table from the substrate migration
// (20260526000000_agent_os_substrate.sql).
//
// Design choices:
//
//   1. Best-effort writes. The in-memory store is authoritative;
//      persistence failures are logged but do NOT throw. This keeps
//      the agent loop running even when Postgres is briefly
//      unreachable. Operators see failures via the optional
//      `onError` callback (default: console.error).
//
//   2. id passthrough. The in-memory store generates string ids
//      like `mem_lq3y_1a`. Postgres tables use UUID columns. The
//      adapter therefore does NOT pass the in-memory id; it relies
//      on Postgres `DEFAULT gen_random_uuid()`. The downstream
//      effect: the in-memory id and the Postgres id diverge. For
//      Phase B this is acceptable — the AgentOsStore stays the
//      source of truth for cross-record references; Postgres
//      provides durable audit + cross-process visibility.
//
//      Phase C (when we replace the in-memory store with Postgres-
//      first reads) will switch to UUID generation at the agent
//      layer and pass ids through.
//
//   3. agent_events use BIGSERIAL `id`. The adapter strips the
//      in-memory `id` so Postgres auto-assigns the next number per
//      tenant.
//
//   4. JSON columns. payload / data / options / output / etc. are
//      jsonb in Postgres. supabase-js handles the serialisation
//      automatically.
//
// This adapter is Node + Deno-compatible (no DOM, no Vite-specific
// imports). It can be used from:
//   - Edge Functions (Deno): import via npm specifier
//   - Background workers (Node)
//   - The agent-os-runner Edge Function (#312)

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AgentEvent, AgentInput, AgentObservation, AgentOutputRecord,
  AgentOsPersistHook, AgentTask, DecisionProposal, MemoryItem,
} from './types';

export interface CreatePostgresPersistHookOptions {
  /** Called on every persistence failure. Default: console.error. */
  onError?: (op: string, err: unknown) => void;
}

export function createPostgresPersistHook(
  client: SupabaseClient,
  opts: CreatePostgresPersistHookOptions = {},
): AgentOsPersistHook {
  const report = opts.onError ?? ((op, err) => {
    // eslint-disable-next-line no-console
    console.error(`[agent-os/postgres-adapter] ${op} failed:`, err);
  });

  async function safe(op: string, fn: () => PromiseLike<{ error: unknown } | unknown>): Promise<void> {
    try {
      const r = await fn();
      const err = (r as { error?: unknown })?.error;
      if (err) report(op, err);
    } catch (e) {
      report(op, e);
    }
  }

  return {
    async saveMemory(m: MemoryItem) {
      await safe('saveMemory', () =>
        client.from('agent_memory').upsert({
          // id: Postgres default gen_random_uuid() — see header note.
          tenant_id:         m.tenant_id,
          source:            m.source,
          source_agent:      m.source_agent,
          topic:             m.topic,
          content:           m.content,
          tags:              m.tags,
          importance:        m.importance,
          status:            m.status,
          superseded_by:     m.superseded_by,
          decided_action:    m.decided_action,
          responsible_agent: m.responsible_agent,
          created_at:        m.created_at,
          updated_at:        m.updated_at,
        }, { onConflict: 'id' }),
      );
    },

    async saveTask(t: AgentTask) {
      await safe('saveTask', () =>
        client.from('agent_tasks').upsert({
          tenant_id:      t.tenant_id,
          agent:          t.agent,
          task:           t.task,
          priority:       t.priority,
          status:         t.status,
          input:          t.input,
          output:         t.output,
          blocker_reason: t.blocker_reason,
          parent_task_id: t.parent_task_id,
          created_by:     t.created_by,
          created_at:     t.created_at,
          started_at:     t.started_at,
          completed_at:   t.completed_at,
        }, { onConflict: 'id' }),
      );
    },

    async saveDecision(d: DecisionProposal) {
      await safe('saveDecision', () =>
        client.from('agent_decisions').upsert({
          tenant_id:      d.tenant_id,
          decision_title: d.decision_title,
          problem:        d.problem,
          options:        d.options,
          recommendation: d.recommendation,
          reason:         d.reason,
          risk_level:     d.risk_level,
          reversibility:  d.reversibility,
          status:         d.status,
          proposed_by:    d.proposed_by,
          approved_by:    d.approved_by,
          approved_at:    d.approved_at,
          superseded_by:  d.superseded_by,
          created_at:     d.created_at,
        }, { onConflict: 'id' }),
      );
    },

    async saveInput(i: AgentInput) {
      await safe('saveInput', () =>
        client.from('agent_inputs').insert({
          tenant_id:   i.tenant_id,
          source:      i.source,
          source_id:   i.source_id,
          payload:     i.payload,
          received_at: i.received_at,
        }),
      );
    },

    async saveOutput(o: AgentOutputRecord) {
      await safe('saveOutput', () =>
        client.from('agent_outputs').insert({
          tenant_id:       o.tenant_id,
          task_id:         o.task_id,
          agent:           o.agent,
          content:         o.content,
          self_confidence: o.self_confidence,
          evidence:        o.evidence,
          risk_dimensions: o.risk_dimensions,
          produced_at:     o.produced_at,
        }),
      );
    },

    async saveObservation(o: AgentObservation) {
      await safe('saveObservation', () =>
        client.from('agent_observations').upsert({
          tenant_id:    o.tenant_id,
          agent:        o.agent,
          category:     o.category,
          severity:     o.severity,
          title:        o.title,
          detail:       o.detail,
          data:         o.data,
          acknowledged: o.acknowledged,
          created_at:   o.created_at,
        }, { onConflict: 'id' }),
      );
    },

    async saveEvent(ev: AgentEvent) {
      // agent_events.id is BIGSERIAL — strip the in-memory id and
      // let Postgres assign the next number per tenant.
      await safe('saveEvent', () =>
        client.from('agent_events').insert({
          tenant_id:    ev.tenant_id,
          event_type:   ev.event_type,
          subject_type: ev.subject_type,
          subject_id:   ev.subject_id,
          agent:        ev.agent,
          payload:      ev.payload,
          created_at:   ev.created_at,
        }),
      );
    },
  };
}
