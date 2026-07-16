import { useCallback, useState, useEffect } from 'react';
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

export function useApprovalWorkflow(sessionId: string | null) {
  const { activeTenantId } = useTenant();
  const { user } = useSupabaseAuth();
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchApprovals = useCallback(async () => {
    if (!sessionId || !activeTenantId || !isSupabaseConfigured()) {
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
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch approvals';
      setError(errorMsg);
      console.error('Fetch approvals error:', err);
    } finally {
      setLoading(false);
    }
  }, [sessionId, activeTenantId]);

  const requestApproval = useCallback(
    async (auditId: string, commandId: string): Promise<boolean> => {
      if (!activeTenantId || !user || !isSupabaseConfigured()) {
        return false;
      }

      try {
        const sb = getSupabase();

        const { error: createError } = await sb
          .from('terminal_approvals')
          .insert({
            id: crypto.randomUUID(),
            audit_id: auditId,
            terminal_command_id: commandId,
            tenant_id: activeTenantId,
            requested_by: user.id,
            status: 'pending',
          });

        if (createError) throw createError;

        // Log to activity if in session
        if (sessionId) {
          await sb.from('terminal_activity_log').insert({
            id: crypto.randomUUID(),
            session_id: sessionId,
            user_id: user.id,
            tenant_id: activeTenantId,
            action: `Requested approval for audit ${auditId.slice(0, 8)}`,
            action_type: 'approval_requested',
            details: { auditId, commandId },
          });
        }

        await fetchApprovals();
        return true;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to request approval';
        setError(errorMsg);
        console.error('Request approval error:', err);
        return false;
      }
    },
    [activeTenantId, user, sessionId, fetchApprovals]
  );

  const approveAudit = useCallback(
    async (approvalId: string, reason?: string): Promise<boolean> => {
      if (!activeTenantId || !user || !isSupabaseConfigured()) {
        return false;
      }

      try {
        const sb = getSupabase();

        const { error: updateError } = await sb
          .from('terminal_approvals')
          .update({
            status: 'approved',
            approver_id: user.id,
            reason,
            approved_at: new Date().toISOString(),
          })
          .eq('id', approvalId)
          .eq('tenant_id', activeTenantId);

        if (updateError) throw updateError;

        // Log to activity if in session
        if (sessionId) {
          await sb.from('terminal_activity_log').insert({
            id: crypto.randomUUID(),
            session_id: sessionId,
            user_id: user.id,
            tenant_id: activeTenantId,
            action: `Approved audit ${approvalId.slice(0, 8)}`,
            action_type: 'approval_completed',
            details: { approvalId, status: 'approved' },
          });
        }

        await fetchApprovals();
        return true;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to approve audit';
        setError(errorMsg);
        console.error('Approve error:', err);
        return false;
      }
    },
    [activeTenantId, user, sessionId, fetchApprovals]
  );

  const rejectAudit = useCallback(
    async (approvalId: string, reason: string): Promise<boolean> => {
      if (!activeTenantId || !user || !isSupabaseConfigured()) {
        return false;
      }

      try {
        const sb = getSupabase();

        const { error: updateError } = await sb
          .from('terminal_approvals')
          .update({
            status: 'rejected',
            approver_id: user.id,
            reason,
            approved_at: new Date().toISOString(),
          })
          .eq('id', approvalId)
          .eq('tenant_id', activeTenantId);

        if (updateError) throw updateError;

        // Log to activity if in session
        if (sessionId) {
          await sb.from('terminal_activity_log').insert({
            id: crypto.randomUUID(),
            session_id: sessionId,
            user_id: user.id,
            tenant_id: activeTenantId,
            action: `Rejected audit ${approvalId.slice(0, 8)}: ${reason}`,
            action_type: 'approval_completed',
            details: { approvalId, status: 'rejected', reason },
          });
        }

        await fetchApprovals();
        return true;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to reject audit';
        setError(errorMsg);
        console.error('Reject error:', err);
        return false;
      }
    },
    [activeTenantId, user, sessionId, fetchApprovals]
  );

  const getPendingApprovalsForUser = useCallback((): ApprovalRequest[] => {
    return approvals.filter((a) => a.status === 'pending' && (!a.approver || a.approver === user?.id));
  }, [approvals, user?.id]);

  useEffect(() => {
    void fetchApprovals();
  }, [fetchApprovals]);

  return {
    approvals,
    loading,
    error,
    fetchApprovals,
    requestApproval,
    approveAudit,
    rejectAudit,
    getPendingApprovalsForUser,
  };
}
