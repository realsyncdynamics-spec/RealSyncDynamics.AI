import { supabase } from './supabase.js';
import crypto from 'crypto';

export interface ApiKey {
  id: string;
  keyPrefix: string;
  name: string;
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
 * Validate an API key by checking its hash against the database.
 * This is called by the auth middleware on every request.
 */
export async function validateApiKey(apiKey: string): Promise<KeyValidationResult> {
  if (!apiKey.startsWith('rsmcp_') || apiKey.length < 20) {
    return { valid: false, error: 'Invalid key format' };
  }

  const keyHash = hashApiKey(apiKey);

  try {
    const { data: result, error } = await (supabase.rpc as any)('mcp_key_is_valid', {
      p_key_hash: keyHash,
    });

    if (error || !result || result.length === 0) {
      return { valid: false, error: 'Key not found or invalid' };
    }

    const [row] = result as Array<{
      valid: boolean;
      key_id: string;
      tenant_id: string;
      scopes: string[];
    }>;
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
 * Log an API key usage event.
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
    await (supabase.rpc as any)('mcp_log_usage', {
      p_key_id: keyId,
      p_action: action,
      p_status: status,
      p_ip: options?.ip,
      p_user_agent: options?.userAgent,
      p_latency_ms: options?.latencyMs,
      p_error: options?.error,
    });
  } catch (err) {
    console.error('Failed to log key usage:', err);
  }
}

/**
 * List all API keys for a tenant.
 * Requires authentication with 'admin' scope.
 */
export async function listApiKeys(tenantId: string): Promise<ApiKey[]> {
  const { data, error } = await (supabase.from('mcp_api_keys') as any)
    .select(
      'id, key_prefix, name, scopes, active, created_at, expires_at, last_used_at',
    )
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list API keys: ${error.message}`);
  }

  return (data || []).map(
    (row: {
      id: string;
      key_prefix: string;
      name: string;
      scopes: string[];
      active: boolean;
      created_at: string;
      expires_at?: string;
      last_used_at?: string;
    }) => ({
      id: row.id,
      keyPrefix: row.key_prefix,
      name: row.name,
      scopes: row.scopes,
      active: row.active,
      createdAt: new Date(row.created_at),
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
    }),
  );
}

/**
 * Revoke an API key (set active = false).
 */
export async function revokeApiKey(keyId: string, tenantId: string): Promise<void> {
  const { error } = await (supabase.from('mcp_api_keys') as any)
    .update({ active: false })
    .eq('id', keyId)
    .eq('tenant_id', tenantId);

  if (error) {
    throw new Error(`Failed to revoke API key: ${error.message}`);
  }
}

/**
 * Hash an API key with SHA256.
 * Same method used in Edge Function and during validation.
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Get key statistics (usage, last used, etc).
 */
export async function getKeyStats(keyId: string): Promise<{
  totalRequests: number;
  lastUsedAt?: Date;
  averageLatencyMs?: number;
  errorRate: number;
}> {
  const { data, error } = await (supabase.from('mcp_key_usage') as any)
    .select('status, latency_ms, timestamp')
    .eq('key_id', keyId);

  if (error || !data) {
    return { totalRequests: 0, errorRate: 0 };
  }

  const total = data.length;
  const errors = data.filter((row: any) => row.status >= 400).length;
  const latencies = data
    .filter((row: any) => row.latency_ms)
    .map((row: any) => row.latency_ms);
  const avgLatency =
    latencies.length > 0 ? latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length : undefined;
  const lastUsed = data.length > 0 ? new Date((data[0] as any).timestamp) : undefined;

  return {
    totalRequests: total,
    lastUsedAt: lastUsed,
    averageLatencyMs: avgLatency,
    errorRate: total > 0 ? errors / total : 0,
  };
}
