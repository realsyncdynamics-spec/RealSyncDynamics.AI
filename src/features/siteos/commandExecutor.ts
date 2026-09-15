// SiteOS substrate for the RealSync OS command loop.
//
// The kernel stays free of Supabase. This file is the only place that maps
// plan steps onto existing SiteOS client calls. It never invents runs,
// scores, or a successful production deploy.

import type { AgentKey } from '../../../packages/siteos-core/src/index';
import type { StepExecutor, StepExecutorContext } from '../../core/realsync-os';
import {
  buildSite,
  errorMessage,
  evaluatePublish,
  listAgentRuns,
  listSites,
  runAgent,
  runScan,
  type AgentRunRow,
  type SiteOsResult,
} from './siteOsApi';

export type SiteOsCommandSurface = {
  listSites: typeof listSites;
  listAgentRuns: typeof listAgentRuns;
  buildSite: typeof buildSite;
  runScan: typeof runScan;
  runAgent: typeof runAgent;
  evaluatePublish: typeof evaluatePublish;
};

const LIVE_COMMANDS: SiteOsCommandSurface = {
  listSites,
  listAgentRuns,
  buildSite,
  runScan,
  runAgent,
  evaluatePublish,
};

function unwrapError<T>(result: SiteOsResult<T>): { ok: true; data: T } | { ok: false; reason: string } {
  if (result.kind === 'ok') return { ok: true, data: result.data };
  return { ok: false, reason: errorMessage(result) };
}

function agentForAction(action: string): AgentKey | null {
  if (action === 'optimize_visibility') return 'seo';
  if (action === 'evaluate_governance') return 'compliance';
  if (action === 'verify_frontend') return 'accessibility';
  return null;
}

async function runMappedAgent(
  commands: SiteOsCommandSurface,
  tenantId: string,
  action: string,
): Promise<{ status: 'succeeded' | 'blocked' | 'failed'; reason?: string; observation: Record<string, unknown>; artifacts?: { agentRunId?: string } }> {
  const agent = agentForAction(action);
  if (agent === null) {
    return { status: 'failed', reason: `No SiteOS agent mapped for ${action}`, observation: {} };
  }

  let runs: AgentRunRow[];
  try {
    runs = await commands.listAgentRuns(tenantId);
  } catch (error) {
    return { status: 'failed', reason: (error as Error).message, observation: { agent } };
  }

  const awaiting = runs.find((run) => run.agent === agent && run.status === 'awaiting_approval');
  if (awaiting) {
    return {
      status: 'blocked',
      reason: `SiteOS ${agent} run ${awaiting.id} requires its own approval gate.`,
      observation: { agent, runId: awaiting.id, status: awaiting.status },
      artifacts: { agentRunId: awaiting.id },
    };
  }

  const queued = runs.find((run) => run.agent === agent && run.status === 'queued');
  if (!queued) {
    return {
      status: 'succeeded',
      observation: {
        agent,
        ran: false,
        reason: `no queued SiteOS ${agent} run — queue one from a runtime scan or build`,
      },
    };
  }

  const result = await commands.runAgent(tenantId, queued.id);
  const unwrapped = unwrapError(result);
  if (!unwrapped.ok) {
    return { status: 'failed', reason: unwrapped.reason, observation: { agent, runId: queued.id } };
  }

  return {
    status: 'succeeded',
    observation: {
      agent,
      ran: unwrapped.data.ran,
      applied: unwrapped.data.applied ?? [],
      runId: queued.id,
    },
    artifacts: { agentRunId: queued.id },
  };
}

export function createSiteOsExecutor(
  tenantId: string,
  commands: SiteOsCommandSurface = LIVE_COMMANDS,
): StepExecutor {
  return async ({ step, session }: StepExecutorContext) => {
    if (!tenantId) {
      return { status: 'failed', reason: 'tenant_id required', tool: 'siteos' };
    }

    try {
      if (step.action === 'analyze_project' || step.action === 'discover') {
        const sites = await commands.listSites(tenantId);
        return {
          status: 'succeeded',
          tool: 'siteos.listSites',
          observation: {
            count: sites.length,
            sites: sites.map((site) => ({ slug: site.slug, name: site.name, status: site.status })),
          },
          artifacts: {
            sites: sites.map((site) => ({ slug: site.slug, name: site.name, status: site.status })),
            blueprintId: sites[0]?.blueprint_id,
            slug: sites[0]?.slug,
          },
        };
      }

      if (step.action === 'create_design_system') {
        return {
          status: 'succeeded',
          tool: 'siteos.builder',
          observation: {
            note: 'Design tokens are produced by siteos/builder together with the blueprint. There is no separate DesignOS API yet.',
          },
        };
      }

      if (step.action === 'write_frontend') {
        const result = await commands.buildSite({
          tenant_id: tenantId,
          prompt: session.intent.text,
          project_id: session.intent.projectId,
        });
        const unwrapped = unwrapError(result);
        if (!unwrapped.ok) {
          return { status: 'failed', tool: 'siteos.builder', reason: unwrapped.reason };
        }
        return {
          status: 'succeeded',
          tool: 'siteos.builder',
          observation: {
            unchanged: unwrapped.data.unchanged,
            slug: unwrapped.data.slug,
            version: unwrapped.data.version,
            findings: unwrapped.data.findings.length,
            health: unwrapped.data.scores.health,
            content_sha256: unwrapped.data.content_sha256,
          },
          artifacts: {
            blueprintId: unwrapped.data.blueprint_id,
            slug: unwrapped.data.slug,
            contentSha256: unwrapped.data.content_sha256,
          },
        };
      }

      if (step.action === 'verify_frontend') {
        const url = session.artifacts.siteUrl;
        if (!url) {
          return {
            status: 'not_implemented',
            tool: 'siteos.runtime-scan',
            reason: 'NOT IMPLEMENTED: no live URL to scan. Connect a website or provide a URL first.',
          };
        }
        const result = await commands.runScan({
          tenant_id: tenantId,
          url,
          blueprint_id: session.artifacts.blueprintId,
          trigger: 'agent',
        });
        const unwrapped = unwrapError(result);
        if (!unwrapped.ok) {
          return { status: 'failed', tool: 'siteos.runtime-scan', reason: unwrapped.reason };
        }
        return {
          status: 'succeeded',
          tool: 'siteos.runtime-scan',
          observation: {
            scan_id: unwrapped.data.scan_id,
            findings: unwrapped.data.findings.length,
            health: unwrapped.data.scores.health,
          },
          artifacts: { scanId: unwrapped.data.scan_id },
        };
      }

      if (step.action === 'optimize_visibility' || step.action === 'evaluate_governance') {
        const mapped = await runMappedAgent(commands, tenantId, step.action);
        return {
          status: mapped.status,
          tool: step.action === 'optimize_visibility' ? 'siteos.agents.seo' : 'siteos.agents.compliance',
          reason: mapped.reason,
          observation: mapped.observation,
          artifacts: mapped.artifacts,
        };
      }

      if (step.action === 'publish') {
        if (!session.artifacts.blueprintId) {
          return {
            status: 'not_implemented',
            tool: 'siteos.publish-gate',
            reason: 'NOT IMPLEMENTED: no blueprint to evaluate. Build a site first.',
          };
        }
        const result = await commands.evaluatePublish({
          tenant_id: tenantId,
          blueprint_id: session.artifacts.blueprintId,
        });
        const unwrapped = unwrapError(result);
        if (!unwrapped.ok) {
          return { status: 'failed', tool: 'siteos.publish-gate', reason: unwrapped.reason };
        }
        const evaluation = unwrapped.data.evaluation;
        return {
          status: evaluation.publishable ? 'succeeded' : 'blocked',
          tool: 'siteos.publish-gate',
          reason: evaluation.publishable
            ? 'Publish gate passed. Production deploy still requires a separate approval.'
            : evaluation.blockers.join('; ') || 'Publish gate blocked.',
          observation: {
            publishable: evaluation.publishable,
            status: evaluation.status,
            blockers: evaluation.blockers,
            warnings: evaluation.warnings,
            evaluation_id: evaluation.evaluation_id,
            artifact_sha256: evaluation.artifact_sha256,
            deployed: false,
          },
        };
      }

      if (step.action === 'refine_plan') {
        return {
          status: 'succeeded',
          tool: 'kernel',
          observation: { capabilities: session.plan.capabilities, steps: session.plan.steps.length },
        };
      }

      return {
        status: 'not_implemented',
        tool: `siteos.unknown:${step.action}`,
        reason: `NOT IMPLEMENTED: no SiteOS mapping for ${step.action}.`,
      };
    } catch (error) {
      return { status: 'failed', tool: 'siteos', reason: (error as Error).message };
    }
  };
}
