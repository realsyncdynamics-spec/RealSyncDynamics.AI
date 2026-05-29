/**
 * Typed Evidence Layer v0 — Phase B1 implementation of the Evidence Graph.
 *
 * Pure type-layer + factory helpers. No DB writes, no AJV/Zod, no network.
 * Consumers import RuntimeEvent + EvidenceGraphNode/Relation from this file
 * alone — keine zusaetzliche Surface zu kennen.
 *
 * Siehe: docs/architecture/evidence-graph-rfc.md fuer die Semantik des
 * Causal-Governance-History-Modells.
 */

// Re-export RuntimeEvent for convenience — consumers only need this file.
export type { RuntimeEvent, RuntimeEventType, RuntimeSeverity } from './runtime-event';

import type { RuntimeSeverity } from './runtime-event';

// ─── Node ID ────────────────────────────────────────────────────────────────

/**
 * Opaque node identifier. Format: `egn_<uuid>` prefix ensures no collision
 * with RuntimeEvent IDs (which use `crypto.randomUUID()` without prefix).
 */
export type EvidenceGraphNodeId = `egn_${string}`;

export function createNodeId(): EvidenceGraphNodeId {
  const raw =
    typeof globalThis !== 'undefined' &&
    (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.()
      ? (globalThis as { crypto?: { randomUUID: () => string } }).crypto!.randomUUID()
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return `egn_${raw}`;
}

// ─── Base Node ──────────────────────────────────────────────────────────────

export interface EvidenceGraphNodeBase {
  node_id: EvidenceGraphNodeId;
  node_type: string;                   // narrowed by each concrete type
  tenant_id?: string;
  created_at: string;                  // ISO-8601
  superseded_by?: EvidenceGraphNodeId; // immutability: never delete, only supersede
  content_hash?: string;               // SHA-256 of canonical JSON (filled by hasher, not here)
  spec_version: '0.1';
}

// ─── RuntimeEventNode ───────────────────────────────────────────────────────

/** Wraps a RuntimeEvent. Every graph path starts here. */
export interface RuntimeEventNode extends EvidenceGraphNodeBase {
  node_type: 'runtime_event';
  event_id: string;  // → RuntimeEvent.id
}

// ─── EvidenceNode ───────────────────────────────────────────────────────────

export type EvidenceType =
  | 'scan_result'
  | 'policy_match'
  | 'vendor_response'
  | 'manual_review'
  | 'ai_finding';

export interface EvidenceNode extends EvidenceGraphNodeBase {
  node_type: 'evidence';
  evidence_type: EvidenceType;
  anchored_by: EvidenceGraphNodeId;  // → RuntimeEventNode.node_id
  severity?: RuntimeSeverity;
  source_ref?: string;               // URL or file path
}

// ─── IncidentNode ───────────────────────────────────────────────────────────

export type IncidentStatus = 'open' | 'investigating' | 'resolved' | 'closed';

export interface IncidentNode extends EvidenceGraphNodeBase {
  node_type: 'incident';
  triggered_by: EvidenceGraphNodeId[];  // → EvidenceNode.node_id[] (min 1)
  title?: string;
  severity?: RuntimeSeverity;
  status: IncidentStatus;
  detected_by?: string;  // agent name or system ID
}

// ─── Union type for Phase B1 (only the 3 nodes implemented so far) ──────────

export type EvidenceGraphNode =
  | RuntimeEventNode
  | EvidenceNode
  | IncidentNode;

// ─── Relation ───────────────────────────────────────────────────────────────

export type EvidenceRelationType =
  | 'anchored_by'
  | 'triggered_by'
  | 'caused_by'
  | 'supersedes';

export interface EvidenceRelation {
  relation_id: EvidenceGraphNodeId;
  relation_type: EvidenceRelationType;
  source_node_id: EvidenceGraphNodeId;
  target_node_id: EvidenceGraphNodeId;
  created_at: string;
  tenant_id?: string;
}

// ─── Factory helpers ─────────────────────────────────────────────────────────

/**
 * Creates a RuntimeEventNode wrapping an existing RuntimeEvent.id.
 * Does NOT write to DB. Does NOT validate the referenced event.
 */
export function createRuntimeEventNode(
  input: Pick<RuntimeEventNode, 'event_id' | 'tenant_id'>,
): RuntimeEventNode {
  return {
    node_id: createNodeId(),
    node_type: 'runtime_event',
    event_id: input.event_id,
    tenant_id: input.tenant_id,
    created_at: new Date().toISOString(),
    spec_version: '0.1',
  };
}

/**
 * Creates an EvidenceNode anchored to a RuntimeEventNode.
 */
export function createEvidenceNode(
  input: Pick<EvidenceNode, 'evidence_type' | 'anchored_by' | 'tenant_id' | 'severity' | 'source_ref'>,
): EvidenceNode {
  return {
    node_id: createNodeId(),
    node_type: 'evidence',
    evidence_type: input.evidence_type,
    anchored_by: input.anchored_by,
    tenant_id: input.tenant_id,
    severity: input.severity,
    source_ref: input.source_ref,
    created_at: new Date().toISOString(),
    spec_version: '0.1',
  };
}

/**
 * Creates an IncidentNode triggered by one or more EvidenceNodes.
 */
export function createIncidentNode(
  input: Pick<IncidentNode, 'triggered_by' | 'tenant_id' | 'title' | 'severity' | 'detected_by'> & {
    status?: IncidentStatus;
  },
): IncidentNode {
  return {
    node_id: createNodeId(),
    node_type: 'incident',
    triggered_by: input.triggered_by,
    tenant_id: input.tenant_id,
    title: input.title,
    severity: input.severity,
    status: input.status ?? 'open',
    detected_by: input.detected_by,
    created_at: new Date().toISOString(),
    spec_version: '0.1',
  };
}

/**
 * Creates a relation between two nodes.
 */
export function createEvidenceRelation(
  input: Pick<EvidenceRelation, 'relation_type' | 'source_node_id' | 'target_node_id' | 'tenant_id'>,
): EvidenceRelation {
  return {
    relation_id: createNodeId(),
    relation_type: input.relation_type,
    source_node_id: input.source_node_id,
    target_node_id: input.target_node_id,
    tenant_id: input.tenant_id,
    created_at: new Date().toISOString(),
  };
}
