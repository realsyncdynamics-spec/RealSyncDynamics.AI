import React from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ArrowRight, ArrowLeft, TrendingUp, CheckCircle2, AlertTriangle, Clock, DollarSign, Zap,
  Target, Shield, Lock, Users,
} from 'lucide-react';
import type { Recommendation, GovernanceProfile, ClassifiedFinding } from '../core/onboarding/types';
import { estimateTimeToValue } from '../core/onboarding/recommendationEngine';
import {
  recommendForProfile,
  type CanonicalRecommendation,
  type RecommendedModule,
} from '../core/onboarding/canonicalRecommendation';
import { saveFunnelContext, withAuditContext } from '../core/onboarding/funnelContext';
import { useGovernanceOnboarding } from '../hooks/useGovernanceOnboarding';
import { toScanFindings, useSharedAudit } from '../features/audit/loadSharedAudit';
import type { OnboardingChoiceId } from '@/shared/onboarding';
import {
  planById,
  formatPriceEur,
  checkoutHrefForPlan,
  modulesForArea,
  planByKey,
  PRODUCT_AREAS,
} from '@/shared/pricing';

interface LocationState {
  profile?: GovernanceProfile;
  recommendation?: Recommendation;
  findings?: ClassifiedFinding[];
  /** Selbstauskünfte aus dem Q&A-Einstieg — ergänzen die Befunde. */
  businessNeeds?: OnboardingChoiceId[];
  canonical?: CanonicalRecommendation;
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
  const { state } = useLocation();
  const locationState = (state ?? {}) as LocationState;

  // Der Router-State ist der schnelle Weg (direkt aus dem Onboarding). Fehlt
  // er — Reload, geteilter Link, Rückkehr von Stripe —, wird die Empfehlung
  // aus dem kanonischen Datensatz neu gerechnet statt in einer Sackgasse zu
  // enden. Derselbe Rechenweg, keine zweite Engine.
  if (locationState.profile && locationState.recommendation) {
    return (
      <RecommendationBody
        scanId={scanId}
        profile={locationState.profile}
        recommendation={locationState.recommendation}
        businessNeeds={locationState.businessNeeds ?? []}
        canonical={locationState.canonical}
      />
    );
  }
  return <RecommendationFromAudit scanId={scanId} />;
}

/** Empfehlung ohne Router-State: Audit laden → Profil → Plan → Angebot. */
function RecommendationFromAudit({ scanId }: { scanId: string }) {
  const navigate = useNavigate();
  const { audit, loading, error } = useSharedAudit(scanId);
  const findings = React.useMemo(() => (audit ? toScanFindings(audit.issues) : []), [audit]);
  const onboarding = useGovernanceOnboarding(scanId, audit?.domain ?? '', findings);

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex items-center justify-center p-4">
        <p className="font-mono text-xs text-titanium-500">Empfehlung wird aus Ihrem Scan berechnet …</p>
      </div>
    );
  }

  if (error || !audit) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
          <h1 className="text-2xl font-display font-bold text-titanium-50 mb-2">Keine Empfehlung verfügbar</h1>
          <p className="text-sm text-titanium-300 mb-6">
            {error ?? 'Der Scan konnte nicht geladen werden.'} Starten Sie den kostenlosen Audit erneut, um eine Empfehlung zu erhalten.
          </p>
          <button
            onClick={() => navigate('/audit')}
            className="surface-mono inline-flex items-center justify-center gap-2 px-6 py-3 font-bold text-sm"
          >
            Zum Audit <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <RecommendationBody
      scanId={scanId}
      profile={onboarding.profile}
      recommendation={onboarding.recommendation}
      businessNeeds={[]}
      canonical={onboarding.canonicalRecommendation}
    />
  );
}

function RecommendationBody({
  scanId,
  profile,
  recommendation,
  businessNeeds,
  canonical: given,
}: {
  scanId: string;
  profile: GovernanceProfile;
  recommendation: Recommendation;
  businessNeeds: OnboardingChoiceId[];
  canonical?: CanonicalRecommendation;
}) {
  const navigate = useNavigate();

  // Der empfohlene Plan ist bereits kanonisch (PlanId) — es gibt keine
  // Übersetzungstabelle mehr zwischen Onboarding und Pricing.
  const plan = planById(recommendation.recommendedPlan);
  const timeToValue = estimateTimeToValue(recommendation.recommendedPlan, profile.dimensions[0]?.criticalityScore || 0);

  // Kanonische Empfehlung: Befunde → konkrete Module → Angebot. Sie kommt
  // aus dem Onboarding mit; fehlt sie (Reload, Deep-Link), wird sie aus dem
  // Profil neu gerechnet — dieselbe Funktion, kein zweiter Rechenweg.
  const canonical: CanonicalRecommendation =
    given ?? recommendForProfile(profile, businessNeeds);

  // Governance Score → Planempfehlung → CTA → Stripe Checkout.
  // Das Ziel kommt aus checkoutHrefForPlan(), damit Empfehlung und
  // Pricing-Karten dieselbe URL benutzen.
  const handleCheckout = () => {
    const href = checkoutHrefForPlan(plan, { source: 'governance_recommendation' });
    // `withAuditContext` ergänzt, statt neu zusammenzusetzen — sonst gingen
    // `source` und `pilot` aus `checkoutHrefForPlan()` verloren.
    const withContext = withAuditContext(href, { auditId: scanId, domain: profile.domain });
    const separator = withContext.includes('?') ? '&' : '?';
    navigate(`${withContext}${separator}sector=${encodeURIComponent(profile.sector)}`);
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
              {plan.name}
            </h1>
            <p className="text-lg text-titanium-300 max-w-lg mx-auto">
              {plan.outcomeHeadline}
            </p>
            <p className="text-sm text-titanium-400 max-w-lg mx-auto">
              {recommendation.reasoning}
            </p>
          </div>

          {/* Angebot — Problem → Lösung → Nutzen → Preis.
              Neue Sektion (CLAUDE.md §10.2: Ergänzen ist frei). Sie steht
              vor der Plan-Karte, weil der Kunde zuerst wissen soll, was
              gegen *seine* Befunde getan wird, und erst danach, was das
              Paket kostet. */}
          <OfferSection canonical={canonical} auditId={scanId} domain={profile.domain} />

          {/* Plan card with details */}
          <div className="border-2 border-cyan-600 bg-obsidian-900 p-8 rounded-none space-y-6">
            {/* Pricing */}
            <div className="flex items-baseline justify-between mb-6">
              <div>
                <div className="font-display font-bold text-5xl text-titanium-50">
                  {formatPriceEur(plan.price.monthlyEur)}
                </div>
                <div className="text-sm text-titanium-400 mt-1">
                  {plan.price.monthlyEur > 0 ? '/Monat · jederzeit kündbar' : 'einmalig · kein Account'}
                </div>
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
            <div className="space-y-4">
              {PRODUCT_AREAS.map((area) => {
                const modules = modulesForArea(plan, area.id);
                if (modules.length === 0) return null;
                return (
                  <div key={area.id}>
                    <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-titanium-500">
                      {area.label}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {modules.map((module) => (
                        <div key={module.id} className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                          <span className="text-sm text-titanium-300">{module.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Checkout CTA */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleCheckout}
              className="flex-1 bg-cyan-500 text-obsidian-950 px-8 py-4 font-bold text-lg rounded-none hover:bg-cyan-400 transition-colors flex items-center justify-center gap-2"
            >
              {plan.ctaLabel} <ArrowRight className="h-5 w-5" />
            </button>
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

// ─── Angebot ────────────────────────────────────────────────────────────────
//
// „Das sind Deine Probleme — das empfehlen wir — das kostet es."
//
// Diese Sektion ist der Punkt, an dem aus einem Bericht ein Angebot wird.
// Drei Regeln, die sie von einer Verkaufsfläche unterscheiden:
//
//  1. **Jede Zeile trägt ihren Beleg.** Ein Modul, das der Scan begründet,
//     nennt die Befund-Kennungen; ein Modul aus dem Fragebogen sagt genau
//     das. Der Kunde muss unterscheiden können, was gemessen und was
//     behauptet ist.
//  2. **Kein Preis entsteht hier.** Beträge, Preismodell und
//     Verbrauchshinweis kommen unverändert aus `shared/pricing.ts`.
//  3. **Kein Knopf ohne Ziel** (`CLAUDE.md` §14). Ein Modul, das heute nicht
//     buchbar ist, wird als solches ausgewiesen — und bekommt nur dann eine
//     Schaltfläche, wenn es einen erreichbaren Weg gibt.

function OfferSection({
  canonical,
  auditId,
  domain,
}: {
  canonical: CanonicalRecommendation;
  auditId: string;
  domain: string;
}) {
  const moduleKey = canonical.recommendedModules.map((m) => m.id).join(',');

  // Der Trichter-Kontext überlebt ab hier Reload, Anmeldung und die Rückkehr
  // von Stripe. Vorher reiste er ausschliesslich im Router-State und war bei
  // jedem dieser drei Schritte verloren.
  React.useEffect(() => {
    if (!auditId) return;
    saveFunnelContext({
      auditId,
      domain,
      recommendedPlan: canonical.recommendedPlan,
      selectedModules: moduleKey ? (moduleKey.split(',') as RecommendedModule['id'][]) : [],
      track: canonical.implementationTrack,
    });
  }, [auditId, domain, canonical.recommendedPlan, canonical.implementationTrack, moduleKey]);

  if (canonical.recommendedModules.length === 0) return null;

  return (
    <section className="border border-titanium-700 bg-obsidian-900 p-6 rounded-none space-y-5">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-titanium-500 mb-1">
          Deine Empfehlung
        </div>
        <h2 className="font-display font-bold text-titanium-50 text-lg">
          Das können wir für Dich umsetzen
        </h2>
        <p className="text-sm text-titanium-400 mt-1">
          Abgeleitet aus {canonical.recommendedModules.filter((m) => m.source === 'scan').length}{' '}
          Modulvorschlägen auf Basis Deiner Befunde
          {domain ? ` für ${domain}` : ''}.
        </p>
      </div>

      <div className="space-y-4">
        {canonical.recommendedModules.map((module) => (
          <OfferCard key={module.id} module={module} auditId={auditId} domain={domain} />
        ))}
      </div>

      {canonical.recommendedActions.length > 0 && (
        <div className="border-t border-titanium-800 pt-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-titanium-500 mb-2">
            Ohne Zukauf zu erledigen
          </div>
          <ul className="space-y-2">
            {canonical.recommendedActions.map((action) => (
              <li key={action.label} className="flex gap-2.5">
                <Target className="h-4 w-4 text-titanium-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-titanium-100">{action.label}</div>
                  <div className="text-xs text-titanium-400">{action.reason}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-titanium-800 pt-4 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm text-titanium-300">Monatsbasis der empfohlenen Module</span>
        <span className="font-display font-bold text-titanium-50 text-xl">
          {formatPriceEur(canonical.estimatedValue.monthlyBaseEur)}
        </span>
      </div>
      <p className="font-mono text-[10px] text-titanium-600 leading-relaxed">
        Richtwert aus den Modulpreisen. Verbrauchsabhängige Anteile (Telefonie,
        WhatsApp-Konversationen) sind nicht enthalten. Abgerechnet wird über den
        gebuchten Plan.
      </p>
    </section>
  );
}

function OfferCard({
  module,
  auditId,
  domain,
}: {
  module: RecommendedModule;
  auditId: string;
  domain: string;
}) {
  const planName = module.unlockedByPlan ? planByKey(module.unlockedByPlan)?.name ?? null : null;
  // Der Builder ist der einzige Weg, den ein noch nicht angemeldeter Kunde
  // sofort gehen kann. Audit und Domain reisen als Parameter mit, damit der
  // Bau den Scan-Zusammenhang kennt.
  const entryHref = module.entryRoute
    ? withAuditContext(module.entryRoute, { auditId, domain })
    : null;

  return (
    <div className="border border-titanium-800 bg-obsidian-950 p-4 rounded-none space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display font-bold text-titanium-50 text-base">{module.name}</h3>
        <div className="text-right">
          <div className="font-display font-bold text-titanium-50">
            {formatPriceEur(module.priceEur)}
            <span className="text-xs font-normal text-titanium-400">
              {module.priceModel === 'per_unit' ? ' je Einheit' : ' / Monat'}
            </span>
          </div>
          {module.usageNote && (
            <div className="font-mono text-[10px] text-titanium-500">{module.usageNote}</div>
          )}
        </div>
      </div>

      <dl className="space-y-2 text-sm">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-wider text-titanium-600">Problem</dt>
          <dd className="text-titanium-300">{module.problem}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-wider text-titanium-600">Lösung</dt>
          <dd className="text-titanium-300">{module.solution}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-wider text-titanium-600">Nutzen</dt>
          <dd className="text-titanium-300">{module.benefit}</dd>
        </div>
      </dl>

      {module.evidence.length > 0 && (
        <div className="font-mono text-[10px] text-titanium-600 break-words">
          Belege: {module.evidence.slice(0, 6).join(' · ')}
          {module.evidence.length > 6 ? ` · +${module.evidence.length - 6}` : ''}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {module.purchase === 'bookable' && planName ? (
          <span className="inline-flex items-center gap-1.5 border border-emerald-700 bg-emerald-950/40 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-emerald-300">
            <CheckCircle2 className="h-3 w-3" /> Enthalten ab {planName}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 border border-amber-700 bg-amber-950/40 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-amber-300">
            <Clock className="h-3 w-3" /> Einzelbuchung folgt
          </span>
        )}
        {module.source === 'answers' && (
          <span className="inline-flex items-center gap-1.5 border border-titanium-700 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-titanium-400">
            aus Deinen Angaben
          </span>
        )}
        {entryHref && (
          <a
            href={entryHref}
            className="inline-flex items-center gap-1.5 border border-titanium-700 bg-obsidian-900 px-3 py-1.5 text-xs font-semibold text-titanium-200 hover:border-titanium-400"
          >
            {module.id === 'ai_frontend' ? 'Vorschau bauen' : 'Öffnen'}{' '}
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}
