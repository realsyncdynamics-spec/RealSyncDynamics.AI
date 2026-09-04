// Governed AI Routing Layer — feature flag.
//
// The governed routing path (registry-driven selection, circuit breaker,
// policy/risk gates) is rolled out behind a single kill-switch that defaults
// to OFF. While off, the gateway behaves exactly as it does today: the
// existing ServerAiGateway path is untouched. This lets each rollout step
// (R1…R4) land in main without changing production behaviour until the flag
// is deliberately switched on per deployment.
//
// Accepted "on" values (case-insensitive): "on", "1", "true", "enabled".
// Anything else — including unset — is OFF.
//
// Frontend mirror: src/core/ai-gateway/featureFlags.ts.

export const GOVERNED_ROUTING_FLAG = 'GOVERNED_ROUTING';

const ON_VALUES = new Set(['on', '1', 'true', 'enabled']);

/**
 * Whether the governed routing path is enabled. Pass the raw env value
 * (e.g. import.meta.env.VITE_GOVERNED_ROUTING on the client, or the resolved
 * Deno.env value on the server). Defaults to OFF for any unrecognised input.
 */
export function isGovernedRoutingEnabled(rawValue: string | undefined | null): boolean {
  if (!rawValue) return false;
  return ON_VALUES.has(rawValue.trim().toLowerCase());
}
