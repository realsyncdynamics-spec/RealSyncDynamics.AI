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
} from './types';

export interface RealSyncDynamicsSDKOptions {
  apiKey: string;
  baseURL?: string;
  timeout?: number;
}

export class RealSyncDynamicsSDK {
  private apiKey: string;
  private baseURL: string;
  private timeout: number;

  constructor(options: RealSyncDynamicsSDKOptions) {
    this.apiKey = options.apiKey;
    this.baseURL = options.baseURL || 'https://api.realsyncdynamics.ai';
    this.timeout = options.timeout || 30000;
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    data?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.baseURL}${path}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    const options: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(this.timeout),
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const error: APIError = await response.json();
        throw new Error(error.message || `API Error: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error occurred');
    }
  }

  // Dashboard & Intelligence APIs
  async getDashboardSummary(tenantId: string): Promise<DashboardSummary> {
    return this.request('GET', `/api/dashboard/${tenantId}/summary`);
  }

  async getComplianceScores(
    tenantId: string,
    options?: { limit?: number; days?: number }
  ): Promise<ComplianceScore[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.days) params.append('days', options.days.toString());

    const queryString = params.toString();
    const path = `/api/dashboard/${tenantId}/scores${queryString ? `?${queryString}` : ''}`;
    return this.request('GET', path);
  }

  async getRiskMetrics(tenantId: string): Promise<RiskMetrics> {
    return this.request('GET', `/api/risks/${tenantId}/summary`);
  }

  async getInsights(
    tenantId: string,
    options?: { severity?: string; limit?: number }
  ): Promise<DashboardInsight[]> {
    const params = new URLSearchParams();
    if (options?.severity) params.append('severity', options.severity);
    if (options?.limit) params.append('limit', options.limit.toString());

    const queryString = params.toString();
    const path = `/api/insights/${tenantId}${queryString ? `?${queryString}` : ''}`;
    return this.request('GET', path);
  }

  async dismissInsight(tenantId: string, insightId: string): Promise<void> {
    await this.request('PATCH', `/api/insights/${tenantId}/${insightId}`, {
      status: 'dismissed',
    });
  }

  async getKPIs(tenantId: string): Promise<DashboardKPI> {
    return this.request('GET', `/api/kpis/${tenantId}`);
  }

  // Webhook APIs
  async subscribeToWebhook(
    tenantId: string,
    options: {
      url: string;
      events: string[];
      secret?: string;
      headers?: Record<string, string>;
    }
  ): Promise<{ subscription_id: string }> {
    return this.request('POST', `/api/webhooks/${tenantId}/subscribe`, {
      url: options.url,
      events: options.events,
      secret: options.secret,
      headers: options.headers,
    });
  }

  async unsubscribeWebhook(tenantId: string, subscriptionId: string): Promise<void> {
    await this.request('DELETE', `/api/webhooks/${tenantId}/${subscriptionId}`);
  }

  async getWebhookDeliveries(
    tenantId: string,
    subscriptionId: string,
    options?: { limit?: number; status?: string }
  ): Promise<WebhookEvent[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.status) params.append('status', options.status);

    const queryString = params.toString();
    const path = `/api/webhooks/${tenantId}/${subscriptionId}/deliveries${queryString ? `?${queryString}` : ''}`;
    return this.request('GET', path);
  }

  // Compliance Alert APIs
  async createAlertRule(
    tenantId: string,
    rule: Omit<ComplianceAlertRule, 'id'>
  ): Promise<ComplianceAlertRule> {
    return this.request('POST', `/api/alerts/${tenantId}/rules`, rule);
  }

  async updateAlertRule(
    tenantId: string,
    ruleId: string,
    updates: Partial<ComplianceAlertRule>
  ): Promise<ComplianceAlertRule> {
    return this.request('PATCH', `/api/alerts/${tenantId}/rules/${ruleId}`, updates);
  }

  async deleteAlertRule(tenantId: string, ruleId: string): Promise<void> {
    await this.request('DELETE', `/api/alerts/${tenantId}/rules/${ruleId}`);
  }

  // Remediation APIs
  async getRemediationTasks(
    tenantId: string,
    options?: { status?: string; limit?: number }
  ): Promise<RemediationTask[]> {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', options.limit.toString());

    const queryString = params.toString();
    const path = `/api/remediation/${tenantId}/tasks${queryString ? `?${queryString}` : ''}`;
    return this.request('GET', path);
  }

  async approveRemediationTask(tenantId: string, taskId: string): Promise<void> {
    await this.request('POST', `/api/remediation/${tenantId}/${taskId}/approve`);
  }

  // C2PA / Provenance APIs
  async generateC2PAManifest(options: {
    content_type: string;
    content_id: string;
    content_hash: string;
    signer_name?: string;
  }): Promise<C2PAManifest> {
    return this.request('POST', '/api/c2pa/generate', options);
  }

  async getProvenanceChain(
    contentType: string,
    contentId: string
  ): Promise<{ chain: C2PAManifest[] }> {
    return this.request('GET', `/api/c2pa/provenance/${contentType}/${contentId}`);
  }

  // Tenant Configuration
  async getTenantConfig(tenantId: string): Promise<TenantConfig> {
    return this.request('GET', `/api/tenant/${tenantId}/config`);
  }

  async updateTenantConfig(
    tenantId: string,
    config: Partial<TenantConfig>
  ): Promise<TenantConfig> {
    return this.request('PATCH', `/api/tenant/${tenantId}/config`, config);
  }

  async updateBranding(
    tenantId: string,
    branding: {
      company_name?: string;
      brand_colors?: Record<string, string>;
      custom_logo_url?: string;
      favicon_url?: string;
      support_email?: string;
      support_phone?: string;
      support_url?: string;
      footer_text?: string;
    }
  ): Promise<TenantConfig> {
    return this.request('PATCH', `/api/tenant/${tenantId}/branding`, branding);
  }
}

export default RealSyncDynamicsSDK;
