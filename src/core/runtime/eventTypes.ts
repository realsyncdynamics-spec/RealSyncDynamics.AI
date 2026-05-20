/**
 * Operational Event Vocabulary (Phase 1, Conversation 18.05.2026).
 *
 * Diese Datei ergänzt die zwei bereits existierenden Event-Familien:
 *
 *   - `RuntimeEventName`     (`./types.ts`)           — interne Skill-Lifecycle-Events.
 *   - `GovernanceEventName`  (`./governanceEvents.ts`) — adjudicate Governance-Signale.
 *
 * Hier ist die *operative* Schicht: Was die Datensammler (Scanner,
 * AI-Telemetry-SDK, Browser-Extension) *beobachten*, bevor die
 * Risk/Drift/Policy-Engines daraus eine Governance-Aussage machen.
 *
 * Die Trennung ist bewusst:
 *
 *   beobachten      → operationale Events (diese Datei)
 *   bewerten        → `risk.*` (operational, hier definiert)
 *   adjudizieren    → GovernanceEventName (frozen, governanceEvents.ts)
 *
 * Persistenz für beide operativen und Governance-Events: `public.runtime_events`
 * (Spalte `name`). Severity/Category werden gemäß `OPERATIONAL_EVENT_DEFAULTS`
 * vorbelegt, dürfen aber pro Event überschrieben werden.
 *
 * Konvention für neue Namen: `<domain>.<verb_in_past_tense>` —
 * Beispiel `scan.executed`, niemals `executeScan`.
 *
 * Hinzufügen ja, ändern oder entfernen nein. Jede Änderung ist eine
 * Breaking Change für den Customer-Evidence-Trail.
 */

import type { Severity } from './governanceEvents';

// ─── Vocabulary ─────────────────────────────────────────────────────────────

export const OPERATIONAL_EVENT_NAMES = [
  // Scanner
  'scan.executed',
  'scan.failed',

  // AI-Telemetrie (vor Adjudication)
  'ai.request.detected',
  'ai.endpoint.used',

  // Risk-Engine
  'risk.assessed',
  'risk.high',
  'risk.low',

  // Policy-Engine
  'policy.checked',
  'policy.violation',

  // Drift-Engine
  'drift.detected',

  // Evidence
  'evidence.created',
] as const;

export type OperationalEventName = (typeof OPERATIONAL_EVENT_NAMES)[number];

export function isOperationalEventName(value: string): value is OperationalEventName {
  return (OPERATIONAL_EVENT_NAMES as readonly string[]).includes(value);
}

// ─── ESS-Mapping (subject → category / default severity) ────────────────────

/** ESS v1.0 category (Untermenge — siehe `spec/runtime/schemas/event.schema.json`). */
export type OperationalCategory = 'governance' | 'ai' | 'platform' | 'evidence';

export interface OperationalEventDefaults {
  category: OperationalCategory;
  severity: Severity;
}

/**
 * Default-Category und -Severity pro Operational-Event. Diese Werte
 * fließen in `public.runtime_events.payload.meta` und in die ESS-konforme
 * Repräsentation, wenn ein Operational-Event in einen `event.schema.json`-
 * Wire-Format-Event übersetzt wird.
 *
 * Pro Event-Instanz darf die Severity nach oben oder unten korrigiert
 * werden (z. B. `scan.executed` mit 0 Findings → `info`, mit > 5
 * High-Risk-Findings → `high`). Die Werte hier sind *Defaults*, keine
 * harten Constraints.
 */
export const OPERATIONAL_EVENT_DEFAULTS: Record<OperationalEventName, OperationalEventDefaults> = {
  'scan.executed':         { category: 'platform',   severity: 'info' },
  'scan.failed':           { category: 'platform',   severity: 'medium' },
  'ai.request.detected':   { category: 'ai',         severity: 'info' },
  'ai.endpoint.used':      { category: 'ai',         severity: 'info' },
  'risk.assessed':         { category: 'governance', severity: 'info' },
  'risk.high':             { category: 'governance', severity: 'high' },
  'risk.low':              { category: 'governance', severity: 'low' },
  'policy.checked':        { category: 'governance', severity: 'info' },
  'policy.violation':      { category: 'governance', severity: 'high' },
  'drift.detected':        { category: 'governance', severity: 'medium' },
  'evidence.created':      { category: 'evidence',   severity: 'info' },
};

// ─── Combined name space (für Konsumenten, die alle drei kennen müssen) ─────

/**
 * Re-exportiert für Konsumenten, die ALLE drei Event-Familien unterscheiden
 * müssen (z. B. der Event-Bus). Lifecycle- und Governance-Namen werden hier
 * nicht dupliziert; der Konsument importiert sie aus den Quell-Dateien.
 *
 * Verwendung:
 *
 *   import type { RuntimeEventName } from './types';
 *   import type { GovernanceEventName } from './governanceEvents';
 *   import type { OperationalEventName } from './eventTypes';
 *   type AnyEventName = RuntimeEventName | GovernanceEventName | OperationalEventName;
 */
