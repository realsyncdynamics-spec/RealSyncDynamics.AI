// AI Gateway types — shared between the browser-facing wrapper and the
// server-side Edge Function. Keep the surface area small. Nothing in this
// file should pull in fetch, Deno or React.

export type AiTaskType =
  | 'chat'
  | 'classify'
  | 'extract_json'
  | 'embed'
  | 'summarize'
  | 'draft'
  | 'governance_reasoning';

export type ModelProfile =
  | 'fast-local'
  | 'quality-local'
  | 'strict-json'
  | 'embed-default'
  | 'cloud-fallback';

export type ProviderId =
  | 'lm_studio'
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'ollama'
  | 'mock';

// --- Governed AI Routing Layer (R1) — additive, data-driven registry metadata.
// These describe a provider so routing can decide by capability and data
// locality instead of a hardcoded profile→provider table. Nothing here
// changes existing behaviour; the descriptor is consumed by the registry
// (registry.ts), not by the current ServerAiGateway path.

/** Where the inference physically runs — cloud API vs. a local/on-prem daemon. */
export type ProviderKind = 'cloud' | 'local';

/** Data-locality class, relevant for DSGVO / EU-AI-Act routing constraints. */
export type ProviderLocality = 'eu' | 'non_eu' | 'on_prem';

export interface ProviderDescriptor {
  id: ProviderId;
  kind: ProviderKind;
  locality: ProviderLocality;
  /** Which task types this provider can serve. */
  capabilities: AiTaskType[];
  /** Advertised model ids (informational — the adapter holds the live config). */
  models: string[];
  maxContext?: number;
  costPer1k?: { input: number; output: number };
  /** Whether a data-processing agreement (AVV) is in place for this provider. */
  dataProcessingAgreement?: boolean;
}

export interface RegisteredProvider {
  descriptor: ProviderDescriptor;
  adapter: AiProviderAdapter;
}

export interface AiGatewayRequest {
  tenant_id?: string | null;
  user_id?: string | null;
  /** Free-text feature name for analytics ("governance_chat", "audit_explain"). */
  feature: string;
  task_type: AiTaskType;
  model_profile: ModelProfile;
  input: string;
  system_prompt?: string;
  /** JSON Schema (or any structural hint) — only honoured by JSON-capable profiles. */
  response_schema?: unknown;
  timeout_ms?: number;
  max_tokens?: number;
  temperature?: number;
  trace_id?: string;
  idempotency_key?: string;
  metadata?: Record<string, unknown>;
}

export interface AiGatewayUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
}

export interface AiGatewayResponse<T = unknown> {
  provider: ProviderId;
  model: string;
  profile: ModelProfile;
  output: T;
  raw_text?: string;
  usage?: AiGatewayUsage;
  trace_id: string;
  latency_ms: number;
  cached?: boolean;
}

export interface AiProviderHealth {
  ok: boolean;
  models?: string[];
  error?: string;
}

export interface AiProviderAdapter {
  id: ProviderId;
  health(): Promise<AiProviderHealth>;
  generate(request: AiGatewayRequest): Promise<AiGatewayResponse<string>>;
  extractJson<T>(request: AiGatewayRequest): Promise<AiGatewayResponse<T>>;
  embed(request: AiGatewayRequest): Promise<AiGatewayResponse<number[]>>;
}
