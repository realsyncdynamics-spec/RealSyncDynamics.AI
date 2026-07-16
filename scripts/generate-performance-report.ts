#!/usr/bin/env node

/**
 * Generate monthly performance report from Sentry data.
 *
 * Usage:
 *   npx ts-node scripts/generate-performance-report.ts [--month YYYY-MM] [--slack]
 *
 * Examples:
 *   npx ts-node scripts/generate-performance-report.ts --month 2026-08
 *   npx ts-node scripts/generate-performance-report.ts --slack  (sends to Slack)
 *
 * Output: docs/MONTHLY-PERFORMANCE-REPORTS/YYYY-MM.md
 */

import * as fs from 'fs';
import * as path from 'path';

interface WebVitalMetric {
  name: 'LCP' | 'INP' | 'CLS' | 'TTFB' | 'FCP' | 'DCL';
  p50: number;
  p75: number;
  p95: number;
  p99: number;
  baseline: number;
  status: 'good' | 'needs-improvement' | 'poor';
}

interface ComponentMetric {
  name: string;
  tier: 1 | 2 | 3;
  renderTime: {
    p50: number;
    p95: number;
    p99: number;
  };
  baseline: number;
  rerendersPerMin: number;
  status: 'healthy' | 'warning' | 'critical';
}

interface APIMetric {
  endpoint: string;
  calls: number;
  errorRate: number;
  p95: number;
  baseline: number;
  status: 'healthy' | 'warning' | 'critical';
}

interface PerformanceReport {
  month: string;
  generatedAt: string;
  webVitals: WebVitalMetric[];
  components: {
    tier1: ComponentMetric[];
    tier2: ComponentMetric[];
    tier3: ComponentMetric[];
  };
  apiPerformance: APIMetric[];
  budgetViolations: Array<{
    page: string;
    metric: string;
    budget: string;
    current: string;
    violation: number;
  }>;
  summary: {
    componentsWithinBaseline: number;
    totalComponents: number;
    averageBudgetCompliance: number;
    topRegression: ComponentMetric | null;
    topImprovement: ComponentMetric | null;
  };
}

/**
 * Get the month string (default: current month)
 */
function getMonth(monthArg?: string): string {
  if (monthArg) return monthArg;

  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Query Sentry API for Web Vitals (stub - requires SENTRY_AUTH_TOKEN)
 */
async function fetchWebVitalsData(month: string): Promise<WebVitalMetric[]> {
  // TODO: Implement actual Sentry API calls
  // Requires: SENTRY_AUTH_TOKEN environment variable
  // API: https://docs.sentry.io/api/events/list-a-projects-events/

  console.warn(`⚠️  Web Vitals data fetch not implemented. Set SENTRY_AUTH_TOKEN to enable.`);

  // Mock data for demonstration
  return [
    {
      name: 'LCP',
      p50: 1800,
      p75: 2400,
      p95: 3200,
      p99: 4500,
      baseline: 2500,
      status: 'needs-improvement'
    },
    {
      name: 'INP',
      p50: 85,
      p75: 145,
      p95: 220,
      p99: 380,
      baseline: 200,
      status: 'good'
    },
    {
      name: 'CLS',
      p50: 0.05,
      p75: 0.08,
      p95: 0.12,
      p99: 0.18,
      baseline: 0.1,
      status: 'needs-improvement'
    },
    {
      name: 'TTFB',
      p50: 320,
      p75: 450,
      p95: 650,
      p99: 1100,
      baseline: 600,
      status: 'good'
    },
    {
      name: 'FCP',
      p50: 1200,
      p75: 1600,
      p95: 2100,
      p99: 2900,
      baseline: 1800,
      status: 'good'
    },
    {
      name: 'DCL',
      p50: 800,
      p75: 1100,
      p95: 1400,
      p99: 1900,
      baseline: 1200,
      status: 'good'
    }
  ];
}

/**
 * Query Sentry API for component performance (stub)
 */
async function fetchComponentMetrics(month: string): Promise<{ tier1: ComponentMetric[], tier2: ComponentMetric[], tier3: ComponentMetric[] }> {
  console.warn(`⚠️  Component metrics fetch not implemented. Set SENTRY_AUTH_TOKEN to enable.`);

  // Mock data for demonstration
  return {
    tier1: [
      {
        name: 'GovernanceDashboard',
        tier: 1,
        renderTime: { p50: 45, p95: 120, p99: 180 },
        baseline: 200,
        rerendersPerMin: 0.2,
        status: 'healthy'
      },
      {
        name: 'ProtectedLayout',
        tier: 1,
        renderTime: { p50: 20, p95: 55, p99: 95 },
        baseline: 200,
        rerendersPerMin: 0.1,
        status: 'healthy'
      }
    ],
    tier2: [
      {
        name: 'RiskCenterView',
        tier: 2,
        renderTime: { p50: 120, p95: 280, p99: 420 },
        baseline: 350,
        rerendersPerMin: 0.5,
        status: 'healthy'
      }
    ],
    tier3: [
      {
        name: 'ScansListView',
        tier: 3,
        renderTime: { p50: 180, p95: 420, p99: 600 },
        baseline: 500,
        rerendersPerMin: 0.7,
        status: 'healthy'
      }
    ]
  };
}

/**
 * Query Sentry API for API performance (stub)
 */
async function fetchAPIMetrics(month: string): Promise<APIMetric[]> {
  console.warn(`⚠️  API metrics fetch not implemented. Set SENTRY_AUTH_TOKEN to enable.`);

  return [
    {
      endpoint: '/api/governance/vvt',
      calls: 2450,
      errorRate: 0.2,
      p95: 450,
      baseline: 500,
      status: 'healthy'
    },
    {
      endpoint: '/api/scans/runs',
      calls: 1890,
      errorRate: 0.1,
      p95: 380,
      baseline: 400,
      status: 'healthy'
    },
    {
      endpoint: '/functions/gdpr-audit',
      calls: 456,
      errorRate: 0.5,
      p95: 2200,
      baseline: 2000,
      status: 'warning'
    }
  ];
}

/**
 * Load budget violations from baseline file
 */
async function fetchBudgetViolations(): Promise<Array<{ page: string; metric: string; budget: string; current: string; violation: number }>> {
  // TODO: Compare current metrics against budgets in PERFORMANCE-BUDGETS.json
  return [];
}

/**
 * Generate markdown report
 */
function generateMarkdown(report: PerformanceReport): string {
  const month = report.month;
  const [year, monthNum] = month.split('-');
  const monthName = new Date(`${year}-${monthNum}-01`).toLocaleString('default', { month: 'long', year: 'numeric' });

  let md = `# Performance Report — ${monthName}\n\n`;
  md += `**Generated**: ${report.generatedAt}\n\n`;

  // Summary Section
  md += `## Executive Summary\n\n`;
  md += `- **Components Within Baseline**: ${report.summary.componentsWithinBaseline}/${report.summary.totalComponents} (${Math.round((report.summary.componentsWithinBaseline / report.summary.totalComponents) * 100)}%)\n`;
  md += `- **Budget Compliance**: ${report.summary.averageBudgetCompliance}%\n`;
  if (report.summary.topRegression) {
    md += `- **Most Regressed**: ${report.summary.topRegression.name} (${report.summary.topRegression.renderTime.p95}ms, was ${report.summary.topRegression.baseline}ms)\n`;
  }
  if (report.summary.topImprovement) {
    md += `- **Most Improved**: ${report.summary.topImprovement.name}\n`;
  }
  md += '\n';

  // Web Vitals
  md += `## Core Web Vitals\n\n`;
  md += `| Metric | p50 | p95 | p99 | Baseline | Status |\n`;
  md += `|--------|-----|-----|-----|----------|--------|\n`;
  for (const vital of report.webVitals) {
    const statusEmoji = vital.status === 'good' ? '✅' : vital.status === 'needs-improvement' ? '⚠️' : '🔴';
    md += `| ${vital.name} | ${vital.p50}ms | ${vital.p95}ms | ${vital.p99}ms | ${vital.baseline}ms | ${statusEmoji} |\n`;
  }
  md += '\n';

  // Component Performance by Tier
  md += `## Component Performance by Tier\n\n`;

  for (const tier of [1, 2, 3] as const) {
    const tierKey = `tier${tier}` as const;
    const components = report.components[tierKey];

    md += `### Tier ${tier} (${components.length} components, threshold: ${[200, 350, 500][tier - 1]}ms)\n\n`;
    md += `| Component | p50 | p95 | p99 | Status |\n`;
    md += `|-----------|-----|-----|-----|--------|\n`;

    for (const comp of components) {
      const statusEmoji = comp.status === 'healthy' ? '✅' : comp.status === 'warning' ? '⚠️' : '🔴';
      md += `| ${comp.name} | ${comp.renderTime.p50}ms | ${comp.renderTime.p95}ms | ${comp.renderTime.p99}ms | ${statusEmoji} |\n`;
    }
    md += '\n';
  }

  // API Performance
  if (report.apiPerformance.length > 0) {
    md += `## API & Edge Function Performance\n\n`;
    md += `| Endpoint | Calls | Error Rate | p95 | Status |\n`;
    md += `|----------|-------|-----------|-----|--------|\n`;

    for (const api of report.apiPerformance) {
      const statusEmoji = api.status === 'healthy' ? '✅' : api.status === 'warning' ? '⚠️' : '🔴';
      md += `| ${api.endpoint} | ${api.calls} | ${(api.errorRate * 100).toFixed(1)}% | ${api.p95}ms | ${statusEmoji} |\n`;
    }
    md += '\n';
  }

  // Budget Violations
  if (report.budgetViolations.length > 0) {
    md += `## Budget Violations\n\n`;
    md += `⚠️ ${report.budgetViolations.length} page(s) exceeding performance budgets:\n\n`;
    md += `| Page | Metric | Budget | Current | Violation |\n`;
    md += `|------|--------|--------|---------|----------|\n`;

    for (const violation of report.budgetViolations) {
      md += `| ${violation.page} | ${violation.metric} | ${violation.budget} | ${violation.current} | +${violation.violation}% |\n`;
    }
    md += '\n';
  }

  // Recommendations
  md += `## Recommendations\n\n`;
  md += `1. **Web Vitals**: Monitor LCP and CLS trends; consider lazy-loading large components\n`;
  md += `2. **Slowest Component**: Review ${report.summary.topRegression?.name || 'N/A'} render logic\n`;
  md += `3. **API Optimization**: ${report.apiPerformance.filter(a => a.status !== 'healthy').length} endpoint(s) need attention\n`;
  md += '\n';

  // Footer
  md += `---\n\n`;
  md += `**Next Review**: ${getNextMonthDate(month)}\n`;
  md += `**Data Source**: Sentry Performance Monitoring\n`;

  return md;
}

/**
 * Get next month's date
 */
function getNextMonthDate(currentMonth: string): string {
  const [year, month] = currentMonth.split('-');
  let nextMonth = parseInt(month) + 1;
  let nextYear = parseInt(year);

  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear++;
  }

  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  let month = getMonth();
  let sendToSlack = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--month' && args[i + 1]) {
      month = args[++i];
    }
    if (args[i] === '--slack') {
      sendToSlack = true;
    }
  }

  console.log(`📊 Generating performance report for ${month}...\n`);

  // Fetch data
  console.log('⏳ Fetching Web Vitals...');
  const webVitals = await fetchWebVitalsData(month);

  console.log('⏳ Fetching component metrics...');
  const components = await fetchComponentMetrics(month);

  console.log('⏳ Fetching API metrics...');
  const apiPerformance = await fetchAPIMetrics(month);

  console.log('⏳ Checking budget violations...');
  const budgetViolations = await fetchBudgetViolations();

  // Calculate summary
  const totalComponents = Object.values(components).flat().length;
  const componentsHealthy = Object.values(components)
    .flat()
    .filter(c => c.status === 'healthy').length;

  const report: PerformanceReport = {
    month,
    generatedAt: new Date().toISOString(),
    webVitals,
    components,
    apiPerformance,
    budgetViolations,
    summary: {
      componentsWithinBaseline: componentsHealthy,
      totalComponents,
      averageBudgetCompliance: 100 - (budgetViolations.length * 2), // Mock
      topRegression: Object.values(components).flat().sort((a, b) => b.renderTime.p95 - a.renderTime.p95)[0] || null,
      topImprovement: null // Would track historical improvements
    }
  };

  // Generate markdown
  const markdown = generateMarkdown(report);

  // Write report
  const reportsDir = path.join(process.cwd(), 'docs', 'MONTHLY-PERFORMANCE-REPORTS');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, `${month}.md`);
  fs.writeFileSync(reportPath, markdown, 'utf-8');

  console.log(`\n✅ Report saved: ${reportPath}`);
  console.log(`\n${markdown}`);

  // TODO: Send to Slack if --slack flag
  if (sendToSlack) {
    console.log('\n📤 Sending to Slack #perf-monitoring...');
    // Requires SLACK_WEBHOOK_URL environment variable
  }
}

main().catch(err => {
  console.error('❌ Error generating report:', err);
  process.exit(1);
});
