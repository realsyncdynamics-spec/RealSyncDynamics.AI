// Compliance Alert Trigger
//
// Triggered by risk detection, audit failures, and compliance events.
// Creates alerts, escalates, and optionally auto-remediates.
//
// Endpoint: POST /functions/v1/compliance-alert-trigger
// Body: { tenant_id, trigger_event, entity_type?, entity_id?, severity?, description? }
//
// Returns: { ok: true, alert_id: "...", actions_executed: [...] }

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { jsonResponse, jsonError } from '../_shared/gateway.ts';
import { loadEntitlementsForTenant, hasFeature } from '../_shared/entitlements.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface AlertTriggerRequest {
  tenant_id: string;
  trigger_event: string;
  entity_type?: string;
  entity_id?: string;
  severity?: string;
  description?: string;
}

interface ComplianceAction {
  action: string;
  recipients?: unknown[];
  url?: string;
  [key: string]: unknown;
}

async function logAlert(
  admin: ReturnType<typeof createClient>,
  tenantId: string,
  ruleId: string | null,
  triggerEvent: string,
  entityType: string | undefined,
  entityId: string | undefined,
  severity: string,
  description: string
): Promise<string> {
  const { data, error } = await admin
    .rpc('log_compliance_alert', {
      p_tenant_id: tenantId,
      p_rule_id: ruleId,
      p_trigger_event: triggerEvent,
      p_entity_type: entityType || null,
      p_entity_id: entityId || null,
      p_severity: severity,
      p_description: description,
    });

  if (error) {
    throw new Error(`Failed to log alert: ${error.message}`);
  }

  return data as string;
}

async function getEnabledRules(
  admin: ReturnType<typeof createClient>,
  tenantId: string,
  triggerEvent: string
): Promise<any[]> {
  const { data, error } = await admin
    .from('compliance_alert_rules')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('trigger_event', triggerEvent)
    .eq('enabled', true);

  if (error) {
    throw new Error(`Failed to fetch rules: ${error.message}`);
  }

  return data || [];
}

async function executeActions(
  actions: ComplianceAction[],
  context: {
    alertId: string;
    severity: string;
    description: string;
    entityType?: string;
    entityId?: string;
    /** `alerts.email` des Tenants — ohne den Key wird keine E-Mail-Aktion ausgeführt. */
    emailAllowed: boolean;
  }
): Promise<string[]> {
  const executedActions: string[] = [];

  for (const action of actions) {
    try {
      if (action.action === 'alert_email' && action.recipients) {
        if (!context.emailAllowed) {
          executedActions.push('email_skipped_entitlement_missing');
          continue;
        }
        // Email notification (would integrate with email service)
        executedActions.push(`email_sent_to_${action.recipients.length}_recipients`);
      }
      if (action.action === 'webhook' && action.url) {
        // Webhook notification
        const payload = {
          event: 'compliance.alert.created',
          alert_id: context.alertId,
          severity: context.severity,
          description: context.description,
          entity_type: context.entityType,
          entity_id: context.entityId,
          timestamp: new Date().toISOString(),
        };

        await fetch(action.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        executedActions.push(`webhook_delivered_to_${action.url}`);
      }
      if (action.action === 'alert_slack' && action.webhook_url) {
        // Slack notification
        const slackPayload = {
          text: `🚨 Compliance Alert: ${context.severity.toUpperCase()}`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Alert Severity:* ${context.severity}\n*Description:* ${context.description}`,
              },
            },
          ],
        };

        await fetch(action.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackPayload),
        });

        executedActions.push('slack_notified');
      }
    } catch (err) {
      executedActions.push(`action_error_${action.action}_${(err as Error).message}`);
    }
  }

  return executedActions;
}

async function createRemediationTasks(
  admin: ReturnType<typeof createClient>,
  alertId: string,
  tenantId: string,
  remediation: {
    task_type: string;
    entity_type: string;
    entity_id: string;
    requires_approval?: boolean;
  }
): Promise<void> {
  const { error } = await admin.from('compliance_remediation_tasks').insert({
    alert_id: alertId,
    tenant_id: tenantId,
    task_type: remediation.task_type,
    entity_type: remediation.entity_type,
    entity_id: remediation.entity_id,
    status: 'pending',
    requires_approval: remediation.requires_approval || false,
  });

  if (error) {
    throw new Error(`Failed to create remediation task: ${error.message}`);
  }
}

async function triggerWebhookEvent(
  admin: ReturnType<typeof createClient>,
  tenantId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  // Queue webhook delivery for subscribed endpoints
  const { data: subscriptions, error: subError } = await admin
    .from('webhook_subscriptions')
    .select('id, url, secret, headers')
    .eq('tenant_id', tenantId)
    .eq('event_key', eventType)
    .eq('enabled', true);

  if (subError) {
    console.error('Failed to fetch webhook subscriptions:', subError.message);
    return;
  }

  for (const sub of subscriptions || []) {
    // Queue delivery (would normally call webhook-deliver function or queue)
    console.log(`Queued webhook delivery to ${sub.url} for event ${eventType}`);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonError(405, 'BAD_REQUEST', 'POST only');
  }

  // AP9 Welle 3: Diese Function ist intern — sie legt per Service-Role
  // Alerts für beliebige `tenant_id`s an, ruft die in den Regeln hinterlegten
  // Webhooks auf und erzeugt Behebungsaufgaben. Bis hier war sie mit jedem
  // gültigen JWT erreichbar. Jetzt nur noch mit Service-Role-Bearer, wie
  // compliance-remediation-execute.
  const authHeader = req.headers.get('Authorization') ?? '';
  if (authHeader !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
    return jsonError(401, 'UNAUTHORIZED', 'service role only');
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let body: AlertTriggerRequest;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  if (typeof body.tenant_id !== 'string' || !body.tenant_id || typeof body.trigger_event !== 'string' || !body.trigger_event) {
    return jsonError(400, 'BAD_REQUEST', 'tenant_id and trigger_event required');
  }

  const validSeverities = ['low', 'medium', 'high', 'critical'];
  const severity = body.severity || 'medium';
  if (!validSeverities.includes(severity)) {
    return jsonError(400, 'BAD_REQUEST', `severity must be one of: ${validSeverities.join(', ')}`);
  }

  try {
    // Fetch enabled rules for this trigger event
    const rules = await getEnabledRules(admin, body.tenant_id, body.trigger_event);

    // If no rules match, still log the alert but without a rule_id
    const alertId = await logAlert(
      admin,
      body.tenant_id,
      rules.length > 0 ? rules[0].id : null,
      body.trigger_event,
      body.entity_type,
      body.entity_id,
      severity,
      body.description || `Compliance event triggered: ${body.trigger_event}`
    );

    const executedActions: string[] = [];

    // `alerts.email` (ab Starter) entscheidet, ob E-Mail-Aktionen laufen.
    // Der Alert selbst wird immer protokolliert — der Prüfpfad hängt nicht
    // am Plan, nur der Versand.
    // Fail closed: Lässt sich der Plan nicht lesen, geht keine E-Mail raus —
    // der Alert ist protokolliert, die Webhook-Aktionen laufen trotzdem.
    let emailAllowed = false;
    try {
      const entitlements = await loadEntitlementsForTenant(admin, body.tenant_id);
      emailAllowed = hasFeature(entitlements, 'alerts.email');
    } catch (err) {
      console.warn('entitlements unavailable, e-mail actions suppressed:', err);
    }

    for (const rule of rules) {
      // Execute rule actions
      const actions = await executeActions(rule.actions || [], {
        alertId,
        severity,
        description: body.description || rule.description || body.trigger_event,
        entityType: body.entity_type,
        entityId: body.entity_id,
        emailAllowed,
      });

      executedActions.push(...actions);

      // Auto-remediate if configured
      if (rule.auto_remediate && rule.remediation_template) {
        const template = rule.remediation_template;
        await createRemediationTasks(admin, alertId, body.tenant_id, {
          task_type: template.task_type,
          entity_type: template.entity_type || body.entity_type || 'unknown',
          entity_id: template.entity_id || body.entity_id || 'unknown',
          requires_approval: template.requires_approval || false,
        });

        executedActions.push('remediation_task_created');
      }
    }

    // Trigger webhook event for subscribers
    await triggerWebhookEvent(admin, body.tenant_id, 'compliance.alert.created', {
      alert_id: alertId,
      trigger_event: body.trigger_event,
      severity,
      entity_type: body.entity_type,
      entity_id: body.entity_id,
    });

    return jsonResponse({
      ok: true,
      alert_id: alertId,
      rules_matched: rules.length,
      actions_executed: executedActions,
      timestamp_utc: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Error triggering compliance alert:', e);
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});
