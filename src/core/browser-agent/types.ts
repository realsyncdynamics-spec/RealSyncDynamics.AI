/**
 * Browser-Agent Types
 *
 * Autonomous browser navigation + governance enforcement.
 * Integrates with playwright-scanner microservice + browser-action-log Edge Function.
 */

export type BrowserScanType = 'audit' | 'discovery' | 'policy_check';

export interface BrowserAgentTaskInput {
  /** Target URL to scan */
  url: string;
  /** Tenant owning this scan */
  tenant_id: string;
  /** Scan type: full audit, AI-system discovery, or policy enforcement */
  scan_type: BrowserScanType;
  /** Max wait time (ms) */
  timeout_ms?: number;
  /** Wait for selector before capture (e.g., '#cookie-banner') */
  waitFor?: string;
  /** Custom User-Agent */
  user_agent?: string;
  [key: string]: unknown;
}

export interface BrowserSystemFound {
  name: string;
  category: 'ai_model' | 'tracking' | 'vendor' | 'unknown';
  risk_level: 'critical' | 'high' | 'medium' | 'low';
  evidence_url?: string;
  policy_violations?: string[];
}

export interface BrowserTrackerFound {
  id: string;
  name: string;
  category: 'essential' | 'tracking' | 'unknown';
  pattern_matched: string;
  loaded_before_consent: boolean;
}

export interface BrowserScanResult {
  url: string;
  scan_type: BrowserScanType;
  status: 'completed' | 'failed' | 'blocked';

  // Discovery results
  systems_found: BrowserSystemFound[];
  trackers_found: BrowserTrackerFound[];
  third_party_hosts: string[];

  // Policy assessment
  risk_score: 0 | 1 | 2 | 3 | 4 | 5; // 0=none, 5=critical
  policy_violations: {
    rule_id: string;
    policy_name: string;
    severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
    description: string;
  }[];

  // Audit trail
  duration_ms: number;
  evidence_hash: string; // SHA-256 of scan payload
  evidence_size_bytes: number;
  scanner_version: string;

  // Error handling
  error_message?: string;
  error_code?: string;
}

export interface BrowserActionLogPayload {
  tenant_id: string;
  session_id: string; // browser-agent run id
  workflow_id?: string;
  run_id?: string;
  browser_action: 'scan_start' | 'scan_complete' | 'evidence_generate';
  status: 'started' | 'completed' | 'failed';
  url?: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  evidence_hash?: string;
  evidence_size_bytes?: number;
  error_message?: string;
  error_code?: string;
  metadata?: Record<string, unknown>;
}

export interface PlaywrightScannerRequest {
  url: string;
  options?: {
    timeout?: number;
    waitFor?: string;
    user_agent?: string;
  };
}

export interface PlaywrightScannerResponse {
  ok: boolean;
  url: string;
  meta: {
    duration_ms: number;
    redirect_chain: string[];
    fetched_status: number;
  };
  cookies: Array<{
    name: string;
    domain: string;
    category: string;
    third_party: boolean;
  }>;
  trackers: Array<{
    id: string;
    name: string;
    category: string;
    pattern_matched: string;
    loaded_before_consent: boolean;
  }>;
  third_party_hosts: string[];
  unknown_third_party_scripts: string[];
  network_requests_count: number;
  score: number; // 0-100
  severity: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  error?: {
    code: string;
    message: string;
  };
}
