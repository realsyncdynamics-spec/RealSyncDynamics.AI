// Dashboard Digest Generator
//
// Generates daily digest notifications summarizing compliance activity.
// Called daily by a cron trigger to create digest for each tenant user.
//
// Endpoint: POST /functions/v1/dashboard-digest-generate
// Body: { tenant_id?: string, action: 'generate_digests' | 'generate_single' }

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { jsonResponse, jsonError } from '../_shared/gateway.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface DigestRequest {
  tenant_id?: string;
  action: 'generate_digests' | 'generate_single';
}

interface DigestData {
  newIncidents: number;
  resolvedIncidents: number;
  upcomingDeadlines: number;
  riskTrendDirection: 'improving' | 'stable' | 'declining';
  complianceScore: number;
  criticalFindings: number;
  policies: {
    documented: number;
    pending: number;
  };
  vendors: {
    active: number;
    highRisk: number;
  };
}

async function generateTenantDigest(
  admin: ReturnType<typeof createClient>,
  tenantId: string
): Promise<DigestData> {
  // Fetch incidents from last 24 hours
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  const { data: newIncidents } = await admin
    .from('incidents')
    .select('id')
    .eq('tenant_id', tenantId)
    .gte('created_at', twentyFourHoursAgo.toISOString())
    .eq('status', 'open');

  const { data: resolvedIncidents } = await admin
    .from('incidents')
    .select('id')
    .eq('tenant_id', tenantId)
    .gte('updated_at', twentyFourHoursAgo.toISOString())
    .eq('status', 'resolved');

  // Fetch compliance score
  const { data: scoreData } = await admin
    .from('compliance_score_history')
    .select('score_overall, trend_direction')
    .eq('tenant_id', tenantId)
    .order('recorded_at', { ascending: false })
    .limit(1);

  const currentScore = scoreData?.[0]?.score_overall || 0;
  const trendDirection = scoreData?.[0]?.trend_direction || 'stable';

  // Fetch upcoming deadlines (next 30 days)
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const { data: upcomingDPIAs } = await admin
    .from('dpia_assessments')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .lte('due_date', thirtyDaysFromNow.toISOString());

  // Fetch policies
  const { data: policies } = await admin
    .from('compliance_policies')
    .select('status')
    .eq('tenant_id', tenantId);

  const documentedPolicies = policies?.filter((p) => p.status === 'approved').length || 0;
  const pendingPolicies = policies?.filter((p) => p.status === 'draft').length || 0;

  // Fetch vendors
  const { data: vendors } = await admin
    .from('vendors')
    .select('risk_level')
    .eq('tenant_id', tenantId);

  const highRiskVendors = vendors?.filter((v) => v.risk_level === 'high').length || 0;

  // Fetch recent audit findings
  const { data: recentAudit } = await admin
    .from('audits')
    .select('findings_count')
    .eq('tenant_id', tenantId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1);

  const criticalFindings = recentAudit?.[0]?.findings_count || 0;

  return {
    newIncidents: newIncidents?.length || 0,
    resolvedIncidents: resolvedIncidents?.length || 0,
    upcomingDeadlines: upcomingDPIAs?.length || 0,
    riskTrendDirection: trendDirection,
    complianceScore: currentScore,
    criticalFindings,
    policies: {
      documented: documentedPolicies,
      pending: pendingPolicies,
    },
    vendors: {
      active: vendors?.length || 0,
      highRisk: highRiskVendors,
    },
  };
}

function generateDigestBody(data: DigestData): { title: string; body: string } {
  const bulletPoints = [];

  if (data.newIncidents > 0) {
    bulletPoints.push(`${data.newIncidents} new incident${data.newIncidents > 1 ? 's' : ''} opened`);
  }

  if (data.resolvedIncidents > 0) {
    bulletPoints.push(`${data.resolvedIncidents} incident${data.resolvedIncidents > 1 ? 's' : ''} resolved`);
  }

  if (data.upcomingDeadlines > 0) {
    bulletPoints.push(`${data.upcomingDeadlines} DPIA${data.upcomingDeadlines > 1 ? 's' : ''} due within 30 days`);
  }

  if (data.criticalFindings > 0) {
    bulletPoints.push(`${data.criticalFindings} critical finding${data.criticalFindings > 1 ? 's' : ''} from latest audit`);
  }

  if (data.vendors.highRisk > 0) {
    bulletPoints.push(`${data.vendors.highRisk} vendor${data.vendors.highRisk > 1 ? 's' : ''} with high-risk status`);
  }

  const trendEmoji = {
    improving: '📈',
    stable: '➡️',
    declining: '📉',
  }[data.riskTrendDirection];

  let title = 'Daily Compliance Summary';
  let body = `Your compliance score is ${data.complianceScore}/100 ${trendEmoji} (${data.riskTrendDirection}).\n\n`;

  if (bulletPoints.length > 0) {
    body += bulletPoints.join('\n') + '\n\n';
  }

  body += `Policies documented: ${data.policies.documented}. Vendors managed: ${data.vendors.active}.`;

  return { title, body };
}

async function generateDigests(
  admin: ReturnType<typeof createClient>,
  tenantIds?: string[]
): Promise<number> {
  let tenants = [];

  if (tenantIds && tenantIds.length > 0) {
    const { data } = await admin
      .from('tenants')
      .select('id')
      .in('id', tenantIds);
    tenants = data || [];
  } else {
    const { data } = await admin
      .from('tenants')
      .select('id');
    tenants = data || [];
  }

  let digestsCreated = 0;

  for (const tenant of tenants) {
    try {
      // Get all users in tenant
      const { data: users } = await admin
        .from('auth.users')
        .select('id')
        .eq('raw_app_meta_data->active_tenant_id::text', `"${tenant.id}"`);

      if (!users || users.length === 0) continue;

      // Generate digest data
      const digestData = await generateTenantDigest(admin, tenant.id);

      // Generate digest content
      const { title, body } = generateDigestBody(digestData);

      // Create notification for each user
      for (const user of users) {
        // Check user's notification preferences
        const { data: prefs } = await admin
          .from('dashboard_notification_preferences')
          .select('email_digests_enabled, digest_frequency')
          .eq('tenant_id', tenant.id)
          .eq('user_id', user.id)
          .single();

        // Only create digest if user has opted in
        if (prefs?.email_digests_enabled && prefs?.digest_frequency !== 'never') {
          // Create notification in database
          await admin.rpc('create_notification', {
            p_tenant_id: tenant.id,
            p_user_id: user.id,
            p_type: 'digest',
            p_title: title,
            p_body: body,
            p_action_url: '/app/dashboard',
            p_action_label: 'View Dashboard',
            p_priority: 'medium',
            p_category: 'daily_digest',
          });

          digestsCreated++;
        }
      }
    } catch (err) {
      console.error(`Error generating digest for tenant ${tenant.id}:`, err);
    }
  }

  return digestsCreated;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonError(405, 'BAD_REQUEST', 'POST only');
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let body: DigestRequest;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  const validActions = ['generate_digests', 'generate_single'];
  if (!validActions.includes(body.action)) {
    return jsonError(400, 'BAD_REQUEST', `action must be one of: ${validActions.join(', ')}`);
  }

  try {
    let digestsCreated = 0;

    const tenantIds = body.tenant_id ? [body.tenant_id] : undefined;

    if (body.action === 'generate_digests' || body.action === 'generate_single') {
      digestsCreated = await generateDigests(admin, tenantIds);
    }

    return jsonResponse({
      ok: true,
      action: body.action,
      digests_created: digestsCreated,
      timestamp_utc: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Error in digest generator:', e);
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});
