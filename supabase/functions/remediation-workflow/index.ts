// ISO 42001 Remediation Workflow: Track and manage remediation tasks
// GET: List remediation tasks with filtering
// POST: Create new remediation task from gap

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { audit } from '../_shared/auditLog.ts';

interface RemediationTask {
  id: string;
  gap_id: string;
  control_id: string;
  control_name: string;
  gap_description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'not_started' | 'in_progress' | 'blocked' | 'completed';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  assigned_to: string | null;
  assigned_to_name: string | null;
  start_date: string | null;
  due_date: string;
  completion_date: string | null;
  estimated_effort_hours: number;
  actual_effort_hours: number;
  progress_percent: number;
  dependencies: string[];
  blockers: string[];
  notes: string;
  created_at: string;
  updated_at: string;
}

// Determine initial priority based on gap severity
const determinePriority = (severity: string): 'urgent' | 'high' | 'medium' | 'low' => {
  switch (severity) {
    case 'critical':
      return 'urgent';
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    case 'low':
      return 'low';
    default:
      return 'high';
  }
};

// Estimate due date based on priority (add days)
const calculateDueDate = (priority: string): string => {
  const today = new Date();
  const daysToAdd = {
    'urgent': 7,
    'high': 14,
    'medium': 30,
    'low': 60,
  }[priority] || 30;

  const dueDate = new Date(today.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
  return dueDate.toISOString().split('T')[0];
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

  // GET: List remediation tasks
  if (req.method === 'GET') {
    try {
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
      const statusFilter = url.searchParams.get('status');
      const priorityFilter = url.searchParams.get('priority');
      const severityFilter = url.searchParams.get('severity');
      const assignedToFilter = url.searchParams.get('assigned_to');

      let query = userClient
        .from('remediation_tasks')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .is('archived_at', null)
        .order('priority', { ascending: false })
        .order('due_date', { ascending: true });

      if (statusFilter) query = query.eq('status', statusFilter);
      if (priorityFilter) query = query.eq('priority', priorityFilter);
      if (severityFilter) query = query.eq('severity', severityFilter);
      if (assignedToFilter) query = query.eq('assigned_to', assignedToFilter);

      const { data: tasks, error, count } = await query.range(offset, offset + limit - 1);

      if (error) throw error;

      // Enrich with user names (mock for now, would join with profiles in production)
      const enriched = (tasks || []).map((task: RemediationTask) => ({
        ...task,
        assigned_to_name: task.assigned_to_name || null,
      }));

      return jsonResponse({
        success: true,
        tasks: enriched,
        total_count: count,
        offset,
        limit,
      });
    } catch (err) {
      console.error('Remediation tasks retrieval error:', err);
      return jsonError(500, 'ERROR', 'failed to retrieve tasks');
    }
  }

  // POST: Create remediation task from gap
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const {
        gap_id,
        control_id,
        control_name,
        gap_description,
        severity,
        assigned_to,
        estimated_effort_hours,
        notes,
      } = body;

      if (!gap_id || !control_id) {
        return jsonError(400, 'BAD_REQUEST', 'gap_id and control_id required');
      }

      const priority = determinePriority(severity);
      const dueDate = calculateDueDate(priority);

      // Create remediation task
      const { data: newTask, error: insertError } = await userClient
        .from('remediation_tasks')
        .insert({
          tenant_id: tenantId,
          gap_id,
          control_id,
          control_name,
          gap_description,
          severity,
          status: 'not_started',
          priority,
          assigned_to: assigned_to || null,
          assigned_to_name: null,
          start_date: null,
          due_date: dueDate,
          completion_date: null,
          estimated_effort_hours: estimated_effort_hours || 0,
          actual_effort_hours: 0,
          progress_percent: 0,
          dependencies: [],
          blockers: [],
          notes: notes || '',
          created_by: userId,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Log audit action
      await audit(admin, {
        tenant_id: tenantId,
        user_id: userId,
        user_email: userEmail,
        action: 'remediation_task_created',
        resource_type: 'remediation_task',
        resource_id: newTask.id,
        changes: {
          control_id,
          priority,
          severity,
          due_date: dueDate,
          estimated_effort_hours,
        },
        severity: 'info',
      });

      return jsonResponse({
        success: true,
        message: `Remediation task for ${control_id} created successfully`,
        task: newTask,
      });
    } catch (err) {
      console.error('Remediation task creation error:', err);
      return jsonError(500, 'ERROR', 'failed to create task');
    }
  }

  return jsonError(405, 'BAD_REQUEST', 'POST or GET only');
});
