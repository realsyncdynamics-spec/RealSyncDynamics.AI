// Pure Health-Checks — testbar ohne Deno-Runtime.
// Liefert ein normalisiertes Status-Summary, das die Edge Function
// (supabase/functions/health/index.ts) als JSON ausspielt.
//
// Status-Semantik:
//   ok        — alle Checks gruen
//   degraded  — mindestens ein nicht-kritischer Check rot
//   down      — kritischer Check rot (z.B. DB unerreichbar)

export type HealthCheckStatus = 'ok' | 'degraded' | 'down';

export interface CheckResult {
  ok: boolean;
  latency_ms?: number;
  error?: string;
}

export interface HealthSummary {
  status: HealthCheckStatus;
  checks: {
    database: CheckResult;
    env: CheckResult;
  };
  version: string;
  timestamp: string;
}

export interface HealthDbClient {
  rpc(fn: string): Promise<{ data: unknown; error: { message: string } | null }>;
}

export interface CheckHealthInput {
  db: HealthDbClient | null;
  env: {
    SUPABASE_URL?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
  };
  version: string;
  now?: () => Date;
}

export async function checkHealth(input: CheckHealthInput): Promise<HealthSummary> {
  const now = input.now ?? (() => new Date());

  const env: CheckResult = checkEnv(input.env);
  const database: CheckResult = await checkDatabase(input.db);

  const status: HealthCheckStatus = database.ok && env.ok
    ? 'ok'
    : !database.ok
      ? 'down'
      : 'degraded';

  return {
    status,
    checks: { database, env },
    version: input.version,
    timestamp: now().toISOString(),
  };
}

function checkEnv(env: CheckHealthInput['env']): CheckResult {
  const missing: string[] = [];
  if (!env.SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (missing.length > 0) {
    return { ok: false, error: `missing env: ${missing.join(', ')}` };
  }
  return { ok: true };
}

async function checkDatabase(db: HealthDbClient | null): Promise<CheckResult> {
  if (!db) return { ok: false, error: 'no db client' };
  const start = Date.now();
  try {
    const { error } = await db.rpc('health_ping');
    const latency_ms = Date.now() - start;
    if (error) return { ok: false, latency_ms, error: error.message };
    return { ok: true, latency_ms };
  } catch (e) {
    return { ok: false, latency_ms: Date.now() - start, error: (e as Error).message ?? 'rpc failed' };
  }
}
