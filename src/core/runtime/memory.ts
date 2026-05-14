import type { PiiClass } from './types';

/**
 * Memory layer contract. Two stores, intentionally separated:
 *
 *  - Working memory: per-execution, short-lived, swept by TTL.
 *  - Knowledge store: durable, tenant-isolated, kind/pii-tagged.
 *
 * Phase 0 ships only the interface. Concrete implementations arrive when
 * Phase 1 produces something worth remembering.
 */

export type MemoryKind =
  | 'audit_finding'
  | 'remediation_decision'
  | 'evidence'
  | 'governance_record'
  | 'support_case'
  | 'metric_snapshot'
  | 'lead_state';

export interface MemoryWriteInput<T = unknown> {
  tenant_id: string;
  /** Logical scope (agent.memory_scope), not a tenant override. */
  scope: string;
  kind: MemoryKind;
  pii_class: PiiClass;
  key: string;
  value: T;
}

export interface MemoryReadInput {
  tenant_id: string;
  scope: string;
  kind: MemoryKind;
  key: string;
}

export interface KnowledgeStore {
  write<T>(input: MemoryWriteInput<T>): Promise<void>;
  read<T>(input: MemoryReadInput): Promise<T | undefined>;
}

export interface WorkingMemory {
  /** TTL in seconds. Implementations MUST enforce it; no infinite lifetime. */
  set(execution_id: string, key: string, value: unknown, ttl_seconds: number): Promise<void>;
  get<T>(execution_id: string, key: string): Promise<T | undefined>;
  drop(execution_id: string): Promise<void>;
}
