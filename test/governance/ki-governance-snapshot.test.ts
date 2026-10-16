import { describe, expect, it } from 'vitest';
import {
  buildKiGovernanceSnapshot, type SnapshotInput,
} from '../../src/features/governance/reporting/kiGovernanceSnapshot';

const TENANT = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const TIME = '2026-10-13T04:00:00.000Z';

function fixture(overrides: Partial<SnapshotInput> = {}): SnapshotInput {
  return {
    tenantId: TENANT,
    generatedAt: TIME,
    websiteAudit: null,
    assets: [],
    vendors: [],
    policies: [],
    evidenceByAsset: new Map(),
    ...overrides,
  };
}

const aiSystem = {
  id: 'ai-1', tenant_id: TENANT, asset_type: 'ai_system' as const,
  name: 'Support-Assistent', ai_act_class: 'unknown' as const,
  status: 'active' as const, owner_email: null, vendor: 'Vendor A',
  intended_purpose: 'Kundenanfragen', data_residency: 'unknown',
  deployment_model: 'vendor_cloud', model_name: 'Modell A',
};

const vendor = {
  id: 'vendor-1', tenant_id: TENANT, name: 'Vendor A',
  dpa_status: 'requested' as const, risk_level: 'medium' as const,
  transfer_mechanism: 'unknown' as const,
};

describe('KI-Governance-Snapshot (read-only, tenant-scoped)', () => {
  it('does not manufacture an overall compliance score or Shadow-AI discovery', () => {
    const result = buildKiGovernanceSnapshot(fixture());
    expect(result.website).toBeNull();
    expect(result.aiSystems).toEqual([]);
    expect(result.competenceEvidence).toBe('not_assessed');
    expect(result.shadowAiDiscovery).toBe('not_performed');
    expect(result.reviewTasks.map((x) => x.code)).toContain('VERIFY_AI_INVENTORY');
    expect(JSON.stringify(result)).not.toMatch(/overallComplianceScore|aiActComplianceScore/);
  });

  it('marks an observed score as website-only, not as DSGVO/AI Act compliance', () => {
    const result = buildKiGovernanceSnapshot(fixture({
      websiteAudit: {
        id: 'audit-1', tenant_id: TENANT, domain: 'example.de',
        score: 78, created_at: TIME,
        issues: [{ id: 'privacy-link', severity: 'medium', title: 'Datenschutzlink',
                   paragraph_ref: 'Art. 13 DSGVO' }],
      },
    }));
    expect(result.website?.websiteScanScore).toBe(78);
    expect(result.website?.scoreScope).toBe('website_only');
    expect(result.website?.source).toBe('technical_scan');
    expect(result.website?.findings[0]?.paragraph_ref).toBe('Art. 13 DSGVO');
  });

  it('uses unknown or not checked instead of fabricated evidence', () => {
    const result = buildKiGovernanceSnapshot(fixture({
      assets: [aiSystem],
      evidenceByAsset: null, // failure to fetch is NOT zero evidence
    }));
    expect(result.aiSystems[0]?.evidenceState).toBe('not_checked');
    expect(result.reviewTasks.map((a) => a.code)).toContain('REVIEW_AI_ACT_CLASS');
    expect(result.reviewTasks.map((a) => a.code)).toContain('ASSIGN_SYSTEM_OWNER');
    expect(result.reviewTasks.map((a) => a.code)).not.toContain('COLLECT_SYSTEM_EVIDENCE');
  });

  it('preserves existing evidence counts without inferring audit-proof compliance', () => {
    const result = buildKiGovernanceSnapshot(fixture({
      assets: [aiSystem],
      evidenceByAsset: new Map([['ai-1', { count: 2, latestAt: TIME }]]),
    }));
    expect(result.aiSystems[0]?.evidenceState).toBe('recorded');
    expect(result.aiSystems[0]?.source).toBe('tenant_registry');
    expect(result.limitations).toContain('Policy-Anzahl und Nachweisanzahl begründen kein rechtliches Konformitätsurteil.');
  });

  it('produces review tasks, not a legal violation verdict, for missing AVV proof', () => {
    const result = buildKiGovernanceSnapshot(fixture({
      vendors: [vendor],
    }));
    expect(result.vendors[0]?.dpaStatus).toBe('requested');
    expect(result.reviewTasks.find((a) => a.code === 'REVIEW_VENDOR_CONTRACT')?.priority)
      .toBe('follow_up');
  });

  it('keeps critical classification a human review task', () => {
    const result = buildKiGovernanceSnapshot(fixture({
      assets: [{ ...aiSystem, ai_act_class: 'prohibited' as const }],
    }));
    expect(result.reviewTasks.find((a) => a.code === 'REVIEW_AI_ACT_OBLIGATIONS')?.priority)
      .toBe('review_now');
  });

  it('only counts explicit enabled tenant policies', () => {
    const result = buildKiGovernanceSnapshot(fixture({
      policies: [
        { id: 'p1', tenant_id: TENANT, enabled: true },
        { id: 'p2', tenant_id: TENANT, enabled: false },
      ],
    }));
    expect(result.activePolicyCount).toBe(1);
  });

  it('fails closed for any cross-tenant joined input', () => {
    expect(() => buildKiGovernanceSnapshot(fixture({
      assets: [{ ...aiSystem, tenant_id: OTHER }],
    }))).toThrow('CROSS_TENANT_REPORT_INPUT');
    expect(() => buildKiGovernanceSnapshot(fixture({
      vendors: [{ ...vendor, tenant_id: null }],
    }))).toThrow('CROSS_TENANT_REPORT_INPUT');
    expect(() => buildKiGovernanceSnapshot(fixture({
      websiteAudit: {
        id: 'audit-2', tenant_id: OTHER, domain: 'other.example',
        score: 1, created_at: TIME, issues: [],
      },
    }))).toThrow('CROSS_TENANT_REPORT_INPUT');
  });
});
