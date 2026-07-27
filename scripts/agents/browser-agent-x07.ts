#!/usr/bin/env -S node --experimental-strip-types
// Browser Agent X07 — read-only browser watcher.
//
// Smallest vertical slice of the future Phase 4 org hierarchy
// (docs/architecture/agent-os.md §5, docs/architecture/browser-agent-x07.md).
// X07 crawls ONE route with Playwright/Chromium, classifies console errors,
// failed network requests and UI regressions
// (src/core/runtime/skills/browser-monitoring.ts), and runs the result
// through the EXISTING runtime:
//   - Executor persists a runtime_execution
//   - runtime_events records execution.started / execution.completed
//   - a runtime_approval_gate opens when findings escalate (high/critical)
//
// No new tables. No new orchestration layer. X07 never remediates — it
// only reports; a human (via the approval gate) or Claude Code / Hermes
// downstream decides what happens next.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     npm run agent:browser-x07 -- \
//       --url https://realsyncdynamics.ai/pricing \
//       --tenant-id <uuid> \
//       --selector "[data-cta=primary]" --width 390 --height 844
//
// `--tenant-id` is required today because `runtime_executions.tenant_id`
// is NOT NULL (see agent-os.md §2 "Tenant-Isolation ist nicht
// verhandelbar."). There is no platform-scope (non-tenant) execution yet —
// this is a tracked gap, not something this script works around; point it
// at an internal ops tenant until Phase 4 defines that scope properly (see
// the gap analysis in docs/architecture/browser-agent-x07.md).

import { chromium } from 'playwright-core';
import { createClient } from '@supabase/supabase-js';
import {
  Executor,
  HandlerRegistry,
  InMemoryEventBus,
  SkillRegistry,
  type ApprovalGateService,
  type PermissionChecker,
} from '../../src/core/runtime';
import {
  SupabaseApprovalGateService,
  SupabaseEventLog,
  SupabaseExecutionTracer,
  TeeEventBus,
} from '../../src/core/runtime/supabase';
import {
  BROWSER_MONITORING_SKILL_ID,
  registerBrowserMonitoringSkill,
  requiresEscalation,
  type BrowserFinding,
  type ConsoleErrorEntry,
  type InspectionResult,
  type NetworkFailureEntry,
  type UiCheckEntry,
} from '../../src/core/runtime/skills/browser-monitoring';

interface CliArgs {
  url: string;
  tenantId: string;
  agentId: string;
  selectors: string[];
  width: number;
  height: number;
}

function parseArgs(argv: string[]): CliArgs {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const url = get('--url');
  const tenantId = get('--tenant-id');
  if (!url) throw new Error('--url is required');
  if (!tenantId) {
    throw new Error(
      '--tenant-id is required (no platform-scope execution yet — see ' +
        'the gap analysis in docs/architecture/browser-agent-x07.md)',
    );
  }
  const selectors = argv.filter((v, i) => argv[i - 1] === '--selector' && v);
  return {
    url,
    tenantId,
    agentId: get('--agent-id') ?? 'browser-agent-x07',
    selectors,
    width: Number(get('--width') ?? 1280),
    height: Number(get('--height') ?? 800),
  };
}

function allowAll(): PermissionChecker {
  return {
    async check() {
      return { outcome: 'granted' as const };
    },
  };
}

interface Telemetry {
  route: string;
  consoleErrors: ConsoleErrorEntry[];
  networkFailures: NetworkFailureEntry[];
  uiChecks: UiCheckEntry[];
}

/**
 * Drives Chromium via Playwright and collects raw telemetry. Deliberately
 * dumb: no classification here — that stays in the pure, tested module
 * (src/core/runtime/skills/browser-monitoring.ts). This function is the
 * concrete substitute for "WebMCP" referenced in the org-structure design;
 * no WebMCP SDK exists in this repo today (see gap analysis).
 */
async function inspect(args: CliArgs): Promise<Telemetry> {
  // Optional override for environments that pin a non-default Chromium
  // revision (e.g. a CI image with its own browser cache). Falls back to
  // Playwright's normal resolution — `npx playwright install chromium`
  // remains the documented one-time setup (see playwright.config.ts).
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;
  const browser = await chromium.launch({ executablePath });
  try {
    const page = await browser.newPage({ viewport: { width: args.width, height: args.height } });

    const consoleCounts = new Map<string, number>();
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const message = msg.text();
      consoleCounts.set(message, (consoleCounts.get(message) ?? 0) + 1);
    });

    const networkFailures: NetworkFailureEntry[] = [];
    page.on('requestfailed', (req) => {
      networkFailures.push({ url: req.url(), errorText: req.failure()?.errorText });
    });
    page.on('response', (res) => {
      if (res.status() >= 400) {
        networkFailures.push({ url: res.url(), status: res.status() });
      }
    });

    await page.goto(args.url, { waitUntil: 'networkidle' });

    const uiChecks: UiCheckEntry[] = [];
    for (const selector of args.selectors) {
      const locator = page.locator(selector).first();
      const found = (await locator.count()) > 0;
      let visible = false;
      let inViewport = false;
      if (found) {
        visible = await locator.isVisible();
        const box = visible ? await locator.boundingBox() : null;
        inViewport =
          !!box &&
          box.x >= 0 &&
          box.y >= 0 &&
          box.x + box.width <= args.width &&
          box.y + box.height <= args.height;
      }
      uiChecks.push({ selector, viewport: { width: args.width, height: args.height }, found, visible, inViewport });
    }

    const consoleErrors: ConsoleErrorEntry[] = Array.from(consoleCounts, ([message, count]) => ({
      message,
      count,
    }));

    return { route: args.url, consoleErrors, networkFailures, uiChecks };
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  const sb = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const registry = new SkillRegistry();
  const handlers = new HandlerRegistry();
  registerBrowserMonitoringSkill(registry, handlers);

  const tracer = new SupabaseExecutionTracer(sb);
  const gates: ApprovalGateService = new SupabaseApprovalGateService(sb);
  const events = new TeeEventBus(new InMemoryEventBus(), [new SupabaseEventLog(sb)]);

  const executor = new Executor({
    registry,
    handlers,
    tracer,
    gates,
    events,
    permissions: allowAll(),
  });

  console.log(`[x07] crawling ${args.url} …`);
  const telemetry = await inspect(args);

  const outcome = await executor.execute({
    tenant_id: args.tenantId,
    agent_id: args.agentId,
    skill_id: BROWSER_MONITORING_SKILL_ID,
    args: telemetry as unknown as Record<string, unknown>,
  });

  if (outcome.status !== 'completed') {
    console.error(`[x07] execution did not complete: ${JSON.stringify(outcome)}`);
    process.exitCode = 1;
    return;
  }

  const result = outcome.output as InspectionResult;
  console.log(`[x07] severity=${result.severity} execution=${outcome.execution_id}`);
  for (const line of result.bulletPoints) console.log(`  - ${line}`);

  const findings: BrowserFinding[] = result.findings;
  if (requiresEscalation(findings)) {
    const gate = await gates.open({
      execution_id: outcome.execution_id,
      reason: `Browser Agent X07: ${result.severity} finding(s) on ${result.route}`,
      risk_level: result.severity === 'critical' ? 'critical' : 'high',
      requested_action: 'browser_monitoring.escalate_finding',
    });
    console.log(`[x07] escalated → runtime_approval_gates:${gate.id} (pending human review)`);
  }
}

main().catch((err) => {
  console.error('[x07] fatal:', err);
  process.exitCode = 1;
});
