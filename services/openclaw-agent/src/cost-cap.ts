/**
 * Cost-Cap — In-Memory-Counter fuer per-day OpenAI-Token-Verbrauch.
 *
 * Strategie:
 *   - Max-Tokens pro Request hard-limited via API (max_tokens)
 *   - Pro Tag: Total-Token-Counter, bei Ueberschreitung werden weitere
 *     Calls abgelehnt
 *   - Reset taeglich um 00:00 UTC (passt zu OpenAI-Billing-Cycle)
 *
 * In Production: Redis-backed Counter fuer Multi-Instance-Setups.
 * Folge-PR wenn der Service horizontal skaliert wird.
 */

const DEFAULT_DAILY_TOKEN_CAP = 2_000_000; // ~$0.30 bei gpt-4o-mini @ $0.15/M

interface CounterState {
  date: string; // YYYY-MM-DD UTC
  totalTokens: number;
}

const state: CounterState = {
  date: getUtcDate(),
  totalTokens: 0,
};

function getUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function rotateIfNewDay(): void {
  const today = getUtcDate();
  if (state.date !== today) {
    state.date = today;
    state.totalTokens = 0;
  }
}

export function getDailyCap(): number {
  const fromEnv = Number(process.env.OPENCLAW_DAILY_TOKEN_CAP);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_DAILY_TOKEN_CAP;
}

export function getDailyUsage(): { date: string; used: number; cap: number; remaining: number } {
  rotateIfNewDay();
  const cap = getDailyCap();
  return {
    date: state.date,
    used: state.totalTokens,
    cap,
    remaining: Math.max(0, cap - state.totalTokens),
  };
}

/** Wirft 'DAILY_CAP_EXCEEDED' wenn das Cap heute schon ueberschritten ist. */
export function assertCapNotExceeded(): void {
  rotateIfNewDay();
  if (state.totalTokens >= getDailyCap()) {
    throw new Error('DAILY_CAP_EXCEEDED');
  }
}

/** Buchung nach erfolgreicher OpenAI-Antwort. */
export function recordUsage(tokens: number): void {
  rotateIfNewDay();
  state.totalTokens += Math.max(0, tokens);
}
