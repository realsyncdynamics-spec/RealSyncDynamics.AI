import { useEffect, useState, useCallback } from 'react';
import { useTenant } from '../../../core/access/TenantProvider';
import { useSupabaseAuth } from '../../../features/supabase/SupabaseAuthContext';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase';

export interface ApprovalRequest {
  id: string;
  auditId: string;
  commandId: string;
  requestedBy: string;
  requestedByEmail: string;
  approver?: string;
  approverEmail?: string;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  requestedAt: Date;
  approvedAt?: Date;
}

interface UseRealtimeApprovalsReturn {
  approvals: ApprovalRequest[];
  loading: boolean;
  error: string | null;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
}

export function useRealtimeApprovals(): UseRealtimeApprovalsReturn {
  const { activeTenantId } = useTenant();
  const { user } = useSupabaseAuth();
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>(
    'disconnected'
  );

  const fetchApprovals = useCallback(async () => {
    if (!activeTenantId || !isSupabaseConfigured()) {
      return;
    }

    try {
      setLoading(true);
      const sb = getSupabase();

      const { data, error: fetchError } = await sb
        .from('terminal_approvals')
        .select('*')
        .eq('tenant_id', activeTenantId)
        .order('requested_at', { ascending: false });

      if (fetchError) throw fetchError;

      const transformedApprovals: ApprovalRequest[] = (data || []).map((a) => ({
        id: a.id,
        auditId: a.audit_id,
        commandId: a.terminal_command_id,
        requestedBy: a.requested_by,
        requestedByEmail: `user-${a.requested_by.slice(0, 8)}@example.com`,
        approver: a.approver_id,
        approverEmail: a.approver_id ? `user-${a.approver_id.slice(0, 8)}@example.com` : undefined,
        status: a.status,
        reason: a.reason,
        requestedAt: new Date(a.requested_at),
        approvedAt: a.approved_at ? new Date(a.approved_at) : undefined,
      }));

      setApprovals(transformedApprovals);
      setError(null);
      setConnectionStatus('connected');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch approvals';
      setError(errorMsg);
      console.error('Fetch approvals error:', err);
      setConnectionStatus('disconnected');
    } finally {
      setLoading(false);
    }
  }, [activeTenantId]);

  // Initial fetch
  useEffect(() => {
    void fetchApprovals();
  }, [fetchApprovals]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!activeTenantId || !isSupabaseConfigured()) {
      return;
    }

    const sb = getSupabase();
    setConnectionStatus('reconnecting');

    try {
      const channel = sb.channel(`approvals:${activeTenantId}`, {
        config: { broadcast: { self: true } },
      });

      channel
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'terminal_approvals',
            filter: `tenant_id=eq.${activeTenantId}`,
          },
          () => {
            // On any change (INSERT/UPDATE), refetch full state
            void fetchApprovals();
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setConnectionStatus('connected');
            setError(null);
          } else if (status === 'CLOSED') {
            setConnectionStatus('disconnected');
          } else if (status === 'CHANNEL_ERROR') {
            setConnectionStatus('disconnected');
            setError('Connection error - will auto-reconnect');
          }
        });

      return () => {
        channel.unsubscribe();
        setConnectionStatus('disconnected');
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to subscribe to real-time updates';
      setError(errorMsg);
      setConnectionStatus('disconnected');
      console.error('Realtime subscription error:', err);
    }
  }, [activeTenantId, fetchApprovals]);

  return {
    approvals,
    loading,
    error,
    connectionStatus,
  };
}
