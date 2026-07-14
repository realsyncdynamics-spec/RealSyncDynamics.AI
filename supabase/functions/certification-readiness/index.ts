// ISO 42001 Certification Readiness Assessment
// Analyzes tenant progress towards certification and provides actionable insights

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== 'GET') return jsonError(405, 'BAD_REQUEST', 'GET only');

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });

  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');

  const url = new URL(req.url);
  const tenantId = url.searchParams.get('tenant_id');

  if (!tenantId) {
    return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  }

  try {
    // Load all implementations
    const { data: implementations } = await userClient
      .from('iso42001_implementations')
      .select('*')
      .eq('tenant_id', tenantId);

    if (!implementations || implementations.length === 0) {
      return jsonResponse({
        overall_score: 0,
        total_controls: 0,
        implemented_controls: 0,
        in_progress_controls: 0,
        planned_controls: 0,
        not_started_controls: 0,
        average_maturity: 0,
        categories: [],
        timeline: {
          estimated_weeks: 0,
          critical_path: [],
          auditor_contact_required: true,
        },
        action_items: [],
        risks: [],
        resources: {
          total_hours_required: 0,
          hours_completed: 0,
          current_team_size: 1,
          recommended_team_size: 1,
          weeks_until_ready: 0,
        },
      });
    }

    // Calculate metrics
    const total = implementations.length;
    const implemented = implementations.filter((i) => i.status === 'implemented' || i.status === 'optimized').length;
    const inProgress = implementations.filter((i) => i.status === 'in_progress').length;
    const planned = implementations.filter((i) => i.status === 'planned').length;
    const notStarted = implementations.filter((i) => i.status === 'not_started').length;

    const overallScore = Math.round((implemented / total) * 100);
    const averageMaturity = implementations.reduce((sum, i) => sum + (i.maturity_level || 0), 0) / total;

    // Group by category for category readiness
    const categoryMap = new Map<string, typeof implementations>();
    implementations.forEach((impl) => {
      const cat = impl.control_category || 'Uncategorized';
      if (!categoryMap.has(cat)) categoryMap.set(cat, []);
      categoryMap.get(cat)!.push(impl);
    });

    const categories = Array.from(categoryMap.entries()).map(([name, items]) => {
      const completed = items.filter((i) => i.status === 'implemented' || i.status === 'optimized').length;
      const percent = Math.round((completed / items.length) * 100);
      const critical = items.filter((i) => i.status === 'not_started' && i.control_code?.includes('critical')).length;

      let status: 'at_risk' | 'on_track' | 'ahead' = 'on_track';
      if (percent >= 85) status = 'ahead';
      if (percent <= 40) status = 'at_risk';

      return {
        name,
        completion_percentage: percent,
        controls_completed: completed,
        controls_total: items.length,
        critical_issues: critical,
        status,
      };
    });

    // Estimate timeline (based on in_progress + planned items, assuming ~2-3 weeks per item)
    const itemsToComplete = inProgress + planned + Math.max(0, Math.round(notStarted * 0.3));
    const estimatedWeeks = Math.max(4, Math.ceil(itemsToComplete / 2)); // Optimistic: 2 items/week

    // Critical path: identify long-lead-time or dependent items
    const criticalItems = implementations
      .filter((i) => i.control_code?.match(/^A\.[456]\./)) // Assume A.4-A.6 are critical
      .filter((i) => i.status !== 'implemented' && i.status !== 'optimized')
      .map((i) => `${i.control_code}: ${i.control_name}`)
      .slice(0, 3);

    const timeline = {
      estimated_weeks: estimatedWeeks,
      critical_path: criticalItems,
      auditor_contact_required: implemented < total * 0.6,
    };

    // Action items: highest-priority open work
    const actionItems = implementations
      .filter((i) => i.status !== 'implemented' && i.status !== 'optimized')
      .map((impl) => ({
        id: impl.id,
        title: `Implement ${impl.control_code}: ${impl.control_name}`,
        priority: (impl.status === 'planned' || impl.status === 'not_started') ? 'high' : 'medium' as const,
        status: (impl.status === 'in_progress' ? 'in_progress' : 'open') as const,
        due_date: impl.next_review_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        effort_hours: impl.maturity_level === 0 ? 40 : impl.maturity_level <= 2 ? 20 : 10,
        control_ids: [impl.id],
      }))
      .sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .slice(0, 10);

    // Risks: identify problematic areas
    const risks = [];

    if (notStarted > total * 0.2) {
      risks.push({
        id: 'risk_1',
        title: `${notStarted} controls not yet started`,
        severity: 'high' as const,
        likelihood: 0.7,
        impact: 0.8,
        mitigation_plan: 'Allocate resources to begin implementation of priority controls immediately',
      });
    }

    if (categories.some((c) => c.status === 'at_risk')) {
      risks.push({
        id: 'risk_2',
        title: 'At-risk categories identified',
        severity: 'high' as const,
        likelihood: 0.6,
        impact: 0.9,
        mitigation_plan: 'Focus team capacity on at-risk control categories',
      });
    }

    if (timeline.auditor_contact_required) {
      risks.push({
        id: 'risk_3',
        title: 'Early auditor engagement recommended',
        severity: 'medium' as const,
        likelihood: 0.5,
        impact: 0.6,
        mitigation_plan: 'Contact certification body to discuss requirements and timeline',
      });
    }

    if (averageMaturity < 2) {
      risks.push({
        id: 'risk_4',
        title: 'Low average maturity level',
        severity: 'medium' as const,
        likelihood: 0.4,
        impact: 0.7,
        mitigation_plan: 'Invest in quality improvements and mature processes before certification audit',
      });
    }

    // Resource allocation
    const totalHoursRequired = actionItems.reduce((sum, item) => sum + item.effort_hours, 0) + 100; // +100 for documentation
    const hoursCompleted = implementations
      .filter((i) => i.status === 'implemented' || i.status === 'optimized')
      .reduce((sum, i) => sum + (i.maturity_level * 10), 0);

    const recommendedTeamSize = Math.max(1, Math.ceil(totalHoursRequired / (40 * estimatedWeeks))); // 40 hours/week assumption
    const weeksUntilReady = Math.max(estimatedWeeks, Math.ceil(totalHoursRequired / (recommendedTeamSize * 40)));

    const resources = {
      total_hours_required: totalHoursRequired,
      hours_completed: hoursCompleted,
      current_team_size: 1, // Would need to fetch from actual team data
      recommended_team_size: recommendedTeamSize,
      weeks_until_ready: weeksUntilReady,
    };

    return jsonResponse({
      overall_score: overallScore,
      total_controls: total,
      implemented_controls: implemented,
      in_progress_controls: inProgress,
      planned_controls: planned,
      not_started_controls: notStarted,
      average_maturity: Math.round(averageMaturity * 10) / 10,
      categories,
      timeline,
      action_items: actionItems,
      risks: risks,
      resources,
    });
  } catch (e) {
    console.error('Error:', e);
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});
