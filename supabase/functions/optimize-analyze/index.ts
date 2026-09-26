import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import { Anthropic } from "https://esm.sh/@anthropic-ai/sdk@0.20.6";
import { requireAuthAndTenant } from "../_shared/auth.ts";

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

// Kein Service-Role-Client auf Modulebene mehr. `requireAuthAndTenant` gibt ihn
// erst zurueck, nachdem die Mitgliedschaft geprueft ist — so ist der
// RLS-umgehende Client gar nicht erreichbar, solange der Mandant unbestaetigt
// ist. Der Vertrag von _shared/auth.ts verlangt genau das: "Use service_role
// only AFTER membership in the target tenant is verified."

async function analyzeComplianceTrends(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<RecommendationInput[]> {
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
  supabase: SupabaseClient,
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

  // Sicherheitsrelevanz: Vorher war `body.tenantId` die Autoritaet. Ein
  // beliebiger Aufrufer mit dem oeffentlichen Anon-Key (er liegt im
  // Frontend-Bundle und ist ein gueltiges JWT, das Plattform-verify_jwt also
  // passiert) konnte damit einen fremden Mandanten benennen und
  //   1. dessen compliance_score_history und risk_dashboard_summary lesen —
  //      per Service-Role an RLS vorbei,
  //   2. diese Daten an Anthropic schicken, auf Betreiberrechnung,
  //   3. optimization_recommendations unter dem fremden Mandanten schreiben.
  //
  // Der Leseschritt macht das zu einem Datenabfluss, nicht nur zu einem
  // Fremdschreiben: Compliance-Verlaeufe sind personenbezogen-nah und gehen
  // hier an einen Auftragsverarbeiter (Art. 28 DSGVO, Art. 32 Abs. 1 lit. b —
  // Vertraulichkeit). EU-AI-Act-Bezug: Art. 12 (Protokollierung) und Art. 26
  // (Betreiberpflichten) setzen voraus, dass Governance-Daten dem richtigen
  // Verantwortlichen zugeordnet bleiben.
  //
  // `requireAuthAndTenant` ist der kanonische Resolver aus _shared/auth.ts —
  // derselbe, den website-operations-agent, enterprise-ai-os-agents-run und
  // ai-gateway nutzen. Kein zweiter Auth-Pfad, keine eigene
  // Membership-Abfrage. Der Body-Wert ist ab hier nur noch ein zu pruefender
  // Claim; Autoritaet ist ausschliesslich `auth.tenantId`.
  //
  // Reihenfolge ist Absicht: Diese Pruefung steht vor der ersten Leseabfrage,
  // vor dem Provider-Aufruf und vor dem ersten Write.
  const auth = await requireAuthAndTenant(req, body.tenantId);
  if (auth instanceof Response) return auth;

  const tenantId = auth.tenantId;
  const supabase = auth.admin;

  try {
    const recommendations = await analyzeComplianceTrends(supabase, tenantId);

    if (recommendations.length === 0) {
      return new Response(
        JSON.stringify({ message: "No optimization opportunities identified" }),
        { status: 200 }
      );
    }

    const success = await storeRecommendations(supabase, tenantId, recommendations);

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
