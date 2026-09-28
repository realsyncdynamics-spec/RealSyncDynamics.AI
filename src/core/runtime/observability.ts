import type { ExecutionRecord, ExecutionStatus } from './types';

/**
 * Observability contract. The runtime emits structured execution records
 * here. Sentry remains for UI-level errors and is intentionally NOT the
 * audit trail.
 */
export interface ExecutionTracer {
  /** Persist a new execution row in `pending` or `running` state. */
  start(record: ExecutionRecord): Promise<void>;
  /** Patch an existing execution row with status + finished_at + hashes. */
  finish(
    id: string,
    patch: Pick<ExecutionRecord, 'status'> &
      Partial<Pick<ExecutionRecord, 'output_hash' | 'finished_at' | 'error_code'>>,
  ): Promise<void>;
}

/**
 * In-memory implementation for testing and development.
 * Production impl (Postgres-backed) arrives in Phase 1.2.
 */
export class InMemoryExecutionTracer implements ExecutionTracer {
  readonly #records = new Map<string, ExecutionRecord>();

  async start(record: ExecutionRecord): Promise<void> {
    this.#records.set(record.id, { ...record });
  }

  async finish(
    id: string,
    patch: Pick<ExecutionRecord, 'status'> &
      Partial<Pick<ExecutionRecord, 'output_hash' | 'finished_at' | 'error_code'>>,
  ): Promise<void> {
    const record = this.#records.get(id);
    if (!record) throw new Error(`Execution ${id} not found`);
    Object.assign(record, patch);
  }

  // Test helpers
  getRecord(id: string): ExecutionRecord | undefined {
    return this.#records.get(id);
  }

  getAllRecords(): ExecutionRecord[] {
    return Array.from(this.#records.values());
  }
}
