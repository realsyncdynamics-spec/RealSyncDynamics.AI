import type { RuntimeEvent, RuntimeEventName } from './types';

/**
 * Runtime event bus contract. Phase 1 uses a synchronous Postgres-backed
 * implementation that writes to `runtime_events`. An asynchronous broker
 * (LISTEN/NOTIFY or outbox) follows in Phase 3.
 *
 * Subscribers MUST be idempotent. The bus may redeliver in failure modes.
 */
export interface EventBus {
  emit(event: RuntimeEvent): Promise<void>;
  subscribe(name: RuntimeEventName, handler: EventHandler): Unsubscribe;
}

export type EventHandler = (event: RuntimeEvent) => void | Promise<void>;
export type Unsubscribe = () => void;

/**
 * Minimal in-process bus useful for tests and the local dev path. NOT a
 * production implementation — no durability, no cross-process delivery.
 */
export class InMemoryEventBus implements EventBus {
  readonly #handlers = new Map<RuntimeEventName, Set<EventHandler>>();

  async emit(event: RuntimeEvent): Promise<void> {
    const handlers = this.#handlers.get(event.name);
    if (!handlers) return;
    for (const h of handlers) {
      await h(event);
    }
  }

  subscribe(name: RuntimeEventName, handler: EventHandler): Unsubscribe {
    let set = this.#handlers.get(name);
    if (!set) {
      set = new Set();
      this.#handlers.set(name, set);
    }
    set.add(handler);
    return () => set!.delete(handler);
  }
}
