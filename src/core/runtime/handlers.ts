import type { ExecutionInput } from './types';

/**
 * A skill handler is the actual business logic invoked by the executor
 * once permissions and approval gates have cleared. Handlers receive a
 * context object — not the raw ExecutionInput — so they cannot reach
 * around the runtime to read identifiers they were not given.
 */
export interface HandlerContext {
  readonly execution_id: string;
  readonly tenant_id: string;
  readonly agent_id: string;
  readonly skill_id: string;
  readonly args: Readonly<Record<string, unknown>>;
}

export interface HandlerResult {
  /**
   * Hash of the handler's output payload. The handler decides what is
   * payload and what is not — the executor only persists the hash, never
   * the raw value.
   */
  output_hash: string;
  /**
   * Optional structured payload returned to the caller in-process. Not
   * persisted by the runtime. PII MUST NOT be embedded here without
   * explicit caller acknowledgement (out of scope for Phase 1.1).
   */
  output?: unknown;
}

export type SkillHandler = (ctx: HandlerContext) => Promise<HandlerResult>;

/**
 * In-memory map from skill_id to handler. Lookups are O(1) and the
 * registry refuses to overwrite a previously registered handler so a
 * misconfigured boot fails loudly rather than silently rewiring a skill.
 */
export class HandlerRegistry {
  readonly #handlers = new Map<string, SkillHandler>();

  register(skill_id: string, handler: SkillHandler): void {
    if (this.#handlers.has(skill_id)) {
      throw new Error(`Handler already registered for skill: ${skill_id}`);
    }
    this.#handlers.set(skill_id, handler);
  }

  get(skill_id: string): SkillHandler | undefined {
    return this.#handlers.get(skill_id);
  }

  has(skill_id: string): boolean {
    return this.#handlers.has(skill_id);
  }

  /** Test helper. Not for production use. */
  clear(): void {
    this.#handlers.clear();
  }
}

/** Stable string form of execution arguments, used for input hashing. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => [k, sortKeys(v)] as const);
    return Object.fromEntries(entries);
  }
  return value;
}

/**
 * Lightweight, dependency-free hash used by the default executor wiring.
 * Not cryptographically strong on its own — it is for content-addressing
 * within the audit trail, never for secrets. Production wiring may swap
 * this for `crypto.subtle.digest('SHA-256', ...)`; the executor accepts a
 * custom hasher for exactly that reason.
 */
export function fnv1a32(s: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function defaultHasher(input: ExecutionInput | unknown): string {
  return fnv1a32(stableStringify(input));
}
