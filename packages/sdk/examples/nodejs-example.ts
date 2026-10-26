/**
 * Node.js Example: Using RealSyncDynamics SDK
 *
 * This example demonstrates how to use the RealSyncDynamics SDK in a Node.js application.
 *
 * Setup:
 * 1. npm install @realsyncdynamics/sdk
 * 2. Set REALSYNCDYNAMICS_API_KEY environment variable
 * 3. Update TENANT_ID to your organization's tenant ID
 */

import { RealSyncDynamicsSDK } from '@realsyncdynamics/sdk';

// Configuration
const API_KEY = process.env.REALSYNCDYNAMICS_API_KEY || '';
const TENANT_ID = process.env.TENANT_ID || 'your-tenant-id';
const BASE_URL = process.env.API_BASE_URL || 'https://api.realsyncdynamicsai.de';

// Initialize SDK
const sdk = new RealSyncDynamicsSDK({
  apiKey: API_KEY,
  baseURL: BASE_URL,
  timeout: 30000,
});

// Example 1: Get Compliance Dashboard
async function getDashboard() {
  try {
    console.log('📊 Fetching compliance dashboard...');
    const dashboard = await sdk.getDashboardSummary(TENANT_ID);

    if (dashboard.compliance_score) {
      console.log(
        `✅ Overall Compliance Score: ${dashboard.compliance_score.score_overall}/100`
      );
      console.log(`   Trend: ${dashboard.compliance_score.trend_direction}`);
    }

    if (dashboard.risks) {
      console.log(`⚠️  Critical Risks: ${dashboard.risks.critical_risks_count}`);
      console.log(`    High Risks: ${dashboard.risks.high_risks_count}`);
    }

    console.log(`💡 Insights: ${dashboard.insights.length}`);
    dashboard.insights.slice(0, 3).forEach((insight) => {
      console.log(`   - [${insight.severity}] ${insight.title}`);
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }
}

// Example 2: Get Historical Compliance Scores
async function getScoreHistory() {
  try {
    console.log('\n📈 Fetching compliance score history...');
    const scores = await sdk.getComplianceScores(TENANT_ID, {
      days: 30,
      limit: 10,
    });

    console.log(`Found ${scores.length} score records:`);
    scores.forEach((score) => {
      console.log(`  ${score.recorded_at}: ${score.score_overall}/100`);
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }
}

// Example 3: Get Current Risk Metrics
async function getRisks() {
  try {
    console.log('\n⚠️  Fetching risk metrics...');
    const risks = await sdk.getRiskMetrics(TENANT_ID);

    console.log(`Critical: ${risks.critical_risks_count}`);
    console.log(`High: ${risks.high_risks_count}`);
    console.log(`Medium: ${risks.medium_risks_count}`);
    console.log(`Low: ${risks.low_risks_count}`);
    console.log(`Open Incidents: ${risks.open_incidents_count}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }
}

// Example 4: Get AI Insights with Filtering
async function getInsights() {
  try {
    console.log('\n💡 Fetching critical insights...');
    const insights = await sdk.getInsights(TENANT_ID, {
      severity: 'critical',
      limit: 5,
    });

    console.log(`Found ${insights.length} critical insights:`);
    insights.forEach((insight) => {
      console.log(`\n  Title: ${insight.title}`);
      console.log(`  Action: ${insight.recommended_action}`);
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }
}

// Example 5: Get KPIs
async function getKPIs() {
  try {
    console.log('\n📋 Fetching KPIs...');
    const kpis = await sdk.getKPIs(TENANT_ID);

    console.log(`Active Domains: ${kpis.domains_active}`);
    console.log(`Policies Documented: ${kpis.policies_documented}`);
    console.log(`Vendors Managed: ${kpis.vendors_managed}`);
    console.log(`Compliance Status: ${kpis.compliance_status}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }
}

// Example 6: Create Alert Rule
async function createAlertRule() {
  try {
    console.log('\n🔔 Creating alert rule...');
    const rule = await sdk.createAlertRule(TENANT_ID, {
      rule_name: 'Critical Risk Alert',
      trigger_event: 'risk_detected',
      severity_threshold: 'critical',
      enabled: true,
      actions: [
        {
          action: 'alert_email',
          recipients: ['security@example.com'],
        },
        {
          action: 'webhook',
          url: 'https://your-api.example.com/webhooks/compliance',
        },
      ],
    });

    console.log(`✅ Alert rule created: ${rule.id}`);
    console.log(`   Name: ${rule.rule_name}`);
    console.log(`   Trigger: ${rule.trigger_event}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }
}

// Example 7: Subscribe to Webhooks
async function subscribeToWebhook() {
  try {
    console.log('\n🔗 Subscribing to webhook events...');
    const subscription = await sdk.subscribeToWebhook(TENANT_ID, {
      url: 'https://your-api.example.com/webhooks/realsyncdynamics',
      events: [
        'audit.completed',
        'risk.detected',
        'incident.created',
        'dpia.completed',
      ],
      secret: 'your-webhook-secret',
      headers: {
        'X-Custom-Header': 'my-value',
      },
    });

    console.log(`✅ Webhook subscribed: ${subscription.subscription_id}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }
}

// Example 8: Update Branding
async function updateBranding() {
  try {
    console.log('\n🎨 Updating tenant branding...');
    const config = await sdk.updateBranding(TENANT_ID, {
      company_name: 'Acme Corporation',
      brand_colors: {
        primary: '#0F766E',
        secondary: '#64748B',
        accent: '#EC4899',
      },
      custom_logo_url: 'https://example.com/logo.png',
      support_email: 'support@acme.example.com',
      support_phone: '+1-800-ACME-CORP',
      support_url: 'https://support.acme.example.com',
      footer_text: '© 2024 Acme Corporation. All rights reserved.',
    });

    console.log(`✅ Branding updated for: ${config.name}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }
}

// Example 9: Generate C2PA Manifest
async function generateC2PAManifest() {
  try {
    console.log('\n📜 Generating C2PA manifest...');
    const manifest = await sdk.generateC2PAManifest({
      content_type: 'audit_report',
      content_id: 'report-2024-q4',
      content_hash: 'sha256:abcdef1234567890abcdef1234567890',
      signer_name: 'John Doe, Compliance Officer',
    });

    console.log(`✅ Manifest generated`);
    console.log(`   Version: ${manifest.version}`);
    console.log(`   ID: ${manifest.manifest_id}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }
}

// Main Execution
async function main() {
  console.log('🚀 RealSyncDynamics SDK Examples\n');
  console.log(`API Key configured: ${!!API_KEY}`);
  console.log(`Tenant ID: ${TENANT_ID}\n`);
  console.log('================================\n');

  if (!API_KEY) {
    console.error(
      '❌ Error: REALSYNCDYNAMICS_API_KEY environment variable not set'
    );
    console.error('Set it with: export REALSYNCDYNAMICS_API_KEY="your-key-here"');
    process.exit(1);
  }

  // Run examples (uncomment to test specific ones)
  await getDashboard();
  // await getScoreHistory();
  // await getRisks();
  // await getInsights();
  // await getKPIs();
  // await createAlertRule();
  // await subscribeToWebhook();
  // await updateBranding();
  // await generateC2PAManifest();

  console.log('\n✅ Examples completed!');
}

main().catch(console.error);
