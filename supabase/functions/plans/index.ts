// Kanonischer Plan-Katalog als API.
//
// GET /functions/v1/plans            → alle Pläne
// GET /functions/v1/plans?plan=growth → ein Plan
//
// Die Antwortstruktur ist für jeden Plan identisch — es gibt keine
// Sonderfälle für Free, Enterprise oder Partner:
//
//   { id, key, name, outcomeHeadline, technicalSubheadline,
//     price, currency, interval, purchaseMode, availability,
//     limits, modules, permissions, automation, bots, channels,
//     features, addons, policyPacks, trialDays }
//
// `availability` unterscheidet seit AP2 zwischen `self_service`, `contract`
// und `legacy`. Der Katalog liefert bewusst weiterhin alle Pläne — wer nur
// das Angebot rendern will, filtert auf `!== 'legacy'`.
//
// Quelle ist ausschließlich `_shared/pricing.generated.ts`, erzeugt aus
// `shared/pricing.ts`. Diese Function enthält keine eigenen Preise.
//
// Öffentlich lesbar (kein Auth): der Katalog ist dieselbe Information, die
// auch auf /pricing steht. Es werden keine Stripe-Price-IDs ausgeliefert —
// die löst der Checkout serverseitig aus public.products auf.

import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import {
  ADDONS,
  ORDERED_PLANS,
  PRODUCT_AREAS,
  RUNTIME_PIPELINE,
  addonsFor,
  modulesForArea,
  planByKey,
  policyPacksFor,
  type Plan,
} from '../_shared/pricing.generated.ts';

// Der Katalog ändert sich nur bei einem Deploy — fünf Minuten Cache
// entlasten die Function, ohne Preisänderungen spürbar zu verzögern.
const CACHED_HEADERS = { ...corsHeaders, 'Cache-Control': 'public, max-age=300' };

/** Einheitliche Repräsentation eines Plans. Keine Sonderfälle. */
function serializePlan(plan: Plan) {
  return {
    id: plan.id,
    key: plan.planKey,
    yearlyKey: plan.yearlyPlanKey,
    name: plan.name,
    outcomeHeadline: plan.outcomeHeadline,
    technicalSubheadline: plan.technicalSubheadline,
    price: {
      monthly: plan.price.monthlyEur,
      yearly: plan.price.yearlyEur,
    },
    currency: plan.currency,
    interval: plan.price.monthlyEur === 0 ? 'none' : 'month',
    purchaseMode: plan.purchaseMode,
    // Seit AP2: Der Katalog liefert weiterhin *alle* Pläne, damit ein
    // Bestandskunde auf Agency oder Partner seinen eigenen nachschlagen
    // kann. Ob ein Plan noch angeboten wird, steht hier — additiv, damit
    // bestehende Konsumenten unverändert weiterlaufen.
    availability: plan.availability,
    trialDays: plan.trialDays,
    limits: plan.limits,
    modules: plan.modules,
    permissions: plan.permissions,
    // Explizit ausgewiesen, weil die Spezifikation diese Felder auf jedem
    // Endpunkt erwartet — abgeleitet, nicht separat gepflegt.
    automation: {
      runsPerMonth: plan.limits.automationRunsPerMonth,
      scheduler: plan.permissions.scheduler,
      bulkJobs: plan.limits.bulkJobsPerMonth,
      modules: modulesForArea(plan, 'automate').map((m) => m.id),
    },
    bots: {
      max: plan.limits.bots,
      answersPerMonth: plan.limits.answersPerMonth,
    },
    channels: plan.channels,
    policyPacks: policyPacksFor(plan),
    features: plan.features,
    addons: addonsFor(plan).map((addon) => ({
      id: addon.id,
      name: addon.name,
      description: addon.description,
      price: addon.priceEur,
      priceNote: addon.priceNote,
      interval: addon.interval,
    })),
    support: plan.support,
  };
}

Deno.serve((req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== 'GET') {
    return jsonError(405, 'METHOD_NOT_ALLOWED', 'only GET is supported');
  }

  const url = new URL(req.url);
  const requested = url.searchParams.get('plan');

  if (requested) {
    const plan = planByKey(requested);
    if (!plan) return jsonError(404, 'UNKNOWN_PLAN', `unbekannter Plan: ${requested}`);
    return jsonResponse({ plan: serializePlan(plan) }, 200, CACHED_HEADERS);
  }

  return jsonResponse({
    positioning: 'AI Governance Runtime',
    currency: 'EUR',
    areas: PRODUCT_AREAS,
    runtimePipeline: RUNTIME_PIPELINE,
    plans: ORDERED_PLANS.map(serializePlan),
    addons: ADDONS,
  }, 200, CACHED_HEADERS);
});
