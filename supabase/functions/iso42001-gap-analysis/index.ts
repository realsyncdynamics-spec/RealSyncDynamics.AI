// ISO 42001 Gap Analysis: Identify compliance gaps and remediation needs
// GET: Analyze controls and identify implementation gaps

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { audit } from '../_shared/auditLog.ts';

interface ControlGap {
  id: string;
  control_id: string;
  control_name: string;
  gap_description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  impact_score: number;
  effort_days: number;
  status: 'identified' | 'planned' | 'in_progress' | 'resolved';
  root_cause: string;
  affected_controls: string[];
  estimated_fix_date: string | null;
  owner: string | null;
  created_at: string;
}

// Calculate gap severity based on control maturity level
const calculateSeverity = (maturityLevel: string): 'critical' | 'high' | 'medium' | 'low' => {
  switch (maturityLevel) {
    case 'not_started':
      return 'critical';
    case 'planned':
      return 'high';
    case 'in_progress':
      return 'medium';
    case 'implemented':
      return 'low';
    case 'optimized':
      return 'low';
    default:
      return 'medium';
  }
};

// Calculate impact score based on control criticality and maturity gap
const calculateImpactScore = (criticality: number, maturityLevel: string): number => {
  const baseScore = criticality || 75;
  const maturityPenalty = {
    'not_started': 100,
    'planned': 75,
    'in_progress': 50,
    'implemented': 25,
    'optimized': 0,
  }[maturityLevel] || 50;

  return Math.min(100, Math.round((baseScore + maturityPenalty) / 2));
};

// Estimate effort based on gap type and control complexity
const estimateEffort = (controlId: string, maturityLevel: string): number => {
  const baseEffort = {
    'not_started': 20,
    'planned': 15,
    'in_progress': 8,
    'implemented': 3,
    'optimized': 0,
  }[maturityLevel] || 10;

  // Add effort for cross-control dependencies
  const crossControlBonus = controlId.includes('.1') ? 2 : 0;
  return baseEffort + crossControlBonus;
};

// Generate gap description based on control requirements
const generateGapDescription = (controlName: string, maturityLevel: string): string => {
  const templates = {
    'not_started': `${controlName} has not been implemented. This control requires establishing processes, documentation, and evidence.`,
    'planned': `${controlName} implementation is in planning phase. Control requirements analysis complete, but execution has not begun.`,
    'in_progress': `${controlName} is partially implemented. Some requirements are in place, but full compliance requires additional work.`,
    'implemented': `${controlName} is implemented with minor gaps. Control is operational but could be optimized.`,
    'optimized': `${controlName} is fully optimized. No gaps identified.`,
  };

  return templates[maturityLevel as keyof typeof templates] || templates['in_progress'];
};

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });

  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  const userId = userResp.user.id;
  const userEmail = userResp.user.email ?? null;

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  const url = new URL(req.url);
  const tenantId = url.searchParams.get('tenant_id');
  if (!tenantId) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');

  // Verify access
  const { data: member } = await userClient
    .from('memberships')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .single();

  if (!member) {
    return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');
  }

  // GET: Analyze controls and identify gaps
  if (req.method === 'GET') {
    try {
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
      const severityFilter = url.searchParams.get('severity');
      const statusFilter = url.searchParams.get('status');
      const controlIdFilter = url.searchParams.get('control_id');

      // Fetch all control implementations for this tenant
      const { data: implementations, error: implError } = await userClient
        .from('iso42001_implementations')
        .select('id, control_id, control_name, maturity_level, criticality')
        .eq('tenant_id', tenantId)
        .is('archived_at', null)
        .order('control_id', { ascending: true });

      if (implError) throw implError;

      // Generate gaps based on implementations
      const gaps: ControlGap[] = (implementations || [])
        .filter((impl: any) => impl.maturity_level !== 'optimized')
        .map((impl: any) => {
          const severity = calculateSeverity(impl.maturity_level);
          const impactScore = calculateImpactScore(impl.criticality, impl.maturity_level);
          const effortDays = estimateEffort(impl.control_id, impl.maturity_level);
          const gapDescription = generateGapDescription(impl.control_name, impl.maturity_level);

          return {
            id: `gap-${impl.id}`,
            control_id: impl.control_id,
            control_name: impl.control_name,
            gap_description: gapDescription,
            severity,
            impact_score: impactScore,
            effort_days: effortDays,
            status: 'identified',
            root_cause: `Control ${impl.control_id} maturity level is ${impl.maturity_level}`,
            affected_controls: [impl.control_id],
            estimated_fix_date: null,
            owner: null,
            created_at: new Date().toISOString(),
          };
        });

      // Apply filters
      let filtered = gaps;

      if (severityFilter) {
        filtered = filtered.filter((g) => g.severity === severityFilter);
      }

      if (statusFilter) {
        filtered = filtered.filter((g) => g.status === statusFilter);
      }

      if (controlIdFilter) {
        filtered = filtered.filter((g) => g.control_id.includes(controlIdFilter));
      }

      // Sort by severity and impact
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      filtered.sort((a, b) => {
        const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
        return severityDiff !== 0 ? severityDiff : b.impact_score - a.impact_score;
      });

      // Apply pagination
      const paginated = filtered.slice(offset, offset + limit);

      // Calculate metrics
      const criticalCount = gaps.filter((g) => g.severity === 'critical').length;
      const totalEffort = gaps.reduce((sum, g) => sum + g.effort_days, 0);
      const avgImpact = gaps.length > 0 ? Math.round(gaps.reduce((sum, g) => sum + g.impact_score, 0) / gaps.length) : 0;

      // Log audit action
      await audit(admin, {
        tenant_id: tenantId,
        user_id: userId,
        user_email: userEmail,
        action: 'gap_analysis_viewed',
        resource_type: 'gap_analysis',
        resource_id: tenantId,
        changes: {
          total_gaps: gaps.length,
          critical_gaps: criticalCount,
          total_effort_days: totalEffort,
        },
        severity: 'info',
      });

      return jsonResponse({
        success: true,
        gaps: paginated,
        total_count: filtered.length,
        offset,
        limit,
        metrics: {
          total_gaps: gaps.length,
          critical_count: criticalCount,
          total_effort_days: totalEffort,
          avg_impact_score: avgImpact,
        },
      });
    } catch (err) {
      console.error('Gap analysis error:', err);
      return jsonError(500, 'ERROR', 'failed to analyze gaps');
    }
  }

  return jsonError(405, 'BAD_REQUEST', 'GET only');
});
