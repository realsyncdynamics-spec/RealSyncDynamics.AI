// Pure Health-Checks — testbar ohne Deno-Runtime.
// Liefert ein normalisiertes Status-Summary, das die Edge Function
// (supabase/functions/health/index.ts) als JSON ausspielt.
//
// Status-Semantik (Gesamtstatus):
//   ok        — alle messbaren Checks gruen
//   degraded  — mindestens ein nicht-kritischer Check rot
//   down      — kritischer Check rot (z.B. DB unerreichbar)
//
// Truth-Layer-Regel (docs/architecture/target-architecture.md §3.1):
// Ein Check, der seinen Gegenstand nicht messen kann, meldet 'unknown' —
// niemals 'ok'. 'unknown' verschlechtert den Gesamtstatus NICHT, weil
// "nicht gemessen" etwas anderes ist als "kaputt". Beides als 'ok' zu
// fuehren waere die Luege, die dieser Endpoint verhindern soll.

export type HealthCheckStatus = 'ok' | 'degraded' | 'down';

/** Status eines einzelnen Bausteins. 'unknown' = nicht messbar, nicht geraten. */
export type ComponentStatus = 'ok' | 'degraded' | 'down' | 'unknown';

export interface CheckResult {
  /** Rueckwaertskompatibel: true genau dann, wenn status === 'ok'. */
  ok: boolean;
  status: ComponentStatus;
  latency_ms?: number;
  error?: string;
  /** Was dieser Check tatsaechlich geprueft hat — verhindert Fehldeutung. */
  checked?: string;
}

export interface HealthSummary {
  status: HealthCheckStatus;
  checks: {
    database: CheckResult;
    env: CheckResult;
    ai_gateway: CheckResult;
    automation: CheckResult;
    bot_layer: CheckResult;
    evidence: CheckResult;
  };
  version: string;
  timestamp: string;
}

/** Minimal-Schnittstelle einer Tabellen-Erreichbarkeitspruefung. */
export interface HealthTableProbe {
  select(columns: string): {
    limit(count: number): Promise<{ error: { message: string } | null }>;
  };
}

export interface HealthDbClient {
  rpc(fn: string): Promise<{ data: unknown; error: { message: string } | null }>;
  /** Optional: fehlt die Sonde, melden die Tabellen-Checks 'unknown'. */
  from?(table: string): HealthTableProbe;
}

export interface CheckHealthInput {
  db: HealthDbClient | null;
  env: {
    SUPABASE_URL?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    /** Provider-Secrets des AI Gateway (Anwesenheit, nicht Gueltigkeit). */
    ANTHROPIC_API_KEY?: string;
    OPENAI_API_KEY?: string;
    GEMINI_API_KEY?: string;
    GOOGLE_API_KEY?: string;
    OLLAMA_URL?: string;
  };
  version: string;
  now?: () => Date;
}

export async function checkHealth(input: CheckHealthInput): Promise<HealthSummary> {
  const now = input.now ?? (() => new Date());

  const env: CheckResult = checkEnv(input.env);
  const database: CheckResult = await checkDatabase(input.db);

  // Bausteine parallel — jeder einzeln fehlertolerant.
  const [automation, bot_layer, evidence] = await Promise.all([
    probeTable(input.db, 'automation_runs', 'Tabelle automation_runs erreichbar'),
    probeTable(input.db, 'bots', 'Tabelle bots erreichbar'),
    probeTable(input.db, 'evidence_items', 'Tabelle evidence_items erreichbar'),
  ]);
  const ai_gateway: CheckResult = checkAiGateway(input.env);

  const checks = { database, env, ai_gateway, automation, bot_layer, evidence };

  return {
    status: aggregate(checks),
    checks,
    version: input.version,
    timestamp: now().toISOString(),
  };
}

/**
 * Gesamtstatus. Die Datenbank ist der einzige kritische Baustein: ohne sie
 * ist keine Aussage mehr belastbar. Alles andere kann nur auf 'degraded'
 * ziehen. 'unknown' zieht bewusst gar nicht.
 */
function aggregate(checks: HealthSummary['checks']): HealthCheckStatus {
  if (checks.database.status !== 'ok') return 'down';
  const others = [checks.env, checks.ai_gateway, checks.automation, checks.bot_layer, checks.evidence];
  return others.some((c) => c.status === 'down' || c.status === 'degraded') ? 'degraded' : 'ok';
}

function result(status: ComponentStatus, extra: Omit<CheckResult, 'ok' | 'status'> = {}): CheckResult {
  return { ok: status === 'ok', status, ...extra };
}

function checkEnv(env: CheckHealthInput['env']): CheckResult {
  const missing: string[] = [];
  if (!env.SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (missing.length > 0) {
    return result('down', { error: `missing env: ${missing.join(', ')}`, checked: 'Pflicht-Env vorhanden' });
  }
  return result('ok', { checked: 'Pflicht-Env vorhanden' });
}

async function checkDatabase(db: HealthDbClient | null): Promise<CheckResult> {
  const checked = 'RPC health_ping()';
  if (!db) return result('down', { error: 'no db client', checked });
  const start = Date.now();
  try {
    const { error } = await db.rpc('health_ping');
    const latency_ms = Date.now() - start;
    if (error) return result('down', { latency_ms, error: error.message, checked });
    return result('ok', { latency_ms, checked });
  } catch (e) {
    return result('down', { latency_ms: Date.now() - start, error: (e as Error).message ?? 'rpc failed', checked });
  }
}

/**
 * Tabellen-Erreichbarkeit als Stellvertreter fuer einen Baustein.
 * Bewusst schwach formuliert: die Sonde beweist, dass Schema und Zugriff
 * stehen — nicht, dass der Baustein Arbeit verrichtet. Fehlt die Tabelle
 * (nicht angewendete Migration, PGRST205), ist das 'down' und genau die
 * Information, die heute im Dashboard fehlt.
 */
async function probeTable(db: HealthDbClient | null, table: string, checked: string): Promise<CheckResult> {
  if (!db?.from) return result('unknown', { error: 'no table probe available', checked });
  const start = Date.now();
  try {
    const { error } = await db.from(table).select('id').limit(1);
    const latency_ms = Date.now() - start;
    if (error) return result('down', { latency_ms, error: error.message, checked });
    return result('ok', { latency_ms, checked });
  } catch (e) {
    return result('down', { latency_ms: Date.now() - start, error: (e as Error).message ?? 'probe failed', checked });
  }
}

/**
 * AI Gateway: geprueft wird ausschliesslich, ob ein Provider-Secret in der
 * Env liegt. Kein Provider wird angesprochen — ein Health-Endpoint darf
 * keine kostenpflichtigen Modellaufrufe ausloesen.
 *
 * Fehlt jedes Env-Secret, ist das NICHT 'down': getApiKey() faellt auf den
 * Supabase Vault zurueck, den dieser Check nicht einsehen kann. Ohne Beleg
 * gilt 'unknown'. Ollama zaehlt hier nur als Konfiguration mit — seine
 * Erreichbarkeit (VPS/Traefik) wird bewusst nicht behauptet.
 */
function checkAiGateway(env: CheckHealthInput['env']): CheckResult {
  const checked = 'mindestens ein Provider-Secret in der Env (keine Provider-Anfrage)';
  const configured = (['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'OLLAMA_URL'] as const)
    .filter((key) => Boolean(env[key]));
  if (configured.length === 0) {
    return result('unknown', { error: 'kein Provider-Secret in der Env; Vault-Fallback nicht pruefbar', checked });
  }
  return result('ok', { checked });
}
