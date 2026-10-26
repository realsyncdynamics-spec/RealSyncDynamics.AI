/**
 * Authoritative validation boundary for AI data residency decisions.
 *
 * A failing RPC, missing tenant/user, an unknown value, or a network error
 * must NEVER be interpreted as permission to use a cloud provider.
 * This small pure module is shared by the AI tool pipeline and API-key router.
 */
export type VerifiedAiResidency = 'cloud' | 'eu_local';

export class ResidencyUnavailableError extends Error {
  readonly code = 'RESIDENCY_UNAVAILABLE';
  readonly status = 503;

  constructor() {
    super('AI data residency cannot be verified; inference has been blocked.');
    this.name = 'ResidencyUnavailableError';
  }
}

export function requireVerifiedAiResidency(
  result: { data: unknown; error: unknown },
): VerifiedAiResidency {
  if (result.error || (result.data !== 'cloud' && result.data !== 'eu_local')) {
    throw new ResidencyUnavailableError();
  }
  return result.data;
}
