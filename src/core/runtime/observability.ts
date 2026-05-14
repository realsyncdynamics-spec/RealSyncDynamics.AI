import type { ExecutionRecord } from './types';

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
