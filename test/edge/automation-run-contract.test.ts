import { describe, expect, it } from 'vitest';
import {
  isHttpTarget, isTerminalAutomationStatus, parseAutomationAuditResult,
} from '../../src/features/automations/automationRunContract';

describe('automation run asynchronous contract', () => {
  it('treats queued and running as non-terminal', () => {
    expect(isTerminalAutomationStatus('queued')).toBe(false);
    expect(isTerminalAutomationStatus('running')).toBe(false);
  });

  it('accepts all terminal statuses', () => {
    for (const status of ['success', 'error', 'timeout', 'cancelled']) {
      expect(isTerminalAutomationStatus(status)).toBe(true);
    }
  });

  it('does not invent an audit result from a trigger acknowledgment', () => {
    expect(parseAutomationAuditResult({ ok: true, run_id: 'abc', n8n_execution_id: 'def' })).toBeNull();
  });

  it('does not invent a report from absent or malformed callback data', () => {
    expect(parseAutomationAuditResult(null)).toBeNull();
    expect(parseAutomationAuditResult({ score: 99, issues: [] })).toBeNull();
    expect(parseAutomationAuditResult({ audit_id: 'a', domain: 'a.example', severity: 'low', score: 1000, issues: [] })).toBeNull();
    expect(parseAutomationAuditResult({ audit_id: 'a', domain: 'a.example', severity: 'low', score: 90, issues: [{ title: 'x' }] })).toBeNull();
  });

  it('renders only validated callback report fields', () => {
    expect(parseAutomationAuditResult({
      audit_id: 'test-audit', domain: 'example.com', score: 82, severity: 'medium',
      issues: [{ id: 'issue-1', severity: 'low', title: 'Header fehlt' }],
      coverage_notice: 'Begrenzter Scan',
    })).toEqual({
      audit_id: 'test-audit', domain: 'example.com', score: 82, severity: 'medium',
      issues: [{ id: 'issue-1', severity: 'low', title: 'Header fehlt' }],
      coverage_notice: 'Begrenzter Scan',
    });
  });

  it('allows only HTTP and HTTPS target URLs', () => {
    expect(isHttpTarget('https://example.com')).toBe(true);
    expect(isHttpTarget('http://example.com')).toBe(true);
    expect(isHttpTarget('javascript:alert(1)')).toBe(false);
    expect(isHttpTarget('file:///etc/passwd')).toBe(false);
    expect(isHttpTarget('not a url')).toBe(false);
  });
});
