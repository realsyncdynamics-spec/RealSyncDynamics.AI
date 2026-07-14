import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuditLogger, logAuditEvent } from '../auditLogger';

describe('AuditLogger', () => {
  beforeEach(() => {
    AuditLogger.clear();
  });

  afterEach(() => {
    AuditLogger.clear();
  });

  it('should create and store audit log entries', () => {
    const entry = AuditLogger.log({
      actor: {
        userId: 'user_1',
        email: 'test@example.de',
      },
      action: 'audit_started',
      resource: {
        type: 'audit',
        id: 'audit_123',
        name: 'Example.de Audit',
      },
      details: { scanType: 'full' },
      result: 'success',
    });

    expect(entry).toHaveProperty('id');
    expect(entry).toHaveProperty('timestamp');
    expect(entry).toHaveProperty('hash');
    expect(entry.action).toBe('audit_started');
  });

  it('should retrieve logs by resource', () => {
    AuditLogger.log({
      actor: { userId: 'user_1', email: 'test@example.de' },
      action: 'audit_started',
      resource: { type: 'audit', id: 'audit_123' },
      details: {},
      result: 'success',
    });

    AuditLogger.log({
      actor: { userId: 'user_1', email: 'test@example.de' },
      action: 'scan_completed',
      resource: { type: 'audit', id: 'audit_123' },
      details: { issuesFound: 5 },
      result: 'success',
    });

    AuditLogger.log({
      actor: { userId: 'user_1', email: 'test@example.de' },
      action: 'audit_started',
      resource: { type: 'audit', id: 'audit_456' },
      details: {},
      result: 'success',
    });

    const logsForAudit123 = AuditLogger.getLogsForResource('audit', 'audit_123');
    expect(logsForAudit123).toHaveLength(2);
    expect(logsForAudit123[0].action).toBe('audit_started');
    expect(logsForAudit123[1].action).toBe('scan_completed');
  });

  it('should export audit trail with hash verification', () => {
    AuditLogger.log({
      actor: { userId: 'user_1', email: 'test@example.de' },
      action: 'audit_started',
      resource: { type: 'audit', id: 'audit_123' },
      details: {},
      result: 'success',
    });

    AuditLogger.log({
      actor: { userId: 'user_1', email: 'test@example.de' },
      action: 'scan_completed',
      resource: { type: 'audit', id: 'audit_123' },
      details: { issuesFound: 5 },
      result: 'success',
    });

    const trail = AuditLogger.exportTrail();
    expect(trail.logs).toHaveLength(2);
    expect(trail).toHaveProperty('exportDate');
    expect(trail).toHaveProperty('hash');
  });

  it('should support hash chain for revision safety', () => {
    const entry1 = AuditLogger.log({
      actor: { userId: 'user_1', email: 'test@example.de' },
      action: 'action_1',
      resource: { type: 'audit', id: 'audit_123' },
      details: {},
      result: 'success',
    });

    const entry2 = AuditLogger.log({
      actor: { userId: 'user_1', email: 'test@example.de' },
      action: 'action_2',
      resource: { type: 'audit', id: 'audit_123' },
      details: {},
      result: 'success',
    });

    expect(entry2.previousHash).toBe(entry1.hash);
  });

  it('should use logAuditEvent convenience function', () => {
    const entry = logAuditEvent(
      'checkout_completed',
      { type: 'billing', id: 'checkout_123', name: 'Growth Plan' },
      { planKey: 'growth', amount: 249 },
      'success'
    );

    expect(entry.action).toBe('checkout_completed');
    expect(entry.resource.type).toBe('billing');
  });

  it('should filter logs by date range in export', () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    AuditLogger.log({
      actor: { userId: 'user_1', email: 'test@example.de' },
      action: 'action_1',
      resource: { type: 'audit', id: 'audit_123' },
      details: {},
      result: 'success',
    });

    const trail = AuditLogger.exportTrail(yesterday, now);
    expect(trail.logs.length).toBeGreaterThanOrEqual(1);
  });
});
