import React from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ArrowRight, ArrowLeft, TrendingUp, CheckCircle2, AlertTriangle, Clock, DollarSign, Zap,
  Target, Shield, Lock, Users,
} from 'lucide-react';
import type { Recommendation, GovernanceProfile, ClassifiedFinding } from '../core/onboarding/types';
import { estimateTimeToValue } from '../core/onboarding/recommendationEngine';
import { PLAN_CONFIG } from '../core/billing/plan-config';

interface LocationState {
  profile?: GovernanceProfile;
  recommendation?: Recommendation;
  findings?: ClassifiedFinding[];
}

/**
 * GovernanceRecommendation — final step showing the personalized recommendation
 *
 * Shows:
 * 1. The recommended plan with reasons
 * 2. Plan details and pricing
 * 3. Why this plan fits their profile
 * 4. CTA to checkout
 */

export function GovernanceRecommendation() {
  const { scanId = '' } = useParams<{ scanId: string }>();
  const navigate = useNavigate();
  const { state } = useLocation();
  const locationState = (state ?? {}) as LocationState;

  const profile = locationState.profile;
  const recommendation = locationState.recommendation;
  const findings = locationState.findings || [];

  if (!profile || !recommendation) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
          <h1 className="text-2xl font-display font-bold text-titanium-50 mb-2">Keine Empfehlung verfügbar</h1>
          <p className="text-sm text-titanium-300 mb-6">
            Bitte schließe erst die Onboarding-Flow ab.
          </p>
          <button
            onClick={() => navigate('/onboarding/' + scanId)}
            className="surface-mono inline-flex items-center justify-center gap-2 px-6 py-3 font-bold text-sm"
          >
            Zurück zum Onboarding <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  const planConfig = PLAN_CONFIG[recommendation.recommendedPlan];
  const timeToValue = estimateTimeToValue(recommendation.recommendedPlan, profile.dimensions[0]?.criticalityScore || 0);

  // Governance-Empfehlungs-Keys → kanonische Pricing-Tiers. So landet der
  // geführte Flow auf der EINEN Paket-Auswahl (/pricing) mit vorgewähltem
  // Paket — statt in einem ungültigen /checkout/<*_governance> (das der
  // Checkout ablehnt).
  const GOV_TO_TIER: Record<string, string> = {
    starter_governance: 'starter',
    professional_governance: 'growth',
    governance_os: 'agency',
    enterprise_regulated: 'enterprise',
  };
  const handleCheckout = () => {
    const tier = GOV_TO_TIER[recommendation.recommendedPlan] ?? 'growth';
    navigate(
      `/pricing?plan=${tier}&source=governance_recommendation&audit_id=${scanId}&sector=${profile.sector}`
    );
  };

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4 sm:px-6">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-obsidian-950 border border-titanium-700 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-titanium-100" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Empfehlung</div>
            <div className="text-[11px] text-titanium-400 font-medium">Dein ideales Paket</div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-4 sm:px-6 py-8 sm:py-12">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Recommendation headline */}
          <div className="text-center space-y-3">
            <div className="inline-block px-3 py-1 bg-cyan-950 border border-cyan-600 text-cyan-300 text-xs font-bold rounded-none">
              ✓ Empfohlen für Dich
            </div>
            <h1 className="text-4xl sm:text-5xl font-display font-bold text-titanium-50">
              {planConfig.metadata?.displayName}
            </h1>
            <p className="text-lg text-titanium-300 max-w-lg mx-auto">
              {recommendation.reasoning}
            </p>
          </div>

          {/* Plan card with details */}
          <div className="border-2 border-cyan-600 bg-obsidian-900 p-8 rounded-none space-y-6">
            {/* Pricing */}
            <div className="flex items-baseline justify-between mb-6">
              <div>
                {planConfig.metadata?.monthlyPrice ? (
                  <>
                    <div className="font-display font-bold text-5xl text-titanium-50">
                      €{planConfig.metadata.monthlyPrice}
                    </div>
                    <div className="text-sm text-titanium-400 mt-1">/Monat · jederzeit kündbar</div>
                  </>
                ) : (
                  <>
                    <div className="font-display font-bold text-5xl text-titanium-50">Individuell</div>
                    <div className="text-sm text-titanium-400 mt-1">Kontaktiere unser Sales-Team</div>
                  </>
                )}
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-cyan-300 mb-1">Zeit bis ROI</div>
                <div className="text-2xl font-display font-bold text-titanium-50">
                  {timeToValue.months === 0.5 ? '2 Wochen' : `${timeToValue.months} Monat${timeToValue.months !== 1 ? 'e' : ''}`}
                </div>
              </div>
            </div>

            {/* ROI reasoning */}
            <div className="border-t border-titanium-700 pt-4">
              <p className="text-sm text-titanium-300">{timeToValue.reasoning}</p>
            </div>

            {/* Urgency indicator */}
            {recommendation.urgencyLevel === 'critical' && (
              <div className="bg-red-950/50 border border-red-800 p-3 rounded-none flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <div className="font-bold text-red-300 mb-0.5">Dringend empfohlen</div>
                  <p className="text-red-200/80">
                    Basierend auf Deinen Befunden solltest Du dieses Paket schnellstmöglich aktivieren.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Why this plan */}
          <div className="border border-titanium-700 bg-obsidian-900 p-6 rounded-none space-y-4">
            <h2 className="font-display font-bold text-titanium-50 text-lg">Warum dieses Paket?</h2>
            <ul className="space-y-3">
              {recommendation.nextSteps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-sm text-titanium-300">{step}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Dimension breakdown */}
          {profile.dimensions.length > 0 && (
            <div className="border border-titanium-700 bg-obsidian-900 p-6 rounded-none space-y-4">
              <h2 className="font-display font-bold text-titanium-50 text-lg mb-4">
                Governance-Dimensionen im Detail
              </h2>
              <div className="space-y-3">
                {profile.dimensions.slice(0, 4).map((dim) => (
                  <div key={dim.dimension} className="flex items-start gap-3">
                    <div className="w-full">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-titanium-50 text-sm capitalize">
                          {dim.dimension.replace(/_/g, ' ')}
                        </span>
                        <span className={`text-xs font-bold ${dim.criticalityScore >= 70 ? 'text-red-300' : dim.criticalityScore >= 40 ? 'text-amber-300' : 'text-emerald-300'}`}>
                          {dim.criticalityScore}/100
                        </span>
                      </div>
                      <div className="h-2 bg-obsidian-950 border border-titanium-800 rounded-none overflow-hidden">
                        <div
                          className={`h-full ${dim.criticalityScore >= 70 ? 'bg-red-500' : dim.criticalityScore >= 40 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${dim.criticalityScore}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Plan benefits */}
          <div className="border border-titanium-700 bg-obsidian-900 p-6 rounded-none space-y-4">
            <h2 className="font-display font-bold text-titanium-50 text-lg mb-4">Was ist inbegriffen</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {['website.scan', 'website.resan', 'dsgvo.monitoring', 'aiact.classification', 'evidence.vault', 'policy.engine', 'team.members', 'api.access'].map((feature) => {
                const hasFeature = planConfig.features[feature as keyof typeof planConfig.features];
                if (!hasFeature) return null;
                return (
                  <div key={feature} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span className="text-sm text-titanium-300 capitalize">{feature.replace(/\./g, ' ')}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Checkout CTA */}
          <div className="flex flex-col sm:flex-row gap-3">
            {planConfig.metadata?.monthlyPrice && (
              <button
                onClick={handleCheckout}
                className="flex-1 bg-cyan-500 text-obsidian-950 px-8 py-4 font-bold text-lg rounded-none hover:bg-cyan-400 transition-colors flex items-center justify-center gap-2"
              >
                Jetzt starten <ArrowRight className="h-5 w-5" />
              </button>
            )}
            {!planConfig.metadata?.monthlyPrice && (
              <a
                href="/contact-sales?source=governance_recommendation"
                className="flex-1 bg-cyan-500 text-obsidian-950 px-8 py-4 font-bold text-lg rounded-none hover:bg-cyan-400 transition-colors flex items-center justify-center gap-2"
              >
                Enterprise anfragen <ArrowRight className="h-5 w-5" />
              </a>
            )}
            <button
              onClick={() => navigate('/pricing')}
              className="flex-1 border border-titanium-700 text-titanium-200 px-8 py-4 font-bold text-lg rounded-none hover:border-titanium-400 transition-colors"
            >
              Alle Pläne vergleichen
            </button>
          </div>

          {/* Trust signal */}
          <div className="text-center text-xs text-titanium-500 space-y-2">
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Keine Kreditkarte nötig</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>14 Tage kostenlos</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Jederzeit kündbar</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
