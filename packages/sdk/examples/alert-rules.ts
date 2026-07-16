/**
 * Alert Rules Example
 * Demonstrates creating, updating, and managing compliance alert rules
 */

import { RealSyncDynamicsSDK } from '@realsyncdynamics/sdk';

const sdk = new RealSyncDynamicsSDK({
  apiKey: process.env.REALSYNCDYNAMICS_API_KEY!,
});

async function setupAlertRules() {
  const tenantId = 'your-tenant-id';

  try {
    // Rule 1: Critical Risk Detection
    console.log('⚠️  Creating critical risk alert rule...');
    const criticalRule = await sdk.createAlertRule(tenantId, {
      rule_name: 'Critical Risk Detection',
      trigger_event: 'risk_detected',
      severity_threshold: 'critical',
      enabled: true,
      actions: [
        {
          action: 'alert_email',
          recipients: ['ciso@company.com', 'compliance@company.com'],
        },
        {
          action: 'slack',
          webhook_url: process.env.SLACK_WEBHOOK_URL,
          channel: '#security-alerts',
        },
        {
          action: 'webhook',
          url: 'https://api.company.com/alerts/critical',
        },
      ],
    });
    console.log(`✅ Rule created: ${criticalRule.id}`);

    // Rule 2: High Audit Findings
    console.log('\n📋 Creating audit findings alert rule...');
    const auditRule = await sdk.createAlertRule(tenantId, {
      rule_name: 'High Audit Findings Alert',
      trigger_event: 'audit.completed',
      severity_threshold: 'high',
      enabled: true,
      actions: [
        {
          action: 'alert_email',
          recipients: ['compliance@company.com'],
        },
        {
          action: 'webhook',
          url: 'https://api.company.com/alerts/audit',
        },
      ],
    });
    console.log(`✅ Rule created: ${auditRule.id}`);

    // Rule 3: Overdue DPIA Reminder
    console.log('\n🕐 Creating DPIA deadline alert rule...');
    const dpiaRule = await sdk.createAlertRule(tenantId, {
      rule_name: 'Overdue DPIA Reminders',
      trigger_event: 'dpia.deadline_approaching',
      severity_threshold: 'medium',
      enabled: true,
      actions: [
        {
          action: 'alert_email',
          recipients: ['dpa@company.com'],
        },
      ],
    });
    console.log(`✅ Rule created: ${dpiaRule.id}`);

    // Update alert rule (e.g., change recipients)
    console.log('\n📝 Updating alert rule...');
    const updatedRule = await sdk.updateAlertRule(tenantId, criticalRule.id, {
      actions: [
        {
          action: 'alert_email',
          recipients: ['ciso@company.com', 'compliance@company.com', 'cto@company.com'],
        },
        {
          action: 'slack',
          webhook_url: process.env.SLACK_WEBHOOK_URL,
          channel: '#critical-incidents',
        },
      ],
    });
    console.log(`✅ Rule updated: ${updatedRule.id}`);

    // List and inspect all rules
    console.log('\n📊 Summary of active alert rules:');
    const rules = [criticalRule, auditRule, dpiaRule];
    rules.forEach((rule) => {
      console.log(`\n  • ${rule.rule_name}`);
      console.log(`    Trigger: ${rule.trigger_event}`);
      console.log(`    Threshold: ${rule.severity_threshold}`);
      console.log(`    Actions: ${rule.actions.length}`);
    });

    // Demonstrate rule disabling (without deletion)
    console.log('\n🔇 Disabling audit rule temporarily...');
    await sdk.updateAlertRule(tenantId, auditRule.id, {
      enabled: false,
    });
    console.log(`✅ Audit rule disabled (can be re-enabled later)`);

    // Delete a rule
    console.log('\n🗑️  Deleting low-priority rule...');
    await sdk.deleteAlertRule(tenantId, dpiaRule.id);
    console.log(`✅ DPIA rule deleted`);
  } catch (error) {
    console.error('❌ Alert rule setup failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

setupAlertRules();
