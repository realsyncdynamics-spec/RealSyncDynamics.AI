/**
 * RFC-004 Part A — Anomaly Detection
 *
 * Thresholds müssen Plattform-weit konsistent sein — Drift hier ist
 * False-Positive- oder False-Negative-Risiko.
 */
import { describe, expect, it } from 'vitest';

// Spiegel der SQL-Schwellen aus RFC-004 §4
const TOKEN_EXPLOSION_Z = 4;
const CONSENT_REGRESSION_LAG_MAX_MIN = 60;
const COST_PER_OUTCOME_MULTIPLIER = 5;
const MEMORY_DECAY_RATE_MULTIPLIER = 3;

describe('RFC-004 / anomaly thresholds — invariants', () => {
  it('token explosion z-score threshold is 4σ', () => {
    expect(TOKEN_EXPLOSION_Z).toBe(4);
  });
  it('consent regression window is 60 minutes (RFC-004 §4.3)', () => {
    expect(CONSENT_REGRESSION_LAG_MAX_MIN).toBe(60);
  });
  it('cost-per-outcome explosion multiplier is 5×', () => {
    expect(COST_PER_OUTCOME_MULTIPLIER).toBe(5);
  });
  it('memory decay rate anomaly multiplier is 3×', () => {
    expect(MEMORY_DECAY_RATE_MULTIPLIER).toBe(3);
  });
});

describe('RFC-004 / anomaly detection (DB)', () => {
  it.todo(
    'detect_token_explosion returns rows only for traces with z >= 4 and tokens > p99(30d)',
  );
  it.todo(
    'detect_consent_regression matches only when lag is strictly under 1 hour',
  );
  it.todo(
    'detect_cost_per_outcome_explosion fires only at >= 5× rolling 30d',
  );
  it.todo(
    'detector cron emits governance.anomaly_detected as T1 with severity=high',
  );
});
