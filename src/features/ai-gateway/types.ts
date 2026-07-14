export interface ModelUsageRow {
  provider: string;
  model_id: string;
  month: string;
  request_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cached_tokens: number;
  total_cost_usd: number;
  avg_duration_ms: number;
  p95_duration_ms: number;
  success_count: number;
  error_count: number;
}

export interface ModelConfig {
  id: string;
  provider: string;
  model_id: string;
  display_name: string;
  cost_input_per_million_usd: number;
  cost_output_per_million_usd: number;
  avg_latency_ms: number | null;
  eu_resident: boolean;
  enabled: boolean;
}

export interface RoutingPolicy {
  id: string;
  tenant_id: string;
  name: string;
  priority: number;
  match_tool_key_pattern: string | null;
  match_content_type: string | null;
  preferred_provider: string | null;
  preferred_model_id: string | null;
  max_cost_usd_per_call: number | null;
  require_eu_resident: boolean;
  enabled: boolean;
}

export const PROVIDER_COLORS: Record<string, string> = {
  anthropic: '#D97706',  // amber
  openai:    '#10B981',  // emerald
  google:    '#3B82F6',  // blue
  ollama:    '#8B5CF6',  // violet (EU-local)
  lm_studio: '#6366F1',  // indigo
  unknown:   '#6B7280',  // gray
};

export const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai:    'OpenAI',
  google:    'Google',
  ollama:    'Ollama (EU-lokal)',
  lm_studio: 'LM Studio',
  unknown:   'Unbekannt',
};
