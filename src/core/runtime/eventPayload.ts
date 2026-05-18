/**
 * Operational Event Payload Envelope (Phase 1, Conversation 18.05.2026).
 *
 * Standardisierter Wrapper für den `payload`-Inhalt von Operational-Events
 * (siehe `./eventTypes.ts`). Stellt sicher, dass Konsumenten — Risk-Engine,
 * Dashboard, Evidence-Builder — verlässlich auf `source`, `target`, `data`,
 * `meta.version` und `meta.region` zugreifen können.
 *
 * Bewusst zero-dependency: keine ajv-/zod-Imports. Diese Datei wird sowohl
 * im SPA-Bundle als auch in Edge Functions geladen; ajv (~150 kB) würde die
 * SPA-Bundle-Size unnötig aufblähen, und die Validation hier ist flach
 * genug für handgeschriebene Guards. Für tiefe Schema-Validation (z. B.
 * gegen `spec/runtime/schemas/event.schema.json`) liegt `src/runtime/validator.ts`.
 */

export const OPERATIONAL_PAYLOAD_VERSION = '1.0';

/**
 * Standard-Region für Events, die ohne explizite Region erzeugt werden.
 * EU-Datenraum ist Plattform-Default (siehe README + ADR-0001).
 */
export const DEFAULT_REGION = 'eu-central';

export interface OperationalPayloadMeta {
  /** Semver MAJOR.MINOR des Payload-Schemas. Aktuell `1.0`. */
  version: string;
  /** ISO-Region des Erzeugers, z. B. `eu-central` oder `eu-central-1`. */
  region: string;
}

export interface OperationalPayloadEnvelope<TData extends Record<string, unknown> = Record<string, unknown>> {
  /**
   * Identifier des erzeugenden Subsystems. Konvention: kebab-case,
   * z. B. `playwright-scanner`, `ai-telemetry-sdk`, `agent-os-runner`.
   */
  source: string;
  /**
   * Ziel-Subject, auf das sich das Event bezieht. Konvention:
   * vollqualifizierte URL (`https://example.com/path`) für Web-Targets,
   * UUID-String für interne System-IDs (z. B. `ai_systems.id`).
   */
  target: string;
  /** Event-spezifische Nutzdaten. Schema variiert pro Event-Typ. */
  data: TData;
  meta: OperationalPayloadMeta;
}

// ─── Construction ───────────────────────────────────────────────────────────

export function makeOperationalPayload<TData extends Record<string, unknown>>(args: {
  source: string;
  target: string;
  data: TData;
  region?: string;
  version?: string;
}): OperationalPayloadEnvelope<TData> {
  return {
    source: args.source,
    target: args.target,
    data: args.data,
    meta: {
      version: args.version ?? OPERATIONAL_PAYLOAD_VERSION,
      region: args.region ?? DEFAULT_REGION,
    },
  };
}

// ─── Validation ─────────────────────────────────────────────────────────────

export type PayloadParseResult<TData extends Record<string, unknown> = Record<string, unknown>> =
  | { ok: true; payload: OperationalPayloadEnvelope<TData> }
  | { ok: false; reason: string };

export function isOperationalPayloadEnvelope(
  value: unknown,
): value is OperationalPayloadEnvelope {
  return parseOperationalPayload(value).ok;
}

export function parseOperationalPayload<TData extends Record<string, unknown>>(
  value: unknown,
): PayloadParseResult<TData> {
  if (value === null || typeof value !== 'object') {
    return { ok: false, reason: 'payload must be an object' };
  }

  const v = value as Record<string, unknown>;

  if (typeof v.source !== 'string' || v.source.length === 0) {
    return { ok: false, reason: 'payload.source must be a non-empty string' };
  }
  if (typeof v.target !== 'string' || v.target.length === 0) {
    return { ok: false, reason: 'payload.target must be a non-empty string' };
  }
  if (v.data === null || typeof v.data !== 'object' || Array.isArray(v.data)) {
    return { ok: false, reason: 'payload.data must be an object' };
  }
  if (v.meta === null || typeof v.meta !== 'object' || Array.isArray(v.meta)) {
    return { ok: false, reason: 'payload.meta must be an object' };
  }

  const meta = v.meta as Record<string, unknown>;
  if (typeof meta.version !== 'string' || !/^\d+\.\d+$/.test(meta.version)) {
    return { ok: false, reason: 'payload.meta.version must match /^\\d+\\.\\d+$/' };
  }
  if (typeof meta.region !== 'string' || meta.region.length === 0) {
    return { ok: false, reason: 'payload.meta.region must be a non-empty string' };
  }

  return {
    ok: true,
    payload: {
      source: v.source,
      target: v.target,
      data: v.data as TData,
      meta: {
        version: meta.version,
        region: meta.region,
      },
    },
  };
}
