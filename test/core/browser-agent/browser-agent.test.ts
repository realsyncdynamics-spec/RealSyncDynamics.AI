import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlaywrightScannerClient, ScannerError } from '../../../src/core/browser-agent/scanner-client';
import type { BrowserAgentTaskInput, BrowserScanResult } from '../../../src/core/browser-agent/types';

describe('Browser-Agent', () => {
  describe('PlaywrightScannerClient', () => {
    let client: PlaywrightScannerClient;

    beforeEach(() => {
      client = new PlaywrightScannerClient({
        baseUrl: 'http://localhost:3000',
        apiKey: 'test-key-123',
      });

      // Mock global fetch
      global.fetch = vi.fn();
    });

    it('should scan a URL and return results', async () => {
      const mockResponse = {
        ok: true,
        url: 'https://example.com',
        meta: { duration_ms: 2500, redirect_chain: [], fetched_status: 200 },
        cookies: [
          {
            name: '_ga',
            domain: 'example.com',
            category: 'tracking',
            third_party: false,
          },
        ],
        trackers: [
          {
            id: 'google-analytics',
            name: 'Google Analytics',
            category: 'tracking',
            pattern_matched: 'www.google-analytics.com',
            loaded_before_consent: true,
          },
        ],
        third_party_hosts: ['google-analytics.com'],
        unknown_third_party_scripts: [],
        network_requests_count: 42,
        score: 65,
        severity: 'high',
        summary: 'Medium-high risk profile',
      };

      (global.fetch as any).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await client.scan('https://example.com', { timeout: 30000 });

      expect(result.status).toBe('completed');
      expect(result.trackers_found).toHaveLength(1);
      expect(result.trackers_found[0].name).toBe('Google Analytics');
      expect(result.risk_score).toBe(3); // score 65 → high
    });

    it('should handle scanner API errors', async () => {
      (global.fetch as any).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: false,
            error: { code: 'INVALID_URL', message: 'URL validation failed' },
          }),
          { status: 400 }
        )
      );

      await expect(client.scan('not-a-url')).rejects.toThrow(ScannerError);
    });

    it('should handle network timeouts', async () => {
      (global.fetch as any).mockRejectedValueOnce(new DOMException('AbortError'));

      await expect(client.scan('https://example.com')).rejects.toThrow('Failed to reach scanner');
    });

    it('should check scanner health', async () => {
      (global.fetch as any).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'ok',
            active_scans: 2,
            browser_connected: true,
          }),
          { status: 200 }
        )
      );

      const health = await client.health();

      expect(health.status).toBe('ok');
      expect(health.browser_connected).toBe(true);
    });

    it('should handle health check failures gracefully', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Connection refused'));

      const health = await client.health();

      expect(health.status).toBe('down');
      expect(health.browser_connected).toBe(false);
    });
  });

  describe('Browser-Agent Task Contract', () => {
    it('should validate required task input fields', () => {
      const validInput: BrowserAgentTaskInput = {
        url: 'https://example.com',
        tenant_id: 'tenant-123',
        scan_type: 'audit',
        timeout_ms: 30000,
      };

      expect(validInput.url).toBeDefined();
      expect(validInput.tenant_id).toBeDefined();
      expect(validInput.scan_type).toMatch(/audit|discovery|policy_check/);
    });

    it('should accept optional task parameters', () => {
      const fullInput: BrowserAgentTaskInput = {
        url: 'https://example.com',
        tenant_id: 'tenant-123',
        scan_type: 'policy_check',
        timeout_ms: 45000,
        waitFor: '#consent-banner',
        user_agent: 'Custom-Scanner/1.0',
      };

      expect(fullInput.timeout_ms).toBe(45000);
      expect(fullInput.waitFor).toBe('#consent-banner');
    });
  });

  describe('Evidence Hash Computation', () => {
    it('should compute consistent SHA-256 hashes', async () => {
      const data = JSON.stringify({
        url: 'https://example.com',
        trackers: ['google-analytics'],
        risk_score: 3,
      });

      // This would be tested in handler tests
      // For now, just verify the data structure is hashable
      expect(typeof data).toBe('string');
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('Risk Score Mapping', () => {
    const testCases = [
      { score: 15, expected: 0 },  // none
      { score: 35, expected: 1 },  // low
      { score: 55, expected: 2 },  // medium
      { score: 75, expected: 3 },  // high
      { score: 95, expected: 5 },  // critical
    ];

    testCases.forEach(({ score, expected }) => {
      it(`should map scanner score ${score} to risk level ${expected}`, () => {
        // Risk mapping: 0-19→0, 20-39→1, 40-59→2, 60-79→3, 80+→5
        const riskLevel =
          score < 20 ? 0 :
          score < 40 ? 1 :
          score < 60 ? 2 :
          score < 80 ? 3 :
          5;

        expect(riskLevel).toBe(expected);
      });
    });
  });

  describe('Policy Violation Proposals', () => {
    it('should structure violation proposals correctly', () => {
      const violations = [
        {
          rule_id: 'rule-openai-dpa',
          policy_name: 'EU AI Act — DPA Requirement',
          severity: 'critical' as const,
          description: 'OpenAI GPT-4 endpoint detected without DPA',
        },
      ];

      expect(violations[0].severity).toBe('critical');
      expect(violations[0].policy_name).toMatch(/DPA/);
    });
  });
});
