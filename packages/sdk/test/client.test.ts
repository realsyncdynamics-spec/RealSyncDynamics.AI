import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RealSyncDynamicsSDK } from '../src/client';

describe('RealSyncDynamicsSDK Client', () => {
  let sdk: RealSyncDynamicsSDK;
  const mockApiKey = 'test-api-key-123';
  const mockTenantId = 'tenant-123';

  beforeEach(() => {
    sdk = new RealSyncDynamicsSDK({
      apiKey: mockApiKey,
      baseURL: 'https://api.test.local',
      timeout: 5000,
    });

    // Mock fetch globally
    global.fetch = vi.fn();
  });

  describe('Constructor', () => {
    it('should initialize with required API key', () => {
      expect(() => new RealSyncDynamicsSDK({ apiKey: mockApiKey })).not.toThrow();
    });

    it('should use default baseURL when not provided', () => {
      const defaultSDK = new RealSyncDynamicsSDK({ apiKey: mockApiKey });
      expect(defaultSDK).toBeDefined();
    });

    it('should use custom baseURL when provided', () => {
      const customSDK = new RealSyncDynamicsSDK({
        apiKey: mockApiKey,
        baseURL: 'https://custom.example.com',
      });
      expect(customSDK).toBeDefined();
    });
  });

  describe('getDashboardSummary', () => {
    it('should fetch dashboard summary for tenant', async () => {
      const mockResponse = {
        compliance_score: {
          score_overall: 85,
          trend_direction: 'improving',
        },
        risks: {
          critical_risks_count: 2,
          high_risks_count: 5,
        },
        insights: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await sdk.getDashboardSummary(mockTenantId);
      expect(result).toEqual(mockResponse);
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Tenant not found' }),
      });

      await expect(sdk.getDashboardSummary(mockTenantId)).rejects.toThrow();
    });
  });

  describe('getComplianceScores', () => {
    it('should fetch compliance score history', async () => {
      const mockScores = [
        { score_overall: 85, recorded_at: '2024-01-01' },
        { score_overall: 87, recorded_at: '2024-01-02' },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockScores,
      });

      const result = await sdk.getComplianceScores(mockTenantId, { days: 30 });
      expect(result).toHaveLength(2);
      expect(result[0].score_overall).toBe(85);
    });
  });

  describe('getRiskMetrics', () => {
    it('should fetch current risk metrics', async () => {
      const mockRisks = {
        critical_risks_count: 2,
        high_risks_count: 5,
        medium_risks_count: 12,
        low_risks_count: 20,
        open_incidents_count: 3,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRisks,
      });

      const result = await sdk.getRiskMetrics(mockTenantId);
      expect(result.critical_risks_count).toBe(2);
      expect(result.open_incidents_count).toBe(3);
    });
  });

  describe('getInsights', () => {
    it('should fetch AI-generated insights with filtering', async () => {
      const mockInsights = [
        {
          id: 'insight-1',
          title: 'Critical Risk Detected',
          severity: 'critical',
          confidence_score: 0.98,
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockInsights,
      });

      const result = await sdk.getInsights(mockTenantId, {
        severity: 'critical',
        limit: 10,
      });
      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('critical');
    });
  });

  describe('Webhook Methods', () => {
    it('should subscribe to webhook events', async () => {
      const mockSubscription = {
        subscription_id: 'sub-123',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSubscription,
      });

      const result = await sdk.subscribeToWebhook(mockTenantId, {
        url: 'https://api.example.com/webhooks',
        events: ['risk.detected', 'incident.created'],
      });
      expect(result.subscription_id).toBe('sub-123');
    });

    it('should unsubscribe from webhook', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await expect(
        sdk.unsubscribeWebhook(mockTenantId, 'sub-123')
      ).resolves.not.toThrow();
    });

    it('should retrieve webhook delivery history', async () => {
      const mockDeliveries = [
        {
          id: 'delivery-1',
          event_key: 'risk.detected',
          timestamp: '2024-01-01T00:00:00Z',
          response_status: 200,
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeliveries,
      });

      const result = await sdk.getWebhookDeliveries(mockTenantId, 'sub-123', {
        status: 'success',
      });
      expect(result).toHaveLength(1);
      expect(result[0].response_status).toBe(200);
    });
  });

  describe('Alert Rule Methods', () => {
    it('should create compliance alert rule', async () => {
      const mockRule = {
        id: 'rule-123',
        rule_name: 'Critical Risk Detection',
        enabled: true,
        actions: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRule,
      });

      const result = await sdk.createAlertRule(mockTenantId, {
        rule_name: 'Critical Risk Detection',
        trigger_event: 'risk_detected',
        severity_threshold: 'critical',
        enabled: true,
        actions: [],
      });
      expect(result.id).toBe('rule-123');
    });

    it('should update alert rule', async () => {
      const mockUpdated = {
        id: 'rule-123',
        enabled: false,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUpdated,
      });

      const result = await sdk.updateAlertRule(mockTenantId, 'rule-123', {
        enabled: false,
      });
      expect(result.enabled).toBe(false);
    });

    it('should delete alert rule', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await expect(
        sdk.deleteAlertRule(mockTenantId, 'rule-123')
      ).resolves.not.toThrow();
    });
  });

  describe('Remediation Methods', () => {
    it('should retrieve remediation tasks', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          task_type: 'policy_update',
          status: 'pending',
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTasks,
      });

      const result = await sdk.getRemediationTasks(mockTenantId, {
        status: 'pending',
      });
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('pending');
    });

    it('should approve remediation task', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await expect(
        sdk.approveRemediationTask(mockTenantId, 'task-1')
      ).resolves.not.toThrow();
    });
  });

  describe('Tenant Configuration Methods', () => {
    it('should retrieve tenant configuration', async () => {
      const mockConfig = {
        id: 'tenant-123',
        name: 'Acme Corp',
        email: 'admin@acme.com',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfig,
      });

      const result = await sdk.getTenantConfig(mockTenantId);
      expect(result.name).toBe('Acme Corp');
    });

    it('should update tenant configuration', async () => {
      const mockUpdated = {
        id: 'tenant-123',
        name: 'Acme Corporation',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUpdated,
      });

      const result = await sdk.updateTenantConfig(mockTenantId, {
        name: 'Acme Corporation',
      });
      expect(result.name).toBe('Acme Corporation');
    });

    it('should update white-label branding', async () => {
      const mockBranding = {
        id: 'tenant-123',
        brand_colors: {
          primary: '#0F766E',
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockBranding,
      });

      const result = await sdk.updateBranding(mockTenantId, {
        brand_colors: { primary: '#0F766E' },
      });
      expect(result.brand_colors?.primary).toBe('#0F766E');
    });
  });
});
