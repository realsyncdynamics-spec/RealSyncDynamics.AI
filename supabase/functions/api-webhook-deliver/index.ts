import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

/**
 * Webhook Delivery Function
 *
 * Scheduled to run every 5 minutes
 * Processes pending webhook deliveries with exponential backoff retry logic
 */

interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  attempt_number: number;
  created_at: string;
}

interface WebhookEndpoint {
  id: string;
  url: string;
  secret_key: string;
  max_retries: number;
}

const MAX_PAYLOAD_SIZE = 1024 * 1024; // 1MB
const DELIVERY_TIMEOUT = 10000; // 10 seconds
const MAX_CONCURRENT_DELIVERIES = 10;

serve(async () => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Fetch pending deliveries
    const { data: pendingDeliveries, error: fetchErr } = await supabase
      .from('webhook_deliveries')
      .select('*')
      .is('delivered_at', null)
      .or('next_retry_at.is.null,next_retry_at.lte.now()')
      .order('created_at', { ascending: true })
      .limit(100);

    if (fetchErr) {
      throw fetchErr;
    }

    if (!pendingDeliveries || pendingDeliveries.length === 0) {
      return new Response(
        JSON.stringify({ success: true, delivered: 0, message: 'No pending deliveries' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Process deliveries concurrently
    const deliveryPromises = pendingDeliveries
      .slice(0, MAX_CONCURRENT_DELIVERIES)
      .map(delivery => processDelivery(supabase, delivery as WebhookDelivery));

    const results = await Promise.allSettled(deliveryPromises);

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return new Response(
      JSON.stringify({
        success: true,
        processed: pendingDeliveries.length,
        successful,
        failed,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Webhook delivery error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

async function processDelivery(supabase: any, delivery: WebhookDelivery): Promise<void> {
  try {
    // Fetch webhook endpoint
    const { data: webhook, error: webhookErr } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .eq('id', delivery.webhook_id)
      .single();

    if (webhookErr || !webhook) {
      throw new Error('Webhook endpoint not found');
    }

    // Generate signature
    const signature = await generateSignature(delivery.event_data, webhook.secret_key);

    // Prepare payload
    const payload = JSON.stringify(delivery.event_data);
    if (payload.length > MAX_PAYLOAD_SIZE) {
      throw new Error('Payload too large');
    }

    // Send webhook with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT);

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-ID': delivery.webhook_id,
          'X-Event-Type': delivery.event_type,
          'X-Delivery-ID': delivery.id,
        },
        body: payload,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();

      if (response.ok) {
        // Mark as delivered
        await supabase
          .from('webhook_deliveries')
          .update({
            status_code: response.status,
            response_body: responseText.slice(0, 1000), // Store first 1KB
            delivered_at: new Date().toISOString(),
          })
          .eq('id', delivery.id);
      } else {
        // Retry logic
        await handleDeliveryFailure(supabase, delivery, webhook, response.status, responseText);
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      const errorMsg = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      await handleDeliveryFailure(supabase, delivery, webhook, null, errorMsg);
    }
  } catch (error) {
    console.error(`Failed to process delivery ${delivery.id}:`, error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    // Log error and don't retry
    await supabase
      .from('webhook_deliveries')
      .update({
        error_message: errorMsg,
        delivered_at: new Date().toISOString(), // Mark as delivered to stop retries
      })
      .eq('id', delivery.id);
  }
}

async function handleDeliveryFailure(
  supabase: any,
  delivery: WebhookDelivery,
  webhook: WebhookEndpoint,
  statusCode: number | null,
  responseBody: string
): Promise<void> {
  const nextAttempt = delivery.attempt_number + 1;
  const maxRetries = webhook.max_retries || 3;

  if (nextAttempt <= maxRetries) {
    // Calculate exponential backoff: 2^attempt minutes
    const backoffMinutes = Math.pow(2, nextAttempt);
    const nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();

    await supabase
      .from('webhook_deliveries')
      .update({
        status_code: statusCode,
        response_body: responseBody.slice(0, 1000),
        error_message: `Delivery failed (attempt ${delivery.attempt_number}/${maxRetries})`,
        attempt_number: nextAttempt,
        next_retry_at: nextRetryAt,
      })
      .eq('id', delivery.id);
  } else {
    // Max retries exceeded - mark as delivered to stop
    await supabase
      .from('webhook_deliveries')
      .update({
        status_code: statusCode,
        response_body: responseBody.slice(0, 1000),
        error_message: `Delivery failed after ${maxRetries} retries`,
        delivered_at: new Date().toISOString(),
      })
      .eq('id', delivery.id);
  }
}

async function generateSignature(payload: Record<string, unknown>, secretKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const payloadStr = JSON.stringify(payload);
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadStr));
  const signatureArray = Array.from(new Uint8Array(signature));
  return 'sha256=' + signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
