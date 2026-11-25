// Input validation for usage-increment.
//
// Client-reported usage may only add consumption. Corrections and refunds
// are server-side operations (recordUsage with the service role).

export const MAX_DELTA = 1_000_000;

export type DeltaResult =
  | { ok: true; delta: number }
  | { ok: false; status: number; code: 'BAD_REQUEST' | 'FORBIDDEN'; message: string };

export function parseDelta(raw: unknown): DeltaResult {
  const value = raw === undefined || raw === null ? 1 : raw;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { ok: false, status: 400, code: 'BAD_REQUEST', message: 'delta must be a non-zero integer' };
  }
  const delta = Math.trunc(value);
  if (delta === 0) {
    return { ok: false, status: 400, code: 'BAD_REQUEST', message: 'delta must be a non-zero integer' };
  }
  if (delta < 0) {
    return { ok: false, status: 403, code: 'FORBIDDEN', message: 'delta must be positive' };
  }
  if (delta > MAX_DELTA) {
    return { ok: false, status: 400, code: 'BAD_REQUEST', message: 'delta out of range' };
  }
  return { ok: true, delta };
}
