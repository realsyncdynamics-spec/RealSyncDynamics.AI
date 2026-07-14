import { useEffect, useState, useCallback } from 'react';
import { useTenant } from '../../../core/access/TenantProvider';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase';

export interface ActivityLogEntry {
  id: string;
  action: string;
  actionType: string;
  userId: string;
  createdAt: Date;
  details?: Record<string, unknown>;
}

interface UseRealtimeActivityLogReturn {
  activities: ActivityLogEntry[];
  loading: boolean;
  error: string | null;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
}

export function useRealtimeActivityLog(
  sessionId: string | null,
  limit: number = 100
): UseRealtimeActivityLogReturn {
  const { activeTenantId } = useTenant();
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>(
    'disconnected'
  );

  const fetchInitialActivities = useCallback(async () => {
    if (!sessionId || !activeTenantId || !isSupabaseConfigured()) {
      return;
    }

    try {
      setLoading(true);
      const sb = getSupabase();

      const { data, error: fetchError } = await sb
        .from('terminal_activity_log')
        .select('id, action, action_type, user_id, details, created_at')
        .eq('session_id', sessionId)
        .eq('tenant_id', activeTenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (fetchError) throw fetchError;

      const transformed: ActivityLogEntry[] = (data || []).map((entry) => ({
        id: entry.id,
        action: entry.action,
        actionType: entry.action_type,
        userId: entry.user_id,
        details: entry.details,
        createdAt: new Date(entry.created_at),
      }));

      setActivities(transformed);
      setError(null);
      setConnectionStatus('connected');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch activity log';
      setError(errorMsg);
      console.error('Fetch activity log error:', err);
      setConnectionStatus('disconnected');
    } finally {
      setLoading(false);
    }
  }, [sessionId, activeTenantId, limit]);

  useEffect(() => {
    void fetchInitialActivities();
  }, [fetchInitialActivities]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!sessionId || !activeTenantId || !isSupabaseConfigured()) {
      return;
    }

    const sb = getSupabase();
    setConnectionStatus('reconnecting');

    try {
      const channel = sb.channel(`activity:${sessionId}`, {
        config: { broadcast: { self: true } },
      });

      channel
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'terminal_activity_log',
            filter: `session_id=eq.${sessionId}`,
          },
          (payload) => {
            // Filter by tenant_id as extra security
            if (payload.new.tenant_id === activeTenantId) {
              const newEntry: ActivityLogEntry = {
                id: payload.new.id,
                action: payload.new.action,
                actionType: payload.new.action_type,
                userId: payload.new.user_id,
                details: payload.new.details,
                createdAt: new Date(payload.new.created_at),
              };

              // Add to front of list and maintain limit
              setActivities((prev) => [newEntry, ...prev].slice(0, limit));
            }
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
  }, [sessionId, activeTenantId, limit]);

  return {
    activities,
    loading,
    error,
    connectionStatus,
  };
}
