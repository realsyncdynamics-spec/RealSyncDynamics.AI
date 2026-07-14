import { useEffect, useState, useCallback } from 'react';
import { useTenant } from '../../../core/access/TenantProvider';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase';

export interface WebhookEndpoint {
  id: string;
  url: string;
  description: string;
  events: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastTriggeredAt: Date | null;
  secret: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: Record<string, unknown>;
  responseStatus: number | null;
  responseBody: string | null;
  attempt: number;
  nextRetryAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const WEBHOOK_EVENTS = [
  'framework.created',
  'framework.updated',
  'framework.deleted',
  'control.completed',
  'audit.logged',
  'compliance.score.changed',
  'team.member.invited',
  'team.member.removed',
  'subscription.upgraded',
  'scan.completed',
] as const;

export type WebhookEventType = typeof WEBHOOK_EVENTS[number];

/**
 * Hook for managing webhook endpoints and delivery.
 * Enables organizations to receive real-time compliance event notifications.
 */
export function useWebhooks() {
  const { activeTenantId } = useTenant();
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEndpoints = useCallback(async () => {
    if (!activeTenantId || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const sb = getSupabase();

      const { data, error: fetchError } = await sb
        .from('webhook_endpoints')
        .select('*')
        .eq('tenant_id', activeTenantId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      const transformedEndpoints: WebhookEndpoint[] = (data || []).map((endpoint) => ({
        id: endpoint.id,
        url: endpoint.url,
        description: endpoint.description || '',
        events: endpoint.events || [],
        isActive: endpoint.is_active !== false,
        createdAt: new Date(endpoint.created_at),
        updatedAt: new Date(endpoint.updated_at),
        lastTriggeredAt: endpoint.last_triggered_at ? new Date(endpoint.last_triggered_at) : null,
        secret: endpoint.secret,
      }));

      setEndpoints(transformedEndpoints);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch webhooks';
      setError(errorMsg);
      console.error('Webhook fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTenantId]);

  const fetchDeliveries = useCallback(
    async (webhookId?: string) => {
      if (!activeTenantId || !isSupabaseConfigured()) {
        return;
      }

      try {
        const sb = getSupabase();

        let query = sb
          .from('webhook_deliveries')
          .select('*')
          .eq('tenant_id', activeTenantId);

        if (webhookId) {
          query = query.eq('webhook_id', webhookId);
        }

        const { data, error: fetchError } = await query.order('created_at', { ascending: false }).limit(50);

        if (fetchError) {
          throw fetchError;
        }

        const transformedDeliveries: WebhookDelivery[] = (data || []).map((delivery) => ({
          id: delivery.id,
          webhookId: delivery.webhook_id,
          event: delivery.event,
          payload: delivery.payload || {},
          responseStatus: delivery.response_status,
          responseBody: delivery.response_body,
          attempt: delivery.attempt || 1,
          nextRetryAt: delivery.next_retry_at ? new Date(delivery.next_retry_at) : null,
          deliveredAt: delivery.delivered_at ? new Date(delivery.delivered_at) : null,
          createdAt: new Date(delivery.created_at),
          updatedAt: new Date(delivery.updated_at),
        }));

        setDeliveries(transformedDeliveries);
      } catch (err) {
        console.error('Webhook deliveries fetch error:', err);
      }
    },
    [activeTenantId]
  );

  const createEndpoint = useCallback(
    async (endpoint: Omit<WebhookEndpoint, 'id' | 'createdAt' | 'updatedAt' | 'lastTriggeredAt' | 'secret'>): Promise<WebhookEndpoint | null> => {
      if (!activeTenantId || !isSupabaseConfigured()) {
        return null;
      }

      try {
        const sb = getSupabase();

        const { data, error } = await sb
          .from('webhook_endpoints')
          .insert({
            tenant_id: activeTenantId,
            url: endpoint.url,
            description: endpoint.description,
            events: endpoint.events,
            is_active: endpoint.isActive,
            secret: crypto.getRandomValues(new Uint8Array(32)).toString(),
          })
          .select()
          .single();

        if (error) {
          throw error;
        }

        if (data) {
          const newEndpoint: WebhookEndpoint = {
            id: data.id,
            url: data.url,
            description: data.description || '',
            events: data.events || [],
            isActive: data.is_active !== false,
            createdAt: new Date(data.created_at),
            updatedAt: new Date(data.updated_at),
            lastTriggeredAt: data.last_triggered_at ? new Date(data.last_triggered_at) : null,
            secret: data.secret,
          };

          await fetchEndpoints();
          return newEndpoint;
        }
      } catch (err) {
        console.error('Failed to create webhook endpoint:', err);
      }

      return null;
    },
    [activeTenantId, fetchEndpoints]
  );

  const updateEndpoint = useCallback(
    async (id: string, updates: Partial<WebhookEndpoint>): Promise<boolean> => {
      if (!activeTenantId || !isSupabaseConfigured()) {
        return false;
      }

      try {
        const sb = getSupabase();

        const { error } = await sb
          .from('webhook_endpoints')
          .update({
            url: updates.url,
            description: updates.description,
            events: updates.events,
            is_active: updates.isActive,
          })
          .eq('id', id)
          .eq('tenant_id', activeTenantId);

        if (error) {
          throw error;
        }

        await fetchEndpoints();
        return true;
      } catch (err) {
        console.error('Failed to update webhook endpoint:', err);
        return false;
      }
    },
    [activeTenantId, fetchEndpoints]
  );

  const deleteEndpoint = useCallback(
    async (id: string): Promise<boolean> => {
      if (!activeTenantId || !isSupabaseConfigured()) {
        return false;
      }

      try {
        const sb = getSupabase();

        const { error } = await sb
          .from('webhook_endpoints')
          .delete()
          .eq('id', id)
          .eq('tenant_id', activeTenantId);

        if (error) {
          throw error;
        }

        await fetchEndpoints();
        return true;
      } catch (err) {
        console.error('Failed to delete webhook endpoint:', err);
        return false;
      }
    },
    [activeTenantId, fetchEndpoints]
  );

  const retryDelivery = useCallback(
    async (deliveryId: string): Promise<boolean> => {
      if (!activeTenantId || !isSupabaseConfigured()) {
        return false;
      }

      try {
        const sb = getSupabase();

        const { error } = await sb
          .from('webhook_deliveries')
          .update({
            attempt: 1,
            next_retry_at: null,
            response_status: null,
            response_body: null,
          })
          .eq('id', deliveryId)
          .eq('tenant_id', activeTenantId);

        if (error) {
          throw error;
        }

        await fetchDeliveries();
        return true;
      } catch (err) {
        console.error('Failed to retry webhook delivery:', err);
        return false;
      }
    },
    [activeTenantId, fetchDeliveries]
  );

  useEffect(() => {
    void fetchEndpoints();
  }, [fetchEndpoints]);

  return {
    endpoints,
    deliveries,
    loading,
    error,
    createEndpoint,
    updateEndpoint,
    deleteEndpoint,
    retryDelivery,
    refetchEndpoints: fetchEndpoints,
    refetchDeliveries: fetchDeliveries,
  };
}
