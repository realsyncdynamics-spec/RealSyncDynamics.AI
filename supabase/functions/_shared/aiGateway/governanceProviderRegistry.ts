/**
 * RealSync Governance Provider Registry v1.
 *
 * Pure data + deterministic routing helpers. No fetch, no env, no secrets,
 * no provider calls. A registry entry means "researched candidate", NOT
 * "configured", "approved" or "live".
 *
 * Evidence snapshot: 2026-09-25. The accompanying research explicitly says
 * prices/model catalogs are point-in-time and several capabilities remain
 * model-/contract-dependent. Runtime code must therefore supply the actually
 * enabled deployment ids; otherwise routing fails closed.
 */

export type GovernanceVendorId =
  | 'mistral'
  | 'ionos'
  | 'stackit'
  | 'ovhcloud'
  | 'scaleway'
  | 'nebius';

export type GovernanceWorkload =
  | 'governance_chat'
  | 'strict_json'
  | 'classification';

export type ResidencyRequirement =
  | 'DE_ONLY'
  | 'EU_ONLY'
  | 'EU_EFTA'
  | 'GLOBAL_ALLOWED';

export type ResidencyScope = 'DE' | 'EU' | 'EU_EFTA' | 'GLOBAL';

export type CapabilitySupport =
  | 'documented'
  | 'model_dependent'
  | 'not_documented';

export type RetentionPosture =
  | 'zdr_default'
  | 'zdr_available'
  | 'no_prompt_output_persistence'
  | 'requires_configuration'
  | 'not_verified';

export interface GovernanceCapabilities {
  chat: CapabilitySupport;
  jsonObject: CapabilitySupport;
  jsonSchema: CapabilitySupport;
  functionCalling: CapabilitySupport;
  embeddings: CapabilitySupport;
}

export interface GovernanceDeploymentCandidate {
  deploymentId: string;
  vendorId: GovernanceVendorId;
  displayName: string;
  companyCountry: string;
  inferenceRegion: string;
  residency: ResidencyScope;
  openAiCompatible: boolean;
  deploymentKind: 'shared' | 'dedicated';
  capabilities: GovernanceCapabilities;
  retention: RetentionPosture;
  /**
   * Human-readable conditions that MUST remain visible in review/UI.
   * They are deliberately not converted into unverifiable booleans.
   */
  prerequisites: readonly string[];
  /**
   * Lower number = preferred for that workload after policy filtering.
   * This is a product routing preference, not a claim of benchmark superiority.
   */
  priority: Readonly<Record<GovernanceWorkload, number>>;
  evidenceDate: '2026-09-25';
  evidenceStatus: 'researched_candidate';
}

export const GOVERNANCE_DEPLOYMENTS: readonly GovernanceDeploymentCandidate[] = [
  {
    deploymentId: 'mistral.eu-regional',
    vendorId: 'mistral',
    displayName: 'Mistral La Plateforme — EU Regional Inference',
    companyCountry: 'FR',
    inferenceRegion: 'EU/EFTA',
    residency: 'EU_EFTA',
    openAiCompatible: true,
    deploymentKind: 'shared',
    capabilities: {
      chat: 'documented',
      jsonObject: 'documented',
      jsonSchema: 'documented',
      functionCalling: 'documented',
      embeddings: 'not_documented',
    },
    retention: 'zdr_available',
    prerequisites: [
      'Use the EU regional endpoint explicitly.',
      'ZDR must be requested/verified for eligible stateless calls before relying on it.',
      'Control-plane geography is not fully regionalized by the research snapshot.',
    ],
    priority: {
      governance_chat: 10,
      strict_json: 20,
      classification: 20,
    },
    evidenceDate: '2026-09-25',
    evidenceStatus: 'researched_candidate',
  },
  {
    deploymentId: 'scaleway.generative.fr-par',
    vendorId: 'scaleway',
    displayName: 'Scaleway Generative APIs — Paris',
    companyCountry: 'FR',
    inferenceRegion: 'fr-par',
    residency: 'EU',
    openAiCompatible: true,
    deploymentKind: 'shared',
    capabilities: {
      chat: 'documented',
      jsonObject: 'documented',
      jsonSchema: 'documented',
      functionCalling: 'documented',
      embeddings: 'documented',
    },
    retention: 'zdr_default',
    prerequisites: [
      'Abuse/error-analysis exceptions described by the provider remain contractually relevant.',
      'Model availability/capabilities must be checked for the selected model.',
    ],
    priority: {
      governance_chat: 20,
      strict_json: 10,
      classification: 15,
    },
    evidenceDate: '2026-09-25',
    evidenceStatus: 'researched_candidate',
  },
  {
    deploymentId: 'ionos.ai-model-hub.de',
    vendorId: 'ionos',
    displayName: 'IONOS AI Model Hub — Germany',
    companyCountry: 'DE',
    inferenceRegion: 'Germany',
    residency: 'DE',
    openAiCompatible: true,
    deploymentKind: 'shared',
    capabilities: {
      chat: 'documented',
      jsonObject: 'model_dependent',
      jsonSchema: 'not_documented',
      functionCalling: 'documented',
      embeddings: 'documented',
    },
    retention: 'no_prompt_output_persistence',
    prerequisites: [
      'Strict JSON Schema enforcement must be validated in the RealSync PoC.',
      'Exact model capability must be checked before enabling a route.',
    ],
    priority: {
      governance_chat: 30,
      strict_json: 40,
      classification: 10,
    },
    evidenceDate: '2026-09-25',
    evidenceStatus: 'researched_candidate',
  },
  {
    deploymentId: 'stackit.ai-model-serving.eu01',
    vendorId: 'stackit',
    displayName: 'STACKIT AI Model Serving — Germany South / EU01',
    companyCountry: 'DE',
    inferenceRegion: 'Germany South / EU01',
    residency: 'DE',
    openAiCompatible: true,
    deploymentKind: 'shared',
    capabilities: {
      chat: 'documented',
      jsonObject: 'model_dependent',
      jsonSchema: 'not_documented',
      functionCalling: 'model_dependent',
      embeddings: 'documented',
    },
    retention: 'no_prompt_output_persistence',
    prerequisites: [
      'Shared-model inference location and the selected model must be verified contractually.',
      'Strict structured-output behavior is not sufficiently documented and requires a model test.',
    ],
    priority: {
      governance_chat: 40,
      strict_json: 50,
      classification: 20,
    },
    evidenceDate: '2026-09-25',
    evidenceStatus: 'researched_candidate',
  },
  {
    deploymentId: 'ovhcloud.ai-endpoints.gravelines',
    vendorId: 'ovhcloud',
    displayName: 'OVHcloud AI Endpoints — Gravelines',
    companyCountry: 'FR',
    inferenceRegion: 'Gravelines, France',
    residency: 'EU',
    openAiCompatible: true,
    deploymentKind: 'shared',
    capabilities: {
      chat: 'documented',
      jsonObject: 'model_dependent',
      jsonSchema: 'model_dependent',
      functionCalling: 'model_dependent',
      embeddings: 'model_dependent',
    },
    retention: 'no_prompt_output_persistence',
    prerequisites: [
      'Structured outputs and tool calling are model-dependent; catalog capability checks are mandatory.',
    ],
    priority: {
      governance_chat: 50,
      strict_json: 40,
      classification: 30,
    },
    evidenceDate: '2026-09-25',
    evidenceStatus: 'researched_candidate',
  },
  {
    deploymentId: 'nebius.token-factory.dedicated-eu',
    vendorId: 'nebius',
    displayName: 'Nebius Token Factory — Dedicated EU',
    companyCountry: 'NL',
    inferenceRegion: 'Dedicated EU region',
    residency: 'EU',
    openAiCompatible: true,
    deploymentKind: 'dedicated',
    capabilities: {
      chat: 'documented',
      jsonObject: 'documented',
      jsonSchema: 'documented',
      functionCalling: 'documented',
      embeddings: 'model_dependent',
    },
    retention: 'requires_configuration',
    prerequisites: [
      'Public endpoints are NOT sufficient for EU-residency routing.',
      'A dedicated EU endpoint plus ZDR must be configured and verified.',
      'Group/subprocessor transfer and support-access terms require contractual review.',
    ],
    priority: {
      governance_chat: 60,
      strict_json: 30,
      classification: 40,
    },
    evidenceDate: '2026-09-25',
    evidenceStatus: 'researched_candidate',
  },
] as const;

export interface GovernanceRoutingPolicy {
  residency: ResidencyRequirement;
  workload: GovernanceWorkload;
  requireJsonSchema?: boolean;
  requireFunctionCalling?: boolean;
  allowedVendors?: readonly GovernanceVendorId[];
  deniedVendors?: readonly GovernanceVendorId[];
}

export interface GovernanceRoutingRuntime {
  /**
   * Only deployments proven configured/usable by runtime configuration belong
   * here. The static registry NEVER makes a deployment operational.
   */
  enabledDeploymentIds: readonly string[];
  /**
   * Deployments for which runtime/contract checks have satisfied every
   * prerequisite represented outside the static capability booleans
   * (for example dedicated+ZDR on Nebius).
   */
  /**
   * Omitted means "nothing verified" (fail closed), never "trust enabled".
   */
  verifiedDeploymentIds?: readonly string[];
}

export interface GovernanceRoutingDecision {
  selected: GovernanceDeploymentCandidate;
  candidates: readonly GovernanceDeploymentCandidate[];
  policy: GovernanceRoutingPolicy;
}

export class NoCompliantProviderError extends Error {
  readonly code = 'NO_COMPLIANT_PROVIDER_AVAILABLE' as const;
  readonly policy: GovernanceRoutingPolicy;

  constructor(policy: GovernanceRoutingPolicy) {
    super('No enabled AI deployment satisfies the active governance policy.');
    this.name = 'NoCompliantProviderError';
    this.policy = policy;
  }
}

export function residencySatisfies(
  deployment: ResidencyScope,
  requirement: ResidencyRequirement,
): boolean {
  switch (requirement) {
    case 'DE_ONLY':
      return deployment === 'DE';
    case 'EU_ONLY':
      return deployment === 'DE' || deployment === 'EU';
    case 'EU_EFTA':
      return deployment === 'DE' || deployment === 'EU' || deployment === 'EU_EFTA';
    case 'GLOBAL_ALLOWED':
      return true;
  }
}

function isDocumented(support: CapabilitySupport): boolean {
  return support === 'documented';
}

export function candidateSatisfiesPolicy(
  candidate: GovernanceDeploymentCandidate,
  policy: GovernanceRoutingPolicy,
): boolean {
  if (!residencySatisfies(candidate.residency, policy.residency)) return false;

  if (policy.allowedVendors && !policy.allowedVendors.includes(candidate.vendorId)) return false;
  if (policy.deniedVendors?.includes(candidate.vendorId)) return false;

  if (policy.requireJsonSchema && !isDocumented(candidate.capabilities.jsonSchema)) return false;
  if (policy.requireFunctionCalling && !isDocumented(candidate.capabilities.functionCalling)) return false;

  return true;
}

export function compliantGovernanceCandidates(
  policy: GovernanceRoutingPolicy,
  runtime: GovernanceRoutingRuntime,
): readonly GovernanceDeploymentCandidate[] {
  const enabled = new Set(runtime.enabledDeploymentIds);
  const verified = new Set(runtime.verifiedDeploymentIds ?? []);

  return GOVERNANCE_DEPLOYMENTS
    .filter((candidate) => enabled.has(candidate.deploymentId))
    .filter((candidate) => verified.has(candidate.deploymentId))
    .filter((candidate) => candidateSatisfiesPolicy(candidate, policy))
    .slice()
    .sort((a, b) => {
      const p = a.priority[policy.workload] - b.priority[policy.workload];
      return p !== 0 ? p : a.deploymentId.localeCompare(b.deploymentId);
    });
}

export function selectGovernanceDeployment(
  policy: GovernanceRoutingPolicy,
  runtime: GovernanceRoutingRuntime,
): GovernanceRoutingDecision {
  const candidates = compliantGovernanceCandidates(policy, runtime);
  const selected = candidates[0];
  if (!selected) throw new NoCompliantProviderError(policy);
  return { selected, candidates, policy };
}
