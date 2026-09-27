import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface InvalidateRequest {
  event_type: string;
  tenant_id: string;
  policy_id?: string;
  pattern?: string;
}

interface InvalidateResponse {
  success: boolean;
  message: string;
  invalidated_count?: number;
  error?: string;
}

async function invalidatePolicyCachePattern(
  pattern: string,
  kv: KVNamespace
): Promise<number> {
  let invalidated = 0;

  // Pattern matching: governance:policy:tenant_id:*
  const keys = await kv.list({ prefix: `governance:policy:${pattern}` });

  for (const key of keys.keys) {
    await kv.delete(key.name);
    invalidated++;
  }

  return invalidated;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const payload = (await req.json()) as InvalidateRequest;

    const kv = Deno.env.get("GOVERNANCE_CACHE") as unknown as KVNamespace;

    if (!kv) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "KV namespace binding not configured",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let invalidated = 0;

    if (payload.event_type === "policy.updated") {
      const pattern = payload.pattern || payload.policy_id;
      if (pattern) {
        invalidated = await invalidatePolicyCachePattern(pattern, kv);
      }
    } else if (payload.event_type === "policy.deleted") {
      const pattern = `${payload.tenant_id}:${payload.policy_id}`;
      invalidated = await invalidatePolicyCachePattern(pattern, kv);
    } else if (payload.event_type === "policy.created") {
      // No cache to invalidate on creation (first request will cache)
      invalidated = 0;
    }

    const response: InvalidateResponse = {
      success: true,
      message: `Invalidated ${invalidated} cache entries`,
      invalidated_count: invalidated,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        scope: "cache_invalidation_failed",
        error: error instanceof Error ? error.message : String(error),
      })
    );

    const response: InvalidateResponse = {
      success: false,
      message: "Cache invalidation failed",
      error: "Internal server error",
    };

    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
