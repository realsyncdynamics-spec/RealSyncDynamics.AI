/** Pure, fail-closed interpretation of the entitlement RPC response. */
export function resolveAutomationRunLimit(data: unknown): number | null {
  if (!Array.isArray(data)) return null;
  const row = data.find((item: unknown) =>
    !!item && typeof item === 'object' && !Array.isArray(item) &&
    (item as Record<string, unknown>).key === 'limit.automation_runs_monthly');
  if (!row || typeof row !== 'object') return null;
  const value = (row as Record<string, unknown>).value;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < -1) return null;
  return value;
}
