import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { crypto } from 'https://deno.land/std@0.208.0/crypto/mod.ts';

interface WebhookPayload {
  tenantId: string;
  eventType: string;
  data: Record<string, unknown>;
  timestamp: string;
}

interface WebhookEndpoint {
  id: string;
  url: string;
  signingSecret: string;
  events: string[];
  active: boolean;
  retryPolicy: 'exponential' | 'linear' | 'once';
}

async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const secretKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    secretKey,
    encoder.encode(payload)
  );

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function deliverWebhook(
  endpoint: WebhookEndpoint,
  payload: WebhookPayload,
  retryCount: number = 0
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const payloadJson = JSON.stringify(payload);
  const signature = await signPayload(payloadJson, endpoint.signingSecret);

  const headers = {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': `sha256=${signature}`,
    'X-Webhook-Id': endpoint.id,
    'X-Webhook-Event': payload.eventType,
    'X-Webhook-Timestamp': payload.timestamp,
  };

  try {
    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers,
      body: payloadJson,
      signal: AbortSignal.timeout(30000), // 30s timeout
    });

    const success = response.ok;

    if (success) {
      return { success: true, statusCode: response.status };
    } else {
      // Determine if should retry
      const shouldRetry = response.status >= 500 && retryCount < 5;

      if (shouldRetry) {
        // Schedule retry
        const delay = endpoint.retryPolicy === 'exponential'
          ? Math.min(1000 * Math.pow(2, retryCount), 60000)
          : 5000;

        setTimeout(() => {
          deliverWebhook(endpoint, payload, retryCount + 1);
        }, delay);
      }

      return {
        success: false,
        statusCode: response.status,
        error: `HTTP ${response.status}`,
      };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Retry on network errors for exponential policy
    if (endpoint.retryPolicy !== 'once' && retryCount < 5) {
      const delay = endpoint.retryPolicy === 'exponential'
        ? Math.min(1000 * Math.pow(2, retryCount), 60000)
        : 5000;

      setTimeout(() => {
        deliverWebhook(endpoint, payload, retryCount + 1);
      }, delay);
    }

    return { success: false, error: errorMsg };
  }
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  );

  try {
    const payload: WebhookPayload = await req.json();

    // Fetch active webhook endpoints for this tenant and event type
    const { data: endpoints, error: fetchError } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .eq('tenant_id', payload.tenantId)
      .eq('active', true)
      .contains('events', [payload.eventType]);

    if (fetchError) {
      console.error('Failed to fetch endpoints:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch endpoints' }),
        { status: 500 }
      );
    }

    // Deliver to each endpoint
    const deliveryResults = await Promise.all(
      (endpoints || []).map(async (endpoint: WebhookEndpoint) => {
        const result = await deliverWebhook(endpoint, payload);

        // Log delivery
        await supabase.from('webhook_deliveries').insert({
          tenant_id: payload.tenantId,
          endpoint_id: endpoint.id,
          event_type: payload.eventType,
          status: result.success ? 'success' : 'failed',
          status_code: result.statusCode,
          payload: payload.data,
          response_body: result.error,
          sent_at: new Date().toISOString(),
          retry_count: 0,
        });

        return result;
      })
    );

    const successCount = deliveryResults.filter((r) => r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        delivered: successCount,
        total: deliveryResults.length,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Webhook dispatcher error:', errorMsg);

    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
