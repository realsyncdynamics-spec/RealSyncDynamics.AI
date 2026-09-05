import { webcrypto } from 'crypto';
import { supabase } from './supabase.js';
import { pepper, verifyAgainstStored } from './key-hash.js';

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

/** Präfix + 8 Hex-Zeichen — genau das, was in `key_prefix` gespeichert ist. */
const DISPLAY_PREFIX_LEN = 'rsmcp_'.length + 8;

/**
 * Prüft einen API-Key gegen die Datenbank.
 *
 * Läuft bei jedem Request durch die Auth-Middleware. Der Klartext-Key verlässt
 * diese Funktion nie.
 *
 * **Zwei Stufen, und die Reihenfolge ist der Punkt.** Zuerst wird über das
 * nicht geheime Präfix vorausgewählt — eine indizierte Suche, die nichts
 * kostet. Erst für die so gefundenen Kandidaten läuft die teure Ableitung
 * (~137 ms, siehe `key-hash.ts`). Wer kein gültiges Präfix trifft, erhält null
 * Zeilen und erzeugt keine einzige KDF-Runde; ein teures Verfahren an einem
 * unauthentifizierten Endpunkt wäre sonst ein DoS-Verstärker.
 *
 * Die Datenbank entscheidet nicht mehr über die Gültigkeit — sie kann es
 * nicht, weil der Pepper nur hier vorliegt. Sie liefert Kandidaten, der
 * Vergleich geschieht in diesem Prozess und laufzeitkonstant.
 */
export async function validateApiKey(apiKey: string): Promise<KeyValidationResult> {
  if (!apiKey.startsWith('rsmcp_') || apiKey.length < 20) {
    return { valid: false, error: 'Invalid key format' };
  }

  try {
    const { data, error } = await supabase.rpc('mcp_key_candidates', {
      p_key_prefix: apiKey.slice(0, DISPLAY_PREFIX_LEN),
    });

    if (error || !data || data.length === 0) {
      return { valid: false, error: 'Key not found or invalid' };
    }

    const secret = pepper();
    for (const row of data) {
      if (!(await verifyAgainstStored(apiKey, secret, row.key_hash, webcrypto.subtle))) {
        continue;
      }
      // Ablauf und Widerruf werden erst NACH dem Nachweis gemeldet. Andersherum
      // verriete die Antwort, dass ein Präfix zu einem echten Key gehört, ohne
      // dass der Aufrufer ihn besitzt.
      if (!row.valid) {
        return { valid: false, error: 'Key expired or inactive' };
      }
      return {
        valid: true,
        keyId: row.key_id,
        tenantId: row.tenant_id,
        scopes: row.scopes,
      };
    }

    return { valid: false, error: 'Key not found or invalid' };
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
