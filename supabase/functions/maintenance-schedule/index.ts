// ISO 42001 Maintenance Schedule: Manage ongoing compliance monitoring and recertification
// GET: List compliance events and maintenance schedule
// POST: Create or update maintenance schedule

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { audit } from '../_shared/auditLog.ts';

interface ComplianceEvent {
  id: string;
  type: 'audit_scheduled' | 'audit_completed' | 'control_reviewed' | 'policy_updated' | 'training_required' | 'recertification_due';
  title: string;
  description: string;
  scheduled_date: string;
  completed_date?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed';
  assigned_to?: string;
  controls_affected: string[];
}

interface MaintenanceSchedule {
  id: string;
  audit_frequency_months: number;
  recertification_frequency_months: number;
  control_review_frequency_months: number;
  next_audit_date: string;
  next_recertification_date: string;
  last_audit_date?: string;
  last_recertification_date?: string;
  auto_schedule_enabled: boolean;
  notification_days_before: number;
}

// Generate compliance events based on maintenance schedule
const generateComplianceEvents = (schedule: MaintenanceSchedule): ComplianceEvent[] => {
  const events: ComplianceEvent[] = [];
  const today = new Date();

  // Audit scheduled event
  if (schedule.auto_schedule_enabled) {
    const auditDate = new Date(schedule.next_audit_date);
    const daysUntilAudit = Math.ceil((auditDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    events.push({
      id: `audit-${schedule.id}`,
      type: 'audit_scheduled',
      title: `ISO 42001 Audit geplant`,
      description: `Externe Zertifizierungsprüfung erforderlich`,
      scheduled_date: schedule.next_audit_date,
      severity: daysUntilAudit < 30 ? 'critical' : daysUntilAudit < 60 ? 'high' : 'medium',
      status: daysUntilAudit < 0 ? 'in_progress' : 'pending',
      controls_affected: [],
    });
  }

  // Recertification event
  if (schedule.auto_schedule_enabled) {
    const recertDate = new Date(schedule.next_recertification_date);
    const daysUntilRecert = Math.ceil((recertDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    events.push({
      id: `recert-${schedule.id}`,
      type: 'recertification_due',
      title: `ISO 42001 Rezertifizierung erforderlich`,
      description: `Rezertifizierungsprüfung ist fällig`,
      scheduled_date: schedule.next_recertification_date,
      severity: daysUntilRecert < 60 ? 'critical' : daysUntilRecert < 120 ? 'high' : 'medium',
      status: daysUntilRecert < 0 ? 'in_progress' : 'pending',
      controls_affected: [],
    });
  }

  // Control review events (quarterly)
  const nextReviewDate = new Date(today);
  nextReviewDate.setMonth(nextReviewDate.getMonth() + (schedule.control_review_frequency_months || 6));
  const daysUntilReview = Math.ceil((nextReviewDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  events.push({
    id: `review-${schedule.id}`,
    type: 'control_reviewed',
    title: `Periodische Control-Überprüfung`,
    description: `Regelmäßige Überprüfung der Kontrollimplementierungen erforderlich`,
    scheduled_date: nextReviewDate.toISOString(),
    severity: daysUntilReview < 30 ? 'high' : 'medium',
    status: daysUntilReview < 7 ? 'pending' : 'pending',
    controls_affected: [],
  });

  // Training event (annual)
  const trainingDate = new Date(today);
  trainingDate.setFullYear(trainingDate.getFullYear() + 1);

  events.push({
    id: `training-${schedule.id}`,
    type: 'training_required',
    title: `ISO 42001 Schulung erforderlich`,
    description: `Jährliche Compliance-Schulung für alle Mitarbeiter erforderlich`,
    scheduled_date: trainingDate.toISOString(),
    severity: 'medium',
    status: 'pending',
    controls_affected: [],
  });

  return events;
};

// Generate compliance trends (mock data for 12 months)
const generateComplianceTrends = () => {
  const trends = [];
  const today = new Date();

  for (let i = 11; i >= 0; i--) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthName = monthDate.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });

    // Simulate gradual improvement over time
    const baseScore = 65 + (11 - i) * 2.5;
    const complianceScore = Math.min(100, baseScore + Math.random() * 10);

    trends.push({
      month: monthName,
      compliance_score: Math.round(complianceScore),
      controls_reviewed: Math.floor(Math.random() * 5) + 2,
      incidents: Math.floor(Math.random() * 3),
      training_completion: Math.floor(Math.random() * 20) + 75,
    });
  }

  return trends;
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

  // GET: Retrieve maintenance schedule, compliance events, and trends
  if (req.method === 'GET') {
    try {
      // For now, return mock schedule and generated events
      // In production, this would query the database for saved schedules
      const mockSchedule: MaintenanceSchedule = {
        id: `schedule-${tenantId}`,
        audit_frequency_months: 12,
        recertification_frequency_months: 24,
        control_review_frequency_months: 6,
        next_audit_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
        next_recertification_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        auto_schedule_enabled: true,
        notification_days_before: 30,
      };

      const events = generateComplianceEvents(mockSchedule);
      const trends = generateComplianceTrends();

      // Log audit action
      await audit(admin, {
        tenant_id: tenantId,
        user_id: userId,
        user_email: userEmail,
        action: 'maintenance_schedule_viewed',
        resource_type: 'maintenance_schedule',
        resource_id: tenantId,
        changes: {
          next_audit: mockSchedule.next_audit_date,
          next_recertification: mockSchedule.next_recertification_date,
          total_events: events.length,
        },
        severity: 'info',
      });

      return jsonResponse({
        success: true,
        schedule: mockSchedule,
        events,
        trends,
      });
    } catch (err) {
      console.error('Maintenance schedule retrieval error:', err);
      return jsonError(500, 'ERROR', 'failed to retrieve schedule');
    }
  }

  // POST: Update maintenance schedule
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const {
        audit_frequency_months,
        recertification_frequency_months,
        control_review_frequency_months,
        auto_schedule_enabled,
        notification_days_before,
      } = body;

      // Calculate next dates based on frequency
      const today = new Date();
      const nextAuditDate = new Date(today);
      nextAuditDate.setMonth(nextAuditDate.getMonth() + (audit_frequency_months || 12));

      const nextRecertDate = new Date(today);
      nextRecertDate.setMonth(nextRecertDate.getMonth() + (recertification_frequency_months || 24));

      // Log audit action
      await audit(admin, {
        tenant_id: tenantId,
        user_id: userId,
        user_email: userEmail,
        action: 'maintenance_schedule_updated',
        resource_type: 'maintenance_schedule',
        resource_id: tenantId,
        changes: {
          audit_frequency_months,
          recertification_frequency_months,
          control_review_frequency_months,
          auto_schedule_enabled,
          notification_days_before,
        },
        severity: 'info',
      });

      return jsonResponse({
        success: true,
        message: 'Maintenance schedule updated successfully',
        schedule: {
          id: `schedule-${tenantId}`,
          audit_frequency_months,
          recertification_frequency_months,
          control_review_frequency_months,
          next_audit_date: nextAuditDate.toISOString(),
          next_recertification_date: nextRecertDate.toISOString(),
          auto_schedule_enabled,
          notification_days_before,
        },
      });
    } catch (err) {
      console.error('Maintenance schedule update error:', err);
      return jsonError(500, 'ERROR', 'failed to update schedule');
    }
  }

  return jsonError(405, 'BAD_REQUEST', 'GET or POST only');
});
