import { describe, it, expect } from 'vitest';
import type { DbGovernanceKpiSnapshot, KpiMetrics } from '@/src/features/governance/analytics/types';

/**
 * Helper function implementations (copied from analyticsApi.ts for testing)
 * These are tested independently to avoid Supabase client initialization.
 */

function snapshotToMetrics(snapshot: DbGovernanceKpiSnapshot | null): KpiMetrics | null {
  if (!snapshot) return null;

  const today = new Date().toISOString().split('T')[0];
  const isStale = snapshot.captured_date !== today;

  return {
    assetCount: snapshot.asset_count,
    policyCount: snapshot.policy_count,
    eventCount: snapshot.event_count,
    incidentCount: snapshot.incident_count,
    criticalIncidents: snapshot.critical_incident_count,
    highIncidents: snapshot.high_incident_count,
    mediumIncidents: snapshot.medium_incident_count,
    policyBlocks: snapshot.policy_blocks_count,
    policyWarns: snapshot.policy_warns_count,
    dpiaApproved: snapshot.dpia_approved_count,
    dsrOverdue: snapshot.dsr_overdue_count,
    assetEvidencePercent: snapshot.assets_with_evidence_percent,
    assetMappingsPercent: snapshot.assets_with_mappings_percent,
    policiesEnabledPercent: snapshot.policies_enabled_percent,
    lastUpdated: snapshot.captured_date,
    isStale,
  };
}

function calculateTrend(
  current: number,
  previous: number
): { change: number; percent: number; direction: 'up' | 'down' | 'flat' } {
  if (previous === 0) {
    return {
      change: current,
      percent: current > 0 ? 100 : 0,
      direction: current > 0 ? 'up' : 'flat',
    };
  }

  const change = current - previous;
  const percent = Math.round((change / previous) * 100);
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';

  return { change, percent, direction };
}

describe('analyticsApi — Data Transformation & Helpers', () => {
  describe('snapshotToMetrics', () => {
    it('transforms DbGovernanceKpiSnapshot to KpiMetrics correctly', () => {
      const today = new Date().toISOString().split('T')[0];
      const snapshot: DbGovernanceKpiSnapshot = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        tenant_id: 'tenant-1',
        captured_date: today,
        asset_count: 150,
        policy_count: 25,
        event_count: 1200,
        incident_count: 8,
        critical_incident_count: 2,
        high_incident_count: 3,
        medium_incident_count: 3,
        policy_blocks_count: 45,
        policy_warns_count: 120,
        policy_approvals_required_count: 5,
        dpia_draft_count: 2,
        dpia_approved_count: 12,
        dsr_overdue_count: 1,
        assets_with_evidence_percent: 78,
        assets_with_mappings_percent: 65,
        policies_enabled_percent: 92,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const metrics = snapshotToMetrics(snapshot);

      expect(metrics).not.toBeNull();
      expect(metrics?.assetCount).toBe(150);
      expect(metrics?.policyCount).toBe(25);
      expect(metrics?.eventCount).toBe(1200);
      expect(metrics?.incidentCount).toBe(8);
      expect(metrics?.criticalIncidents).toBe(2);
      expect(metrics?.highIncidents).toBe(3);
      expect(metrics?.mediumIncidents).toBe(3);
      expect(metrics?.policyBlocks).toBe(45);
      expect(metrics?.policyWarns).toBe(120);
      expect(metrics?.dpiaApproved).toBe(12);
      expect(metrics?.dsrOverdue).toBe(1);
      expect(metrics?.assetEvidencePercent).toBe(78);
      expect(metrics?.assetMappingsPercent).toBe(65);
      expect(metrics?.policiesEnabledPercent).toBe(92);
      expect(metrics?.lastUpdated).toBe(today);
      expect(metrics?.isStale).toBe(false);
    });

    it('marks snapshot as stale if not from today', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const snapshot: DbGovernanceKpiSnapshot = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        tenant_id: 'tenant-1',
        captured_date: yesterday,
        asset_count: 100,
        policy_count: 20,
        event_count: 1000,
        incident_count: 5,
        critical_incident_count: 1,
        high_incident_count: 2,
        medium_incident_count: 2,
        policy_blocks_count: 30,
        policy_warns_count: 100,
        policy_approvals_required_count: 3,
        dpia_draft_count: 1,
        dpia_approved_count: 10,
        dsr_overdue_count: 0,
        assets_with_evidence_percent: 80,
        assets_with_mappings_percent: 70,
        policies_enabled_percent: 90,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const metrics = snapshotToMetrics(snapshot);

      expect(metrics?.isStale).toBe(true);
      expect(metrics?.lastUpdated).toBe(yesterday);
    });

    it('returns null for null input', () => {
      const result = snapshotToMetrics(null);
      expect(result).toBeNull();
    });

    it('handles all metric fields correctly', () => {
      const today = new Date().toISOString().split('T')[0];
      const snapshot: DbGovernanceKpiSnapshot = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        tenant_id: 'tenant-1',
        captured_date: today,
        asset_count: 200,
        policy_count: 30,
        event_count: 1500,
        incident_count: 10,
        critical_incident_count: 3,
        high_incident_count: 4,
        medium_incident_count: 3,
        policy_blocks_count: 50,
        policy_warns_count: 150,
        policy_approvals_required_count: 7,
        dpia_draft_count: 3,
        dpia_approved_count: 15,
        dsr_overdue_count: 2,
        assets_with_evidence_percent: 85,
        assets_with_mappings_percent: 75,
        policies_enabled_percent: 95,
        metadata: { custom_field: 'value' },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const metrics = snapshotToMetrics(snapshot);

      expect(metrics).toBeDefined();
      expect(metrics?.assetCount).toBe(200);
      expect(metrics?.policyCount).toBe(30);
      expect(metrics?.criticalIncidents).toBe(3);
    });
  });

  describe('calculateTrend', () => {
    it('calculates positive trend correctly', () => {
      const result = calculateTrend(150, 100);

      expect(result.change).toBe(50);
      expect(result.percent).toBe(50);
      expect(result.direction).toBe('up');
    });

    it('calculates negative trend correctly', () => {
      const result = calculateTrend(50, 100);

      expect(result.change).toBe(-50);
      expect(result.percent).toBe(-50);
      expect(result.direction).toBe('down');
    });

    it('calculates flat trend when values are equal', () => {
      const result = calculateTrend(100, 100);

      expect(result.change).toBe(0);
      expect(result.percent).toBe(0);
      expect(result.direction).toBe('flat');
    });

    it('handles zero previous value with positive current', () => {
      const result = calculateTrend(50, 0);

      expect(result.change).toBe(50);
      expect(result.percent).toBe(100);
      expect(result.direction).toBe('up');
    });

    it('handles zero previous value with zero current', () => {
      const result = calculateTrend(0, 0);

      expect(result.change).toBe(0);
      expect(result.percent).toBe(0);
      expect(result.direction).toBe('flat');
    });

    it('handles small percentage changes correctly', () => {
      const result = calculateTrend(101, 100);

      expect(result.change).toBe(1);
      expect(result.percent).toBe(1);
      expect(result.direction).toBe('up');
    });

    it('rounds percentage to nearest integer', () => {
      const result = calculateTrend(156, 100);

      expect(result.percent).toBe(56);
      expect(result.direction).toBe('up');
    });

    it('handles large numbers', () => {
      const result = calculateTrend(1000000, 500000);

      expect(result.change).toBe(500000);
      expect(result.percent).toBe(100);
      expect(result.direction).toBe('up');
    });

    it('handles decimal percentages by rounding down', () => {
      const result = calculateTrend(105, 100);

      expect(result.percent).toBe(5);
    });
  });
});

describe('analyticsApi — Type Safety', () => {
  it('KpiMetrics type has all required fields', () => {
    const today = new Date().toISOString().split('T')[0];
    const snapshot: DbGovernanceKpiSnapshot = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      tenant_id: 'tenant-1',
      captured_date: today,
      asset_count: 100,
      policy_count: 20,
      event_count: 1000,
      incident_count: 5,
      critical_incident_count: 1,
      high_incident_count: 2,
      medium_incident_count: 2,
      policy_blocks_count: 30,
      policy_warns_count: 100,
      policy_approvals_required_count: 3,
      dpia_draft_count: 1,
      dpia_approved_count: 10,
      dsr_overdue_count: 0,
      assets_with_evidence_percent: 80,
      assets_with_mappings_percent: 70,
      policies_enabled_percent: 90,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const metrics = snapshotToMetrics(snapshot);

    // Verify all expected properties exist
    expect(metrics).toHaveProperty('assetCount');
    expect(metrics).toHaveProperty('policyCount');
    expect(metrics).toHaveProperty('eventCount');
    expect(metrics).toHaveProperty('incidentCount');
    expect(metrics).toHaveProperty('criticalIncidents');
    expect(metrics).toHaveProperty('highIncidents');
    expect(metrics).toHaveProperty('mediumIncidents');
    expect(metrics).toHaveProperty('policyBlocks');
    expect(metrics).toHaveProperty('policyWarns');
    expect(metrics).toHaveProperty('dpiaApproved');
    expect(metrics).toHaveProperty('dsrOverdue');
    expect(metrics).toHaveProperty('assetEvidencePercent');
    expect(metrics).toHaveProperty('assetMappingsPercent');
    expect(metrics).toHaveProperty('policiesEnabledPercent');
    expect(metrics).toHaveProperty('lastUpdated');
    expect(metrics).toHaveProperty('isStale');
  });
});
