/**
 * Contract tests for governance-incidents
 * (supabase/functions/governance-incidents/logic.ts + index.ts).
 *
 * Guards the SPA contract that was broken while the function was a stub:
 * the client sends `op` and expects `ok`; writes land in `incidents`,
 * the table the SPA reads.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildCreateRow,
  buildTransitionPatch,
  isWriterRole,
  STATUSES,
  WRITER_ROLES,
} from '../../supabase/functions/governance-incidents/logic';

const TENANT = '11111111-2222-4333-8444-555555555555';
const NOW = '2026-09-28T10:00:00.000Z';

describe('governance-incidents — buildCreateRow', () => {
  it('builds an open incident with a created timeline entry', () => {
    const r = buildCreateRow({ tenant_id: TENANT, title: '  Leak  ', severity: 'critical', personal_data_affected: true }, 'a@b.de', NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({ tenant_id: TENANT, title: 'Leak', severity: 'critical', status: 'open', personal_data_affected: true });
    expect(r.value.timeline).toEqual([{ timestamp: NOW, actor: 'a@b.de', action: 'created', note: null }]);
  });

  it('defaults severity to high like the table default', () => {
    const r = buildCreateRow({ tenant_id: TENANT, title: 'x' }, 'u', NOW);
    expect(r.ok && r.value.severity).toBe('high');
  });

  it('rejects a missing or non-UUID tenant_id', () => {
    expect(buildCreateRow({ title: 'x' }, 'u', NOW).ok).toBe(false);
    expect(buildCreateRow({ tenant_id: 'evil', title: 'x' }, 'u', NOW).ok).toBe(false);
  });

  it('rejects an empty title, an unknown severity and a bad asset_id', () => {
    expect(buildCreateRow({ tenant_id: TENANT, title: '   ' }, 'u', NOW).ok).toBe(false);
    expect(buildCreateRow({ tenant_id: TENANT, title: 'x', severity: 'apocalyptic' }, 'u', NOW).ok).toBe(false);
    expect(buildCreateRow({ tenant_id: TENANT, title: 'x', asset_id: 'nope' }, 'u', NOW).ok).toBe(false);
  });

  it('ignores client-supplied status and server-owned columns', () => {
    const r = buildCreateRow({ tenant_id: TENANT, title: 'x', status: 'resolved', id: 'evil', notification_deadline_at: 'never' }, 'u', NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.status).toBe('open');
    expect('id' in r.value).toBe(false);
    expect('notification_deadline_at' in r.value).toBe(false);
  });
});

describe('governance-incidents — buildTransitionPatch', () => {
  const current = { status: 'open', timeline: [{ timestamp: 'x', actor: 'u', action: 'created' }] };

  it('appends a timeline entry and keeps the history', () => {
    const r = buildTransitionPatch(current, { status: 'investigating', note: ' checking ' }, 'u', NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.status).toBe('investigating');
    expect(r.value.timeline).toHaveLength(2);
    expect((r.value.timeline as unknown[])[1]).toEqual({ timestamp: NOW, actor: 'u', action: 'status:open->investigating', note: 'checking' });
  });

  it('stamps contained_at, resolved_at and reported_to_authority_at', () => {
    const c = buildTransitionPatch(current, { status: 'contained' }, 'u', NOW);
    const r = buildTransitionPatch(current, { status: 'resolved' }, 'u', NOW);
    const a = buildTransitionPatch(current, { status: 'reported_to_authority', authority_reference: 'LfDI-42' }, 'u', NOW);
    expect(c.ok && c.value.contained_at).toBe(NOW);
    expect(r.ok && r.value.resolved_at).toBe(NOW);
    expect(a.ok && a.value).toMatchObject({ reported_to_authority_at: NOW, authority_reference: 'LfDI-42' });
  });

  it('rejects unknown and unchanged status', () => {
    expect(buildTransitionPatch(current, { status: 'closed' }, 'u', NOW).ok).toBe(false);
    expect(buildTransitionPatch(current, { status: 'open' }, 'u', NOW).ok).toBe(false);
  });

  it('accepts every status the table CHECK allows', () => {
    expect([...STATUSES].sort()).toEqual(['contained', 'investigating', 'open', 'reported_to_authority', 'resolved']);
  });
});

describe('governance-incidents — roles', () => {
  it('lets owner, admin, dpo and editor write, not viewer_auditor or outsiders', () => {
    expect(isWriterRole('owner')).toBe(true);
    expect(isWriterRole('admin')).toBe(true);
    expect(isWriterRole('dpo')).toBe(true);
    expect(isWriterRole('editor')).toBe(true);
    expect(isWriterRole('viewer_auditor')).toBe(false);
    expect(isWriterRole(null)).toBe(false);
  });

  it('does not accept roles the memberships constraint does not know', () => {
    expect(isWriterRole('member')).toBe(false);
    expect(isWriterRole('viewer')).toBe(false);
  });

  it('only lists roles allowed by memberships_role_check', () => {
    const allowed = ['owner', 'admin', 'dpo', 'editor', 'viewer_auditor'];
    for (const r of WRITER_ROLES) expect(allowed).toContain(r);
  });
});

describe('governance-incidents — handler contract (source)', () => {
  const src = readFileSync('supabase/functions/governance-incidents/index.ts', 'utf8');

  it('dispatches on op, not action', () => {
    expect(src).toMatch(/switch \(body\.op\)/);
    expect(src).not.toMatch(/body\.action|const \{ action/);
  });

  it('verifies the caller and checks membership', () => {
    expect(src).toMatch(/auth\.getUser\(\)/);
    expect(src).toMatch(/from\('memberships'\)/);
  });

  it('writes the table the SPA reads', () => {
    expect(src).toMatch(/from\('incidents'\)\.insert/);
    expect(src).not.toMatch(/governance_incidents'\)\s*\.insert/);
  });

  it('transitions with compare-and-set on the row version it read, 409 on a lost race', () => {
    // The timeline is appended in JS (read-modify-write). Without a version
    // predicate two concurrent transitions silently drop timeline entries
    // (last writer wins). Status alone is not enough: a reopen makes
    // open → investigating → open match the read status again, so the
    // trigger-maintained updated_at is the version.
    const transition = src.slice(src.indexOf('async function handleTransition'));
    expect(transition).toMatch(/select\('id, tenant_id, status, timeline, updated_at'\)/);
    const update = transition.match(/\.update\(built\.value\)([\s\S]*?)\.select\('\*'\)/);
    expect(update).not.toBeNull();
    expect(update![1]).toMatch(/\.eq\('id', current\.id\)/);
    expect(update![1]).toMatch(/\.eq\('updated_at', current\.updated_at\)/);
    expect(update![1]).toMatch(/\.eq\('status', current\.status\)/);
    expect(transition).toMatch(/\.maybeSingle\(\);\s*if \(error\) throw error;\s*if \(!data\) return jsonError\(409, 'CONFLICT'/);
  });
});
