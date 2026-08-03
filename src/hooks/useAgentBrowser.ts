import { useState, useCallback } from 'react';
import { getSupabase } from '../lib/supabase';
import { useCurrentTenant } from '../lib/useCurrentTenant';
import type {
  AgentBrowserRequest,
  AgentBrowserResponse,
  AgentBrowserSession,
  BrowserAction,
} from '../types/agent-browser';

export function useAgentBrowser() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const tenant = useCurrentTenant();

  const initiateBrowserSession = useCallback(
    async (
      agentId: string,
      initialUrl: string,
      actions: BrowserAction[],
      agentRunId?: string
    ): Promise<AgentBrowserResponse | null> => {
      if (!tenant?.id) {
        setError('No tenant context');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const supabase = getSupabase();
        const { data: session } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setError('Not authenticated');
          return null;
        }

        const request: AgentBrowserRequest = {
          tenant_id: tenant.id,
          agent_id: agentId,
          agent_run_id: agentRunId,
          initial_url: initialUrl,
          actions,
        };

        const response = await fetch('/functions/v1/agent-browser', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.error || 'Browser session failed');
          return null;
        }

        const result: AgentBrowserResponse = await response.json();
        setSessionId(result.session_id);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [tenant?.id]
  );

  const fetchSessionDetails = useCallback(
    async (browserSessionId: string): Promise<AgentBrowserSession | null> => {
      if (!tenant?.id) {
        setError('No tenant context');
        return null;
      }

      try {
        const supabase = getSupabase();
        const { data, error: fetchErr } = await supabase
          .from('agent_browser_sessions')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('session_key', browserSessionId)
          .single();

        if (fetchErr) {
          setError(fetchErr.message);
          return null;
        }

        return data as AgentBrowserSession;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch session';
        setError(message);
        return null;
      }
    },
    [tenant?.id]
  );

  const listSessions = useCallback(
    async (agentId?: string) => {
      if (!tenant?.id) {
        setError('No tenant context');
        return null;
      }

      try {
        const supabase = getSupabase();
        let query = supabase
          .from('agent_browser_sessions_with_context')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('started_at', { ascending: false });

        if (agentId) {
          query = query.eq('agent_id', agentId);
        }

        const { data, error: fetchErr } = await query;

        if (fetchErr) {
          setError(fetchErr.message);
          return null;
        }

        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to list sessions';
        setError(message);
        return null;
      }
    },
    [tenant?.id]
  );

  return {
    loading,
    error,
    sessionId,
    initiateBrowserSession,
    fetchSessionDetails,
    listSessions,
  };
}
