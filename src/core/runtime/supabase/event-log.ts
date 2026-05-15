import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  EventBus,
  EventHandler,
  Unsubscribe,
} from '../events';
import type { RuntimeEvent, RuntimeEventName } from '../types';

/**
 * Write-only sink for runtime events. Persists to `runtime_events`, which
 * is append-only by design (UPDATE/DELETE revoked in the Phase-0
 * migration). Subscribers are intentionally unsupported — Phase 3 will
 * add an async broker (LISTEN/NOTIFY or outbox pattern). Until then,
 * compose this sink with an `InMemoryEventBus` via `TeeEventBus` so
 * in-process subscribers keep working.
 */
export interface EventSink {
  emit(event: RuntimeEvent): Promise<void>;
}

export class SupabaseEventLog implements EventSink {
  constructor(private readonly sb: SupabaseClient) {}

  async emit(event: RuntimeEvent): Promise<void> {
    const { error } = await this.sb.from('runtime_events').insert({
      tenant_id: event.tenant_id,
      execution_id: event.execution_id ?? null,
      agent_id: event.agent_id ?? null,
      skill_id: event.skill_id ?? null,
      name: event.name,
      payload: event.payload,
      occurred_at: event.occurred_at,
    });
    if (error) {
      throw new Error(`runtime_events.insert failed: ${error.message}`);
    }
  }
}

/**
 * EventBus implementation that fans an emit() out to a primary bus
 * (typically `InMemoryEventBus` for in-process subscribers) plus one or
 * more sinks (typically `SupabaseEventLog` for persistence). Failures in
 * any sink are surfaced — silent drops would defeat the audit trail.
 *
 * subscribe() delegates to the primary bus; sinks are not subscribable.
 */
export class TeeEventBus implements EventBus {
  constructor(
    private readonly primary: EventBus,
    private readonly sinks: readonly EventSink[],
  ) {}

  async emit(event: RuntimeEvent): Promise<void> {
    await this.primary.emit(event);
    for (const sink of this.sinks) {
      await sink.emit(event);
    }
  }

  subscribe(name: RuntimeEventName, handler: EventHandler): Unsubscribe {
    return this.primary.subscribe(name, handler);
  }
}
