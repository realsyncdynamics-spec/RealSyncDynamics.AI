// Governance Agents Discovery API
//
// Public read-only endpoint for listing available agents
// in a tenant's governance runtime. Used by:
//   - SPA agent selector UI (governance dashboard)
//   - Governance orchestrator (agent routing)
//   - Agent discovery/audit
//
// Query params:
//   ?status=active|archived|deprecated (default: active)
//   ?capability=policy_evaluation,remediation (filter by any)
//   ?runtime=deno|node|python (optional filter)

import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

interface AgentListRow {
  id: string;
  agent_name: string;
  description: string | null;
  version: string;
  status: string;
  capabilities: string[];
  runtime: string | null;
  metadata: Record<string, unknown>;
}

async function listAgents(
  tenantId: string,
  status: string = "active",
  capabilities: string[] = [],
  runtime?: string,
): Promise<AgentListRow[]> {
  const client = createClient(supabaseUrl, supabaseKey);

  let query = client
    .from("governance_agent_registry")
    .select("id, agent_name, description, version, status, capabilities, runtime, metadata")
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`) // tenant + global
    .eq("status", status);

  if (runtime) {
    query = query.eq("runtime", runtime);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Query failed: ${error.message}`);
  }

  const rows = (data || []) as AgentListRow[];

  // Filter by capabilities (if any) — agent must have at least one match
  if (capabilities.length > 0) {
    return rows.filter((row) =>
      capabilities.some((cap) => row.capabilities?.includes(cap))
    );
  }

  return rows;
}

Deno.serve(async (req) => {
  // CORS headers
  if (req.method === "OPTIONS") {
    return new Response("OK", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const tenantId = url.searchParams.get("tenant_id");
    const status = url.searchParams.get("status") || "active";
    const capabilities = url.searchParams.get("capability")?.split(",") || [];
    const runtime = url.searchParams.get("runtime") || undefined;

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: "tenant_id is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const agents = await listAgents(tenantId, status, capabilities, runtime);

    return new Response(JSON.stringify({ agents, count: agents.length }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Failed to list agents:", error);
    return new Response(
      JSON.stringify({
        error: `Failed to list agents: ${error instanceof Error ? error.message : String(error)}`,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
