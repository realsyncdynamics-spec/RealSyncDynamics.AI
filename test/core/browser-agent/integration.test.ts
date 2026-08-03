/**
 * Browser-Agent Integration Tests
 *
 * Tests the complete flow:
 * Agent Task → Handler → PlaywrightScanner → browser-action-log
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Orchestrator } from '../../../src/core/agent-os/orchestrator';
import { createBrowserAgentHandler } from '../../../src/core/browser-agent/handler';
import type { BrowserAgentTaskInput } from '../../../src/core/browser-agent/types';

describe('Browser-Agent Integration', () => {
  let orchestrator: Orchestrator;

  beforeEach(() => {
    orchestrator = new Orchestrator();

    // Mock fetch for both scanner and logger
    global.fetch = vi.fn((url: string) => {
      // Mock playwright-scanner
      if (url.includes('/scan')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              url: 'https://example.com',
              meta: {
                duration_ms: 2500,
                redirect_chain: [],
                fetched_status: 200,
              },
              cookies: [
                {
                  name: '_ga',
                  value_preview: '12345678...',
                  domain: 'example.com',
                  category: 'tracking',
                  third_party: false,
                  set_before_consent: false,
                },
              ],
              trackers: [
                {
                  id: 'google-analytics',
                  name: 'Google Analytics',
                  category: 'analytics',
                  pattern_matched: 'google-analytics.com',
                  consent_compliant: false,
                  loaded_before_consent: true,
                },
              ],
              third_party_hosts: ['google-analytics.com'],
              unknown_third_party_scripts: [],
              network_requests_count: 42,
              score: 65,
              severity: 'high',
              summary: 'Medium-high risk profile',
            }),
            { status: 200 }
          )
        );
      }

      // Mock browser-action-log
      if (url.includes('browser-action-log')) {
        return Promise.resolve(
          new Response(JSON.stringify({ success: true, id: 'log-123' }), {
            status: 201,
          })
        );
      }

      return Promise.reject(new Error(`Unmocked URL: ${url}`));
    });
  });

  it('should execute full browser scan workflow', async () => {
    // Register browser-agent
    orchestrator.registerAgent(
      'browser-agent',
      await createBrowserAgentHandler({
        scannerBaseUrl: 'http://localhost:3000',
        scannerApiKey: 'test-key',
        browserActionLogUrl: 'http://localhost:54321/functions/v1/browser-action-log',
        browserActionLogApiKey: 'test-log-key',
      })
    );

    // Create a task
    const taskInput: BrowserAgentTaskInput = {
      url: 'https://example.com',
      tenant_id: 'tenant_test_123',
      scan_type: 'audit',
      timeout_ms: 30000,
    };

    const task = orchestrator.store.createTask({
      tenant_id: 'tenant_test_123',
      agent: 'browser-agent',
      task: 'Audit example.com for compliance',
      input: taskInput,
      priority: 'normal',
    });

    expect(task.status).toBe('open');

    // Execute
    const result = await orchestrator.run(task.id);

    // Verify task completion
    expect(result?.status).toBe('done');
    expect(result?.output).toBeDefined();

    // Verify output structure (orchestrator wraps in { output_id, content })
    const output = result?.output as Record<string, unknown>;
    const content = output.content as Record<string, unknown>;
    expect(content.url).toBe('https://example.com');
    expect(content.systems_found).toBeDefined();
    expect(content.trackers_found).toBeDefined();
    expect(content.risk_score).toBeDefined();
    expect(content.evidence_hash).toBeDefined();
  });

  it('should record observations for high-risk scans', async () => {
    orchestrator.registerAgent(
      'browser-agent',
      await createBrowserAgentHandler({
        scannerBaseUrl: 'http://localhost:3000',
        scannerApiKey: 'test-key',
        browserActionLogUrl: 'http://localhost:54321/functions/v1/browser-action-log',
        browserActionLogApiKey: 'test-log-key',
      })
    );

    const task = orchestrator.store.createTask({
      tenant_id: 'tenant_obs_123',
      agent: 'browser-agent',
      task: 'Scan and observe',
      input: {
        url: 'https://example.com',
        tenant_id: 'tenant_obs_123',
        scan_type: 'audit',
      },
      priority: 'high',
    });

    await orchestrator.run(task.id);

    // Query observations
    const obs = orchestrator.store.listObservations({ tenant_id: 'tenant_obs_123' });

    expect(obs.length).toBeGreaterThan(0);
    expect(obs[0].category).toBe('browser_scan');
  });

  it('should handle scanner failures gracefully', async () => {
    // Mock scanner failure
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/scan')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: false,
              error: {
                code: 'INVALID_URL',
                message: 'URL validation failed',
              },
            }),
            { status: 400 }
          )
        );
      }
      // browser-action-log
      return Promise.resolve(
        new Response(JSON.stringify({ success: true }), { status: 201 })
      );
    });

    orchestrator.registerAgent(
      'browser-agent',
      await createBrowserAgentHandler({
        scannerBaseUrl: 'http://localhost:3000',
        scannerApiKey: 'test-key',
        browserActionLogUrl: 'http://localhost:54321/functions/v1/browser-action-log',
        browserActionLogApiKey: 'test-log-key',
      })
    );

    const task = orchestrator.store.createTask({
      tenant_id: 'tenant_fail_123',
      agent: 'browser-agent',
      task: 'Scan with error',
      input: {
        url: 'not-a-valid-url',
        tenant_id: 'tenant_fail_123',
        scan_type: 'audit',
      },
      priority: 'normal',
    });

    const result = await orchestrator.run(task.id);

    // Should fail gracefully with reason
    expect(result?.status).toBe('failed');
    expect(result?.blocker_reason).toBeDefined();
    expect(result?.blocker_reason).toMatch(/INVALID_URL/);
  });

  it('should respect multi-tenant isolation', async () => {
    orchestrator.registerAgent(
      'browser-agent',
      await createBrowserAgentHandler({
        scannerBaseUrl: 'http://localhost:3000',
        scannerApiKey: 'test-key',
        browserActionLogUrl: 'http://localhost:54321/functions/v1/browser-action-log',
        browserActionLogApiKey: 'test-log-key',
      })
    );

    // Create tasks for two different tenants
    const task1 = orchestrator.store.createTask({
      tenant_id: 'tenant_a',
      agent: 'browser-agent',
      task: 'Scan A',
      input: {
        url: 'https://example.com',
        tenant_id: 'tenant_a',
        scan_type: 'discovery',
      },
      priority: 'normal',
    });

    const task2 = orchestrator.store.createTask({
      tenant_id: 'tenant_b',
      agent: 'browser-agent',
      task: 'Scan B',
      input: {
        url: 'https://example.com',
        tenant_id: 'tenant_b',
        scan_type: 'discovery',
      },
      priority: 'normal',
    });

    await orchestrator.run(task1.id);
    await orchestrator.run(task2.id);

    // Verify observations are isolated by tenant
    const obsA = orchestrator.store.listObservations({ tenant_id: 'tenant_a' });
    const obsB = orchestrator.store.listObservations({ tenant_id: 'tenant_b' });

    expect(obsA.length).toBeGreaterThan(0);
    expect(obsB.length).toBeGreaterThan(0);
    expect(obsA[0].tenant_id).toBe('tenant_a');
    expect(obsB[0].tenant_id).toBe('tenant_b');
  });
});
