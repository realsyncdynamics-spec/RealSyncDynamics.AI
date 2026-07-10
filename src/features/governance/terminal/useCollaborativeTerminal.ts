import { useCallback, useState, useEffect } from 'react';
import { useTenant } from '../../../core/access/TenantProvider';
import { useSupabaseAuth } from '../../../features/supabase/SupabaseAuthContext';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase';

export type TerminalRole = 'owner' | 'editor' | 'viewer' | 'approver';

export interface SessionMember {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  role: TerminalRole;
  joinedAt: Date;
  isActive: boolean;
  avatar?: string;
}

export interface SessionInvitation {
  id: string;
  invitedEmail: string;
  role: TerminalRole;
  invitedBy: string;
  expiresAt: Date;
  token: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface CollaborativeSessionState {
  sessionId: string;
  members: SessionMember[];
  invitations: SessionInvitation[];
  ownerUserId: string;
  currentUserRole: TerminalRole;
}

export function useCollaborativeTerminal(sessionId: string | null) {
  const { activeTenantId } = useTenant();
  const { user } = useSupabaseAuth();
  const [sessionState, setSessionState] = useState<CollaborativeSessionState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessionMembers = useCallback(async () => {
    if (!sessionId || !activeTenantId || !isSupabaseConfigured()) {
      return;
    }

    try {
      setLoading(true);
      const sb = getSupabase();

      // Get session and owner info
      const { data: sessionData, error: sessionError } = await sb
        .from('terminal_sessions')
        .select('id, user_id')
        .eq('id', sessionId)
        .eq('tenant_id', activeTenantId)
        .single();

      if (sessionError) throw sessionError;

      // Get all members
      const { data: membersData, error: membersError } = await sb
        .from('terminal_session_members')
        .select('id, user_id, role, joined_at, is_active')
        .eq('session_id', sessionId)
        .eq('tenant_id', activeTenantId)
        .eq('is_active', true);

      if (membersError) throw membersError;

      // Get pending invitations
      const { data: invitationsData, error: invitationsError } = await sb
        .from('terminal_session_invitations')
        .select('id, invited_email, role, invited_by, expires_at, token, accepted_at, rejected_at')
        .eq('session_id', sessionId)
        .eq('tenant_id', activeTenantId);

      if (invitationsError) throw invitationsError;

      // Transform members (simplified - in production would fetch user details)
      const members: SessionMember[] = (membersData || []).map((m) => ({
        id: m.id,
        userId: m.user_id,
        email: `user-${m.user_id.slice(0, 8)}@example.com`,
        displayName: `User ${m.user_id.slice(0, 8)}`,
        role: m.role,
        joinedAt: new Date(m.joined_at),
        isActive: m.is_active,
      }));

      // Transform invitations
      const invitations: SessionInvitation[] = (invitationsData || []).map((i) => ({
        id: i.id,
        invitedEmail: i.invited_email,
        role: i.role,
        invitedBy: i.invited_by,
        expiresAt: new Date(i.expires_at),
        token: i.token,
        status: i.accepted_at ? 'accepted' : i.rejected_at ? 'rejected' : 'pending',
      }));

      // Determine current user's role
      const currentUserMember = members.find((m) => m.userId === user?.id);
      const currentUserRole: TerminalRole = currentUserMember?.role || 'viewer';

      setSessionState({
        sessionId,
        members,
        invitations: invitations.filter((i) => i.status === 'pending'),
        ownerUserId: sessionData.user_id,
        currentUserRole,
      });

      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch session members';
      setError(errorMsg);
      console.error('Fetch members error:', err);
    } finally {
      setLoading(false);
    }
  }, [sessionId, activeTenantId, user?.id]);

  const inviteMember = useCallback(
    async (email: string, role: TerminalRole): Promise<boolean> => {
      if (!sessionId || !activeTenantId || !isSupabaseConfigured()) {
        return false;
      }

      try {
        const sb = getSupabase();
        const token = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7-day expiry

        const { error: inviteError } = await sb
          .from('terminal_session_invitations')
          .insert({
            session_id: sessionId,
            tenant_id: activeTenantId,
            invited_email: email,
            invited_by: user?.id,
            role,
            token,
            expires_at: expiresAt.toISOString(),
          });

        if (inviteError) throw inviteError;

        // Log activity
        await sb.from('terminal_activity_log').insert({
          id: crypto.randomUUID(),
          session_id: sessionId,
          user_id: user?.id,
          tenant_id: activeTenantId,
          action: `Invited ${email} as ${role}`,
          action_type: 'member_invited',
          details: { email, role },
        });

        await fetchSessionMembers();
        return true;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to invite member';
        setError(errorMsg);
        console.error('Invite error:', err);
        return false;
      }
    },
    [sessionId, activeTenantId, user?.id, fetchSessionMembers]
  );

  const removeMember = useCallback(
    async (memberId: string): Promise<boolean> => {
      if (!sessionId || !activeTenantId || !isSupabaseConfigured()) {
        return false;
      }

      try {
        const sb = getSupabase();

        const { error: removeError } = await sb
          .from('terminal_session_members')
          .update({ is_active: false, left_at: new Date().toISOString() })
          .eq('id', memberId)
          .eq('tenant_id', activeTenantId);

        if (removeError) throw removeError;

        // Log activity
        await sb.from('terminal_activity_log').insert({
          id: crypto.randomUUID(),
          session_id: sessionId,
          user_id: user?.id,
          tenant_id: activeTenantId,
          action: 'Removed member from session',
          action_type: 'member_leave',
          details: { memberId },
        });

        await fetchSessionMembers();
        return true;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to remove member';
        setError(errorMsg);
        console.error('Remove member error:', err);
        return false;
      }
    },
    [sessionId, activeTenantId, user?.id, fetchSessionMembers]
  );

  const updateMemberRole = useCallback(
    async (memberId: string, newRole: TerminalRole): Promise<boolean> => {
      if (!sessionId || !activeTenantId || !isSupabaseConfigured()) {
        return false;
      }

      // Check if current user is owner
      if (sessionState?.currentUserRole !== 'owner') {
        setError('Only session owner can change member roles');
        return false;
      }

      try {
        const sb = getSupabase();

        const { error: updateError } = await sb
          .from('terminal_session_members')
          .update({ role: newRole })
          .eq('id', memberId)
          .eq('tenant_id', activeTenantId);

        if (updateError) throw updateError;

        await fetchSessionMembers();
        return true;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to update member role';
        setError(errorMsg);
        console.error('Update role error:', err);
        return false;
      }
    },
    [sessionId, activeTenantId, sessionState?.currentUserRole, fetchSessionMembers]
  );

  const canPerformAction = useCallback(
    (action: 'invite' | 'remove' | 'approve'): boolean => {
      if (!sessionState) return false;

      switch (action) {
        case 'invite':
          return sessionState.currentUserRole === 'owner' || sessionState.currentUserRole === 'editor';
        case 'remove':
          return sessionState.currentUserRole === 'owner';
        case 'approve':
          return (
            sessionState.currentUserRole === 'owner' || sessionState.currentUserRole === 'approver'
          );
        default:
          return false;
      }
    },
    [sessionState]
  );

  useEffect(() => {
    void fetchSessionMembers();
  }, [fetchSessionMembers]);

  return {
    sessionState,
    loading,
    error,
    fetchSessionMembers,
    inviteMember,
    removeMember,
    updateMemberRole,
    canPerformAction,
  };
}
