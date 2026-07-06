/**
 * Quick Start Example
 * Demonstrates basic SDK usage and dashboard data retrieval
 */

import { RealSyncDynamicsSDK } from '@realsyncdynamics/sdk';

// Initialize the SDK with your API key
const sdk = new RealSyncDynamicsSDK({
  apiKey: process.env.REALSYNCDYNAMICS_API_KEY!,
  timeout: 30000,
});

async function main() {
  try {
    const tenantId = 'your-tenant-id';

    // Get comprehensive dashboard summary
    console.log('📊 Fetching dashboard summary...');
    const dashboard = await sdk.getDashboardSummary(tenantId);

    if (dashboard.compliance_score) {
      console.log(`✅ Compliance Score: ${dashboard.compliance_score.score_overall}/100`);
      console.log(`📈 Trend: ${dashboard.compliance_score.trend_direction}`);
    }

    // Get detailed risk metrics
    console.log('\n⚠️  Fetching risk metrics...');
    const risks = await sdk.getRiskMetrics(tenantId);
    console.log(`🔴 Critical Risks: ${risks.critical_risks_count}`);
    console.log(`🟠 High Risks: ${risks.high_risks_count}`);
    console.log(`📋 Open Incidents: ${risks.open_incidents_count}`);

    // Get AI-powered insights
    console.log('\n💡 Fetching insights...');
    const insights = await sdk.getInsights(tenantId, {
      severity: 'critical',
      limit: 5,
    });

    insights.forEach((insight) => {
      console.log(`\n[${insight.severity.toUpperCase()}] ${insight.title}`);
      console.log(`Action: ${insight.recommended_action}`);
      if (insight.confidence_score) {
        console.log(`Confidence: ${Math.round(insight.confidence_score * 100)}%`);
      }
    });

    // Get KPI metrics
    console.log('\n📈 Fetching KPIs...');
    const kpis = await sdk.getKPIs(tenantId);
    console.log(`Active Domains: ${kpis.domains_active}`);
    console.log(`Policies Documented: ${kpis.policies_documented}`);
    console.log(`Vendors Managed: ${kpis.vendors_managed}`);
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
