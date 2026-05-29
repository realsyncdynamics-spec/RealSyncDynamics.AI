/**
 * Vertragstests fuer das Typed-Evidence-Layer-v0 (Phase B1).
 *
 * Geprueft werden ausschliesslich die Factory-Helper + Anchor-Chain-Semantik.
 * Kein DB-Roundtrip, kein Netz, kein Hashing — das kommt in Phase B2/B3.
 */
import { describe, it, expect } from 'vitest';
import {
  createNodeId,
  createRuntimeEventNode,
  createEvidenceNode,
  createIncidentNode,
  createEvidenceRelation,
} from '../../src/types/evidence-graph';

describe('Typed Evidence Layer v0 — Phase B1', () => {
  it('createNodeId() liefert einen String mit "egn_"-Prefix', () => {
    const id = createNodeId();
    expect(typeof id).toBe('string');
    expect(id.startsWith('egn_')).toBe(true);
  });

  it('createNodeId() liefert unterschiedliche Werte bei zwei Aufrufen', () => {
    const a = createNodeId();
    const b = createNodeId();
    expect(a).not.toBe(b);
  });

  it('createRuntimeEventNode() — node_type, event_id, spec_version, prefix', () => {
    const node = createRuntimeEventNode({ event_id: 'evt-123', tenant_id: 'tenant-A' });
    expect(node.node_type).toBe('runtime_event');
    expect(node.event_id).toBe('evt-123');
    expect(node.spec_version).toBe('0.1');
    expect(node.node_id.startsWith('egn_')).toBe(true);
    expect(node.tenant_id).toBe('tenant-A');
    expect(typeof node.created_at).toBe('string');
  });

  it('createEvidenceNode() — node_type, anchored_by, evidence_type, spec_version', () => {
    const anchor = createNodeId();
    const node = createEvidenceNode({
      evidence_type: 'scan_result',
      anchored_by: anchor,
      tenant_id: 'tenant-A',
      severity: 'high',
      source_ref: 'https://kunde.de/scan/42',
    });
    expect(node.node_type).toBe('evidence');
    expect(node.anchored_by).toBe(anchor);
    expect(node.evidence_type).toBe('scan_result');
    expect(node.spec_version).toBe('0.1');
    expect(node.severity).toBe('high');
    expect(node.source_ref).toBe('https://kunde.de/scan/42');
  });

  it('createIncidentNode() — node_type, status defaults to "open", triggered_by preserved', () => {
    const evIdA = createNodeId();
    const evIdB = createNodeId();
    const node = createIncidentNode({
      triggered_by: [evIdA, evIdB],
      tenant_id: 'tenant-A',
      title: 'Pre-Consent Tracker',
      severity: 'critical',
      detected_by: 'drift-agent',
    });
    expect(node.node_type).toBe('incident');
    expect(node.status).toBe('open');                // default
    expect(node.triggered_by).toEqual([evIdA, evIdB]);
    expect(node.title).toBe('Pre-Consent Tracker');
    expect(node.severity).toBe('critical');
    expect(node.detected_by).toBe('drift-agent');
  });

  it('createEvidenceRelation() — relation_type, source/target preserved', () => {
    const src = createNodeId();
    const dst = createNodeId();
    const rel = createEvidenceRelation({
      relation_type: 'caused_by',
      source_node_id: src,
      target_node_id: dst,
      tenant_id: 'tenant-A',
    });
    expect(rel.relation_type).toBe('caused_by');
    expect(rel.source_node_id).toBe(src);
    expect(rel.target_node_id).toBe(dst);
    expect(rel.relation_id.startsWith('egn_')).toBe(true);
    expect(rel.tenant_id).toBe('tenant-A');
  });

  it('Anchor-Chain Smoke-Test: RuntimeEventNode → EvidenceNode → IncidentNode', () => {
    const runtimeNode = createRuntimeEventNode({ event_id: 'evt-anchor-1', tenant_id: 't' });
    const evidenceNode = createEvidenceNode({
      evidence_type: 'policy_match',
      anchored_by: runtimeNode.node_id,
      tenant_id: 't',
    });
    expect(evidenceNode.anchored_by).toBe(runtimeNode.node_id);

    const incidentNode = createIncidentNode({
      triggered_by: [evidenceNode.node_id],
      tenant_id: 't',
    });
    expect(incidentNode.triggered_by).toContain(evidenceNode.node_id);
    expect(incidentNode.status).toBe('open');
    // Tenant-Isolation: alle drei Knoten gleicher Tenant.
    expect(runtimeNode.tenant_id).toBe('t');
    expect(evidenceNode.tenant_id).toBe('t');
    expect(incidentNode.tenant_id).toBe('t');
  });

  it('superseded_by ist optional und auf neuen Knoten undefined', () => {
    const a = createRuntimeEventNode({ event_id: 'evt-x' });
    const b = createEvidenceNode({ evidence_type: 'manual_review', anchored_by: a.node_id });
    const c = createIncidentNode({ triggered_by: [b.node_id] });
    expect(a.superseded_by).toBeUndefined();
    expect(b.superseded_by).toBeUndefined();
    expect(c.superseded_by).toBeUndefined();
  });

  it('createRuntimeEventNode() ohne tenant_id — Knoten valide, tenant_id=undefined', () => {
    const node = createRuntimeEventNode({ event_id: 'evt-no-tenant' });
    expect(node.tenant_id).toBeUndefined();
    expect(node.node_type).toBe('runtime_event');
    expect(node.event_id).toBe('evt-no-tenant');
    expect(node.spec_version).toBe('0.1');
  });

  it('createIncidentNode() respektiert explizit gesetzten status', () => {
    const ev = createNodeId();
    const node = createIncidentNode({
      triggered_by: [ev],
      status: 'investigating',
    });
    expect(node.status).toBe('investigating');
  });
});
