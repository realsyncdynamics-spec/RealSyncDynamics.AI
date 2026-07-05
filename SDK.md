# RealSyncDynamics TypeScript SDK

Official TypeScript SDK for the RealSyncDynamics compliance platform API.

## Installation

```bash
npm install @realsyncdynamics/sdk
# or
yarn add @realsyncdynamics/sdk
```

## Quick Start

```typescript
import { RealSyncDynamicsSDK } from '@realsyncdynamics/sdk';

const sdk = new RealSyncDynamicsSDK({
  apiKey: 'your-api-key',
  baseURL: 'https://api.realsyncdynamics.ai', // optional, defaults shown
  timeout: 30000, // optional, milliseconds
});

// Fetch dashboard summary
const summary = await sdk.getDashboardSummary('tenant-id');
console.log(summary.compliance_score);
```

## API Reference

### Dashboard & Intelligence

#### `getDashboardSummary(tenantId: string): Promise<DashboardSummary>`
Get comprehensive compliance dashboard with scores, risks, insights, and KPIs.

```typescript
const summary = await sdk.getDashboardSummary('tenant-123');
// Returns { compliance_score, risks, insights, kpis }
```

#### `getComplianceScores(tenantId: string, options?): Promise<ComplianceScore[]>`
Get historical compliance scores with trend analysis.

```typescript
const scores = await sdk.getComplianceScores('tenant-123', {
  limit: 30,
  days: 30, // Last 30 days
});
```

#### `getRiskMetrics(tenantId: string): Promise<RiskMetrics>`
Get current risk metrics (critical, high, medium, low counts).

```typescript
const risks = await sdk.getRiskMetrics('tenant-123');
console.log(`Critical risks: ${risks.critical_risks_count}`);
```

#### `getInsights(tenantId: string, options?): Promise<DashboardInsight[]>`
Get AI-generated insights and recommendations.

```typescript
const insights = await sdk.getInsights('tenant-123', {
  severity: 'critical',
  limit: 10,
});
```

#### `dismissInsight(tenantId: string, insightId: string): Promise<void>`
Dismiss an insight as handled.

```typescript
await sdk.dismissInsight('tenant-123', 'insight-456');
```

#### `getKPIs(tenantId: string): Promise<DashboardKPI>`
Get key performance indicators (domains, policies, vendors, etc).

```typescript
const kpis = await sdk.getKPIs('tenant-123');
console.log(`Active domains: ${kpis.domains_active}`);
```

### Webhooks

#### `subscribeToWebhook(tenantId: string, options): Promise<{ subscription_id: string }>`
Subscribe to webhook events (audit.completed, risk.detected, etc).

```typescript
const sub = await sdk.subscribeToWebhook('tenant-123', {
  url: 'https://your-api.example.com/webhooks',
  events: ['audit.completed', 'risk.detected'],
  secret: 'optional-signing-secret',
  headers: { 'X-Custom-Header': 'value' },
});
```

#### `unsubscribeWebhook(tenantId: string, subscriptionId: string): Promise<void>`
Cancel a webhook subscription.

```typescript
await sdk.unsubscribeWebhook('tenant-123', 'sub-456');
```

#### `getWebhookDeliveries(tenantId: string, subscriptionId: string, options?): Promise<WebhookEvent[]>`
Get webhook delivery history with status and payloads.

```typescript
const deliveries = await sdk.getWebhookDeliveries('tenant-123', 'sub-456', {
  status: 'failed',
  limit: 20,
});
```

### Compliance Alerts

#### `createAlertRule(tenantId: string, rule): Promise<ComplianceAlertRule>`
Create a compliance alert rule with escalation policy.

```typescript
const rule = await sdk.createAlertRule('tenant-123', {
  rule_name: 'Critical Risk Detection',
  trigger_event: 'risk_detected',
  severity_threshold: 'critical',
  enabled: true,
  actions: [
    { action: 'alert_email', recipients: ['admin@example.com'] },
    { action: 'webhook', url: 'https://api.example.com/alerts' },
  ],
});
```

#### `updateAlertRule(tenantId: string, ruleId: string, updates): Promise<ComplianceAlertRule>`
Update an existing alert rule.

```typescript
await sdk.updateAlertRule('tenant-123', 'rule-456', {
  enabled: false,
});
```

#### `deleteAlertRule(tenantId: string, ruleId: string): Promise<void>`
Delete an alert rule.

```typescript
await sdk.deleteAlertRule('tenant-123', 'rule-456');
```

### Remediation

#### `getRemediationTasks(tenantId: string, options?): Promise<RemediationTask[]>`
Get remediation tasks triggered by compliance alerts.

```typescript
const tasks = await sdk.getRemediationTasks('tenant-123', {
  status: 'pending',
  limit: 10,
});
```

#### `approveRemediationTask(tenantId: string, taskId: string): Promise<void>`
Approve a remediation task for execution.

```typescript
await sdk.approveRemediationTask('tenant-123', 'task-789');
```

### Content Authenticity (C2PA)

#### `generateC2PAManifest(options): Promise<C2PAManifest>`
Generate a C2PA manifest for audit reports or compliance exports.

```typescript
const manifest = await sdk.generateC2PAManifest({
  content_type: 'audit_report',
  content_id: 'report-123',
  content_hash: 'sha256:abcd1234...', // 64-char SHA256 hash
  signer_name: 'John Doe',
});
```

#### `getProvenanceChain(contentType: string, contentId: string): Promise<{ chain: C2PAManifest[] }>`
Get the complete C2PA provenance chain for a document.

```typescript
const provenance = await sdk.getProvenanceChain('audit_report', 'report-123');
console.log(`Created by: ${provenance.chain[0].signer_name}`);
```

### Tenant Configuration

#### `getTenantConfig(tenantId: string): Promise<TenantConfig>`
Get tenant configuration and branding settings.

```typescript
const config = await sdk.getTenantConfig('tenant-123');
console.log(config.company_name);
```

#### `updateTenantConfig(tenantId: string, config): Promise<TenantConfig>`
Update tenant configuration.

```typescript
await sdk.updateTenantConfig('tenant-123', {
  name: 'Acme Corp',
});
```

#### `updateBranding(tenantId: string, branding): Promise<TenantConfig>`
Update white-label branding (colors, logo, support info).

```typescript
await sdk.updateBranding('tenant-123', {
  company_name: 'Acme Corp',
  brand_colors: {
    primary: '#0F766E',
    secondary: '#64748B',
  },
  custom_logo_url: 'https://example.com/logo.png',
  support_email: 'support@example.com',
});
```

## Event Types

Subscribe to these webhook event types:

- `audit.completed` - Domain audit scan finished
- `risk.detected` - New compliance risk discovered
- `incident.created` - Incident reported
- `sub_processor.changed` - Vendor/sub-processor status change
- `dpia.completed` - DPIA assessment finished
- `policy.violation` - Policy violation detected
- `agent.completed` - AI agent task completed

## Error Handling

```typescript
try {
  const summary = await sdk.getDashboardSummary('tenant-123');
} catch (error) {
  if (error instanceof Error) {
    console.error(`API Error: ${error.message}`);
  }
}
```

## Authentication

Include your API key in the `Authorization` header (automatically done by the SDK):

```
Authorization: Bearer your-api-key
```

Generate API keys in the tenant admin console at `/app/settings/api-keys`.

## Rate Limiting

All endpoints support rate limiting. Check response headers:

- `X-RateLimit-Limit` - Requests per hour
- `X-RateLimit-Remaining` - Requests remaining
- `X-RateLimit-Reset` - Unix timestamp of rate limit reset

## Support

- Documentation: https://docs.realsyncdynamics.ai
- Issues: https://github.com/realsyncdynamics/sdk-ts
- Email: support@realsyncdynamics.ai

## License

MIT
