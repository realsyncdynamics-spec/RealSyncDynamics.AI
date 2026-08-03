/**
 * Browser-Agent Handler
 *
 * Registered with Agent OS Orchestrator as 'browser-agent'.
 * Orchestrates: scan initiation → playwright-scanner → logging → evidence chain.
 *
 * Hard Rules (§11, CLAUDE.md):
 * - Never auto-approve policy violations
 * - All browser actions logged with evidence hash
 * - Graceful failure with audit trail
 * - Multi-tenant isolation via tenant_id
 */

import type { HandlerContext, HandlerResult } from '../agent-os/orchestrator';
import type {
  BrowserAgentTaskInput,
  BrowserScanResult,
  BrowserActionLogPayload,
} from './types';
import { PlaywrightScannerClient, ScannerError } from './scanner-client';

export interface BrowserAgentOptions {
  scannerBaseUrl: string;
  scannerApiKey: string;
  browserActionLogUrl: string;
  browserActionLogApiKey: string;
}

/**
 * Handle a browser-agent task: navigate, scan, log, verify.
 */
export async function createBrowserAgentHandler(opts: BrowserAgentOptions) {
  const scanner = new PlaywrightScannerClient({
    baseUrl: opts.scannerBaseUrl,
    apiKey: opts.scannerApiKey,
  });

  return async function handleBrowserTask(ctx: HandlerContext): Promise<HandlerResult> {
    const input = ctx.task.input as unknown as BrowserAgentTaskInput;

    // Validate input
    if (!input?.url || !input?.tenant_id) {
      return {
        outcome: 'failed',
        reason: 'Missing required fields: url, tenant_id',
        content: null,
      };
    }

    const sessionId = ctx.task.id; // use task id as session id for correlation
    const startedAt = new Date().toISOString();

    try {
      // Log: scan initiated
      await logBrowserAction(opts, {
        tenant_id: input.tenant_id,
        session_id: sessionId,
        workflow_id: ctx.task.id,
        browser_action: 'scan_start',
        status: 'started',
        url: input.url,
        started_at: startedAt,
        metadata: { scan_type: input.scan_type },
      });

      // Execute scan via playwright-scanner
      const result = await scanner.scan(input.url, {
        timeout: input.timeout_ms ?? 30000,
        waitFor: input.waitFor,
        user_agent: input.user_agent,
      });

      // Compute evidence hash
      const evidenceHash = await sha256(JSON.stringify(result));
      result.evidence_hash = evidenceHash;

      const completedAt = new Date().toISOString();

      // Log: scan completed
      await logBrowserAction(opts, {
        tenant_id: input.tenant_id,
        session_id: sessionId,
        workflow_id: ctx.task.id,
        browser_action: 'scan_complete',
        status: 'completed',
        url: input.url,
        started_at: startedAt,
        completed_at: completedAt,
        duration_ms: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
        evidence_hash: evidenceHash,
        evidence_size_bytes: result.evidence_size_bytes,
        metadata: {
          scan_type: input.scan_type,
          risk_score: result.risk_score,
          systems_found: result.systems_found.length,
          trackers_found: result.trackers_found.length,
        },
      });

      // Record observations
      ctx.observe({
        category: 'browser_scan',
        severity: riskLevelToSeverity(result.risk_score),
        title: `Browser scan completed: ${result.systems_found.length} systems, ${result.trackers_found.length} trackers`,
        detail: `Risk score: ${result.risk_score}/5. Policy violations: ${result.policy_violations.length}`,
        data: {
          scan_type: input.scan_type,
          risk_score: result.risk_score,
          systems_count: result.systems_found.length,
          trackers_count: result.trackers_found.length,
          violations_count: result.policy_violations.length,
        },
      });

      // If policy violations detected, propose a decision (but never auto-approve)
      if (result.policy_violations.length > 0) {
        ctx.propose({
          decision_title: `Review ${result.policy_violations.length} policy violations from browser scan`,
          problem: `Browser scan detected ${result.policy_violations.length} governance rule violations at ${input.url}`,
          options: [
            {
              label: 'Review and remediate',
              detail: 'Audit violations and take corrective action',
              impact: 'Ensures compliance with governance policies',
            },
            {
              label: 'Acknowledge risk and proceed',
              detail: 'Accept the compliance gap for now',
              impact: 'Risk remains unmitigated',
            },
          ],
          recommendation: 'Review and remediate',
          reason: `Risk score ${result.risk_score}/5. Violations require human judgment.`,
          risk_level: result.risk_score >= 4 ? 'critical' : 'high',
          reversibility: 'reversible',
        });

        ctx.observe({
          category: 'governance_signal',
          severity: 'high',
          title: 'Policy violations detected',
          detail: `${result.policy_violations.length} governance rules violated`,
          data: {
            violation_count: result.policy_violations.length,
            violations: result.policy_violations,
            url: input.url,
          },
        });
      }

      return {
        content: {
          url: input.url,
          scan_type: input.scan_type,
          systems_found: result.systems_found,
          trackers_found: result.trackers_found,
          risk_score: result.risk_score,
          policy_violations: result.policy_violations,
          evidence_hash: evidenceHash,
        },
        self_confidence: 95, // high confidence in scan execution
        evidence: [evidenceHash],
        risk_dimensions: result.risk_score > 2 ? ['compliance', 'third_party_risk'] : [],
        outcome: 'done',
      };
    } catch (err) {
      const completedAt = new Date().toISOString();
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorCode = err instanceof ScannerError ? err.code : 'UNKNOWN';

      // Log failure
      await logBrowserAction(opts, {
        tenant_id: input.tenant_id,
        session_id: sessionId,
        workflow_id: ctx.task.id,
        browser_action: 'scan_start',
        status: 'failed',
        url: input.url,
        started_at: startedAt,
        completed_at: completedAt,
        error_message: errorMessage,
        error_code: errorCode,
      }).catch((logErr) => {
        console.error('[browser-agent] Failed to log error:', logErr);
      });

      ctx.observe({
        category: 'error',
        severity: 'high',
        title: 'Browser scan failed',
        detail: `${errorCode}: ${errorMessage}`,
        data: { error_code: errorCode },
      });

      return {
        outcome: 'failed',
        reason: `Scan failed: ${errorCode} — ${errorMessage}`,
        content: { error_code: errorCode, error_message: errorMessage },
      };
    }
  };
}

/**
 * Log browser action via browser-action-log Edge Function.
 */
async function logBrowserAction(
  opts: BrowserAgentOptions,
  payload: BrowserActionLogPayload
): Promise<void> {
  const response = await fetch(opts.browserActionLogUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${opts.browserActionLogApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to log browser action: ${response.status} ${response.statusText}`
    );
  }
}

/**
 * Compute SHA-256 hash of data (works in Deno, Node, Browser).
 */
async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const msgUint8 = encoder.encode(data);
  // Web Crypto API available in Deno, Node 15+, modern browsers
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Map risk score to event severity.
 */
function riskLevelToSeverity(riskScore: number): 'info' | 'low' | 'medium' | 'high' | 'critical' {
  if (riskScore >= 4) return 'critical';
  if (riskScore >= 3) return 'high';
  if (riskScore >= 2) return 'medium';
  if (riskScore >= 1) return 'low';
  return 'info';
}
