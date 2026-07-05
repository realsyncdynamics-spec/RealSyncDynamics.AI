import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Loader2, CheckCircle2, AlertTriangle, TrendingUp, Zap,
  Brain, Lock, Clock, Shield, ChevronRight, Download,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { tierById, type TierId } from '../../config/pricing';
import { getRecommendedTierForFeatures, GOVERNANCE_FEATURES } from '../../config/governance-features';

interface WorkflowAnalysis {
  ai_usage: string;
  personal_data: string;
  external_vendors: string;
  critical_processes: string;
  incidents: string;
  dsgvo_docs: string;
  isms_in_place: string;
  iso_certs: string;
}

interface RecommendationResult {
  recommendedTier: TierId;
  confidence: number;
  reasoning: string[];
  requiredFeatures: string[];
  estimatedMonthlyUsers: number;
  estimatedCost: number;
  nextSteps: string[];
}

export function GovernanceWorkflowRecommendation() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

function Inner() {
  const { activeTenantId } = useTenant();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<WorkflowAnalysis | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendationResult | null>(null);

  useEffect(() => {
    const loadAndAnalyze = async () => {
      if (!activeTenantId) return;
      setLoading(true);
      setError(null);

      try {
        // Fetch workflow data
        const response = await fetch(
          `/functions/v1/governance-resources?tenant_id=${activeTenantId}&resource_type=workflow_state`,
          { headers: { Authorization: `Bearer ${(await import('../../lib/auth')).getAuthToken()}` } }
        );
        if (!response.ok) throw new Error('Failed to load workflow');
        const data = await response.json();
        setAnalysis(data.workflow_state);

        // Generate recommendation based on analysis
        const result = analyzeAndRecommend(data.workflow_state);
        setRecommendation(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Laden');
      } finally {
        setLoading(false);
      }
    };

    void loadAndAnalyze();
  }, [activeTenantId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex items-center justify-center">
        <div className="flex items-center gap-2 text-titanium-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Empfehlung wird generiert...</span>
        </div>
      </div>
    );
  }

  if (error || !recommendation) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-start gap-3 bg-red-950/50 border border-red-900 rounded-none p-4">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-300">Fehler bei der Analyse</h3>
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const tierInfo = tierById(recommendation.recommendedTier);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/governance/onboarding" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="font-display font-bold text-sm text-titanium-50">Tier-Empfehlung</div>
            <div className="text-[11px] text-titanium-400">Maßgeschneiderter Plan für Ihre Governance-Anforderungen</div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Recommended Tier Hero */}
        <div className="bg-gradient-to-br from-blue-900 to-cyan-900 border border-blue-800 rounded-none p-8">
          <div className="mb-6">
            <h2 className="font-display text-3xl font-bold text-white mb-2">
              Wir empfehlen: <span className="text-cyan-300">{tierInfo?.name}</span>
            </h2>
            <p className="text-blue-200 text-lg">
              {recommendation.reasoning[0]}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white/10 backdrop-blur rounded-none border border-white/20 p-4">
              <div className="text-sm text-blue-200 mb-2">Konfidenz</div>
              <div className="text-3xl font-bold text-white">{recommendation.confidence}%</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-none border border-white/20 p-4">
              <div className="text-sm text-blue-200 mb-2">Geschätzter Preis</div>
              <div className="text-3xl font-bold text-cyan-300">{recommendation.estimatedCost}€ / Monat</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-none border border-white/20 p-4">
              <div className="text-sm text-blue-200 mb-2">Nutzer</div>
              <div className="text-3xl font-bold text-white">{recommendation.estimatedMonthlyUsers}</div>
            </div>
          </div>

          <Link
            to={`/checkout/${tierInfo?.planKey}?source=workflow-recommendation`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-obsidian-950 font-semibold rounded-none transition-colors"
          >
            Jetzt upgraden
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Why this tier? */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-6">
            <h3 className="font-semibold text-titanium-50 mb-3 flex items-center gap-2">
              <Brain className="h-5 w-5 text-cyan-400" />
              Analyse-Ergebnisse
            </h3>
            <ul className="space-y-2">
              {recommendation.reasoning.map((reason, idx) => (
                <li key={idx} className="text-[12px] text-titanium-300 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-6">
            <h3 className="font-semibold text-titanium-50 mb-3 flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-400" />
              Erforderliche Features
            </h3>
            <div className="flex flex-wrap gap-2">
              {recommendation.requiredFeatures.map((featureId) => {
                const feature = GOVERNANCE_FEATURES.find(f => f.id === featureId);
                return (
                  <span key={featureId} className="bg-cyan-900/30 border border-cyan-700 text-cyan-300 text-[11px] px-2.5 py-1 rounded-none">
                    {feature?.name || featureId}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tier Comparison */}
        {tierInfo && (
          <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-6">
            <h3 className="font-semibold text-titanium-50 mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Was Sie mit {tierInfo.name} bekommen
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tierInfo.bullets.slice(0, 6).map((bullet, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                  <span className="text-[12px] text-titanium-300">{bullet}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next Steps */}
        <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-6">
          <h3 className="font-semibold text-titanium-50 mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Nächste Schritte
          </h3>
          <ol className="space-y-3">
            {recommendation.nextSteps.map((step, idx) => (
              <li key={idx} className="flex gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-900 text-cyan-300 font-semibold text-sm shrink-0">
                  {idx + 1}
                </span>
                <span className="text-[12px] text-titanium-300 pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            to={`/checkout/${tierInfo?.planKey}?source=workflow-recommendation`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-obsidian-950 font-semibold rounded-none transition-colors"
          >
            <Zap className="h-4 w-4" />
            Upgrade zu {tierInfo?.name}
          </Link>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-6 py-3 border border-titanium-700 hover:border-titanium-500 text-titanium-200 hover:text-titanium-100 font-semibold rounded-none transition-colors"
          >
            <Download className="h-4 w-4" />
            Empfehlung drucken
          </button>
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 px-6 py-3 border border-titanium-700 hover:border-titanium-500 text-titanium-200 hover:text-titanium-100 font-semibold rounded-none transition-colors"
          >
            Alle Pläne vergleichen
          </Link>
        </div>
      </main>
    </div>
  );
}

/**
 * Analyze workflow responses and generate tier recommendation
 */
function analyzeAndRecommend(workflow: WorkflowAnalysis): RecommendationResult {
  const features: string[] = [];
  let complexity = 0;
  let reasoning: string[] = [];

  // Analyze AI Usage
  if (workflow.ai_usage === 'extensive') {
    features.push('ai_register', 'ai_act_risk_assessment', 'iso42001_controls');
    complexity += 3;
    reasoning.push('Extensive KI-Nutzung erfordert AI Act und ISO 42001 Unterstützung');
  } else if (workflow.ai_usage === 'moderate') {
    features.push('ai_register', 'ai_act_risk_assessment');
    complexity += 2;
    reasoning.push('Moderate KI-Nutzung benötigt AI Act Compliance');
  } else {
    features.push('ai_register');
    complexity += 1;
  }

  // Analyze Personal Data
  if (workflow.personal_data === 'high_volume') {
    features.push('dsgvo_directory', 'evidence_vault_advanced');
    complexity += 3;
    reasoning.push('Hohe Datenmengen erfordern DSGVO-Verzeichnis und Evidence Vault');
  } else if (workflow.personal_data === 'moderate') {
    features.push('dsgvo_directory');
    complexity += 1;
  }

  // Analyze Vendors/Dependencies
  if (workflow.external_vendors === 'many') {
    features.push('gap_analysis', 'audit_report');
    complexity += 2;
    reasoning.push('Mehrere externe Lieferanten benötigen Lückenanalyse');
  }

  // Analyze Critical Processes
  if (workflow.critical_processes === 'yes') {
    features.push('nis2_incidents', 'remediation_plan');
    complexity += 2;
    reasoning.push('Kritische Prozesse erfordern NIS2-Incident-Tracking');
  }

  // Analyze Incidents
  if (workflow.incidents === 'yes') {
    features.push('nis2_incidents');
    complexity += 1;
  }

  // Analyze Security/ISO Status
  if (workflow.isms_in_place === 'yes') {
    features.push('iso27001_controls');
    complexity += 1;
  }

  if (workflow.iso_certs === 'yes') {
    features.push('iso27001_controls', 'iso42001_controls');
    complexity += 1;
  }

  // Deduplicate features
  const uniqueFeatures = Array.from(new Set(features));

  // Recommend tier
  let recommendedTier: TierId = 'starter';
  let confidence = 70;

  if (complexity >= 8) {
    recommendedTier = 'agency';
    confidence = 95;
    reasoning.push('Hohe Governance-Komplexität erfordert umfassende Multi-Framework-Unterstützung');
  } else if (complexity >= 6) {
    recommendedTier = 'growth';
    confidence = 90;
    reasoning.push('Mittlere Komplexität mit mehreren Frameworks');
  } else if (complexity >= 3) {
    recommendedTier = 'growth';
    confidence = 75;
  }

  // Next steps based on tier
  const nextSteps = [
    `Upgrade zu ${tierById(recommendedTier)?.name} durchführen`,
    'Governance Onboarding-Workflow konfigurieren',
    'Teams einladen und Roles zuweisen',
    'Erste Compliance-Audits durchführen',
    'Evidence Vault mit Nachweisen füllen',
  ];

  if (recommendedTier === 'agency' || recommendedTier === 'scale') {
    nextSteps.push('API-Keys für Integration generieren');
  }

  return {
    recommendedTier,
    confidence,
    reasoning,
    requiredFeatures: uniqueFeatures,
    estimatedMonthlyUsers: complexity > 6 ? 10 : 5,
    estimatedCost: tierById(recommendedTier)?.priceEur || 0,
    nextSteps,
  };
}
