// Governed AI Routing Layer (R1) — Provider Registry.
//
// Replaces the hardcoded PROVIDER_BY_PROFILE table (router.ts) with a
// data-driven view: each provider advertises what it can do (capabilities)
// and where its data lives (locality). Routing then *derives* a candidate
// list from these facts instead of a fixed profile→provider mapping.
//
// R1 scope: this module is pure logic and holds no adapters or secrets by
// itself — it is a lookup/filter surface. It is NOT yet wired into the live
// ServerAiGateway request path (that is a later, flag-gated step). Nothing
// here performs I/O.
//
// Frontend mirror: src/core/ai-gateway/registry.ts — keep in sync.

import type {
  AiTaskType,
  ProviderDescriptor,
  ProviderId,
  RegisteredProvider,
} from './types.ts';

// Default capability/locality facts per provider. The `models` lists are
// informational; the live model id is held by each adapter's config. These
// defaults can be overridden per deployment by constructing the registry
// with explicit descriptors.
export const DEFAULT_PROVIDER_DESCRIPTORS: Record<ProviderId, ProviderDescriptor> = {
  lm_studio: {
    id: 'lm_studio',
    kind: 'local',
    locality: 'on_prem',
    capabilities: ['chat', 'classify', 'extract_json', 'embed', 'summarize', 'draft', 'governance_reasoning'],
    models: [],
    dataProcessingAgreement: true,
  },
  ollama: {
    id: 'ollama',
    kind: 'local',
    locality: 'eu',
    capabilities: ['chat', 'classify', 'extract_json', 'embed', 'summarize', 'draft', 'governance_reasoning'],
    models: [],
    dataProcessingAgreement: true,
  },
  anthropic: {
    id: 'anthropic',
    kind: 'cloud',
    locality: 'non_eu',
    capabilities: ['chat', 'classify', 'extract_json', 'summarize', 'draft', 'governance_reasoning'],
    models: [],
    dataProcessingAgreement: true,
  },
  openai: {
    id: 'openai',
    kind: 'cloud',
    locality: 'non_eu',
    capabilities: ['chat', 'classify', 'extract_json', 'embed', 'summarize', 'draft', 'governance_reasoning'],
    models: [],
    dataProcessingAgreement: true,
  },
  google: {
    id: 'google',
    kind: 'cloud',
    locality: 'non_eu',
    capabilities: ['chat', 'classify', 'extract_json', 'embed', 'summarize', 'draft', 'governance_reasoning'],
    models: [],
    dataProcessingAgreement: true,
  },
  mock: {
    id: 'mock',
    kind: 'local',
    locality: 'on_prem',
    capabilities: ['chat', 'classify', 'extract_json', 'embed', 'summarize', 'draft', 'governance_reasoning'],
    models: [],
    dataProcessingAgreement: true,
  },
};

export interface ProviderRegistryOptions {
  /** Override the default descriptor facts (e.g. mark a self-hosted OpenAI as EU). */
  descriptors?: Partial<Record<ProviderId, ProviderDescriptor>>;
}

/**
 * In-memory registry of the providers wired into this deployment. Register a
 * RegisteredProvider (descriptor + adapter), then query by capability/locality.
 * Registration order is preserved and used as a stable tie-break by callers.
 */
export class ProviderRegistry {
  private readonly byId = new Map<ProviderId, RegisteredProvider>();
  private readonly order: ProviderId[] = [];
  private readonly descriptorOverrides: Partial<Record<ProviderId, ProviderDescriptor>>;

  constructor(options: ProviderRegistryOptions = {}) {
    this.descriptorOverrides = options.descriptors ?? {};
  }

  /**
   * Register (or replace) a provider by its adapter id. When no descriptor is
   * supplied, the default facts for that id are used, with any constructor
   * override applied on top.
   */
  register(entry: RegisteredProvider): this {
    const id = entry.adapter.id;
    const descriptor =
      entry.descriptor ??
      this.descriptorOverrides[id] ??
      DEFAULT_PROVIDER_DESCRIPTORS[id];
    if (!descriptor) {
      throw new Error(`ProviderRegistry: no descriptor for provider "${id}"`);
    }
    if (!this.byId.has(id)) this.order.push(id);
    this.byId.set(id, { descriptor, adapter: entry.adapter });
    return this;
  }

  has(id: ProviderId): boolean {
    return this.byId.has(id);
  }

  get(id: ProviderId): RegisteredProvider | undefined {
    return this.byId.get(id);
  }

  /** All registered providers, in registration order. */
  all(): RegisteredProvider[] {
    return this.order.map((id) => this.byId.get(id)!).filter(Boolean);
  }

  /** Providers that advertise the given task capability. */
  withCapability(task: AiTaskType): RegisteredProvider[] {
    return this.all().filter((p) => p.descriptor.capabilities.includes(task));
  }

  /** Providers whose data-locality is EU or on-prem (DSGVO / EU-AI-Act safe). */
  euResident(): RegisteredProvider[] {
    return this.all().filter(
      (p) => p.descriptor.locality === 'eu' || p.descriptor.locality === 'on_prem',
    );
  }

  /**
   * Ordered candidate list for a request. Filters by capability and, when
   * `euOnly` is set, by data locality. Preserves registration order so a
   * deployment controls preference by the order it registers providers.
   */
  candidatesFor(task: AiTaskType, opts: { euOnly?: boolean } = {}): RegisteredProvider[] {
    let list = this.withCapability(task);
    if (opts.euOnly) {
      list = list.filter(
        (p) => p.descriptor.locality === 'eu' || p.descriptor.locality === 'on_prem',
      );
    }
    return list;
  }
}
