/**
 * Remediation layer — typed contract for "problem → fix → delivery".
 *
 * The product premise (see `docs/PRODUCT_FOCUS.md`) is that detecting an
 * issue and not offering a concrete remedy is worth far less than the
 * pair. This module defines the *contract*. Concrete remediators (CMS
 * patchers, ticket openers, webhook dispatchers) implement `Remediator`
 * and live next to the systems they remediate, not in `core/runtime/`.
 *
 * Status lifecycle:
 *
 *     drafted → approved → delivered → applied → verified
 *                 ↓             ↓          ↓
 *               denied       failed     reverted
 */

import type { Severity } from './governanceEvents';
import type { RiskLevel } from './types';

export type RemediationStatus =
  | 'drafted'
  | 'approved'
  | 'denied'
  | 'delivered'
  | 'failed'
  | 'applied'
  | 'reverted'
  | 'verified';

/** How the remediation reaches the customer's system. */
export type DeliveryChannel =
  | 'webhook'
  | 'ticket'
  | 'snippet'
  | 'cms_patch'
  | 'manual_review';

/** What the remediation *does*. Discriminated so each kind carries only
 *  the fields it actually needs — no optional grab-bags. */
export type RemediationAction =
  | { kind: 'add_consent_gate'; tracker: string; gate_type: 'reject_until_consent' }
  | { kind: 'remove_tracker'; tracker: string; selector: string }
  | { kind: 'self_host_asset'; original_url: string; vendor: string }
  | { kind: 'inject_consent_sdk'; sdk: string; version: string }
  | { kind: 'add_dpa_record'; vendor: string }
  | { kind: 'open_incident_ticket'; rule_id: string; sla_hours: number }
  | { kind: 'notify_human'; reason: string };

export interface RemediationProblem {
  /** Governance event name this remediation responds to. */
  governance_event: string;
  severity: Severity;
  risk_level: RiskLevel;
  /** Customer-facing target (host, system, vendor). */
  target: string;
  /** One-sentence description used in approval UI. */
  description: string;
}

export interface Remediation {
  id: string;
  tenant_id: string;
  problem: RemediationProblem;
  action: RemediationAction;
  delivery: DeliveryChannel;
  status: RemediationStatus;
  /** Hex-encoded SHA-256 of the canonical problem+action body. Two
   *  remediations with the same fingerprint MUST be de-duped by the
   *  caller — they describe the same fix. */
  fingerprint: string;
  /** ISO-8601. */
  drafted_at: string;
  /** Filled when status transitions out of `drafted`. */
  decided_at?: string;
  decided_by?: string;
}

export interface DeliveryResult {
  ok: boolean;
  /** External reference returned by the channel (ticket id, webhook
   *  response id, applied-snippet hash, …). */
  external_id?: string;
  error?: { code?: string; message: string };
}

/**
 * Contract that every concrete remediator (Jira opener, CMS patcher,
 * webhook dispatcher, …) implements. The runtime calls `deliver()` only
 * after the remediation has reached `approved` status. Implementations
 * MUST be idempotent on `(remediation.id, remediation.fingerprint)`.
 */
export interface Remediator {
  readonly channel: DeliveryChannel;
  /** Whether this remediator can handle the given action. */
  supports(action: RemediationAction): boolean;
  deliver(remediation: Remediation): Promise<DeliveryResult>;
}

/**
 * Simple in-memory registry. Wire concrete remediators at app boot.
 * Production swaps this for a DI-managed version, but the interface
 * stays the same.
 */
export class RemediatorRegistry {
  readonly #byChannel = new Map<DeliveryChannel, Remediator>();

  register(remediator: Remediator): void {
    if (this.#byChannel.has(remediator.channel)) {
      throw new Error(`Remediator already registered for channel: ${remediator.channel}`);
    }
    this.#byChannel.set(remediator.channel, remediator);
  }

  resolve(channel: DeliveryChannel): Remediator | undefined {
    return this.#byChannel.get(channel);
  }

  /** Pick the first registered remediator that supports the given
   *  action. Useful when a remediation is created without a preferred
   *  channel (rare — most remediations name their channel up front). */
  pickFor(action: RemediationAction): Remediator | undefined {
    for (const r of this.#byChannel.values()) {
      if (r.supports(action)) return r;
    }
    return undefined;
  }
}
