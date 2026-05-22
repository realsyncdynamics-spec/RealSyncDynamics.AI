/**
 * Vertragstests fuer den RuntimeEvent v0 Konstruktor-Helper.
 *
 * Phase 1: nur Defaults, ID-Generation, generic-Payload-Erhaltung.
 * Keine Validation, keine DB-Operation, keine Netz-Calls.
 */
import { describe, it, expect } from 'vitest';
import {
  createRuntimeEvent,
  type RuntimeEvent,
} from '../../src/types/runtime-event';

describe('createRuntimeEvent', () => {
  it('fuellt id wenn nicht gesetzt', () => {
    const e = createRuntimeEvent({
      type: 'scan.started',
      source: 'system',
      actor: { type: 'system' },
      payload: {},
    });
    expect(typeof e.id).toBe('string');
    expect(e.id.length).toBeGreaterThan(0);
  });

  it('respektiert explizit gesetzte id', () => {
    const e = createRuntimeEvent({
      id: 'evt-fixed-1',
      type: 'scan.started',
      source: 'system',
      actor: { type: 'system' },
      payload: {},
    });
    expect(e.id).toBe('evt-fixed-1');
  });

  it('defaultet spec_version auf "0.2" (kernel-v1-aware)', () => {
    const e = createRuntimeEvent({
      type: 'scan.started',
      source: 'system',
      actor: { type: 'system' },
      payload: {},
    });
    expect(e.spec_version).toBe('0.2');
  });

  it('respektiert explizit gesetzte spec_version="0.1" (back-compat)', () => {
    const e = createRuntimeEvent({
      spec_version: '0.1',
      type: 'scan.started',
      source: 'system',
      actor: { type: 'system' },
      payload: {},
    });
    expect(e.spec_version).toBe('0.1');
  });

  it('preserved kernel-v1 envelope fields (event_tier, subject_ref, agent_ref, trace_id, retention_class, replayable, cost_snapshot)', () => {
    const e = createRuntimeEvent({
      type: 'ai.risk_classified',
      source: 'ai_probe',
      actor: { type: 'agent', id: 'ai-risk-agent' },
      payload: {},
      event_tier: 'T1',
      subject_ref: 'hmac:abc123',
      agent_ref: 'ai-risk-agent:v1:0.4.2',
      trace_id: '11111111-1111-4111-8111-111111111111',
      retention_class: '3y',
      replayable: true,
      cost_snapshot: {
        model_ref: 'claude-opus-4-7',
        input_tokens: 1240,
        output_tokens: 312,
        total_usd: 0.042,
      },
    });
    expect(e.event_tier).toBe('T1');
    expect(e.subject_ref).toBe('hmac:abc123');
    expect(e.agent_ref).toBe('ai-risk-agent:v1:0.4.2');
    expect(e.trace_id).toBe('11111111-1111-4111-8111-111111111111');
    expect(e.retention_class).toBe('3y');
    expect(e.replayable).toBe(true);
    expect(e.cost_snapshot?.total_usd).toBe(0.042);
    expect(e.cost_snapshot?.input_tokens).toBe(1240);
  });

  it('laesst kernel-v1 envelope fields undefined wenn nicht gesetzt', () => {
    const e = createRuntimeEvent({
      type: 'scan.started',
      source: 'system',
      actor: { type: 'system' },
      payload: {},
    });
    expect(e.event_tier).toBeUndefined();
    expect(e.subject_ref).toBeUndefined();
    expect(e.agent_ref).toBeUndefined();
    expect(e.trace_id).toBeUndefined();
    expect(e.retention_class).toBeUndefined();
    expect(e.replayable).toBeUndefined();
    expect(e.cost_snapshot).toBeUndefined();
  });

  it('setzt created_at als ISO-Datums-String', () => {
    const e = createRuntimeEvent({
      type: 'scan.started',
      source: 'system',
      actor: { type: 'system' },
      payload: {},
    });
    expect(typeof e.created_at).toBe('string');
    expect(e.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
    // Roundtrip-Pruefung
    expect(Number.isNaN(new Date(e.created_at).getTime())).toBe(false);
  });

  it('defaultet severity auf "info"', () => {
    const e = createRuntimeEvent({
      type: 'scan.started',
      source: 'system',
      actor: { type: 'system' },
      payload: {},
    });
    expect(e.severity).toBe('info');
  });

  it('respektiert explizit gesetzte severity', () => {
    const e = createRuntimeEvent({
      type: 'tracker.pre_consent_detected',
      source: 'browser_collector',
      severity: 'high',
      actor: { type: 'system' },
      payload: {},
    });
    expect(e.severity).toBe('high');
  });

  it('defaultet review_status auf "not_required"', () => {
    const e = createRuntimeEvent({
      type: 'scan.completed',
      source: 'system',
      actor: { type: 'system' },
      payload: {},
    });
    expect(e.review_status).toBe('not_required');
  });

  it('respektiert explizit gesetzten review_status', () => {
    const e = createRuntimeEvent({
      type: 'policy.violation_detected',
      source: 'policy_engine',
      review_status: 'review_required',
      actor: { type: 'agent', id: 'policy-agent' },
      payload: {},
    });
    expect(e.review_status).toBe('review_required');
  });

  it('preserved tenant_id, session_id, correlation_id, causation_id', () => {
    const e = createRuntimeEvent({
      tenant_id: 't-1',
      session_id: 's-1',
      correlation_id: 'c-1',
      causation_id: 'parent-event-id',
      type: 'incident.opened',
      source: 'governance_agent',
      actor: { type: 'agent', id: 'triage-agent' },
      payload: {},
    });
    expect(e.tenant_id).toBe('t-1');
    expect(e.session_id).toBe('s-1');
    expect(e.correlation_id).toBe('c-1');
    expect(e.causation_id).toBe('parent-event-id');
  });

  it('erlaubt evidence_refs', () => {
    const e = createRuntimeEvent({
      type: 'evidence.created',
      source: 'evidence_engine',
      actor: { type: 'agent', id: 'evidence-agent' },
      payload: {},
      evidence_refs: [
        {
          id: 'ev-1',
          type: 'dom_snapshot',
          sha256: 'a'.repeat(64),
          url: 'https://example.de',
          created_at: '2026-05-20T00:00:00.000Z',
        },
      ],
    });
    expect(e.evidence_refs).toHaveLength(1);
    expect(e.evidence_refs![0].type).toBe('dom_snapshot');
    expect(e.evidence_refs![0].sha256).toBe('a'.repeat(64));
  });

  it('erlaubt generisches Payload (Type-erhaltend)', () => {
    interface TrackerPayload {
      vendor_domain: string;
      vendor_country: string;
      request_url: string;
    }
    const e: RuntimeEvent<TrackerPayload> = createRuntimeEvent<TrackerPayload>({
      type: 'tracker.pre_consent_detected',
      source: 'browser_collector',
      actor: { type: 'system' },
      payload: {
        vendor_domain: 'googletagmanager.com',
        vendor_country: 'US',
        request_url: 'https://www.googletagmanager.com/gtm.js',
      },
    });
    // Compile-time: payload ist als TrackerPayload typisiert; runtime-check folgt.
    expect(e.payload.vendor_domain).toBe('googletagmanager.com');
    expect(e.payload.vendor_country).toBe('US');
    expect(e.payload.request_url.startsWith('https://')).toBe(true);
  });

  it('erzeugt unterschiedliche ids bei wiederholten Aufrufen ohne id', () => {
    const a = createRuntimeEvent({
      type: 'scan.started',
      source: 'system',
      actor: { type: 'system' },
      payload: {},
    });
    const b = createRuntimeEvent({
      type: 'scan.started',
      source: 'system',
      actor: { type: 'system' },
      payload: {},
    });
    expect(a.id).not.toBe(b.id);
  });
});
