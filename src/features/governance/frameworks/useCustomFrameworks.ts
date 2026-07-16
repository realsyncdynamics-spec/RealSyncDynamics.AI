import { useEffect, useState, useCallback } from 'react';
import { useTenant } from '../../../core/access/TenantProvider';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase';

export interface CustomControl {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'compliant' | 'in-progress' | 'non-compliant' | 'not-applicable';
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  evidence: string[];
  dueDate?: Date;
  assignee?: string;
}

export interface CustomFramework {
  id: string;
  name: string;
  description: string;
  version: string;
  status: 'draft' | 'active' | 'archived';
  controls: CustomControl[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  tags: string[];
}

/**
 * Hook for managing custom compliance frameworks.
 * Allows organizations to define their own compliance requirements.
 *
 * Returns null if Supabase is not configured or tenant is not selected.
 */
export function useCustomFrameworks() {
  const { activeTenantId } = useTenant();
  const [frameworks, setFrameworks] = useState<CustomFramework[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFrameworks = useCallback(async () => {
    if (!activeTenantId || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const sb = getSupabase();

      const { data, error: fetchError } = await sb
        .from('custom_frameworks')
        .select('*')
        .eq('tenant_id', activeTenantId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      const transformedFrameworks: CustomFramework[] = (data || []).map((fw) => ({
        id: fw.id,
        name: fw.name,
        description: fw.description || '',
        version: fw.version || '1.0',
        status: fw.status || 'draft',
        controls: fw.controls || [],
        createdAt: new Date(fw.created_at),
        updatedAt: new Date(fw.updated_at),
        createdBy: fw.created_by || 'Unknown',
        tags: fw.tags || [],
      }));

      setFrameworks(transformedFrameworks);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch frameworks';
      setError(errorMsg);
      console.error('Custom frameworks fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTenantId]);

  const createFramework = useCallback(
    async (framework: Omit<CustomFramework, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>): Promise<CustomFramework | null> => {
      if (!activeTenantId || !isSupabaseConfigured()) {
        return null;
      }

      try {
        const sb = getSupabase();
        const { data, error } = await sb.from('custom_frameworks').insert({
          tenant_id: activeTenantId,
          name: framework.name,
          description: framework.description,
          version: framework.version,
          status: framework.status,
          controls: framework.controls,
          tags: framework.tags,
        }).select().single();

        if (error) {
          throw error;
        }

        if (data) {
          const newFramework: CustomFramework = {
            id: data.id,
            name: data.name,
            description: data.description || '',
            version: data.version || '1.0',
            status: data.status || 'draft',
            controls: data.controls || [],
            createdAt: new Date(data.created_at),
            updatedAt: new Date(data.updated_at),
            createdBy: data.created_by || 'Unknown',
            tags: data.tags || [],
          };

          await fetchFrameworks();
          return newFramework;
        }
      } catch (err) {
        console.error('Failed to create framework:', err);
      }

      return null;
    },
    [activeTenantId, fetchFrameworks]
  );

  const updateFramework = useCallback(
    async (id: string, updates: Partial<CustomFramework>): Promise<boolean> => {
      if (!activeTenantId || !isSupabaseConfigured()) {
        return false;
      }

      try {
        const sb = getSupabase();
        const { error } = await sb
          .from('custom_frameworks')
          .update({
            name: updates.name,
            description: updates.description,
            status: updates.status,
            controls: updates.controls,
            tags: updates.tags,
          })
          .eq('id', id)
          .eq('tenant_id', activeTenantId);

        if (error) {
          throw error;
        }

        await fetchFrameworks();
        return true;
      } catch (err) {
        console.error('Failed to update framework:', err);
        return false;
      }
    },
    [activeTenantId, fetchFrameworks]
  );

  const deleteFramework = useCallback(
    async (id: string): Promise<boolean> => {
      if (!activeTenantId || !isSupabaseConfigured()) {
        return false;
      }

      try {
        const sb = getSupabase();
        const { error } = await sb
          .from('custom_frameworks')
          .delete()
          .eq('id', id)
          .eq('tenant_id', activeTenantId);

        if (error) {
          throw error;
        }

        await fetchFrameworks();
        return true;
      } catch (err) {
        console.error('Failed to delete framework:', err);
        return false;
      }
    },
    [activeTenantId, fetchFrameworks]
  );

  useEffect(() => {
    void fetchFrameworks();
  }, [fetchFrameworks]);

  return {
    frameworks,
    loading,
    error,
    createFramework,
    updateFramework,
    deleteFramework,
    refetch: fetchFrameworks,
  };
}
