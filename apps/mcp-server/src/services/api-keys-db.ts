import crypto from 'crypto';
import { supabase } from './supabase.js';

export interface ApiKey {
  id: string;
  keyPrefix: string;
  name: string | null;
  scopes: string[];
  active: boolean;
  createdAt: Date;
  expiresAt?: Date;
  lastUsedAt?: Date;
}

export interface KeyValidationResult {
  valid: boolean;
  keyId?: string;
  tenantId?: string;
  scopes?: string[];
  error?: string;
}

/** Mindestlänge des Peppers — kurz genug geraten ist so gut wie keiner. */
const MIN_PEPPER_LENGTH = 32;

function pepper(): string {
  const secret = process.env.MCP_KEY_PEPPER ?? '';
  if (secret.length < MIN_PEPPER_LENGTH) {
    // Bewusst ein Fehler statt eines Rückfalls auf einen ungepfefferten Hash:
    // ein stiller Rückfall erzeugte zwei unvereinbare Schemata und entwertete
    // den Schutz, ohne dass es jemandem auffiele.
    throw new Error(
      `MCP_KEY_PEPPER fehlt oder ist kürzer als ${MIN_PEPPER_LENGTH} Zeichen — Key-Prüfung nicht möglich.`,
    );
  }
  return secret;
}

/**
 * Gepfefferter Schlüssel-Hash: HMAC-SHA-256 über den Key, verschlüsselt mit
 * einem serverseitigen Geheimnis.
 *
 * Muss byte-identisch zur Berechnung in der Edge Function
 * `mcp-api-key-manager` bleiben — sonst validiert kein einziger Key. Ein Test
 * rechnet beide Seiten gegeneinander.
 *
 * **Warum HMAC und nicht scrypt/argon2:** Der Key ist kein menschliches
 * Passwort, sondern ein Zufallstoken mit 256 Bit Entropie — Brute-Force ist
 * nicht das Angriffsszenario, gegen das ein langsames KDF hier schützen würde.
 * Der Hash läuft zudem bei *jedem* Request; ein absichtlich teures Verfahren
 * wäre an dieser Stelle ein DoS-Verstärker, weil jeder gut geformte Rateversuch
 * Rechenzeit erzwingt.
 *
 * Der Pepper leistet, worauf es hier ankommt: Wer nur die Datenbank erbeutet,
 * kann geratene Keys nicht offline gegen die gespeicherten Hashes prüfen — dazu
 * bräuchte er zusätzlich das Geheimnis, das ausschließlich in der Umgebung von
 * Server und Edge Function liegt.
 */
export function hashApiKey(key: string): string {
  return crypto.createHmac('sha256', pepper()).update(key, 'utf8').digest('hex');
}

/**
 * Prüft einen API-Key gegen die Datenbank.
 *
 * Läuft bei jedem Request durch die Auth-Middleware. Der Klartext-Key verlässt
 * diese Funktion nie — verglichen wird ausschließlich der Hash.
 */
export async function validateApiKey(apiKey: string): Promise<KeyValidationResult> {
  if (!apiKey.startsWith('rsmcp_') || apiKey.length < 20) {
    return { valid: false, error: 'Invalid key format' };
  }

  try {
    const { data, error } = await supabase.rpc('mcp_key_is_valid', {
      p_key_hash: hashApiKey(apiKey),
    });

    if (error || !data || data.length === 0) {
      return { valid: false, error: 'Key not found or invalid' };
    }

    const [row] = data;
    if (!row.valid) {
      return { valid: false, error: 'Key expired or inactive' };
    }

    return {
      valid: true,
      keyId: row.key_id,
      tenantId: row.tenant_id,
      scopes: row.scopes,
    };
  } catch (err) {
    console.error('API key validation error:', err);
    return { valid: false, error: 'Validation failed' };
  }
}

/**
 * Protokolliert eine Key-Nutzung.
 *
 * Wirft bewusst nicht: ein fehlgeschlagenes Protokoll darf den eigentlichen
 * Request nicht scheitern lassen. Der Fehler wird geloggt, damit ein
 * stillschweigender Ausfall des Prüfpfads auffällt.
 */
export async function logKeyUsage(
  keyId: string,
  action: string,
  status: number,
  options?: {
    ip?: string;
    userAgent?: string;
    latencyMs?: number;
    error?: string;
    /** false für Requests, die am Kontingent abgewiesen wurden. */
    countAgainstQuota?: boolean;
  },
): Promise<void> {
  try {
    const { error } = await supabase.rpc('mcp_log_usage', {
      p_key_id: keyId,
      p_action: action,
      p_status: status,
      p_ip: options?.ip ?? null,
      p_user_agent: options?.userAgent ?? null,
      p_latency_ms: options?.latencyMs ?? null,
      p_error: options?.error ?? null,
      p_count: options?.countAgainstQuota ?? true,
    });
    if (error) {
      console.error('Failed to log key usage:', error.message);
    }
  } catch (err) {
    console.error('Failed to log key usage:', err);
  }
}

/**
 * Listet die aktiven API-Keys eines Tenants (ohne key_hash).
 */
export async function listApiKeys(tenantId: string): Promise<ApiKey[]> {
  const { data, error } = await supabase
    .from('mcp_api_keys')
    .select('id, key_prefix, name, scopes, active, created_at, expires_at, last_used_at')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list API keys: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    keyPrefix: row.key_prefix,
    name: row.name,
    scopes: row.scopes,
    active: row.active,
    createdAt: new Date(row.created_at),
    expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
  }));
}

/**
 * Widerruft einen API-Key (active = false).
 *
 * Der tenant_id-Filter gehört in die Query, nicht in eine vorgelagerte Prüfung:
 * ein erratener Key aus einem fremden Workspace bleibt so unberührt.
 */
export async function revokeApiKey(keyId: string, tenantId: string): Promise<void> {
  const { error } = await supabase
    .from('mcp_api_keys')
    .update({ active: false })
    .eq('id', keyId)
    .eq('tenant_id', tenantId);

  if (error) {
    throw new Error(`Failed to revoke API key: ${error.message}`);
  }
}

export interface QuotaState {
  /** Zugriff erlaubt: Plan enthält API-Zugriff UND Kontingent nicht ausgeschöpft. */
  allowed: boolean;
  /** Der Plan enthält überhaupt API-Zugriff (ab Agency). */
  apiAccess: boolean;
  used: number;
  /** -1 = unbegrenzt. */
  limitCalls: number;
  planKey: string;
}

/**
 * Kontingentstand des Tenants für den laufenden Kalendermonat.
 *
 * Die Limits stammen aus `plan_catalog` — der aus `shared/pricing.ts` erzeugten
 * Projektion, die `npm run check:pricing` gegen die Quelle prüft. Bewusst nicht
 * aus `tenant_entitlements()`: dessen Werte für `limit.api_calls_monthly`
 * stammen aus einer Migration vom Juni und weichen von der Quelle ab.
 */
export async function getQuotaState(tenantId: string): Promise<QuotaState | null> {
  const { data, error } = await supabase.rpc('mcp_quota_state', { p_tenant_id: tenantId });

  if (error || !data || data.length === 0) {
    if (error) console.error('Quota check failed:', error.message);
    return null;
  }

  const [row] = data;
  return {
    allowed: row.allowed,
    apiAccess: row.api_access,
    used: Number(row.used),
    limitCalls: row.limit_calls,
    planKey: row.plan_key,
  };
}

/** Sekunden bis zum Beginn des nächsten Kalendermonats (UTC) — für Retry-After. */
export function secondsUntilQuotaReset(now: Date = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

export interface KeyStats {
  totalRequests: number;
  lastUsedAt?: Date;
  averageLatencyMs?: number;
  errorRate: number;
}

/**
 * Nutzungsstatistik eines Keys (Requests, Latenz, Fehlerquote).
 */
export async function getKeyStats(keyId: string): Promise<KeyStats> {
  const { data, error } = await supabase
    .from('mcp_key_usage')
    .select('status, latency_ms, timestamp')
    .eq('key_id', keyId)
    .order('timestamp', { ascending: false });

  if (error || !data || data.length === 0) {
    return { totalRequests: 0, errorRate: 0 };
  }

  const total = data.length;
  const errors = data.filter((row) => row.status >= 400).length;
  const latencies = data
    .map((row) => row.latency_ms)
    .filter((ms): ms is number => typeof ms === 'number');

  return {
    totalRequests: total,
    // Nach timestamp DESC sortiert — die erste Zeile ist die jüngste Nutzung.
    lastUsedAt: new Date(data[0].timestamp),
    averageLatencyMs:
      latencies.length > 0
        ? latencies.reduce((sum, ms) => sum + ms, 0) / latencies.length
        : undefined,
    errorRate: errors / total,
  };
}
