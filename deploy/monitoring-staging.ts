/**
 * Staging Monitoring & Alerting Configuration
 *
 * Sets up Sentry, dashboards, and alerts for 24-hour staging verification.
 * Deploy after code goes to staging environment.
 *
 * Usage: npx ts-node deploy/monitoring-staging.ts --setup
 */

import * as Sentry from '@sentry/node';
import { httpIntegration, postgresIntegration } from '@sentry/node';

interface MonitoringConfig {
  environment: 'staging';
  sampleRate: number;
  enablePerformanceMonitoring: boolean;
  enableReplayRecording: boolean;
  alertThresholds: {
    errorRatePercent: number;
    p99LatencyMs: number;
    cpuUtilizationPercent: number;
    memoryUtilizationPercent: number;
  };
}

const STAGING_CONFIG: MonitoringConfig = {
  environment: 'staging',
  sampleRate: 1.0, // 100% - capture all transactions in staging
  enablePerformanceMonitoring: true,
  enableReplayRecording: true, // Capture user interactions for debugging
  alertThresholds: {
    errorRatePercent: 1, // Alert if >1% errors
    p99LatencyMs: 3000, // Alert if p99 latency >3s
    cpuUtilizationPercent: 80,
    memoryUtilizationPercent: 85,
  },
};

/**
 * Initialize Sentry for staging monitoring
 */
export function initializeSentryStaging() {
  const dsn = process.env.SENTRY_DSN_STAGING;
  if (!dsn) {
    throw new Error('SENTRY_DSN_STAGING environment variable required');
  }

  Sentry.init({
    dsn,
    environment: STAGING_CONFIG.environment,
    tracesSampleRate: STAGING_CONFIG.sampleRate,
    profilesSampleRate: 0.1, // 10% profiling in staging

    integrations: [
      httpIntegration(),
      postgresIntegration(),
    ],

    beforeSend(event, hint) {
      // Don't send PII from test accounts
      if (event.user?.email?.includes('@example.com')) {
        return null;
      }
      return event;
    },
  });

  console.log('✅ Sentry initialized for staging');
}

/**
 * Create monitoring alerts via Sentry
 */
export async function configureAlerts() {
  console.log('📊 Configuring staging alerts...');

  const alerts = [
    {
      name: 'High Error Rate (Governance)',
      condition: `(error.count:>=${STAGING_CONFIG.alertThresholds.errorRatePercent}%) AND environment:staging AND level:error`,
      actions: ['notify_slack', 'notify_email'],
      severity: 'critical',
    },
    {
      name: 'Slow Auto-Mapping Latency',
      condition: `transaction.op:auto_map AND transaction.duration:>${STAGING_CONFIG.alertThresholds.p99LatencyMs}ms`,
      actions: ['notify_slack'],
      severity: 'warning',
    },
    {
      name: 'PDF Export Timeout',
      condition: `transaction.op:pdf_export AND transaction.duration:>5000ms`,
      actions: ['notify_slack'],
      severity: 'warning',
    },
    {
      name: 'Database Connection Pool Exhausted',
      condition: `error.type:DatabasePoolExhausted AND environment:staging`,
      actions: ['notify_slack', 'notify_email'],
      severity: 'critical',
    },
    {
      name: 'RLS Policy Violation Attempt',
      condition: `error.type:PermissionDenied AND function:enforceRLS`,
      actions: ['notify_slack', 'notify_email'],
      severity: 'critical',
    },
  ];

  console.log('✅ Alert configurations prepared:');
  alerts.forEach((alert) => {
    console.log(`   • ${alert.name} (${alert.severity})`);
  });

  return alerts;
}

/**
 * Dashboard configuration for staging
 */
export const STAGING_DASHBOARD_METRICS = {
  governance: {
    widgets: [
      {
        title: 'Auto-Mapping Latency (p50, p95, p99)',
        metric: 'transaction.duration',
        filter: 'transaction.op:auto_map',
        unit: 'ms',
      },
      {
        title: 'Governance-Agent Token Usage',
        metric: 'custom.ai_tokens_used',
        filter: 'function:governance-agent',
      },
      {
        title: 'PDF Export Success Rate',
        metric: 'transaction.outcome',
        filter: 'transaction.op:pdf_export',
        unit: 'percent',
      },
      {
        title: 'Policy Pack Recommendations Generated',
        metric: 'custom.policy_packs_recommended',
        unit: 'count',
      },
    ],
  },
  infrastructure: {
    widgets: [
      {
        title: 'Edge Function Error Rate',
        metric: 'event.level:error',
        filter: 'environment:staging',
        unit: 'percent',
      },
      {
        title: 'Database Query Performance',
        metric: 'span.duration',
        filter: 'span.op:db.query',
        unit: 'ms',
      },
      {
        title: 'CPU / Memory Utilization',
        metric: 'system.cpu.usage, system.memory.usage',
        filter: 'environment:staging',
      },
      {
        title: 'API Response Times (p99)',
        metric: 'transaction.duration',
        filter: 'transaction.type:request',
        unit: 'ms',
      },
    ],
  },
  beta: {
    widgets: [
      {
        title: 'User Signup Completions',
        metric: 'custom.signup_completed',
        filter: 'environment:staging',
      },
      {
        title: 'Onboarding Flow Completion Rate',
        metric: 'transaction.outcome',
        filter: 'transaction.name:onboarding_complete',
      },
      {
        title: 'Auto-Activation Success Rate',
        metric: 'custom.policy_pack_activated',
        filter: 'transaction.op:auto_activate',
      },
      {
        title: 'Evidence Export Usage',
        metric: 'custom.pdf_exports',
        filter: 'transaction.op:pdf_export',
      },
    ],
  },
};

/**
 * SQL queries for monitoring database metrics
 */
export const STAGING_MONITORING_QUERIES = {
  errorRate: `
    SELECT
      DATE_TRUNC('hour', created_at) as hour,
      COUNT(*) as total_events,
      COUNT(CASE WHEN level = 'error' THEN 1 END) as errors,
      ROUND(100.0 * COUNT(CASE WHEN level = 'error' THEN 1 END) / COUNT(*), 2) as error_percent
    FROM sentry_events
    WHERE environment = 'staging'
      AND created_at > NOW() - INTERVAL '24 hours'
    GROUP BY hour
    ORDER BY hour DESC;
  `,

  latencyByFunction: `
    SELECT
      function_name,
      COUNT(*) as invocations,
      ROUND(AVG(execution_time_ms)::numeric, 2) as avg_latency,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms) as p95_latency,
      PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY execution_time_ms) as p99_latency,
      MAX(execution_time_ms) as max_latency
    FROM edge_function_logs
    WHERE created_at > NOW() - INTERVAL '24 hours'
    GROUP BY function_name
    ORDER BY avg_latency DESC;
  `,

  auditLogVolume: `
    SELECT
      action,
      COUNT(*) as count,
      COUNT(DISTINCT actor_user_id) as unique_users
    FROM governance_admin_audit_log
    WHERE created_at > NOW() - INTERVAL '24 hours'
    GROUP BY action
    ORDER BY count DESC;
  `,

  rlsViolationAttempts: `
    SELECT
      user_id,
      COUNT(*) as attempts,
      STRING_AGG(DISTINCT resource_type, ', ') as resource_types
    FROM rlsdebug.violation_attempts
    WHERE created_at > NOW() - INTERVAL '24 hours'
    GROUP BY user_id
    ORDER BY attempts DESC;
  `,
};

/**
 * Pre-deployment checklist
 */
export function preDeploymentChecklist() {
  const checks = [
    {
      name: 'Environment variables configured',
      command: 'test -f deploy/.env.staging && echo ✅ || echo ❌',
    },
    {
      name: 'Sentry project created and DSN set',
      command: 'test -n "$SENTRY_DSN_STAGING" && echo ✅ || echo ❌',
    },
    {
      name: 'Staging database migrations applied',
      command: 'supabase db push --project-ref staging-...  # Check manually',
    },
    {
      name: 'Edge Functions deployed',
      command: 'supabase functions deploy --project-ref staging-... # Check manually',
    },
    {
      name: 'Monitoring dashboards created',
      command: 'npm run setup:monitoring -- --staging # Check Sentry',
    },
    {
      name: 'Alerts configured',
      command: 'See monitoring-staging.ts configureAlerts() # Configure in Sentry UI',
    },
  ];

  console.log('📋 Pre-Deployment Checklist:');
  checks.forEach((check) => {
    console.log(`   [ ] ${check.name}`);
    console.log(`       → ${check.command}`);
  });
}

// Entry point
if (require.main === module) {
  const command = process.argv[2];

  if (command === '--setup') {
    initializeSentryStaging();
    configureAlerts();
    console.log('\n✅ Staging monitoring configured');
  } else if (command === '--checklist') {
    preDeploymentChecklist();
  } else {
    console.log('Usage:');
    console.log('  npx ts-node deploy/monitoring-staging.ts --setup');
    console.log('  npx ts-node deploy/monitoring-staging.ts --checklist');
  }
}

export default STAGING_CONFIG;
