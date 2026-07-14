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
 * API Gateway
 * Handles third-party API requests with authentication, rate limiting, and scope validation
 */
serve(async (req: Request) => {
  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { "Content-Type": "application/json" } }
      );
    }

    // Extract API key from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid Authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const apiKey = authHeader.substring(7); // Remove "Bearer " prefix
    const clientIp = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown";

    // Verify API key
    const { data: keyData, error: keyError } = await supabase.rpc("verify_api_key", {
      p_full_key: apiKey,
    });

    if (keyError || !keyData || !keyData[0] || !keyData[0].valid) {
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const keyInfo = keyData[0];
    const tenantId = keyInfo.tenant_id;
    const scopes = keyInfo.scopes || [];
    const rateLimit = keyInfo.rate_limit_requests || 100;

    // Check IP whitelist (if configured)
    const { data: apiKeyData } = await supabase
      .from("api_keys")
      .select("allowed_ips")
      .like("key_hash", `${apiKey.substring(0, 8)}%`)
      .single();

    if (apiKeyData?.allowed_ips && apiKeyData.allowed_ips.length > 0) {
      if (!apiKeyData.allowed_ips.includes(clientIp)) {
        return new Response(
          JSON.stringify({ error: "IP not allowed" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Parse request
    const body = await req.json();
    const { endpoint, method, data: requestData } = body;

    if (!endpoint || !method) {
      return new Response(
        JSON.stringify({ error: "Missing endpoint or method" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check scope permissions
    const requiredScope = `${endpoint.split("/")[1]}:${method.toLowerCase()}`;
    if (!scopes.includes("*") && !scopes.includes(requiredScope)) {
      return new Response(
        JSON.stringify({ error: `Missing required scope: ${requiredScope}` }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check rate limit
    const now = new Date();
    const startTime = new Date(now.getTime() - (3600 * 1000)); // Last hour

    const { data: usageData, error: usageError } = await supabase
      .from("api_usage")
      .select("id")
      .eq("api_key_id", keyInfo.key_id)
      .gte("created_at", startTime.toISOString())
      .lt("created_at", now.toISOString());

    const requestCount = usageData?.length || 0;
    if (requestCount >= rateLimit) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded", remaining: 0 }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    // Record usage
    const startMs = Date.now();
    const responseTime = Date.now() - startMs;

    await supabase.from("api_usage").insert({
      tenant_id: tenantId,
      api_key_id: keyInfo.key_id,
      method,
      endpoint,
      status_code: 200,
      response_time_ms: responseTime,
      request_size_bytes: JSON.stringify(requestData || {}).length,
      response_size_bytes: 0,
      user_agent: req.headers.get("user-agent"),
      ip_address: clientIp,
    });

    // Route to appropriate handler
    let responseData = {};
    let statusCode = 200;

    switch (endpoint) {
      case "/api/v1/gaps":
        if (method === "GET") {
          const { data: gaps } = await supabase
            .from("compliance_gaps")
            .select("*")
            .eq("tenant_id", tenantId)
            .limit(100);
          responseData = { gaps: gaps || [] };
        } else if (method === "POST") {
          const { data: gap, error: gapError } = await supabase
            .from("compliance_gaps")
            .insert({
              tenant_id: tenantId,
              ...requestData,
            })
            .select()
            .single();
          if (gapError) throw gapError;
          responseData = { gap };
          statusCode = 201;
        }
        break;

      case "/api/v1/reports":
        if (method === "GET") {
          const { data: reports } = await supabase
            .from("governance_reports")
            .select("*")
            .eq("tenant_id", tenantId)
            .limit(50);
          responseData = { reports: reports || [] };
        }
        break;

      case "/api/v1/agents":
        if (method === "GET") {
          const { data: agents } = await supabase
            .from("agents")
            .select("*")
            .eq("tenant_id", tenantId);
          responseData = { agents: agents || [] };
        }
        break;

      default:
        return new Response(
          JSON.stringify({ error: "Endpoint not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify(responseData), {
      status: statusCode,
      headers: {
        "Content-Type": "application/json",
        "X-Rate-Limit-Remaining": String(rateLimit - requestCount - 1),
      },
    });
  } catch (err) {
    console.error("API Gateway error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
