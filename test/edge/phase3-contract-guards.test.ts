/**
 * Guardrails for Phase 3. These source-level checks complement (but cannot
 * replace) integration tests against PostgreSQL, RLS and real Edge Functions.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = (path: string) => readFileSync(resolve(__dirname, '../../', path), 'utf8');

describe('Phase 3 — automation trigger and runner wiring', () => {
  it('does not treat the trigger acknowledgment as a completed audit', () => {
    const runner = source('src/features/automations/AutomationSkillRunner.tsx');
    expect(runner).toContain('setRunId(body.run_id)');
    expect(runner).toContain('parseAuditRunResult(data.result)');
    expect(runner).toContain(".eq('tenant_id', tenantId).eq('id', runId)");
    expect(runner).not.toContain('setResult(body.result');
  });

  it('does not advertise an unlinked n8n workflow as executable', () => {
    const runner = source('src/features/automations/AutomationSkillRunner.tsx');
    expect(runner).toContain("binding !== 'connected'");
    expect(runner).toContain("n8n_workflow_id");
  });

  it('fails closed on unavailable or missing tenant allowance', () => {
    const trigger = source('supabase/functions/automation-trigger/index.ts');
    expect(trigger).toContain('if (entResp.error)');
    expect(trigger).toContain("'ENTITLEMENT_UNAVAILABLE'");
    expect(trigger).toContain("'QUOTA_NOT_CONFIGURED'");
  });

  it('prevents duplicate terminal callback updates via compare-and-set', () => {
    const callback = source('supabase/functions/automation-callback/index.ts');
    expect(callback).toContain(".in('status', ['queued', 'running']).select('id').maybeSingle()");
    expect(callback).toContain("'ALREADY_FINISHED'");
  });
});

describe('Phase 3 — DPIA approval gates', () => {
  it('rejects direct status=approved mutations', () => {
    const dpia = source('supabase/functions/governance-dpias/index.ts');
    expect(dpia).toContain("if (patch.status === 'approved')");
    expect(dpia).toContain("'APPROVAL_REQUIRED'");
    expect(dpia).toContain("if (row.status === 'approved')");
  });

  it('requires in_review and uses compare-and-set for approval', () => {
    const dpia = source('supabase/functions/governance-dpias/index.ts');
    expect(dpia).toContain("if (row.status !== 'in_review')");
    expect(dpia).toContain(".eq('id', id).eq('status', 'in_review')");
    expect(dpia).toContain(".eq('id', id).eq('status', row.status)");
    expect(dpia).toContain("'CONFLICT'");
  });
});
