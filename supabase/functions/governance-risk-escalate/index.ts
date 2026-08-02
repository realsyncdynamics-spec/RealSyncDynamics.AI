// Governance Risk Escalation Handler
//
// Triggered when a HIGH or CRITICAL event requires auto-escalation:
//   - Create governance_incidents record
//   - Optionally dispatch to incident-handling workflow (n8n)
//   - Return escalation decision for caller to log
//
// Caller responsibility: only invoke when risk escalation is confirmed.

import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const client = createClient(supabaseUrl, supabaseKey);

export interface EscalationRequest {
  tenant_id: string;
  event_id: string;
  asset_id?: string;
  risk_level: "high" | "critical";
  escalation_source: "policy" | "risk_threshold";
  policy_id?: string;
  threshold_id?: string;
  summary: string;
  dispatch_incident: boolean;
}

export interface EscalationResponse {
  incident_id?: string;
  status: string;
  message: string;
}

async function escalateRisk(
  req: EscalationRequest,
): Promise<EscalationResponse> {
  const {
    tenant_id,
    event_id,
    asset_id,
    risk_level,
    escalation_source,
    policy_id,
    threshold_id,
    summary,
    dispatch_incident,
  } = req;

  try {
    // Create governance_incidents record
    const { data: incident, error: insertError } = await client
      .from("governance_incidents")
      .insert({
        tenant_id,
        event_id,
        asset_id: asset_id || null,
        risk_level,
        escalation_source,
        policy_id: policy_id || null,
        threshold_id: threshold_id || null,
        status: "open",
        priority: risk_level === "critical" ? "critical" : "high",
        summary,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Failed to create incident:", insertError);
      return {
        status: "error",
        message: `Failed to create incident: ${insertError.message}`,
      };
    }

    // If dispatch_incident is true, trigger n8n workflow
    if (dispatch_incident && incident) {
      const n8nWebhook = Deno.env.get("N8N_GOVERNANCE_INCIDENT_WEBHOOK");
      if (n8nWebhook) {
        try {
          const webhookResponse = await fetch(n8nWebhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              incident_id: incident.id,
              tenant_id,
              event_id,
              risk_level,
              priority: risk_level === "critical" ? "critical" : "high",
              summary,
              timestamp: new Date().toISOString(),
            }),
          });

          if (!webhookResponse.ok) {
            console.warn(
              `n8n dispatch returned ${webhookResponse.status}, continuing`,
            );
          }
        } catch (e) {
          console.warn("n8n dispatch failed (non-blocking):", e);
        }
      }
    }

    return {
      incident_id: incident?.id,
      status: "success",
      message: `Incident ${incident?.id} created for ${risk_level} event`,
    };
  } catch (error) {
    console.error("Escalation failed:", error);
    return {
      status: "error",
      message: `Escalation error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// Edge Function handler for direct POST
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    const result = await escalateRisk(body as EscalationRequest);
    return new Response(JSON.stringify(result), {
      status: result.status === "success" ? 200 : 500,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Request parsing failed:", error);
    return new Response(
      JSON.stringify({
        status: "error",
        message: `Invalid request: ${error instanceof Error ? error.message : String(error)}`,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
});

// Export for use by other Edge Functions
export { escalateRisk };
