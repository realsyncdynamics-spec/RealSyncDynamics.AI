import type { ExecutionZone } from './pricing.ts';

export type RuntimeResidency = 'cloud' | 'eu_local' | 'device_local';
type RuntimeResidencyLogger = (message: string) => void;

export function normalizeRuntimeResidency(
  residency: unknown,
  log: RuntimeResidencyLogger = console.warn,
): RuntimeResidency {
  switch (residency) {
    case 'cloud':
    case 'eu_local':
    case 'device_local':
      return residency;
    default:
      log(`[runtime-zone] unknown residency "${String(residency)}", defaulting to cloud`);
      return 'cloud';
  }
}

export function executionZoneFromResidency(residency: RuntimeResidency): ExecutionZone {
  switch (residency) {
    case 'device_local':
      return 'device_local';
    case 'eu_local':
      return 'eu_private';
    case 'cloud':
    default:
      return 'governed_cloud';
  }
}

export function mapResidencyToExecutionZone(
  residency: unknown,
  log?: RuntimeResidencyLogger,
): ExecutionZone {
  return executionZoneFromResidency(normalizeRuntimeResidency(residency, log));
}
