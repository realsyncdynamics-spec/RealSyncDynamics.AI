import { describe, expect, it, vi } from 'vitest';
import {
  createSiteOsExecutor,
  type SiteOsCommandSurface,
} from '../../../src/features/siteos/commandExecutor';
import { openCommandSession, runUntilTerminal, type CommandSession } from '../../../src/core/realsync-os';
import type { BuildResponse, SiteOverviewRow } from '../../../src/features/siteos/siteOsApi';

const okBuild = (overrides: Partial<BuildResponse> = {}): { kind: 'ok'; data: BuildResponse } => ({
  kind: 'ok',
  data: {
    ok: true,
    unchanged: false,
    blueprint_id: 'bp-9',
    slug: 'acme',
    version: 4,
    content_sha256: 'hash',
    findings: [],
    scores: { health: 40 } as BuildResponse['scores'],
    ...overrides,
  },
});

const acmeSite: SiteOverviewRow = {
  slug: 'acme',
  name: 'Acme',
  industry: 'saas',
  blueprint_id: 'bp-1',
  version: 3,
  status: 'draft',
  content_sha256: 'abc',
  created_at: '2026-09-08T00:00:00.000Z',
  health: 12,
  risk: null,
  compliance: null,
  performance: null,
  ai_risk: null,
  severity_max: null,
  last_scan_at: null,
};

function surface(overrides: Partial<SiteOsCommandSurface> = {}): SiteOsCommandSurface {
  return {
    listSites: vi.fn(async () => []),
    listAgentRuns: vi.fn(async () => []),
    buildSite: vi.fn(async () => ({ kind: 'error', message: 'not called' })),
    runScan: vi.fn(async () => ({ kind: 'error', message: 'not called' })),
    runAgent: vi.fn(async () => ({ kind: 'error', message: 'not called' })),
    evaluatePublish: vi.fn(async () => ({ kind: 'error', message: 'not called' })),
    ...overrides,
  };
}

function approvedWebsiteSession(): CommandSession {
  const session = openCommandSession({
    id: 'i1',
    text: 'Landingpage bauen, SEO prüfen, DSGVO prüfen und publish',
    tenantId: 't1',
    actorId: 'u1',
    createdAt: '2026-09-08T00:00:00.000Z',
  });
  session.approved = true;
  session.phase = 'approved';
  return session;
}

describe('createSiteOsExecutor', () => {
  it('lists real sites for analyze_project and does not invent scores', async () => {
    const commands = surface({
      listSites: vi.fn(async () => [acmeSite]),
    });
    const executeStep = createSiteOsExecutor('t1', commands);
    const result = await executeStep({
      step: { id: 'analyse', title: 'x', agent: 'architect', action: 'analyze_project', risk: 'low', requiresApproval: false, dependsOn: [] },
      session: approvedWebsiteSession(),
    });
    expect(result.status).toBe('succeeded');
    expect(result.observation?.count).toBe(1);
    expect(result.artifacts?.blueprintId).toBe('bp-1');
  });

  it('calls builder for write_frontend', async () => {
    const commands = surface({
      buildSite: vi.fn(async () => okBuild()),
    });
    const executeStep = createSiteOsExecutor('t1', commands);
    const result = await executeStep({
      step: { id: 'build', title: 'x', agent: 'developer', action: 'write_frontend', risk: 'medium', requiresApproval: false, dependsOn: [] },
      session: approvedWebsiteSession(),
    });
    expect(result.status).toBe('succeeded');
    expect(commands.buildSite).toHaveBeenCalledTimes(1);
    expect(result.artifacts?.blueprintId).toBe('bp-9');
  });

  it('does not invent a SiteOS agent run when none is queued', async () => {
    const commands = surface({
      listAgentRuns: vi.fn(async () => []),
      runAgent: vi.fn(async () => ({ kind: 'ok' as const, data: { ran: true, applied: ['fake'] } })),
    });
    const executeStep = createSiteOsExecutor('t1', commands);
    const result = await executeStep({
      step: { id: 'seo', title: 'x', agent: 'seo', action: 'optimize_visibility', risk: 'low', requiresApproval: false, dependsOn: [] },
      session: approvedWebsiteSession(),
    });
    expect(commands.runAgent).not.toHaveBeenCalled();
    expect(result.status).toBe('succeeded');
    expect(result.observation?.ran).toBe(false);
  });

  it('does not auto-approve a waiting SiteOS agent run', async () => {
    const commands = surface({
      listAgentRuns: vi.fn(async () => ([{
        id: 'run-1',
        agent: 'compliance' as const,
        status: 'awaiting_approval' as const,
        finding_codes: ['gdpr.missing-policy'],
        severity_max: 'high',
        requires_approval: true,
        blueprint_id: 'bp-1',
        scan_id: null,
        queued_at: '2026-09-08T00:00:00.000Z',
        completed_at: null,
        error_message: null,
      }])),
      runAgent: vi.fn(async () => ({ kind: 'ok' as const, data: { ran: true } })),
    });
    const executeStep = createSiteOsExecutor('t1', commands);
    const result = await executeStep({
      step: { id: 'governance', title: 'x', agent: 'governance', action: 'evaluate_governance', risk: 'high', requiresApproval: true, dependsOn: [] },
      session: approvedWebsiteSession(),
    });
    expect(result.status).toBe('blocked');
    expect(commands.runAgent).not.toHaveBeenCalled();
  });

  it('evaluates the publish gate and never claims a deploy', async () => {
    const commands = surface({
      evaluatePublish: vi.fn(async () => ({
        kind: 'ok' as const,
        data: {
          ok: true as const,
          evaluation: {
            status: 'blocked' as const,
            evidence_complete: false,
            backend_preservation: 'unknown' as const,
            policy_compliant: false,
            human_approval_required: true,
            publishable: false,
            evaluated_at: '2026-09-08T00:00:00.000Z',
            evaluation_id: 'ev-1',
            artifact_sha256: 'hash',
            blockers: ['human approval required'],
            warnings: [],
          },
        },
      })),
    });
    const executeStep = createSiteOsExecutor('t1', commands);
    const session = approvedWebsiteSession();
    session.artifacts.blueprintId = 'bp-1';
    const result = await executeStep({
      step: { id: 'deploy', title: 'x', agent: 'deployment', action: 'publish', risk: 'critical', requiresApproval: true, dependsOn: [] },
      session,
    });
    expect(result.status).toBe('blocked');
    expect(result.observation?.deployed).toBe(false);
    expect(result.observation?.publishable).toBe(false);
  });

  it('does not scan without a live URL', async () => {
    const commands = surface();
    const executeStep = createSiteOsExecutor('t1', commands);
    const result = await executeStep({
      step: { id: 'qa', title: 'x', agent: 'qa', action: 'verify_frontend', risk: 'medium', requiresApproval: false, dependsOn: [] },
      session: approvedWebsiteSession(),
    });
    expect(result.status).toBe('not_implemented');
    expect(commands.runScan).not.toHaveBeenCalled();
  });

  it('stops the OS loop on NOT IMPLEMENTED instead of skipping', async () => {
    const commands = surface({
      listSites: vi.fn(async () => []),
      buildSite: vi.fn(async () => okBuild()),
    });
    const session = approvedWebsiteSession();
    await runUntilTerminal(session, { executeStep: createSiteOsExecutor('t1', commands) });
    expect(session.phase).toBe('blocked');
    expect(session.artifacts.designProject).toBeTruthy();
    expect(session.steps.find((step) => step.stepId === 'blueprint')?.status).toBe('succeeded');
    expect(session.steps.find((step) => step.stepId === 'publish')?.notImplemented).toBe(true);
    expect(commands.buildSite).not.toHaveBeenCalled();
  });
});
