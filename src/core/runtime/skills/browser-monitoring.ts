/**
 * Browser Monitoring — pure classification logic for Browser Agent X07.
 *
 * Scope is intentionally narrow (see docs/architecture/browser-agent-x07.md):
 * Chromium, DOM, console, network, UI regressions. X07 only OBSERVES and
 * REPORTS — it never remediates.
 *
 * This module is a Runtime Core skill in the sense of
 * docs/architecture/agent-os.md §3.1 (manifest + handler), NOT an entry in
 * `src/lib/skills/registry.ts` — that registry is for chat/prompt-routed
 * LLM skills (free-text trigger → guardrail-wrapped prompt). X07 is invoked
 * programmatically on a schedule, never from a user chat turn, so it is
 * registered directly against the Executor's `SkillRegistry` /
 * `HandlerRegistry` instead (see `registerBrowserMonitoringSkill` below).
 *
 * Persistence goes through the EXISTING runtime tables only:
 * `runtime_executions`, `runtime_events`, `runtime_approval_gates`. No new
 * tables, no new orchestration layer.
 */

import type { HandlerContext, HandlerRegistry, HandlerResult, SkillHandler } from '../handlers';
import { defaultHasher } from '../handlers';
import type { SkillRegistry } from '../registry';
import type { SkillManifest } from '../types';

export type BrowserFindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** Worst-first. Mirrors `src/lib/skills/gdprAudit.ts`'s SEVERITY_ORDER shape. */
export const SEVERITY_ORDER: readonly BrowserFindingSeverity[] = [
  'critical',
  'high',
  'medium',
  'low',
  'info',
];

export interface ConsoleErrorEntry {
  message: string;
  source?: string;
  /** How many times this exact message was observed during the crawl. */
  count?: number;
}

export interface NetworkFailureEntry {
  url: string;
  status?: number;
  errorText?: string;
}

export interface UiCheckEntry {
  /** CSS selector under test, e.g. a primary CTA. */
  selector: string;
  viewport: { width: number; height: number };
  found: boolean;
  visible: boolean;
  inViewport: boolean;
}

export interface BrowserFinding {
  category: 'console_error' | 'network_failure' | 'ui_regression';
  severity: BrowserFindingSeverity;
  summary: string;
  detail: string;
}

export interface InspectionResult {
  route: string;
  severity: BrowserFindingSeverity;
  findings: BrowserFinding[];
  /**
   * ≤10 human-readable lines — mirrors the report cap from the Phase 4
   * design (docs/architecture/agent-os.md §5). This is only the
   * execution's output payload, never a persisted "report" row.
   */
  bulletPoints: string[];
}

function worse(a: BrowserFindingSeverity, b: BrowserFindingSeverity): BrowserFindingSeverity {
  return SEVERITY_ORDER.indexOf(a) <= SEVERITY_ORDER.indexOf(b) ? a : b;
}

function safePath(url: string): string {
  try {
    return new URL(url).pathname || url;
  } catch {
    return url;
  }
}

// Known console error patterns → severity. Unmatched messages default to
// 'medium' — loud enough to surface, not so loud it drowns real criticals.
const CONSOLE_PATTERNS: ReadonlyArray<{
  test: RegExp;
  severity: BrowserFindingSeverity;
  label: string;
}> = [
  { test: /uncaught (type|reference)error/i, severity: 'critical', label: 'Uncaught runtime error' },
  { test: /failed to fetch|networkerror/i, severity: 'high', label: 'Fetch failure surfaced in console' },
  { test: /content security policy|refused to/i, severity: 'high', label: 'CSP violation' },
  { test: /deprecat/i, severity: 'low', label: 'Deprecation warning' },
  { test: /warning/i, severity: 'info', label: 'Generic warning' },
];

export function classifyConsoleErrors(entries: readonly ConsoleErrorEntry[]): BrowserFinding[] {
  return entries.map((entry) => {
    const hit = CONSOLE_PATTERNS.find((p) => p.test.test(entry.message));
    const severity = hit?.severity ?? 'medium';
    const label = hit?.label ?? 'Console error';
    const times = entry.count && entry.count > 1 ? ` (×${entry.count})` : '';
    return {
      category: 'console_error',
      severity,
      summary: `${label}${times}`,
      detail: entry.source ? `${entry.message} — ${entry.source}` : entry.message,
    };
  });
}

export function classifyNetworkFailures(entries: readonly NetworkFailureEntry[]): BrowserFinding[] {
  return entries.map((entry) => {
    const status = entry.status ?? 0;
    let severity: BrowserFindingSeverity;
    if (status === 0) severity = 'high'; // DNS failure, timeout, or blocked request
    else if (status >= 500) severity = 'critical';
    else if (status === 404) severity = 'high';
    else if (status >= 400) severity = 'medium';
    else severity = 'low';
    const path = safePath(entry.url);
    return {
      category: 'network_failure',
      severity,
      summary: status ? `HTTP ${status} on ${path}` : `Request failed: ${path}`,
      detail: entry.errorText ? `${entry.url} — ${entry.errorText}` : entry.url,
    };
  });
}

export function classifyUiChecks(entries: readonly UiCheckEntry[]): BrowserFinding[] {
  return entries.map((entry) => {
    const dims = `${entry.viewport.width}×${entry.viewport.height}`;
    if (!entry.found) {
      return {
        category: 'ui_regression',
        severity: 'high',
        summary: `Element not found: ${entry.selector}`,
        detail: `Selector "${entry.selector}" did not resolve to any element at ${dims}.`,
      };
    }
    if (!entry.visible) {
      return {
        category: 'ui_regression',
        severity: 'high',
        summary: `Element hidden: ${entry.selector}`,
        detail: `"${entry.selector}" is present but not visible at ${dims}.`,
      };
    }
    if (!entry.inViewport) {
      return {
        category: 'ui_regression',
        severity: 'medium',
        summary: `Element outside viewport: ${entry.selector}`,
        detail: `"${entry.selector}" is visible but its bounding box falls outside the ${dims} viewport.`,
      };
    }
    return {
      category: 'ui_regression',
      severity: 'info',
      summary: `OK: ${entry.selector}`,
      detail: `"${entry.selector}" visible and in-viewport at ${dims}.`,
    };
  });
}

/**
 * Reduces raw findings to the shape an execution output carries: overall
 * severity plus a capped, worst-first bullet list.
 */
export function buildInspectionResult(
  route: string,
  findings: readonly BrowserFinding[],
): InspectionResult {
  const severity = findings.reduce<BrowserFindingSeverity>((acc, f) => worse(acc, f.severity), 'info');
  const notable = findings
    .filter((f) => f.severity !== 'info')
    .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
    .slice(0, 10)
    .map((f) => `[${f.severity}] ${f.summary}`);
  const bulletPoints = notable.length > 0 ? notable : [`No findings above 'info' on ${route}.`];
  return { route, severity, findings: [...findings], bulletPoints };
}

/**
 * Whether a set of findings should escalate beyond the routine report —
 * i.e. whether the caller should open a `runtime_approval_gates` row.
 * X07 never decides the fix; it only decides whether a human needs to see
 * this before anything downstream (Claude Code / Hermes) acts on it.
 */
export function requiresEscalation(findings: readonly BrowserFinding[]): boolean {
  return findings.some((f) => f.severity === 'critical' || f.severity === 'high');
}

// ---------------------------------------------------------------------------
// Runtime wiring — manifest + handler, registered directly against the
// Executor's registries (see scripts/agents/browser-agent-x07.ts for the
// production wiring with Supabase-backed adapters).
// ---------------------------------------------------------------------------

export const BROWSER_MONITORING_SKILL_ID = 'browser.monitor_route';

export const BROWSER_MONITORING_MANIFEST: SkillManifest = {
  id: BROWSER_MONITORING_SKILL_ID,
  version: 1,
  title: 'Browser Monitoring (X07)',
  description:
    'Read-only Chromium inspection of a single route: console errors, ' +
    'failed network requests, UI regressions. Reports findings; never ' +
    'remediates.',
  capabilities: ['read:website_content', 'network:external'],
  risk_level: 'low',
  // Read-only, no PII, no writes — safe to run unattended on a schedule.
  // Escalation for individual high/critical findings happens separately,
  // via a direct `ApprovalGateService.open()` call keyed to this
  // execution's id (see requiresEscalation() and the runner script) —
  // not by gating the skill itself.
  auto_approve: true,
  pii_class: 'none',
  idempotent: true,
};

export const browserMonitoringHandler: SkillHandler = async (
  ctx: HandlerContext,
): Promise<HandlerResult> => {
  const route = ctx.args.route;
  if (typeof route !== 'string' || route.trim().length === 0) {
    throw new Error('args.route must be a non-empty string');
  }
  const consoleErrors = Array.isArray(ctx.args.consoleErrors) ? ctx.args.consoleErrors : [];
  const networkFailures = Array.isArray(ctx.args.networkFailures) ? ctx.args.networkFailures : [];
  const uiChecks = Array.isArray(ctx.args.uiChecks) ? ctx.args.uiChecks : [];

  const findings = [
    ...classifyConsoleErrors(consoleErrors as ConsoleErrorEntry[]),
    ...classifyNetworkFailures(networkFailures as NetworkFailureEntry[]),
    ...classifyUiChecks(uiChecks as UiCheckEntry[]),
  ];
  const result = buildInspectionResult(route, findings);

  return { output: result, output_hash: defaultHasher(result) };
};

/** Registers X07's skill + handler against a running Executor's registries. */
export function registerBrowserMonitoringSkill(
  registry: SkillRegistry,
  handlers: HandlerRegistry,
): void {
  registry.register(BROWSER_MONITORING_MANIFEST);
  handlers.register(BROWSER_MONITORING_SKILL_ID, browserMonitoringHandler);
}
