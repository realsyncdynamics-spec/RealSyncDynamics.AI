# RealSyncDynamics TypeScript SDK

Official TypeScript/JavaScript SDK for the RealSyncDynamics compliance platform API.

[![npm version](https://badge.fury.io/js/%40realsyncdynamics%2Fsdk.svg)](https://badge.fury.io/js/%40realsyncdynamics%2Fsdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Installation

```bash
npm install @realsyncdynamics/sdk
# or
yarn add @realsyncdynamics/sdk
# or
pnpm add @realsyncdynamics/sdk
```

## Quick Start

```typescript
import { RealSyncDynamicsSDK } from '@realsyncdynamics/sdk';

// Initialize the SDK
const sdk = new RealSyncDynamicsSDK({
  apiKey: process.env.REALSYNCDYNAMICS_API_KEY,
});

// Fetch compliance dashboard
const dashboard = await sdk.getDashboardSummary('your-tenant-id');

console.log(`Compliance Score: ${dashboard.compliance_score?.score_overall}/100`);
console.log(`Critical Risks: ${dashboard.risks?.critical_risks_count}`);
console.log(`Active Insights: ${dashboard.insights.length}`);
```

## Features

- 📊 **Dashboard & Intelligence** - Real-time compliance scores, risk metrics, and AI-powered insights
- 🎯 **Compliance Monitoring** - Track compliance status across GDPR, NIS2, DSA, and AI Act
- 🔔 **Alerts & Notifications** - Create custom alert rules with email and webhook actions
- 🔧 **Remediation** - Approve and track remediation tasks
- 📜 **Content Authenticity** - Generate and verify C2PA provenance manifests
- ⚙️ **Configuration** - Manage tenant settings and white-label branding
- 🪝 **Webhooks** - Subscribe to compliance events in real-time

## API Reference

### Dashboard & Intelligence

#### `getDashboardSummary(tenantId: string): Promise<DashboardSummary>`

Get comprehensive compliance dashboard with scores, risks, insights, and KPIs.

```typescript
const summary = await sdk.getDashboardSummary('tenant-123');

if (summary.compliance_score) {
  console.log(`Overall Score: ${summary.compliance_score.score_overall}/100`);
  console.log(`Trend: ${summary.compliance_score.trend_direction}`);
}

console.log(`Total Insights: ${summary.insights.length}`);
```

#### `getComplianceScores(tenantId: string, options?): Promise<ComplianceScore[]>`

Get historical compliance scores with trend analysis.

```typescript
// Get last 30 days of scores
const scores = await sdk.getComplianceScores('tenant-123', {
  days: 30,
  limit: 100,
});

scores.forEach((score) => {
  console.log(`${score.recorded_at}: ${score.score_overall}`);
});
```

#### `getRiskMetrics(tenantId: string): Promise<RiskMetrics>`

Get current risk metrics by severity.

```typescript
const risks = await sdk.getRiskMetrics('tenant-123');

console.log(`Critical: ${risks.critical_risks_count}`);
console.log(`High: ${risks.high_risks_count}`);
console.log(`Open Incidents: ${risks.open_incidents_count}`);
```

#### `getInsights(tenantId: string, options?): Promise<DashboardInsight[]>`

Get AI-generated insights and recommendations.

```typescript
const insights = await sdk.getInsights('tenant-123', {
  severity: 'critical',
  limit: 10,
});

insights.forEach((insight) => {
  console.log(`[${insight.severity}] ${insight.title}`);
  console.log(`  Action: ${insight.recommended_action}`);
});
```

#### `dismissInsight(tenantId: string, insightId: string): Promise<void>`

Mark an insight as handled or dismissed.

```typescript
await sdk.dismissInsight('tenant-123', 'insight-456');
```

#### `getKPIs(tenantId: string): Promise<DashboardKPI>`

Get key performance indicators.

```typescript
const kpis = await sdk.getKPIs('tenant-123');

console.log(`Active Domains: ${kpis.domains_active}`);
console.log(`Policies Documented: ${kpis.policies_documented}`);
console.log(`Vendors Managed: ${kpis.vendors_managed}`);
```

### Webhooks

#### `subscribeToWebhook(tenantId: string, options): Promise<{ subscription_id: string }>`

Subscribe to webhook events.

```typescript
const sub = await sdk.subscribeToWebhook('tenant-123', {
  url: 'https://your-api.example.com/webhooks/realsyncdynamics',
  events: [
    'audit.completed',
    'risk.detected',
    'incident.created',
    'dpia.completed',
  ],
  secret: 'your-webhook-secret', // optional
  headers: {
    'X-Custom-Header': 'value',
  },
});

console.log(`Subscription ID: ${sub.subscription_id}`);
```

#### `unsubscribeWebhook(tenantId: string, subscriptionId: string): Promise<void>`

Cancel a webhook subscription.

```typescript
await sdk.unsubscribeWebhook('tenant-123', 'sub-456');
```

#### `getWebhookDeliveries(tenantId: string, subscriptionId: string, options?): Promise<WebhookEvent[]>`

Get webhook delivery history.

```typescript
const deliveries = await sdk.getWebhookDeliveries('tenant-123', 'sub-456', {
  status: 'failed',
  limit: 20,
});

deliveries.forEach((delivery) => {
  console.log(`Event: ${delivery.event_key} at ${delivery.timestamp}`);
});
```

### Compliance Alerts

#### `createAlertRule(tenantId: string, rule): Promise<ComplianceAlertRule>`

Create a compliance alert rule.

```typescript
const rule = await sdk.createAlertRule('tenant-123', {
  rule_name: 'Critical Risk Detection',
  trigger_event: 'risk_detected',
  severity_threshold: 'critical',
  enabled: true,
  actions: [
    {
      action: 'alert_email',
      recipients: ['admin@example.com', 'security@example.com'],
    },
    {
      action: 'webhook',
      url: 'https://api.example.com/alerts',
    },
  ],
});

console.log(`Rule created: ${rule.id}`);
```

#### `updateAlertRule(tenantId: string, ruleId: string, updates): Promise<ComplianceAlertRule>`

Update an alert rule.

```typescript
await sdk.updateAlertRule('tenant-123', 'rule-456', {
  severity_threshold: 'high',
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

Get remediation tasks.

```typescript
const tasks = await sdk.getRemediationTasks('tenant-123', {
  status: 'pending',
  limit: 20,
});

tasks.forEach((task) => {
  console.log(`Task: ${task.task_type} on ${task.entity_type}`);
  console.log(`  Status: ${task.status}`);
});
```

#### `approveRemediationTask(tenantId: string, taskId: string): Promise<void>`

Approve and execute a remediation task.

```typescript
await sdk.approveRemediationTask('tenant-123', 'task-789');
```

### Content Authenticity (C2PA)

#### `generateC2PAManifest(options): Promise<C2PAManifest>`

Generate a C2PA manifest for audit reports or compliance exports.

```typescript
const manifest = await sdk.generateC2PAManifest({
  content_type: 'audit_report',
  content_id: 'report-2024-q2',
  content_hash: 'sha256:abcdef1234567890...',
  signer_name: 'Compliance Officer',
});

console.log(`Manifest version: ${manifest.version}`);
```

#### `getProvenanceChain(contentType: string, contentId: string): Promise<{ chain: C2PAManifest[] }>`

Get the complete C2PA provenance chain.

```typescript
const provenance = await sdk.getProvenanceChain('audit_report', 'report-123');

provenance.chain.forEach((manifest) => {
  console.log(`Created by: ${manifest.claim_generator}`);
});
```

### Tenant Configuration

#### `getTenantConfig(tenantId: string): Promise<TenantConfig>`

Get tenant configuration.

```typescript
const config = await sdk.getTenantConfig('tenant-123');

console.log(`Company: ${config.name}`);
console.log(`Domain: ${config.custom_domain}`);
```

#### `updateTenantConfig(tenantId: string, config): Promise<TenantConfig>`

Update tenant configuration.

```typescript
await sdk.updateTenantConfig('tenant-123', {
  name: 'Acme Corporation',
});
```

#### `updateBranding(tenantId: string, branding): Promise<TenantConfig>`

Update white-label branding.

```typescript
await sdk.updateBranding('tenant-123', {
  company_name: 'Acme Corp',
  brand_colors: {
    primary: '#0F766E',
    secondary: '#64748B',
  },
  custom_logo_url: 'https://example.com/logo.png',
  support_email: 'support@example.com',
  support_phone: '+1-800-ACME-CORP',
  support_url: 'https://support.example.com',
  footer_text: '© 2024 Acme Corporation. All rights reserved.',
});
```

## Event Types

Subscribe to these webhook event types:

| Event | Triggered When |
|-------|----------------|
| `audit.completed` | Domain audit scan finished |
| `risk.detected` | New compliance risk discovered |
| `incident.created` | Incident reported |
| `sub_processor.changed` | Vendor/sub-processor status change |
| `dpia.completed` | DPIA assessment finished |
| `policy.violation` | Policy violation detected |
| `agent.completed` | AI agent task completed |

## Error Handling

```typescript
import { RealSyncDynamicsSDK } from '@realsyncdynamics/sdk';

const sdk = new RealSyncDynamicsSDK({ apiKey: process.env.API_KEY });

try {
  const summary = await sdk.getDashboardSummary('tenant-123');
  console.log(`Score: ${summary.compliance_score?.score_overall}`);
} catch (error) {
  if (error instanceof Error) {
    console.error(`Error: ${error.message}`);
  }
}
```

## Authentication

Generate API keys in your tenant admin console at `/app/settings/api-keys`.

The SDK automatically includes your API key in the `Authorization: Bearer <key>` header.

```typescript
const sdk = new RealSyncDynamicsSDK({
  apiKey: process.env.REALSYNCDYNAMICS_API_KEY || '',
});
```

## Rate Limiting

All endpoints support rate limiting. Check response headers:

- `X-RateLimit-Limit` - Requests per hour
- `X-RateLimit-Remaining` - Requests remaining
- `X-RateLimit-Reset` - Unix timestamp of rate limit reset

```typescript
// The SDK automatically includes rate limit info
const dashboard = await sdk.getDashboardSummary('tenant-123');
// Check response headers for rate limit status
```

## Timeout Configuration

Set custom timeout (default 30 seconds):

```typescript
const sdk = new RealSyncDynamicsSDK({
  apiKey: process.env.REALSYNCDYNAMICS_API_KEY,
  timeout: 60000, // 60 seconds
});
```

## Support

- **Documentation**: https://docs.realsyncdynamics.ai
- **API Reference**: https://api-docs.realsyncdynamics.ai
- **Issues**: https://github.com/realsyncdynamics/sdk-ts/issues
- **Email**: support@realsyncdynamics.ai

## License

MIT License - see [LICENSE](LICENSE) file for details

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

**Made with ❤️ by RealSyncDynamics**
