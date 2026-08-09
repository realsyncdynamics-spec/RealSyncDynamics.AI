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

/**
 * SHA-256-Hash eines API-Keys.
 *
 * Muss byte-identisch zu der Berechnung in der Edge Function
 * `mcp-api-key-manager` bleiben — sonst validiert kein einziger Key.
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
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
