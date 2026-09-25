import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  GOVERNANCE_DEPLOYMENTS,
  NoCompliantProviderError,
  candidateSatisfiesPolicy,
  compliantGovernanceCandidates,
  residencySatisfies,
  selectGovernanceDeployment,
  type GovernanceRoutingPolicy,
} from '../../src/core/ai-gateway/governanceProviderRegistry';

const ALL = GOVERNANCE_DEPLOYMENTS.map((d) => d.deploymentId);

function runtime(ids: readonly string[] = ALL) {
  return {
    enabledDeploymentIds: ids,
    verifiedDeploymentIds: ids,
  };
}

describe('governance provider registry — provenance and safety boundary', () => {
  it('contains only researched candidates and never claims live/configured state', () => {
    expect(GOVERNANCE_DEPLOYMENTS.length).toBeGreaterThanOrEqual(6);
    for (const deployment of GOVERNANCE_DEPLOYMENTS) {
      expect(deployment.evidenceDate).toBe('2026-09-25');
      expect(deployment.evidenceStatus).toBe('researched_candidate');
      expect(deployment.deploymentId.length).toBeGreaterThan(0);
      expect(deployment.prerequisites.length).toBeGreaterThan(0);
    }
  });

  it('Deno mirror remains byte-identical because the registry is platform-neutral', () => {
    const node = readFileSync('src/core/ai-gateway/governanceProviderRegistry.ts', 'utf8');
    const deno = readFileSync(
      'supabase/functions/_shared/aiGateway/governanceProviderRegistry.ts',
      'utf8',
    );
    expect(deno).toBe(node);
  });
});

describe('residencySatisfies', () => {
  it('DE_ONLY accepts only Germany-scoped deployments', () => {
    expect(residencySatisfies('DE', 'DE_ONLY')).toBe(true);
    expect(residencySatisfies('EU', 'DE_ONLY')).toBe(false);
    expect(residencySatisfies('EU_EFTA', 'DE_ONLY')).toBe(false);
    expect(residencySatisfies('GLOBAL', 'DE_ONLY')).toBe(false);
  });

  it('EU_ONLY accepts DE/EU but rejects EU_EFTA when EU-only cannot be guaranteed', () => {
    expect(residencySatisfies('DE', 'EU_ONLY')).toBe(true);
    expect(residencySatisfies('EU', 'EU_ONLY')).toBe(true);
    expect(residencySatisfies('EU_EFTA', 'EU_ONLY')).toBe(false);
    expect(residencySatisfies('GLOBAL', 'EU_ONLY')).toBe(false);
  });

  it('EU_EFTA accepts DE, EU and EU/EFTA, but not global', () => {
    expect(residencySatisfies('DE', 'EU_EFTA')).toBe(true);
    expect(residencySatisfies('EU', 'EU_EFTA')).toBe(true);
    expect(residencySatisfies('EU_EFTA', 'EU_EFTA')).toBe(true);
    expect(residencySatisfies('GLOBAL', 'EU_EFTA')).toBe(false);
  });
});

describe('candidateSatisfiesPolicy', () => {
  const byId = (id: string) => {
    const found = GOVERNANCE_DEPLOYMENTS.find((d) => d.deploymentId === id);
    if (!found) throw new Error(`missing fixture: ${id}`);
    return found;
  };

  it('strict JSON requires documented json_schema support, not model-dependent guesses', () => {
    const policy: GovernanceRoutingPolicy = {
      residency: 'EU_EFTA',
      workload: 'strict_json',
      requireJsonSchema: true,
    };

    expect(candidateSatisfiesPolicy(byId('scaleway.generative.fr-par'), policy)).toBe(true);
    expect(candidateSatisfiesPolicy(byId('mistral.eu-regional'), policy)).toBe(true);
    expect(candidateSatisfiesPolicy(byId('ionos.ai-model-hub.de'), policy)).toBe(false);
    expect(candidateSatisfiesPolicy(byId('stackit.ai-model-serving.eu01'), policy)).toBe(false);
    expect(candidateSatisfiesPolicy(byId('ovhcloud.ai-endpoints.gravelines'), policy)).toBe(false);
  });

  it('allowed/denied vendor policy is enforced before preference order matters', () => {
    const ionos = byId('ionos.ai-model-hub.de');
    expect(candidateSatisfiesPolicy(ionos, {
      residency: 'DE_ONLY',
      workload: 'classification',
      allowedVendors: ['ionos'],
    })).toBe(true);

    expect(candidateSatisfiesPolicy(ionos, {
      residency: 'DE_ONLY',
      workload: 'classification',
      deniedVendors: ['ionos'],
    })).toBe(false);
  });
});

describe('selectGovernanceDeployment — policy first, preference second', () => {
  it('fails closed if no deployment is enabled', () => {
    expect(() => selectGovernanceDeployment(
      { residency: 'EU_ONLY', workload: 'governance_chat' },
      runtime([]),
    )).toThrow(NoCompliantProviderError);

    try {
      selectGovernanceDeployment(
        { residency: 'EU_ONLY', workload: 'governance_chat' },
        runtime([]),
      );
    } catch (error) {
      expect(error).toBeInstanceOf(NoCompliantProviderError);
      expect((error as NoCompliantProviderError).code)
        .toBe('NO_COMPLIANT_PROVIDER_AVAILABLE');
    }
  });

  it('also excludes enabled-but-unverified deployments', () => {
    expect(() => selectGovernanceDeployment(
      { residency: 'EU_ONLY', workload: 'strict_json', requireJsonSchema: true },
      {
        enabledDeploymentIds: ['scaleway.generative.fr-par'],
        verifiedDeploymentIds: [],
      },
    )).toThrow(NoCompliantProviderError);
  });

  it('DE_ONLY classification prefers IONOS, with STACKIT remaining an eligible fallback', () => {
    const decision = selectGovernanceDeployment(
      { residency: 'DE_ONLY', workload: 'classification' },
      runtime(),
    );

    expect(decision.selected.deploymentId).toBe('ionos.ai-model-hub.de');
    expect(decision.candidates.map((d) => d.deploymentId)).toEqual([
      'ionos.ai-model-hub.de',
      'stackit.ai-model-serving.eu01',
    ]);
  });

  it('EU/EFTA governance chat prefers Mistral EU Regional after policy filtering', () => {
    const decision = selectGovernanceDeployment(
      { residency: 'EU_EFTA', workload: 'governance_chat' },
      runtime(),
    );
    expect(decision.selected.deploymentId).toBe('mistral.eu-regional');
  });

  it('EU_ONLY strict JSON prefers Scaleway; Mistral EU/EFTA is intentionally excluded', () => {
    const decision = selectGovernanceDeployment(
      {
        residency: 'EU_ONLY',
        workload: 'strict_json',
        requireJsonSchema: true,
        requireFunctionCalling: true,
      },
      runtime(),
    );

    expect(decision.selected.deploymentId).toBe('scaleway.generative.fr-par');
    expect(decision.candidates.map((d) => d.deploymentId)).toEqual([
      'scaleway.generative.fr-par',
      'nebius.token-factory.dedicated-eu',
    ]);
  });

  it('Nebius cannot become eligible merely because it exists in the static registry', () => {
    const policy: GovernanceRoutingPolicy = {
      residency: 'EU_ONLY',
      workload: 'strict_json',
      requireJsonSchema: true,
    };

    const withoutRuntimeEnablement = compliantGovernanceCandidates(policy, runtime([
      'scaleway.generative.fr-par',
    ]));
    expect(withoutRuntimeEnablement.some((d) => d.vendorId === 'nebius')).toBe(false);

    const enabledButNotVerified = compliantGovernanceCandidates(policy, {
      enabledDeploymentIds: ['nebius.token-factory.dedicated-eu'],
      verifiedDeploymentIds: [],
    });
    expect(enabledButNotVerified).toEqual([]);
  });
});
