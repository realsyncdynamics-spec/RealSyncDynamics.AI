import { useEffect, useState, useCallback } from 'react';
import { useTenant } from '../access/TenantProvider';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: string;
  actor: string;
  actorEmail: string;
  resourceType: string;
  resourceId: string;
  resourceName: string;
  changes: Record<string, { before: unknown; after: unknown }>;
  status: 'success' | 'failure';
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditTrailOptions {
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
  actionFilter?: string;
  actorFilter?: string;
}

/**
 * Hook for accessing compliance audit trail.
 * Provides chronological log of all compliance-related changes.
 *
 * Returns null if Supabase is not configured or tenant is not selected.
 */
export function useAuditTrail(options: AuditTrailOptions = {}): {
  entries: AuditLogEntry[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const { activeTenantId } = useTenant();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAuditTrail = useCallback(async () => {
    if (!activeTenantId || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const sb = getSupabase();

      const { limit = 50, offset = 0, startDate, endDate, actionFilter, actorFilter } = options;

      let query = sb
        .from('compliance_audit_log')
        .select('*', { count: 'exact' })
        .eq('tenant_id', activeTenantId);

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }
      if (actionFilter) {
        query = query.ilike('action', `%${actionFilter}%`);
      }
      if (actorFilter) {
        query = query.ilike('actor_email', `%${actorFilter}%`);
      }

      const { data, error: fetchError, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (fetchError) {
        throw fetchError;
      }

      const transformedEntries: AuditLogEntry[] = (data || []).map((entry) => ({
        id: entry.id,
        timestamp: new Date(entry.created_at),
        action: entry.action,
        actor: entry.actor_name || 'Unknown',
        actorEmail: entry.actor_email || 'unknown@example.com',
        resourceType: entry.resource_type,
        resourceId: entry.resource_id,
        resourceName: entry.resource_name || 'Unnamed Resource',
        changes: entry.changes || {},
        status: entry.status || 'success',
        ipAddress: entry.ip_address,
        userAgent: entry.user_agent,
      }));

      setEntries(transformedEntries);
      setTotal(count || 0);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch audit trail';
      setError(errorMsg);
      console.error('Audit trail fetch error:', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [activeTenantId, options]);

  useEffect(() => {
    void fetchAuditTrail();
  }, [fetchAuditTrail]);

  return {
    entries,
    total,
    loading,
    error,
    refetch: fetchAuditTrail,
  };
}

/**
 * Create a new audit log entry.
 * Should be called from backend via Edge Function for security.
 */
export async function logAuditTrailEntry(
  tenantId: string,
  entry: Omit<AuditLogEntry, 'id' | 'timestamp'>
): Promise<void> {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured, audit logging skipped');
    return;
  }

  try {
    const sb = getSupabase();
    const { error } = await sb.from('compliance_audit_log').insert({
      tenant_id: tenantId,
      action: entry.action,
      actor_name: entry.actor,
      actor_email: entry.actorEmail,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId,
      resource_name: entry.resourceName,
      changes: entry.changes,
      status: entry.status,
      ip_address: entry.ipAddress,
      user_agent: entry.userAgent,
    });

    if (error) {
      console.error('Failed to log audit trail entry:', error);
    }
  } catch (err) {
    console.error('Audit logging error:', err);
  }
}
