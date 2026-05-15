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
  | 'mock';

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
