/** Server-only rollout gate. An unset or malformed flag MUST disable caching. */
export function isAnthropicPromptCacheEnabled(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
}
