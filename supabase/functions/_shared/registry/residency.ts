// Routing-Zulaessigkeit – ABGELEITET, nie gespeichert.
//
// Reine Funktionen (kein Netz, keine DB, keine Uhr) ueber Registry-Fakten und
// eine Routing-Anfrage. Grundlage fuer das spaetere Gateway v2: Die Richtlinie
// entscheidet VOR dem Aufruf; der Provider hat keine Autoritaet. Ausweichen
// ist nur innerhalb der erlaubten Residency moeglich – die Kandidatenliste
// dieser Funktion IST die Fallback-Kette. Ist sie leer, gibt es keinen
// Aufruf, sondern NO_COMPLIANT_PROVIDER_AVAILABLE mit attemptedProviders.
//
// Fail-closed: unbekannte Region, unbelegte Region, externe Weitergabe der
// Inferenz oder eine nicht belegte Faehigkeit fuehren zum Ausschluss, nie zur
// Zulassung.

import type {
  Capability,
  CapabilityName,
  DeploymentFile,
  ModelEntry,
  RegionFact,
  ResidencyClass,
} from './types.ts';

export const RESIDENCY_CLASSES: readonly ResidencyClass[] = ['DE_ONLY', 'EU_ONLY', 'EU_EFTA', 'GLOBAL_ALLOWED'];

/** EU-27 (ISO 3166-1 alpha-2; Griechenland als GR). */
export const EU27: ReadonlySet<string> = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
]);

/** EFTA: Island, Liechtenstein, Norwegen, Schweiz. */
export const EFTA: ReadonlySet<string> = new Set(['IS', 'LI', 'NO', 'CH']);

export type ExclusionReason =
  | 'REGION_UNKNOWN'
  | 'REGION_UNSOURCED'
  | 'REGION_OUTSIDE_RESIDENCY'
  | 'EXTERNAL_INFERENCE_EGRESS'
  | 'EXTERNAL_INFERENCE_EGRESS_UNKNOWN'
  | 'LISTING_RETIRED'
  | 'VENDOR_NOT_ALLOWED'
  | 'VENDOR_DENIED'
  | 'CAPABILITY_NOT_SATISFIED'
  | 'CONTEXT_WINDOW_TOO_SMALL'
  | 'LANGUAGE_NOT_SUPPORTED'
  | 'MODEL_UNAVAILABLE'
  | 'NO_MODELS';

function hasSource(f: { status: string; sources: unknown[] }): boolean {
  return (f.status === 'claimed' || f.status === 'verified') && f.sources.length > 0;
}

/**
 * Deckt die Region die Residency-Klasse ab? Nur aus der Region selbst –
 * Vendor-Sitz oder Marke spielen keine Rolle.
 */
export function regionSatisfies(region: RegionFact, cls: ResidencyClass): { ok: boolean; reason?: ExclusionReason } {
  if (cls === 'GLOBAL_ALLOWED') return { ok: true };
  if (region.scope === 'unknown' || region.status === 'unknown') return { ok: false, reason: 'REGION_UNKNOWN' };
  if (!hasSource(region)) return { ok: false, reason: 'REGION_UNSOURCED' };

  const codes = region.country_codes;
  const allIn = (set: (c: string) => boolean) => codes.length > 0 && codes.every(set);

  switch (cls) {
    case 'DE_ONLY':
      return region.scope === 'country' && allIn((c) => c === 'DE')
        ? { ok: true }
        : { ok: false, reason: 'REGION_OUTSIDE_RESIDENCY' };
    case 'EU_ONLY':
      if (region.scope === 'eu') return { ok: true };
      return region.scope === 'country' && allIn((c) => EU27.has(c))
        ? { ok: true }
        : { ok: false, reason: 'REGION_OUTSIDE_RESIDENCY' };
    case 'EU_EFTA':
      if (region.scope === 'eu' || region.scope === 'eu_efta') return { ok: true };
      return region.scope === 'country' && allIn((c) => EU27.has(c) || EFTA.has(c))
        ? { ok: true }
        : { ok: false, reason: 'REGION_OUTSIDE_RESIDENCY' };
  }
}

/** Effektive Inferenzregion eines Modells: Modell-Override, sonst Deployment. */
export function effectiveRegion(dep: DeploymentFile, model?: ModelEntry | null): RegionFact {
  return model?.inference_region ?? dep.inference_region;
}

export interface Eligibility {
  eligible: boolean;
  reasons: ExclusionReason[];
  /** Nicht-blockierende Hinweise, die ein Assessment als CONDITIONAL fuehren muss. */
  conditions: string[];
}

/**
 * Residency-Zulaessigkeit eines Deployments (optional eines Modells) fuer eine
 * Klasse. Externe Inferenz-Weitergabe (true) schliesst jede Klasse ausser
 * GLOBAL_ALLOWED aus; unbelegte Weitergabe (unknown) ist eine Bedingung, kein
 * Ausschluss – sie verhindert aber jedes PASS unter strict_eu_sovereignty
 * (invariants.ts).
 */
export function residencyEligibility(dep: DeploymentFile, cls: ResidencyClass, model?: ModelEntry | null): Eligibility {
  const reasons: ExclusionReason[] = [];
  const conditions: string[] = [];
  const region = regionSatisfies(effectiveRegion(dep, model), cls);
  if (!region.ok && region.reason) reasons.push(region.reason);
  if (cls !== 'GLOBAL_ALLOWED') {
    const egress = dep.external_inference_egress;
    if (egress.value === true) reasons.push('EXTERNAL_INFERENCE_EGRESS');
    else if (egress.status === 'unknown' || egress.value === null) conditions.push('EXTERNAL_INFERENCE_EGRESS_UNKNOWN');
    if (dep.jurisdiction.third_country_access.status !== 'no_access_claimed') conditions.push('THIRD_COUNTRY_ACCESS_NOT_EXCLUDED');
  }
  return { eligible: reasons.length === 0, reasons, conditions };
}

/** Eine Faehigkeit erfuellt eine Anforderung nur mit support=yes UND Beleg. */
export function capabilitySatisfied(cap: Capability | undefined): boolean {
  return !!cap && cap.support === 'yes' && hasSource(cap);
}

/** Modell-Faehigkeit vor Deployment-Faehigkeit. */
export function effectiveCapability(dep: DeploymentFile, model: ModelEntry | null, name: CapabilityName): Capability | undefined {
  return model?.capabilities?.[name] ?? dep.capabilities?.[name];
}

export interface RouteRequest {
  residency: ResidencyClass;
  allowed_vendors?: string[];
  denied_vendors?: string[];
  required_capabilities?: CapabilityName[];
  min_context_tokens?: number;
  required_languages?: string[];
  /** Bevorzugte Reihenfolge; nicht genannte Deployments folgen alphabetisch. */
  preferred_deployments?: string[];
}

export interface RouteCandidate { deployment_id: string; vendor_id: string; model_id: string; api_model_id: string | null; conditions: string[] }
export interface AttemptedProvider { deployment_id: string; vendor_id: string; model_id: string | null; rejected_because: ExclusionReason[] }

export type RouteDecision =
  | { ok: true; residency: ResidencyClass; candidates: RouteCandidate[]; attemptedProviders: AttemptedProvider[] }
  | { ok: false; error: 'NO_COMPLIANT_PROVIDER_AVAILABLE'; residency: ResidencyClass; attemptedProviders: AttemptedProvider[] };

function modelUsable(m: ModelEntry): boolean {
  return m.availability.value === 'available' || m.availability.value === 'preview';
}

function languagesOk(dep: DeploymentFile, m: ModelEntry, wanted: string[]): boolean {
  if (wanted.length === 0) return true;
  const f = m.capabilities?.languages ?? dep.capabilities?.languages;
  if (!f || !hasSource(f)) return false;
  if (f.value.includes('*')) return true;
  return wanted.every((w) => f.value.includes(w));
}

/**
 * Leitet die geordnete Kandidatenliste (= erlaubte Fallback-Kette) ab. Kein
 * Kandidat -> NO_COMPLIANT_PROVIDER_AVAILABLE mit allen geprueften Anbietern
 * und Gruenden. Die Reihenfolge ist deterministisch.
 */
export function routeCandidates(deployments: readonly DeploymentFile[], req: RouteRequest): RouteDecision {
  const required = req.required_capabilities ?? [];
  const langs = req.required_languages ?? [];
  const pref = req.preferred_deployments ?? [];
  const order = (id: string) => {
    const i = pref.indexOf(id);
    return i === -1 ? pref.length : i;
  };
  const sorted = [...deployments].sort(
    (a, b) => order(a.deployment_id) - order(b.deployment_id) || a.deployment_id.localeCompare(b.deployment_id),
  );

  const candidates: RouteCandidate[] = [];
  const attempted: AttemptedProvider[] = [];

  for (const dep of sorted) {
    const depReasons: ExclusionReason[] = [];
    if (dep.listing_status === 'retired') depReasons.push('LISTING_RETIRED');
    if (req.allowed_vendors && !req.allowed_vendors.includes(dep.vendor_id)) depReasons.push('VENDOR_NOT_ALLOWED');
    if (req.denied_vendors?.includes(dep.vendor_id)) depReasons.push('VENDOR_DENIED');
    if (dep.models.length === 0) depReasons.push('NO_MODELS');
    if (depReasons.length > 0) {
      attempted.push({ deployment_id: dep.deployment_id, vendor_id: dep.vendor_id, model_id: null, rejected_because: depReasons });
      continue;
    }
    for (const m of [...dep.models].sort((a, b) => a.model_id.localeCompare(b.model_id))) {
      const reasons: ExclusionReason[] = [];
      if (!modelUsable(m)) reasons.push('MODEL_UNAVAILABLE');
      const el = residencyEligibility(dep, req.residency, m);
      reasons.push(...el.reasons);
      for (const c of required) {
        if (!capabilitySatisfied(effectiveCapability(dep, m, c))) {
          reasons.push('CAPABILITY_NOT_SATISFIED');
          break;
        }
      }
      if (req.min_context_tokens !== undefined) {
        const ctx = m.capabilities?.context_window_tokens ?? dep.capabilities?.context_window_tokens;
        if (!ctx || !hasSource(ctx) || ctx.value === null || ctx.value < req.min_context_tokens) reasons.push('CONTEXT_WINDOW_TOO_SMALL');
      }
      if (!languagesOk(dep, m, langs)) reasons.push('LANGUAGE_NOT_SUPPORTED');
      if (reasons.length === 0) {
        candidates.push({ deployment_id: dep.deployment_id, vendor_id: dep.vendor_id, model_id: m.model_id, api_model_id: m.api_model_id, conditions: el.conditions });
      } else {
        attempted.push({ deployment_id: dep.deployment_id, vendor_id: dep.vendor_id, model_id: m.model_id, rejected_because: reasons });
      }
    }
  }

  if (candidates.length === 0) {
    return { ok: false, error: 'NO_COMPLIANT_PROVIDER_AVAILABLE', residency: req.residency, attemptedProviders: attempted };
  }
  return { ok: true, residency: req.residency, candidates, attemptedProviders: attempted };
}

/** Strengere von zwei Residency-Klassen (Deployment- vs. Mandanten-Einstellung). */
export function stricterResidency(a: ResidencyClass, b: ResidencyClass): ResidencyClass {
  return RESIDENCY_CLASSES.indexOf(a) <= RESIDENCY_CLASSES.indexOf(b) ? a : b;
}
