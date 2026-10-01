// Health des Cloudflare-Executors aus Browser Run selbst (limits()), ohne
// dafür einen Browser zu starten. Antwortform wie deploy/playwright-scanner
// (/health), damit browser-execute (healthFromResponse) unverändert bleibt.

import { BASE_CAPABILITIES } from '../../../deploy/playwright-scanner/session-core.js';
import { EXECUTOR_RUNTIME, EXECUTOR_VERSION } from './env.js';

/** Ausschnitt aus @cloudflare/playwright LimitsResponse. */
export interface BrowserRunLimits {
  activeSessions: Array<{ id: string }>;
  maxConcurrentSessions: number;
  allowedBrowserAcquisitions: number;
  timeUntilNextAllowedBrowserAcquisition: number;
}

/** Keine Downloads: Browser Run legt Dateien nicht im Worker ab — die Aktion wird nicht angeboten. */
export const CLOUDFLARE_CAPABILITIES: readonly string[] = [...BASE_CAPABILITIES];

export function healthBody(
  limits: BrowserRunLimits | null,
  configuredMax: number,
  startedAt: number,
  now: number,
): Record<string, unknown> {
  const reachable = limits !== null;
  const active = reachable ? limits.activeSessions.length : null;
  const max = reachable ? Math.min(configuredMax, Math.max(0, limits.maxConcurrentSessions)) : configuredMax;
  return {
    ok: true,
    status: reachable ? 'ok' : 'degraded',
    version: EXECUTOR_VERSION,
    runtime: EXECUTOR_RUNTIME,
    browser_version: null,
    // Ohne erreichbare Browser-Run-API ist kein Browser startbar — ehrlich degraded.
    browser_connected: reachable,
    active_sessions: active,
    max_sessions: max,
    capabilities: CLOUDFLARE_CAPABILITIES,
    network_guard: { route_guard: true, egress_proxy: false, landing_check: true, dns: 'doh' },
    acquisition: reachable
      ? { allowed: limits.allowedBrowserAcquisitions > 0, retry_after_ms: Math.max(0, limits.timeUntilNextAllowedBrowserAcquisition) }
      : null,
    uptime_seconds: Math.max(0, Math.round((now - startedAt) / 1000)),
  };
}
