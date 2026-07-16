/**
 * Webhook Integration Example
 * Demonstrates subscribing to compliance events and handling webhook payloads
 */

import { RealSyncDynamicsSDK } from '@realsyncdynamics/sdk';

const sdk = new RealSyncDynamicsSDK({
  apiKey: process.env.REALSYNCDYNAMICS_API_KEY!,
});

async function setupWebhooks() {
  const tenantId = 'your-tenant-id';
  const webhookUrl = 'https://your-api.example.com/webhooks/realsyncdynamics';

  try {
    // Subscribe to critical compliance events
    console.log('🪝 Setting up webhook subscription...');
    const subscription = await sdk.subscribeToWebhook(tenantId, {
      url: webhookUrl,
      events: [
        'audit.completed',
        'risk.detected',
        'incident.created',
        'dpia.completed',
        'policy.violation',
      ],
      secret: process.env.WEBHOOK_SECRET,
      headers: {
        'X-Custom-Header': 'RealSyncDynamics',
      },
    });

    console.log(`✅ Subscription created: ${subscription.subscription_id}`);

    // Retrieve webhook delivery history
    console.log('\n📋 Checking webhook deliveries...');
    const deliveries = await sdk.getWebhookDeliveries(tenantId, subscription.subscription_id, {
      status: 'failed',
      limit: 10,
    });

    deliveries.forEach((delivery) => {
      console.log(`Event: ${delivery.event_key} at ${delivery.timestamp}`);
      if (delivery.response_status !== 200) {
        console.log(`  ⚠️  Response status: ${delivery.response_status}`);
      }
    });

    // List all active subscriptions
    console.log(`\n✨ Total subscriptions: ${subscription.subscription_id ? 1 : 0}`);
  } catch (error) {
    console.error('❌ Webhook setup failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Example webhook payload handler for Express.js
export function handleWebhookPayload(
  req: { body: Record<string, any>; headers: Record<string, string> },
  _res: { status: (code: number) => { send: (data: any) => void } }
) {
  const payload = req.body;
  const signature = req.headers['x-realsyncdynamics-signature'];

  // Verify webhook signature (use your webhook secret)
  // const verified = verifyWebhookSignature(JSON.stringify(payload), signature);
  // if (!verified) return res.status(401).send({ error: 'Unauthorized' });

  switch (payload.event_key) {
    case 'risk.detected':
      console.log(`🚨 New risk detected: ${payload.data.risk_type}`);
      console.log(`   Severity: ${payload.data.severity}`);
      // Trigger internal alert or escalation
      break;

    case 'incident.created':
      console.log(`🔴 Incident created: ${payload.data.incident_type}`);
      console.log(`   Impact: ${payload.data.affected_count} data subjects`);
      // Trigger incident response workflow
      break;

    case 'audit.completed':
      console.log(`✅ Audit completed: ${payload.data.domain}`);
      console.log(`   Findings: ${payload.data.findings_count}`);
      // Update compliance dashboard
      break;

    case 'dpia.completed':
      console.log(`📋 DPIA assessment completed: ${payload.data.processing_activity}`);
      // Archive assessment and update policy
      break;

    case 'policy.violation':
      console.log(`⚠️  Policy violation: ${payload.data.policy_name}`);
      // Create remediation task
      break;

    default:
      console.log(`📨 Webhook event: ${payload.event_key}`);
  }
}

setupWebhooks();
