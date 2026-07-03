/**
 * Policy-Pack Recommender — Intelligent Empfehlung basierend auf:
 * - Tenant-Industrie
 * - Asset-Klassifikation (AI-Act)
 * - Datentypen (PII, Healthcare, etc.)
 * - Framework-Lücken
 */

export interface PolicyPackRecommendation {
  packId: string;
  packName: string;
  framework: string;
  confidence: number; // 0–100
  reason: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface AssetClassification {
  assetType: string;
  aiActClass: string;
  dataTypes: string[];
  tenantIndustry?: string;
  hasGaps?: { framework: string; gapCount: number }[];
}

/**
 * Recommend policy packs based on asset & tenant profile.
 */
export function recommendPolicyPacks(asset: AssetClassification): PolicyPackRecommendation[] {
  const recommendations: PolicyPackRecommendation[] = [];

  // 1. EU AI Act — High-risk systems
  const isHighRiskAi = asset.aiActClass === 'high' || asset.aiActClass === 'prohibited';
  if (isHighRiskAi) {
    recommendations.push({
      packId: 'pack-eu-ai-act-high-risk',
      packName: 'EU AI Act — High-Risk Systems',
      framework: 'EU_AI_ACT',
      confidence: 100,
      reason: `Asset classified as ${asset.aiActClass}-risk KI-System — EU-AI-Act High-Risk Controls erforderlich.`,
      priority: 'critical',
    });
  }

  // 2. GDPR — PII/Special Categories
  const hasPii = asset.dataTypes.some((dt) =>
    ['pii', 'personal', 'customer', 'employee', 'email', 'phone', 'address'].some((h) => dt.toLowerCase().includes(h)),
  );
  const hasSpecialCategories = asset.dataTypes.some((dt) =>
    ['health', 'diagnosis', 'genetic', 'biometric', 'race', 'religion', 'political'].some((h) =>
      dt.toLowerCase().includes(h),
    ),
  );

  if (hasSpecialCategories) {
    recommendations.push({
      packId: 'pack-gdpr-art9',
      packName: 'DSGVO — Art. 9 Special Categories',
      framework: 'GDPR',
      confidence: 100,
      reason: 'Asset verarbeitet besondere Kategorien gem. DSGVO Art. 9 — strikte Compliance erforderlich.',
      priority: 'critical',
    });
  } else if (hasPii) {
    recommendations.push({
      packId: 'pack-gdpr-standard',
      packName: 'DSGVO — Standard Data Protection',
      framework: 'GDPR',
      confidence: 95,
      reason: 'Asset verarbeitet personenbezogene Daten — DSGVO Standard-Controls aktivieren.',
      priority: 'high',
    });
  }

  // 3. Industry-Specific
  const industry = asset.tenantIndustry?.toLowerCase() ?? '';

  if (industry.includes('healthcare') || industry.includes('medical') || industry.includes('pharma')) {
    recommendations.push({
      packId: 'pack-healthcare-gdpr',
      packName: 'Healthcare-spezifische DSGVO',
      framework: 'HEALTHCARE',
      confidence: 90,
      reason: 'Healthcare-Tenant mit regulatorischen Anforderungen — spezialisierte Controls empfohlen.',
      priority: 'high',
    });

    if (isHighRiskAi) {
      recommendations.push({
        packId: 'pack-healthcare-ai',
        packName: 'KI in Healthcare — Risk-Management',
        framework: 'HEALTHCARE',
        confidence: 100,
        reason: 'Hochrisiko-KI in Healthcare-Kontext — intensive Governance erforderlich.',
        priority: 'critical',
      });
    }
  }

  if (industry.includes('finance') || industry.includes('banking') || industry.includes('insurance')) {
    recommendations.push({
      packId: 'pack-finance-compliance',
      packName: 'Finanzbranche — Compliance-Essentials',
      framework: 'FINANCE',
      confidence: 85,
      reason: 'Finance-Tenant — spezialisierte Compliance-Anforderungen aktivieren.',
      priority: 'high',
    });
  }

  if (industry.includes('legal') || industry.includes('jura') || industry.includes('anwalt')) {
    recommendations.push({
      packId: 'pack-legal-privilege',
      packName: 'Anwaltliche Verschwiegenheit & Privileg',
      framework: 'LEGAL',
      confidence: 90,
      reason: 'Legal-Tenant — Datenschutz und Privileg-Management kritisch.',
      priority: 'high',
    });
  }

  // 4. Framework Gap Analysis
  if (asset.hasGaps && asset.hasGaps.length > 0) {
    const largestGap = asset.hasGaps.reduce((max, g) => (g.gapCount > max.gapCount ? g : max));
    recommendations.push({
      packId: `pack-gap-filler-${largestGap.framework.toLowerCase()}`,
      packName: `${largestGap.framework} — Gap Filler (${largestGap.gapCount} Lücken)`,
      framework: largestGap.framework,
      confidence: 75 + Math.min(largestGap.gapCount * 5, 20), // Max 95
      reason: `${largestGap.gapCount} offene Controls in ${largestGap.framework} — priorisierte Behandlung.`,
      priority: largestGap.gapCount > 5 ? 'high' : 'medium',
    });
  }

  // Sort by priority + confidence
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  return recommendations.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    return priorityDiff !== 0 ? priorityDiff : b.confidence - a.confidence;
  });
}

/**
 * Auto-activate recommended packs (für onboarding workflow).
 */
export async function autoActivateRecommendedPacks(
  admin: any, // Supabase admin client
  tenantId: string,
  assetId: string,
  recommendations: PolicyPackRecommendation[],
): Promise<{ activated: number; failed: string[] }> {
  let activated = 0;
  const failed: string[] = [];

  // Nur critical + high priority
  const toActivate = recommendations.filter((r) => ['critical', 'high'].includes(r.priority));

  for (const rec of toActivate) {
    try {
      // Insert in asset_policy_pack_mappings
      const { error } = await admin.from('asset_policy_pack_mappings').insert({
        asset_id: assetId,
        policy_pack_id: rec.packId,
        status: 'enabled',
        auto_activated: true,
        activated_at: new Date(),
      });

      if (error) throw error;
      activated++;

      // Log to audit
      await admin.from('governance_admin_audit_log').insert({
        tenant_id: tenantId,
        action: 'policy_pack.auto_activate',
        resource_type: 'asset_policy_pack_mapping',
        resource_id: rec.packId,
        payload: { asset_id: assetId, recommendation: rec.reason },
        created_at: new Date(),
      });
    } catch (err) {
      failed.push(rec.packId);
    }
  }

  return { activated, failed };
}
