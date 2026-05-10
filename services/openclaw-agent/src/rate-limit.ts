/**
 * Sliding-Window-Rate-Limit (in-memory, per IP).
 *
 * Default: 10 Requests pro 60 Sekunden pro IP.
 * Override via OPENCLAW_RATE_LIMIT_PER_MIN env-var.
 *
 * In Production: Redis-backed fuer Multi-Instance. Folge-PR.
 */

const buckets = new Map<string, number[]>();

const DEFAULT_REQ_PER_MIN = 10;
const WINDOW_MS = 60_000;

function getLimit(): number {
  const fromEnv = Number(process.env.OPENCLAW_RATE_LIMIT_PER_MIN);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_REQ_PER_MIN;
}

/**
 * Pruef: darf diese IP jetzt einen Request machen?
 * Returned `true` falls erlaubt (und bucht den Request).
 * Returned `false` falls Limit erreicht.
 */
export function checkRateLimit(ip: string): boolean {
  const limit = getLimit();
  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  const bucket = (buckets.get(ip) ?? []).filter((t) => t > cutoff);
  if (bucket.length >= limit) {
    buckets.set(ip, bucket); // re-store with stale entries removed
    return false;
  }

  bucket.push(now);
  buckets.set(ip, bucket);
  return true;
}

/** Hard-Cleanup: entfernt alle abgelaufenen IP-Buckets (Cron-tauglich). */
export function pruneRateLimit(): void {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [ip, times] of buckets) {
    const fresh = times.filter((t) => t > cutoff);
    if (fresh.length === 0) buckets.delete(ip);
    else buckets.set(ip, fresh);
  }
}
