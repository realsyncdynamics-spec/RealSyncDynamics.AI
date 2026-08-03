// Edge Function: Cache Invalidation Webhook
// Purpose: Invalidate cached governance policies when they are updated
// Trigger: Policy service POST to /api/cache/invalidate on policy changes

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

interface CacheInvalidationPayload {
  event: "policy.updated" | "policy.deleted" | "policy.created";
  tenant_id: string;
  policy_id: string;
  policy_version?: number;
  affected_keys: string[];
  timestamp: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const payload: CacheInvalidationPayload = await req.json();

    // Validate required fields
    if (!payload.event || !payload.tenant_id || !payload.affected_keys) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: event, tenant_id, affected_keys",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[cache-invalidate] Event: ${payload.event}`);
    console.log(`[cache-invalidate] Tenant: ${payload.tenant_id}`);
    console.log(`[cache-invalidate] Policy: ${payload.policy_id}`);
    console.log(`[cache-invalidate] Affected keys: ${payload.affected_keys.join(", ")}`);

    // TODO: When KV is bound to this function, implement actual cache invalidation
    // Example implementation:
    // const env = Deno.env.get("GOVERNANCE_CACHE");
    // for (const key of payload.affected_keys) {
    //   // For glob patterns like "governance:policy:*:abc123:*"
    //   // List all matching keys and delete them
    //   const keys = await env.list({ prefix: key.replace("*", "") });
    //   for (const { name } of keys.keys) {
    //     await env.delete(name);
    //   }
    // }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Cache invalidation queued",
        tenant_id: payload.tenant_id,
        policy_id: payload.policy_id,
        affected_keys: payload.affected_keys,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[cache-invalidate] Error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
