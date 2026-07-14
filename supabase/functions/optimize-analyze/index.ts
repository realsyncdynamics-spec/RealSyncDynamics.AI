import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import { Anthropic } from "https://esm.sh/@anthropic-ai/sdk@0.20.6";

interface RequestBody {
  tenantId: string;
  analysisType?: "risk_trends" | "policy_gaps" | "audit_efficiency" | "vendor_health" | "full";
}

interface RecommendationInput {
  tenantId: string;
  category: string;
  title: string;
  description: string;
  impactScore: number;
  implementationEffort: number;
  estimatedSavingsMonthly?: number;
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

async function analyzeComplianceTrends(tenantId: string): Promise<RecommendationInput[]> {
  // Fetch compliance history for the tenant
  const { data: scores } = await supabase
    .from("compliance_score_history")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("recorded_at", { ascending: false })
    .limit(24); // Last 24 months

  const { data: risks } = await supabase
    .from("risk_dashboard_summary")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("recorded_at", { ascending: false })
    .limit(12);

  // Use Claude to analyze trends and generate recommendations
  const anthropic = new Anthropic({
    apiKey: Deno.env.get("ANTHROPIC_API_KEY"),
  });

  const scoresText = scores?.map((s) => `${s.recorded_at}: Overall=${s.score_overall}, GDPR=${s.score_gdpr || "N/A"}`).join("\n") || "No data";
  const risksText = risks?.map((r) => `${r.recorded_at}: Critical=${r.critical_risks_count}, High=${r.high_risks_count}`).join("\n") || "No data";

  const message = await anthropic.messages.create({
    model: "claude-opus-4-1-20250805",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `Analyze these compliance trends and suggest 2-3 specific optimizations:

Compliance Score History (last 24 months):
${scoresText}

Risk Metrics History (last 12 months):
${risksText}

For each recommendation, provide JSON with: category (policy_tightening|risk_mitigation|audit_optimization|vendor_management|framework_alignment), title, description, impactScore (0-100), implementationEffort (1-5), estimatedSavingsMonthly (optional).

Return ONLY a JSON array of recommendations, no other text.`,
      },
    ],
  });

  try {
    const content = message.content[0];
    if (content.type === "text") {
      // Parse JSON from response
      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
  } catch (error) {
    console.error("Failed to parse Claude response:", error);
  }

  return [];
}

async function storeRecommendations(
  tenantId: string,
  recommendations: RecommendationInput[]
): Promise<boolean> {
  const { error } = await supabase
    .from("optimization_recommendations")
    .insert(
      recommendations.map((rec) => ({
        tenant_id: tenantId,
        category: rec.category,
        title: rec.title,
        description: rec.description,
        impact_score: rec.impactScore,
        implementation_effort: rec.implementationEffort,
        estimated_savings_monthly: rec.estimatedSavingsMonthly,
        status: "pending",
      }))
    );

  return !error;
}

async function handleRequest(req: Request): Promise<Response> {
  const body = (await req.json()) as RequestBody;
  const { tenantId, analysisType = "full" } = body;

  if (!tenantId) {
    return new Response(JSON.stringify({ error: "tenantId required" }), {
      status: 400,
    });
  }

  try {
    const recommendations = await analyzeComplianceTrends(tenantId);

    if (recommendations.length === 0) {
      return new Response(
        JSON.stringify({ message: "No optimization opportunities identified" }),
        { status: 200 }
      );
    }

    const success = await storeRecommendations(tenantId, recommendations);

    if (!success) {
      throw new Error("Failed to store recommendations");
    }

    return new Response(
      JSON.stringify({
        success: true,
        recommendationsCount: recommendations.length,
        recommendations,
      }),
      { status: 201 }
    );
  } catch (error) {
    console.error("Optimization analysis error:", error);
    return new Response(JSON.stringify({ error: "Analysis failed" }), {
      status: 500,
    });
  }
}

Deno.serve(handleRequest);
