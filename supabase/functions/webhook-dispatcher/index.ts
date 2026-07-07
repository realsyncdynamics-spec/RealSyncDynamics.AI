import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

/**
 * Webhook Dispatcher
 * Delivers events to subscribed webhooks with HMAC signing and retry logic
 */
serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405 }
      );
    }

    const { tenantId, eventType, eventId, payload, subscriptionIds } = await req.json();

    if (!tenantId || !eventType || !payload) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400 }
      );
    }

    // Get active subscriptions for this tenant and event type
    let query = supabase
      .from("webhook_subscriptions")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("active", true);

    if (subscriptionIds && subscriptionIds.length > 0) {
      query = query.in("id", subscriptionIds);
    }

    const { data: subscriptions, error: subError } = await query;

    if (subError) throw subError;

    const results = [];

    for (const subscription of subscriptions || []) {
      try {
        // Check if subscription matches event type
        if (!subscription.events.includes(eventType) && !subscription.events.includes("*")) {
          continue;
        }

        // Check filter criteria
        if (subscription.filter_criteria && Object.keys(subscription.filter_criteria).length > 0) {
          const criteria = subscription.filter_criteria;
          let matches = true;
          for (const [key, value] of Object.entries(criteria)) {
            if (payload[key] !== value) {
              matches = false;
              break;
            }
          }
          if (!matches) continue;
        }

        // Create webhook delivery record
        const { data: delivery, error: deliveryError } = await supabase
          .from("webhook_deliveries")
          .insert({
            subscription_id: subscription.id,
            tenant_id: tenantId,
            event_type: eventType,
            event_id: eventId,
            payload,
            status: "pending",
          })
          .select()
          .single();

        if (deliveryError) throw deliveryError;

        // Dispatch webhook with HMAC signature
        const success = await dispatchWebhook(subscription, delivery.id, payload);

        if (success) {
          results.push({ subscription_id: subscription.id, status: "sent" });
        } else {
          results.push({ subscription_id: subscription.id, status: "pending_retry" });
        }
      } catch (err) {
        console.error(`Error processing subscription ${subscription.id}:`, err);
        results.push({
          subscription_id: subscription.id,
          status: "error",
          error: String(err),
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        event_type: eventType,
        subscriptions_processed: results.length,
        results,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Webhook dispatcher error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

/**
 * Dispatch webhook to endpoint with HMAC-SHA256 signature
 */
async function dispatchWebhook(
  subscription: any,
  deliveryId: string,
  payload: any
): Promise<boolean> {
  try {
    // Generate HMAC-SHA256 signature
    const secretKey = new TextEncoder().encode(subscription.secret);
    const message = new TextEncoder().encode(JSON.stringify(payload));
    const cryptoKey = await globalThis.crypto.subtle.importKey(
      "raw",
      secretKey,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await globalThis.crypto.subtle.sign("HMAC", cryptoKey, message);
    const signatureHex = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Send webhook
    const response = await fetch(subscription.endpoint_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signatureHex,
        "X-Webhook-Delivery-ID": deliveryId,
      },
      body: JSON.stringify(payload),
    });

    // Record delivery result
    await supabase.from("webhook_deliveries").update({
      status: response.ok ? "sent" : "failed",
      http_status_code: response.status,
      response_body: await response.text(),
      sent_at: new Date().toISOString(),
    }).eq("id", deliveryId);

    return response.ok;
  } catch (err) {
    // Record failed delivery
    const nextRetry = new Date();
    nextRetry.setSeconds(nextRetry.getSeconds() + 300); // 5 minute retry delay

    const { data: delivery } = await supabase
      .from("webhook_deliveries")
      .select("attempt")
      .eq("id", deliveryId)
      .single();

    await supabase.from("webhook_deliveries").update({
      status: "failed",
      attempt: (delivery?.attempt || 0) + 1,
      next_retry_at: nextRetry.toISOString(),
      last_error: String(err),
    }).eq("id", deliveryId);

    return false;
  }
}
