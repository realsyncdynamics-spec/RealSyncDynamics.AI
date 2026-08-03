/**
 * Playwright Scanner Client
 *
 * Communicates with the playwright-scanner microservice.
 * Handles authentication, error codes, and response parsing.
 */

import type {
  PlaywrightScannerRequest,
  PlaywrightScannerResponse,
  BrowserScanResult,
} from './types';

export interface ScannerClientOptions {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
}

export class PlaywrightScannerClient {
  private baseUrl: string;
  private apiKey: string;
  private timeoutMs: number;

  constructor(opts: ScannerClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, ''); // strip trailing slash
    this.apiKey = opts.apiKey;
    this.timeoutMs = opts.timeoutMs ?? 60000;
  }

  /**
   * Scan a URL for trackers, third-party scripts, and compliance violations.
   */
  async scan(url: string, options?: {
    timeout?: number;
    waitFor?: string;
    user_agent?: string;
  }): Promise<BrowserScanResult> {
    const payload: PlaywrightScannerRequest = { url, options };

    let response: Response;
    try {
      response = await this.fetchWithTimeout(
        `${this.baseUrl}/scan`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
        this.timeoutMs
      );
    } catch (err) {
      throw new ScannerError('NETWORK_ERROR', `Failed to reach scanner: ${(err as Error).message}`);
    }

    let data: PlaywrightScannerResponse;
    try {
      data = await response.json();
    } catch (err) {
      throw new ScannerError('PARSE_ERROR', `Invalid JSON response: ${response.statusText}`);
    }

    // Handle scanner errors
    if (!response.ok) {
      const scanErr = data.error ?? { code: 'UNKNOWN', message: response.statusText };
      const code = this.normalizeScannerErrorCode(scanErr.code);
      throw new ScannerError(code, scanErr.message);
    }

    if (!data.ok) {
      const scanErr = data.error ?? { code: 'UNKNOWN', message: 'Scanner failed without error details' };
      const code = this.normalizeScannerErrorCode(scanErr.code);
      throw new ScannerError(code, scanErr.message);
    }

    // Transform scanner response → BrowserScanResult
    return this.transformResponse(data, 'discovery');
  }

  /**
   * Check scanner health.
   */
  async health(): Promise<{
    status: 'ok' | 'degraded' | 'down';
    active_scans: number;
    browser_connected: boolean;
  }> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/health`,
        { method: 'GET' },
        5000
      );
      return await response.json();
    } catch (err) {
      return { status: 'down', active_scans: 0, browser_connected: false };
    }
  }

  private transformResponse(
    data: PlaywrightScannerResponse,
    scanType: 'audit' | 'discovery' | 'policy_check'
  ): BrowserScanResult {
    return {
      url: data.url,
      scan_type: scanType,
      status: data.ok ? 'completed' : 'failed',

      systems_found: [], // TODO: AI system classification via pattern matching
      trackers_found: (data.trackers ?? []).map(t => ({
        id: t.id,
        name: t.name,
        category: t.category as 'essential' | 'tracking' | 'unknown',
        pattern_matched: t.pattern_matched,
        loaded_before_consent: t.loaded_before_consent,
      })),
      third_party_hosts: data.third_party_hosts ?? [],

      risk_score: this.scoreToRiskLevel(data.score ?? 0),
      policy_violations: [], // TODO: policy engine integration

      duration_ms: data.meta?.duration_ms ?? 0,
      evidence_hash: '', // will be set by caller after computing SHA-256
      evidence_size_bytes: JSON.stringify(data).length,
      scanner_version: '1.0.0',
    };
  }

  private scoreToRiskLevel(score: number): 0 | 1 | 2 | 3 | 4 | 5 {
    if (score < 20) return 0; // none
    if (score < 40) return 1; // low
    if (score < 60) return 2; // medium
    if (score < 80) return 3; // high
    return 5; // critical
  }

  private normalizeScannerErrorCode(code: string): ScannerError['code'] {
    const validCodes = [
      'NETWORK_ERROR',
      'PARSE_ERROR',
      'UNAUTHORIZED',
      'RATE_LIMITED',
      'INVALID_URL',
      'SCAN_FAILED',
      'TIMEOUT',
      'UNKNOWN',
    ];
    return (validCodes.includes(code) ? code : 'UNKNOWN') as ScannerError['code'];
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export class ScannerError extends Error {
  constructor(
    public code:
      | 'NETWORK_ERROR'
      | 'PARSE_ERROR'
      | 'UNAUTHORIZED'
      | 'RATE_LIMITED'
      | 'INVALID_URL'
      | 'SCAN_FAILED'
      | 'TIMEOUT'
      | 'UNKNOWN',
    message: string
  ) {
    super(message);
    this.name = 'ScannerError';
  }
}
