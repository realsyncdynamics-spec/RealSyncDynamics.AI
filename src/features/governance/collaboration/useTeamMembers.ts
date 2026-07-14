import { useEffect, useState, useCallback } from 'react';
import { useTenant } from '../../../core/access/TenantProvider';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase';

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'reviewer' | 'contributor' | 'viewer';
  status: 'active' | 'pending' | 'inactive';
  joinedAt: Date;
  lastActivity: Date | null;
  permissions: string[];
}

/**
 * Hook for managing team members and their compliance access.
 * Supports role-based permissions and member lifecycle.
 *
 * Returns null if Supabase is not configured or tenant is not selected.
 */
export function useTeamMembers() {
  const { activeTenantId } = useTenant();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!activeTenantId || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const sb = getSupabase();

      const { data, error: fetchError } = await sb
        .from('workspace_members')
        .select('*')
        .eq('tenant_id', activeTenantId)
        .order('joined_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      const transformedMembers: TeamMember[] = (data || []).map((member) => ({
        id: member.id,
        email: member.email,
        name: member.display_name || 'Unnamed',
        role: member.role || 'viewer',
        status: member.status || 'pending',
        joinedAt: new Date(member.joined_at),
        lastActivity: member.last_activity ? new Date(member.last_activity) : null,
        permissions: member.permissions || [],
      }));

      setMembers(transformedMembers);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch team members';
      setError(errorMsg);
      console.error('Team members fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTenantId]);

  useEffect(() => {
    void fetchMembers();
  }, [fetchMembers]);

  const inviteMember = useCallback(
    async (email: string, role: TeamMember['role']): Promise<boolean> => {
      if (!activeTenantId || !isSupabaseConfigured()) {
        return false;
      }

      try {
        const sb = getSupabase();
        const { error } = await sb.from('workspace_members').insert({
          tenant_id: activeTenantId,
          email,
          role,
          status: 'pending',
          joined_at: new Date().toISOString(),
        });

        if (error) {
          throw error;
        }

        await fetchMembers();
        return true;
      } catch (err) {
        console.error('Failed to invite member:', err);
        return false;
      }
    },
    [activeTenantId, fetchMembers]
  );

  const updateMemberRole = useCallback(
    async (memberId: string, newRole: TeamMember['role']): Promise<boolean> => {
      if (!activeTenantId || !isSupabaseConfigured()) {
        return false;
      }

      try {
        const sb = getSupabase();
        const { error } = await sb
          .from('workspace_members')
          .update({ role: newRole })
          .eq('id', memberId)
          .eq('tenant_id', activeTenantId);

        if (error) {
          throw error;
        }

        await fetchMembers();
        return true;
      } catch (err) {
        console.error('Failed to update member role:', err);
        return false;
      }
    },
    [activeTenantId, fetchMembers]
  );

  const removeMember = useCallback(
    async (memberId: string): Promise<boolean> => {
      if (!activeTenantId || !isSupabaseConfigured()) {
        return false;
      }

      try {
        const sb = getSupabase();
        const { error } = await sb
          .from('workspace_members')
          .delete()
          .eq('id', memberId)
          .eq('tenant_id', activeTenantId);

        if (error) {
          throw error;
        }

        await fetchMembers();
        return true;
      } catch (err) {
        console.error('Failed to remove member:', err);
        return false;
      }
    },
    [activeTenantId, fetchMembers]
  );

  return {
    members,
    loading,
    error,
    inviteMember,
    updateMemberRole,
    removeMember,
    refetch: fetchMembers,
  };
}
