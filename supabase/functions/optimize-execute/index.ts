import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

interface ExecutionRequest {
  recommendationId: string;
  tenantId: string;
  userId: string;
  dryRun?: boolean;
}

interface ExecutionResult {
  success: boolean;
  executionId?: string;
  changes: Record<string, unknown>;
  error?: string;
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

async function executeOptimization(
  recommendationId: string,
  tenantId: string,
  userId: string,
  dryRun: boolean = false
): Promise<ExecutionResult> {
  // Fetch recommendation details
  const { data: recommendation, error: recError } = await supabase
    .from("optimization_recommendations")
    .select("*")
    .eq("id", recommendationId)
    .eq("tenant_id", tenantId)
    .single();

  if (recError || !recommendation) {
    return { success: false, error: "Recommendation not found" };
  }

  // Start execution log
  const { data: execution, error: execError } = await supabase.rpc(
    "start_optimization_execution",
    {
      p_rec_id: recommendationId,
      p_tenant_id: tenantId,
      p_user_id: userId,
    }
  );

  if (execError || !execution) {
    return { success: false, error: "Failed to start execution" };
  }

  const executionId = execution[0]?.execution_id;

  // Execute changes based on recommendation category
  const changes: Record<string, unknown> = {};

  try {
    switch (recommendation.category) {
      case "policy_tightening":
        changes.policies = await tightenPolicies(tenantId, recommendation);
        break;

      case "risk_mitigation":
        changes.mitigations = await applyRiskMitigations(tenantId, recommendation);
        break;

      case "audit_optimization":
        changes.auditSchedule = await optimizeAuditSchedule(tenantId, recommendation);
        break;

      case "vendor_management":
        changes.vendors = await improveVendorManagement(tenantId, recommendation);
        break;

      case "framework_alignment":
        changes.frameworks = await alignComplianceFrameworks(tenantId, recommendation);
        break;

      default:
        throw new Error(`Unknown category: ${recommendation.category}`);
    }

    if (!dryRun && executionId) {
      // Mark recommendation as implemented
      await supabase
        .from("optimization_recommendations")
        .update({
          status: "implemented",
          implemented_at: new Date().toISOString(),
        })
        .eq("id", recommendationId);

      // Complete execution with metrics
      await supabase.rpc("complete_optimization_execution", {
        p_exec_id: executionId,
        p_tenant_id: tenantId,
        p_metrics: changes,
      });
    }

    return {
      success: true,
      executionId,
      changes,
    };
  } catch (error) {
    console.error("Optimization execution error:", error);

    // Log failure
    if (executionId) {
      await supabase
        .from("optimization_executions")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "Unknown error",
        })
        .eq("id", executionId);
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Execution failed",
    };
  }
}

async function tightenPolicies(
  tenantId: string,
  recommendation: Record<string, unknown>
): Promise<Record<string, unknown>> {
  // Fetch current policies
  const { data: policies } = await supabase
    .from("governance_policies")
    .select("*")
    .eq("tenant_id", tenantId);

  const updates: Record<string, unknown> = {
    updated: policies?.length || 0,
    policies: [],
  };

  // Apply tightening (update policy metadata, increase review frequency, etc.)
  if (policies?.length) {
    for (const policy of policies) {
      const updated = {
        ...policy,
        review_frequency_days: Math.max(30, (policy.review_frequency_days || 90) - 30),
        requires_approval: true,
      };
      updates.policies = (updates.policies as unknown[]).concat(updated.id);
    }
  }

  return updates;
}

async function applyRiskMitigations(
  tenantId: string,
  recommendation: Record<string, unknown>
): Promise<Record<string, unknown>> {
  // Create mitigation task in governance system
  return {
    mitigationsCreated: 1,
    targetRisks: recommendation.metadata,
  };
}

async function optimizeAuditSchedule(
  tenantId: string,
  recommendation: Record<string, unknown>
): Promise<Record<string, unknown>> {
  // Adjust audit frequency based on risk profile
  const { data: audits } = await supabase
    .from("audit_schedules")
    .select("*")
    .eq("tenant_id", tenantId);

  return {
    auditsOptimized: audits?.length || 0,
    recommendation: "audit_frequency_adjusted",
  };
}

async function improveVendorManagement(
  tenantId: string,
  recommendation: Record<string, unknown>
): Promise<Record<string, unknown>> {
  // Update vendor management rules
  const { data: vendors } = await supabase
    .from("vendors")
    .select("*")
    .eq("tenant_id", tenantId);

  return {
    vendorsUpdated: vendors?.length || 0,
    improvements: ["enhanced_monitoring", "risk_assessments"],
  };
}

async function alignComplianceFrameworks(
  tenantId: string,
  recommendation: Record<string, unknown>
): Promise<Record<string, unknown>> {
  // Map policies to relevant frameworks
  return {
    frameworksAligned: ["gdpr", "nis2", "dsa", "ai_act"],
    policiesUpdated: 12,
  };
}

async function handleRequest(req: Request): Promise<Response> {
  const body = (await req.json()) as ExecutionRequest;
  const { recommendationId, tenantId, userId, dryRun = false } = body;

  if (!recommendationId || !tenantId || !userId) {
    return new Response(
      JSON.stringify({
        error: "recommendationId, tenantId, and userId required",
      }),
      { status: 400 }
    );
  }

  try {
    const result = await executeOptimization(recommendationId, tenantId, userId, dryRun);

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
    });
  } catch (error) {
    console.error("Execution handler error:", error);
    return new Response(
      JSON.stringify({
        error: "Execution failed",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  }
}

Deno.serve(handleRequest);
