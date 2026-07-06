import { describe, it, expect } from 'vitest';
import {
  TenantConfig,
  ComplianceScore,
  RiskMetrics,
  DashboardInsight,
  DashboardKPI,
  DashboardSummary,
  WebhookEvent,
  ComplianceAlertRule,
  RemediationTask,
  C2PAManifest,
  APIError,
} from '../src/types';

describe('SDK Types', () => {
  describe('TenantConfig', () => {
    it('should validate basic tenant config structure', () => {
      const config: TenantConfig = {
        id: 'tenant-1',
        name: 'Test Company',
        custom_domain: 'test.example.com',
        email: 'admin@test.com',
        phone: '+1-555-0123',
      };

      expect(config.id).toBe('tenant-1');
      expect(config.name).toBe('Test Company');
    });
  });

  describe('ComplianceScore', () => {
    it('should validate compliance score with trend', () => {
      const score: ComplianceScore = {
        score_overall: 85,
        score_gdpr: 88,
        score_nis2: 82,
        score_dsa: 84,
        score_ai_act: 80,
        recorded_at: '2024-01-01T00:00:00Z',
        trend_direction: 'improving',
      };

      expect(score.score_overall).toBe(85);
      expect(score.trend_direction).toBe('improving');
    });
  });

  describe('RiskMetrics', () => {
    it('should validate risk metrics by severity', () => {
      const risks: RiskMetrics = {
        critical_risks_count: 2,
        high_risks_count: 5,
        medium_risks_count: 12,
        low_risks_count: 20,
        open_incidents_count: 3,
      };

      expect(risks.critical_risks_count).toBe(2);
      expect(risks.open_incidents_count).toBe(3);
    });
  });

  describe('DashboardInsight', () => {
    it('should validate insight with recommendation', () => {
      const insight: DashboardInsight = {
        id: 'insight-1',
        title: 'Critical Risk Detected',
        description: 'A critical security risk has been identified',
        severity: 'critical',
        recommended_action: 'Escalate to security team immediately',
        confidence_score: 0.98,
        type: 'risk_detection',
      };

      expect(insight.severity).toBe('critical');
      expect(insight.confidence_score).toBe(0.98);
    });
  });

  describe('DashboardKPI', () => {
    it('should validate KPI metrics', () => {
      const kpi: DashboardKPI = {
        domains_active: 5,
        policies_documented: 12,
        vendors_managed: 8,
        compliance_score: 85,
        incident_response_time_hours: 2.5,
      };

      expect(kpi.domains_active).toBe(5);
      expect(kpi.incident_response_time_hours).toBe(2.5);
    });
  });

  describe('DashboardSummary', () => {
    it('should validate comprehensive dashboard summary', () => {
      const summary: DashboardSummary = {
        compliance_score: {
          score_overall: 85,
          score_gdpr: 88,
          score_nis2: 82,
          score_dsa: 84,
          score_ai_act: 80,
          recorded_at: '2024-01-01T00:00:00Z',
          trend_direction: 'improving',
        },
        risks: {
          critical_risks_count: 2,
          high_risks_count: 5,
          medium_risks_count: 12,
          low_risks_count: 20,
          open_incidents_count: 3,
        },
        insights: [],
        kpis: {
          domains_active: 5,
          policies_documented: 12,
          vendors_managed: 8,
          compliance_score: 85,
          incident_response_time_hours: 2.5,
        },
      };

      expect(summary.compliance_score?.score_overall).toBe(85);
      expect(summary.risks?.critical_risks_count).toBe(2);
    });
  });

  describe('WebhookEvent', () => {
    it('should validate webhook event structure', () => {
      const event: WebhookEvent = {
        id: 'event-1',
        event_key: 'risk.detected',
        tenant_id: 'tenant-1',
        timestamp: '2024-01-01T00:00:00Z',
        data: {
          risk_type: 'data_breach',
          severity: 'critical',
        },
      };

      expect(event.event_key).toBe('risk.detected');
      expect(event.timestamp).toBeDefined();
    });
  });

  describe('ComplianceAlertRule', () => {
    it('should validate alert rule with actions', () => {
      const rule: ComplianceAlertRule = {
        id: 'rule-1',
        tenant_id: 'tenant-1',
        rule_name: 'Critical Risk Alert',
        trigger_event: 'risk_detected',
        severity_threshold: 'critical',
        enabled: true,
        actions: [
          {
            action: 'alert_email',
            recipients: ['admin@company.com'],
          },
        ],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      expect(rule.rule_name).toBe('Critical Risk Alert');
      expect(rule.actions).toHaveLength(1);
    });
  });

  describe('RemediationTask', () => {
    it('should validate remediation task', () => {
      const task: RemediationTask = {
        id: 'task-1',
        tenant_id: 'tenant-1',
        task_type: 'policy_update',
        entity_type: 'policy',
        entity_id: 'policy-1',
        status: 'pending',
        description: 'Update privacy policy',
        assigned_to: 'admin@company.com',
        due_date: '2024-02-01',
        created_at: '2024-01-01T00:00:00Z',
      };

      expect(task.task_type).toBe('policy_update');
      expect(task.status).toBe('pending');
    });
  });

  describe('C2PAManifest', () => {
    it('should validate C2PA manifest structure', () => {
      const manifest: C2PAManifest = {
        version: '2.0',
        claim_generator: 'RealSyncDynamics SDK',
        claims: [
          {
            assertion_type: 'c2pa.actions',
            label: 'Generated by SDK',
          },
        ],
        signature_value: 'sig123',
      };

      expect(manifest.version).toBe('2.0');
      expect(manifest.claims).toHaveLength(1);
    });
  });

  describe('APIError', () => {
    it('should validate API error structure', () => {
      const error: APIError = {
        code: 'INVALID_TENANT',
        message: 'Tenant not found',
        status: 404,
      };

      expect(error.code).toBe('INVALID_TENANT');
      expect(error.status).toBe(404);
    });
  });

  describe('Type Safety', () => {
    it('should enforce strict typing on enum-like values', () => {
      const insight: DashboardInsight = {
        id: 'insight-1',
        title: 'Test',
        severity: 'critical',
        type: 'risk_detection',
      };

      // These would fail at TypeScript compile time:
      // insight.severity = 'invalid'; // TS2322
      // insight.type = 'unknown'; // TS2322

      expect(insight.severity).toBe('critical');
    });

    it('should support optional fields', () => {
      const partialConfig: Partial<TenantConfig> = {
        name: 'Test Company',
        // other fields optional
      };

      expect(partialConfig.name).toBe('Test Company');
    });
  });
});
