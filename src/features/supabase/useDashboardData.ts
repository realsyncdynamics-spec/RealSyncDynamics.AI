import { useState, useEffect } from 'react';
import { supabase } from './SupabaseAuthContext';

export interface DashboardData {
  riskScore: number;
  evidenceCount: number;
  dsgvoStatus: 'Compliant' | 'Non-Compliant' | 'Pending';
  aiActStatus: 'Ready' | 'Not Ready' | 'Under Review';
  monitoringStatus: {
    systemMonitoring: 'Active' | 'Inactive';
    evidenceSync: 'Active' | 'Inactive';
    complianceAlerts: 'Active' | 'Inactive';
  };
  evidenceList: Array<{
    id: string;
    title: string;
    type: string;
    date: string;
  }>;
}

const DEFAULT_DATA: DashboardData = {
  riskScore: 87,
  evidenceCount: 0,
  dsgvoStatus: 'Compliant',
  aiActStatus: 'Ready',
  monitoringStatus: {
    systemMonitoring: 'Active',
    evidenceSync: 'Active',
    complianceAlerts: 'Active',
  },
  evidenceList: [],
};

export function useDashboardData(userId: string | undefined) {
  const [data, setData] = useState<DashboardData>(DEFAULT_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // First, get the user's tenant_id from profiles
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', userId)
          .single();

        if (profileError) {
          console.warn('Could not fetch user profile, using user_id as fallback:', profileError);
        }

        // Use tenant_id (or user_id as fallback) to query governance_evidence
        const tenantId = profileData?.id || userId;

        // Fetch evidence count
        const { count: evidenceCount, error: countError } = await supabase
          .from('governance_evidence')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId);

        if (countError) throw countError;

        // Fetch recent evidence items (limit 5 for dashboard)
        const { data: evidenceData, error: dataError } = await supabase
          .from('governance_evidence')
          .select('id, title, evidence_type, created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(5);

        if (dataError) throw dataError;

        const evidenceList = (evidenceData || []).map((item) => ({
          id: item.id,
          title: item.title,
          type: item.evidence_type || 'Unknown',
          date: new Date(item.created_at).toLocaleDateString(),
        }));

        setData((prev) => ({
          ...prev,
          evidenceCount: evidenceCount || 0,
          evidenceList,
        }));
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
        // Fall back to default data on error
        setData(DEFAULT_DATA);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    // Subscribe to real-time updates on governance_evidence table
    const subscription = supabase
      .channel(`governance_evidence:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'governance_evidence',
          filter: `tenant_id=eq.${userId}`,
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userId]);

  return { data, isLoading, error };
}
