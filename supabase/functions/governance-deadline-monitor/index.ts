/**
 * Governance Deadline Monitor (Cron Job)
 *
 * Runs every 6 hours to:
 * 1. Check NIS2 incident deadlines
 * 2. Alert on expiring evidence
 * 3. Monitor remediation plan milestones
 * 4. Trigger escalations for overdue items
 *
 * Scheduled via: supabase/functions/schedule.yaml
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface DeadlineAlert {
  id: string;
  type: 'nis2_deadline' | 'evidence_expiring' | 'milestone_overdue' | 'gap_critical';
  severity: 'critical' | 'high' | 'medium' | 'low';
  tenant_id: string;
  target_id: string;
  message: string;
  triggered_at: string;
}

Deno.serve(async (req: Request) => {
  // Verify this is a scheduled job (from Supabase cron)
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    console.log('Starting governance deadline monitoring...');

    const alerts: DeadlineAlert[] = [];

    // 1. Check NIS2 incident deadlines
    const { data: nis2Deadlines } = await supabase
      .from('nis2_incident_deadlines')
      .select('*')
      .eq('status', 'critical')
      .lt('full_notification_deadline', new Date().toISOString());

    if (nis2Deadlines) {
      for (const deadline of nis2Deadlines) {
        alerts.push({
          id: `nis2-${deadline.id}`,
          type: 'nis2_deadline',
          severity: 'critical',
          tenant_id: deadline.tenant_id,
          target_id: deadline.id,
          message: `NIS2 Meldepflicht überschritten: ${deadline.incident_id}`,
          triggered_at: new Date().toISOString(),
        });
      }
    }

    // 2. Check expiring evidence (within 7 days)
    const expiryThreshold = new Date();
    expiryThreshold.setDate(expiryThreshold.getDate() + 7);

    const { data: expiringEvidence } = await supabase
      .from('evidence_items')
      .select('*')
      .lt('expiration_date', expiryThreshold.toISOString())
      .gt('expiration_date', new Date().toISOString());

    if (expiringEvidence) {
      for (const evidence of expiringEvidence) {
        const daysLeft = Math.ceil(
          (new Date(evidence.expiration_date).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
        );

        alerts.push({
          id: `evidence-${evidence.id}`,
          type: 'evidence_expiring',
          severity: daysLeft <= 3 ? 'high' : 'medium',
          tenant_id: evidence.tenant_id,
          target_id: evidence.id,
          message: `Nachweis läuft in ${daysLeft} Tagen ab: ${evidence.name}`,
          triggered_at: new Date().toISOString(),
        });
      }
    }

    // 3. Check overdue remediation milestones
    const { data: overdueMillestones } = await supabase
      .from('remediation_milestones')
      .select('*, remediation_plans(id, control_name)')
      .lt('due_date', new Date().toISOString())
      .eq('completed', false);

    if (overdueMillestones) {
      for (const milestone of overdueMillestones) {
        alerts.push({
          id: `milestone-${milestone.id}`,
          type: 'milestone_overdue',
          severity: 'high',
          tenant_id: milestone.tenant_id,
          target_id: milestone.remediation_plan_id,
          message: `Meilenstein überfällig: ${milestone.title}`,
          triggered_at: new Date().toISOString(),
        });
      }
    }

    // 4. Check critical gaps without remediation
    const { data: criticalGaps } = await supabase
      .from('compliance_gaps')
      .select('*')
      .eq('severity', 'critical')
      .in('status', ['identified', 'planned'])
      .gt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (criticalGaps) {
      for (const gap of criticalGaps) {
        alerts.push({
          id: `gap-${gap.id}`,
          type: 'gap_critical',
          severity: 'critical',
          tenant_id: gap.tenant_id,
          target_id: gap.id,
          message: `Kritische Lücke ohne Behebungsplan: ${gap.control_name}`,
          triggered_at: new Date().toISOString(),
        });
      }
    }

    // Store alerts in database
    if (alerts.length > 0) {
      const { error } = await supabase
        .from('governance_alerts')
        .insert(alerts);

      if (error) {
        console.error('Failed to store alerts:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to store alerts', details: error }),
          { status: 500 }
        );
      }

      console.log(`Created ${alerts.length} alerts`);

      // Trigger notifications for critical alerts
      const criticalAlerts = alerts.filter(a => a.severity === 'critical');
      if (criticalAlerts.length > 0) {
        // Would trigger webhooks/emails here in production
        console.log(`Triggering notifications for ${criticalAlerts.length} critical alerts`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        alertsCreated: alerts.length,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (err) {
    console.error('Error in governance deadline monitor:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500 }
    );
  }
});
