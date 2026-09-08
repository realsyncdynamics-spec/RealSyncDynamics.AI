import type { ModelProfile } from './types';

/**
 * Governance Open Router — reiner Katalog.
 *
 * Kein Fetch, kein Deno, kein React. Die Edge Function importiert den
 * Spiegel `supabase/functions/_shared/aiGateway/governanceRouterCatalog.ts`.
 * Beide Dateien müssen zeichengenau zusammenbleiben (Import-Suffix `.ts`
 * ausgenommen); `test/core/ai-gateway/governance-router-catalog.test.ts`
 * hält die Parität.
 *
 * ## Was das ist
 *
 * Ein OpenAI-kompatibler Eingang vor dem bestehenden AI-Gateway. Cursor
 * (und jedes SDK) setzt „Override OpenAI Base URL“ auf
 * `/functions/v1/governance-router/v1`. Auth ist der bestehende
 * `rsd_gov_`-Key. EU-KI-Verordnung Art. 50 (Kennzeichnung) und DSGVO
 * Art. 5/32 (Zweckbindung, Sicherheit, kein Prompt im Prüfpfad) sitzen
 * vor dem Provider-Call.
 *
 * ## Was das nicht ist
 *
 * Kein OpenRouter-Reseller, keine automatische Stripe-Hochstufung, kein
 * VPS-Provisioning. „Automatische Expansion mit Kundenzahl und Umsatz“
 * heisst: Stufe und Modellkatalog werden aus den **bestehenden**
 * Entitlements abgeleitet. Wer über Stripe upgradet, bekommt denselben
 * Tag mehr Modelle und ein höheres Kontingent — ohne neuen Key-Vokabular.
 */

/** Ableitung aus Plan-Kontingenten, nicht aus einer eigenen Preisliste. */
export type ExpansionStage = 'observe' | 'studio' | 'scale' | 'agency' | 'sovereign';

export type AiResidency = 'cloud' | 'eu_local';

export type QuotaKey = 'limit.llm_queries_monthly' | 'limit.ai_calls_monthly';

export interface ExpansionInputs {
  /** `ai.tool.automations` — ab Starter. */
  hasAutomations: boolean;
  /**
   * `limit.ai_calls_monthly`: `-1` unbegrenzt (Vertrag), `null` fehlt
   * (Starter hat den Key nicht), sonst die Plan-Zahl.
   */
  aiCallsMonthly: number | null;
}

export const EXPANSION_STAGES: readonly ExpansionStage[] = [
  'observe',
  'studio',
  'scale',
  'agency',
  'sovereign',
];

export const EXPANSION_STAGE_LABELS: Record<ExpansionStage, { title: string; detail: string }> = {
  observe: {
    title: 'Beobachten',
    detail: 'Kein Router — Automationen liegen erst ab Starter.',
  },
  studio: {
    title: 'Studio',
    detail: 'EU-lokale Modelle. Kontingent: monatliche LLM-Anfragen.',
  },
  scale: {
    title: 'Scale',
    detail: 'Cloud-Fallback freigeschaltet. Kontingent: monatliche KI-Aufrufe.',
  },
  agency: {
    title: 'Agency',
    detail: 'Erweiterte Kontingente für den Agentur-Betrieb.',
  },
  sovereign: {
    title: 'Sovereign',
    detail: 'Vertragsstufe — das System begrenzt hier nicht, der Vertrag tut es.',
  },
};

/**
 * Art. 50 EU-KI-VO — Kennzeichnung KI-generierter Ausgaben.
 * Gehört in die Antwort, nie in den Prompt, nie in den Prüfpfad.
 */
export const ART50_DISCLOSURE_DE =
  'Diese Ausgabe wurde mit Unterstützung eines KI-Systems erzeugt. RealSyncDynamicsAI vermittelt die Anfrage als Governance-Router (EU-KI-Verordnung Art. 50, DSGVO Art. 5 und 32). Der Prüfpfad speichert keine Prompt-Inhalte.';

/**
 * Cursor- und SDK-Namen → internes Gateway-Profil.
 * Kanonische Profilnamen mapen auf sich selbst.
 */
export const MODEL_ALIASES: Readonly<Record<string, ModelProfile>> = {
  'fast-local': 'fast-local',
  'quality-local': 'quality-local',
  'strict-json': 'strict-json',
  'embed-default': 'embed-default',
  'cloud-fallback': 'cloud-fallback',
  'gpt-4o-mini': 'fast-local',
  'gpt-4.1-mini': 'fast-local',
  'eu-local': 'fast-local',
  'gpt-4.1': 'quality-local',
  'gpt-4o': 'cloud-fallback',
  'claude-haiku-4-5': 'cloud-fallback',
};

const LOCAL_PROFILES: readonly ModelProfile[] = [
  'fast-local',
  'quality-local',
  'strict-json',
  'embed-default',
];

const CLOUD_PROFILES: readonly ModelProfile[] = ['cloud-fallback'];

export function expansionStageFromEntitlements(input: ExpansionInputs): ExpansionStage {
  if (!input.hasAutomations) return 'observe';
  const calls = input.aiCallsMonthly;
  if (calls === -1 || (typeof calls === 'number' && calls >= 50_000)) return 'sovereign';
  if (typeof calls === 'number' && calls >= 10_000) return 'agency';
  if (typeof calls === 'number' && calls >= 2_000) return 'scale';
  return 'studio';
}

/**
 * Cloud-Fallback nur ab Scale und nur wenn die Residenz nicht EU-lokal
 * erzwingt. EU-lokal gewinnt immer — auch auf Enterprise.
 */
export function allowCloudFallback(stage: ExpansionStage, residency: AiResidency): boolean {
  if (residency === 'eu_local') return false;
  return stage === 'scale' || stage === 'agency' || stage === 'sovereign';
}

export function quotaKeyForStage(stage: ExpansionStage): QuotaKey | null {
  if (stage === 'observe') return null;
  if (stage === 'studio') return 'limit.llm_queries_monthly';
  return 'limit.ai_calls_monthly';
}

export function resolveModelProfile(model: string | undefined): ModelProfile | null {
  if (!model) return null;
  return MODEL_ALIASES[model] ?? null;
}

export function profilesForStage(stage: ExpansionStage, allowCloud: boolean): readonly ModelProfile[] {
  if (stage === 'observe') return [];
  if (allowCloud) return [...LOCAL_PROFILES, ...CLOUD_PROFILES];
  return LOCAL_PROFILES;
}

export function isProfileAllowed(
  profile: ModelProfile,
  stage: ExpansionStage,
  allowCloud: boolean,
): boolean {
  return profilesForStage(stage, allowCloud).includes(profile);
}

export function aliasesForProfile(profile: ModelProfile): string[] {
  return Object.entries(MODEL_ALIASES)
    .filter(([, mapped]) => mapped === profile)
    .map(([alias]) => alias);
}

export interface RouterModelEntry {
  id: string;
  object: 'model';
  owned_by: 'realsyncdynamics';
  created: number;
  profile: ModelProfile;
}

export interface RouterModelsResponse {
  object: 'list';
  data: RouterModelEntry[];
}

/**
 * Modelle, die Cursor unter GET /v1/models sieht: kanonische Profile
 * plus Aliase, deren Ziel-Profil auf dieser Stufe erlaubt ist.
 */
export function modelsResponseForStage(
  stage: ExpansionStage,
  allowCloud: boolean,
  now: number = Date.now(),
): RouterModelsResponse {
  const created = Math.floor(now / 1000);
  const allowed = new Set(profilesForStage(stage, allowCloud));
  const data: RouterModelEntry[] = [];
  const seen = new Set<string>();
  for (const [alias, profile] of Object.entries(MODEL_ALIASES)) {
    if (!allowed.has(profile) || seen.has(alias)) continue;
    seen.add(alias);
    data.push({
      id: alias,
      object: 'model',
      owned_by: 'realsyncdynamics',
      created,
      profile,
    });
  }
  return { object: 'list', data };
}

export function processorsFor(allowCloud: boolean, residency: AiResidency): readonly string[] {
  const list: string[] = ['RealSyncDynamicsAI Governance Router (EU)'];
  if (residency === 'eu_local' || !allowCloud) {
    list.push('EU-lokale Inferenz (LM Studio)');
    return list;
  }
  list.push('EU-lokale Inferenz (LM Studio)', 'Anthropic (Cloud-Fallback)', 'OpenAI (Cloud-Fallback)');
  return list;
}

export function nextExpansionHint(stage: ExpansionStage): string | null {
  switch (stage) {
    case 'observe':
      return 'Mit Starter (Automationen) schaltet der Router auf Studio (EU-lokal).';
    case 'studio':
      return 'Mit Growth steigen Kontingent und Cloud-Fallback (Scale).';
    case 'scale':
      return 'Agency erweitert das Kontingent; Enterprise liegt auf der Vertragsstufe.';
    case 'agency':
      return 'Enterprise: vertragliche Kontingente, kein System-Cap.';
    case 'sovereign':
      return null;
  }
}

export interface GovernanceMeta {
  disclosure: string;
  residency: AiResidency;
  expansion_stage: ExpansionStage;
  pdp: {
    mode: 'off' | 'shadow' | 'enforce';
    decision: string | null;
  };
  processors: readonly string[];
}

export function governanceMeta(args: {
  residency: AiResidency;
  stage: ExpansionStage;
  allowCloud: boolean;
  pdpMode: 'off' | 'shadow' | 'enforce';
  pdpDecision: string | null;
}): GovernanceMeta {
  return {
    disclosure: ART50_DISCLOSURE_DE,
    residency: args.residency,
    expansion_stage: args.stage,
    pdp: { mode: args.pdpMode, decision: args.pdpDecision },
    processors: processorsFor(args.allowCloud, args.residency),
  };
}
