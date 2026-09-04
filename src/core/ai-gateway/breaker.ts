// Governed AI Routing Layer (R1) — Circuit Breaker.
//
// Per-provider failure isolation so a routing loop skips a provider that is
// currently failing instead of hammering it on every request. Three states:
//
//   closed    — normal; failures are counted within a rolling window.
//   open       — too many recent failures; the provider is skipped until the
//                cooldown elapses.
//   half_open  — cooldown elapsed; a limited number of probe attempts are
//                allowed. A success closes the breaker; a failure re-opens it.
//
// R1 scope: pure, deterministic state machine with an injectable clock. It
// holds no I/O and is NOT yet wired into the live request path — it is the
// building block the routing loop will consult in a later, flag-gated step.
//
// Deno mirror: supabase/functions/_shared/aiGateway/breaker.ts — keep in sync.

export type BreakerState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerConfig {
  /** Consecutive failures (within the window) that trip the breaker to open. */
  failureThreshold: number;
  /** How long the breaker stays open before allowing half-open probes (ms). */
  cooldownMs: number;
  /** Max concurrent probe attempts allowed in half-open before deciding. */
  halfOpenMaxProbes: number;
  /** Rolling window for counting failures (ms). Failures older than this decay. */
  failureWindowMs: number;
}

export const DEFAULT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  cooldownMs: 30_000,
  halfOpenMaxProbes: 1,
  failureWindowMs: 60_000,
};

interface ProviderBreakerState {
  state: BreakerState;
  failures: number[]; // timestamps of recent failures (within window)
  openedAt: number | null;
  halfOpenProbes: number;
}

export type Clock = () => number;

/**
 * Tracks breaker state for many providers, keyed by an arbitrary string
 * (typically the ProviderId). The clock is injectable for deterministic tests.
 */
export class CircuitBreaker {
  private readonly cfg: CircuitBreakerConfig;
  private readonly now: Clock;
  private readonly states = new Map<string, ProviderBreakerState>();

  constructor(config: Partial<CircuitBreakerConfig> = {}, now: Clock = Date.now) {
    this.cfg = { ...DEFAULT_BREAKER_CONFIG, ...config };
    this.now = now;
  }

  private ensure(key: string): ProviderBreakerState {
    let s = this.states.get(key);
    if (!s) {
      s = { state: 'closed', failures: [], openedAt: null, halfOpenProbes: 0 };
      this.states.set(key, s);
    }
    return s;
  }

  /** Current state, after applying any pending cooldown → half-open transition. */
  state(key: string): BreakerState {
    const s = this.ensure(key);
    if (s.state === 'open' && s.openedAt !== null && this.now() - s.openedAt >= this.cfg.cooldownMs) {
      s.state = 'half_open';
      s.halfOpenProbes = 0;
    }
    return s.state;
  }

  /**
   * Whether a new attempt against this provider is permitted right now.
   * - closed: always.
   * - open: no (still cooling down).
   * - half_open: only while probe budget remains; each permitted attempt
   *   consumes one probe slot until a success/failure resolves the state.
   */
  canAttempt(key: string): boolean {
    const state = this.state(key); // may transition open → half_open
    const s = this.ensure(key);
    if (state === 'closed') return true;
    if (state === 'open') return false;
    // half_open
    if (s.halfOpenProbes < this.cfg.halfOpenMaxProbes) {
      s.halfOpenProbes += 1;
      return true;
    }
    return false;
  }

  /** Record a successful call — resets the breaker to closed. */
  recordSuccess(key: string): void {
    const s = this.ensure(key);
    s.state = 'closed';
    s.failures = [];
    s.openedAt = null;
    s.halfOpenProbes = 0;
  }

  /** Record a failed call — may trip the breaker to open. */
  recordFailure(key: string): void {
    const s = this.ensure(key);
    const t = this.now();

    // A failure during a half-open probe re-opens immediately.
    if (this.state(key) === 'half_open') {
      s.state = 'open';
      s.openedAt = t;
      s.halfOpenProbes = 0;
      s.failures = [t];
      return;
    }

    // Otherwise count within the rolling window and trip on threshold.
    s.failures = s.failures.filter((ts) => t - ts < this.cfg.failureWindowMs);
    s.failures.push(t);
    if (s.failures.length >= this.cfg.failureThreshold) {
      s.state = 'open';
      s.openedAt = t;
      s.halfOpenProbes = 0;
    }
  }

  /** Snapshot for observability / dashboards (no side effects beyond state read). */
  snapshot(): Record<string, { state: BreakerState; recentFailures: number }> {
    const out: Record<string, { state: BreakerState; recentFailures: number }> = {};
    for (const key of this.states.keys()) {
      const s = this.ensure(key);
      out[key] = { state: this.state(key), recentFailures: s.failures.length };
    }
    return out;
  }

  /** Reset one provider (or all) — used by tests and admin tooling. */
  reset(key?: string): void {
    if (key) this.states.delete(key);
    else this.states.clear();
  }
}
