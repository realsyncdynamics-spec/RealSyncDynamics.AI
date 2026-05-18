/**
 * RealSync Dynamics AI — ai-risk-agent Supabase Edge Function
 *
 * Endpoint: POST /functions/v1/ai-risk
 * Auth:     Bearer token (AI_RISK_AGENT_TOKEN env)
 *
 * Request:
 *   { "payload": { ...ai_system_description... } }
 *
 * Response 200:
 *   {
 *     "risk_tier": "minimal" | "limited" | "high" | "prohibited",
 *     "reasons": ["..."],
 *     "raw": { ...model metadata... }
 *   }
 *
 * Error responses:
 *   400 — missing or malformed payload
 *   401 — missing or invalid bearer token
 *   405 — method not allowed (only POST)
 *   500 — classifier error (model failure, schema violation)
 *   503 — upstream config error (missing API key)
 */

// deno-lint-ignore-file no-explicit-any
import { classify, ClassifierError } from "./classifier.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  // Auth
  const expectedToken = Deno.env.get("AI_RISK_AGENT_TOKEN");
  if (!expectedToken) {
    return json({ error: "agent_token_not_configured" }, 503);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "missing_bearer_token" }, 401);
  }
  const presentedToken = authHeader.slice("Bearer ".length).trim();
  if (!timingSafeEqual(presentedToken, expectedToken)) {
    return json({ error: "invalid_bearer_token" }, 401);
  }

  // Parse body
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json_body" }, 400);
  }

  if (!body || typeof body !== "object" || !body.payload || typeof body.payload !== "object") {
    return json({ error: "missing_payload" }, 400);
  }

  // Anthropic API key
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return json({ error: "anthropic_api_key_not_configured" }, 503);
  }

  // Classify
  try {
    const result = await classify(body.payload, apiKey);
    return json(result, 200);
  } catch (e) {
    if (e instanceof ClassifierError) {
      console.error("ClassifierError:", e.message, e.cause ?? "");
      return json(
        {
          error: "classifier_error",
          message: e.message,
          ...(e.cause && typeof e.cause === "object" && "status" in e.cause
            ? { upstream_status: (e.cause as any).status }
            : {}),
        },
        500,
      );
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error("UnexpectedError:", msg);
    return json({ error: "internal_error", message: msg }, 500);
  }
});
