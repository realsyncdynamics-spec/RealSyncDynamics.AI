import { describe, it, expect } from 'vitest';
import { CircuitBreaker } from '../../../src/core/ai-gateway/breaker';

// A controllable clock so the state machine is fully deterministic.
function fakeClock(start = 1_000) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe('CircuitBreaker', () => {
  it('starts closed and allows attempts', () => {
    const b = new CircuitBreaker();
    expect(b.state('openai')).toBe('closed');
    expect(b.canAttempt('openai')).toBe(true);
  });

  it('trips to open after the failure threshold within the window', () => {
    const clock = fakeClock();
    const b = new CircuitBreaker({ failureThreshold: 3, failureWindowMs: 10_000 }, clock.now);
    b.recordFailure('openai');
    b.recordFailure('openai');
    expect(b.state('openai')).toBe('closed');
    b.recordFailure('openai'); // 3rd → trips
    expect(b.state('openai')).toBe('open');
    expect(b.canAttempt('openai')).toBe(false);
  });

  it('does not trip when failures fall outside the rolling window', () => {
    const clock = fakeClock();
    const b = new CircuitBreaker({ failureThreshold: 2, failureWindowMs: 1_000 }, clock.now);
    b.recordFailure('google');
    clock.advance(2_000); // first failure decays
    b.recordFailure('google');
    expect(b.state('google')).toBe('closed');
  });

  it('moves open → half_open after cooldown and allows one probe', () => {
    const clock = fakeClock();
    const b = new CircuitBreaker(
      { failureThreshold: 1, cooldownMs: 5_000, halfOpenMaxProbes: 1 },
      clock.now,
    );
    b.recordFailure('ollama'); // opens
    expect(b.state('ollama')).toBe('open');
    expect(b.canAttempt('ollama')).toBe(false);

    clock.advance(5_000);
    expect(b.state('ollama')).toBe('half_open');
    expect(b.canAttempt('ollama')).toBe(true); // first probe allowed
    expect(b.canAttempt('ollama')).toBe(false); // budget spent
  });

  it('closes on a successful probe and re-opens on a failed probe', () => {
    const clock = fakeClock();
    const b = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 1_000 }, clock.now);

    b.recordFailure('anthropic');
    clock.advance(1_000);
    expect(b.state('anthropic')).toBe('half_open');
    b.recordSuccess('anthropic');
    expect(b.state('anthropic')).toBe('closed');

    // trip again, probe fails → back to open
    b.recordFailure('anthropic');
    clock.advance(1_000);
    expect(b.state('anthropic')).toBe('half_open');
    b.recordFailure('anthropic');
    expect(b.state('anthropic')).toBe('open');
  });

  it('isolates providers independently and snapshots state', () => {
    const b = new CircuitBreaker({ failureThreshold: 1 });
    b.recordFailure('openai');
    expect(b.state('openai')).toBe('open');
    expect(b.state('google')).toBe('closed');
    const snap = b.snapshot();
    expect(snap.openai.state).toBe('open');
    expect(snap.google.state).toBe('closed');
  });
});
