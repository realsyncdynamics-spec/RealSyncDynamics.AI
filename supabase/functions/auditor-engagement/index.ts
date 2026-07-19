// Auditor Engagement Management
// GET: Load audit status, assessors, assignments, and findings summary
// POST: Update audit status, log events

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

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

  try {
    if (req.method === 'GET') {
      return await handleGet(userClient, req.url);
    } else {
      return jsonError(405, 'BAD_REQUEST', 'GET only for now');
    }
  } catch (e) {
    console.error('Error:', e);
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});

async function handleGet(client: unknown, urlStr: string) {
  const url = new URL(urlStr);
  const tenantId = url.searchParams.get('tenant_id');

  if (!tenantId) {
    return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  }

  // Load auditors (simplified - in real system would be a separate table)
  const assessors = [
    {
      id: 'auditor-001',
      name: 'Dr. Maria Schmidt',
      email: 'maria.schmidt@isocert.de',
      organization: 'ISO Certification Partners',
      role: 'lead_auditor' as const,
      assigned_controls: 24,
      assessment_status: 'in_progress' as const,
      completion_percentage: 45,
    },
    {
      id: 'auditor-002',
      name: 'Thomas Müller',
      email: 'thomas.mueller@isocert.de',
      organization: 'ISO Certification Partners',
      role: 'auditor' as const,
      assigned_controls: 20,
      assessment_status: 'in_progress' as const,
      completion_percentage: 35,
    },
  ];

  // Simulate findings from audit_findings table (would be real in production)
  const findingsCounts = {
    critical: 1,
    major: 3,
    minor: 5,
  };

  // Simulate recent audit events
  const recentEvents = [
    {
      id: 'event-1',
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      type: 'assessment_completed' as const,
      description: 'Kontrollbewertung abgeschlossen: A.5.1',
      auditor_name: 'Dr. Maria Schmidt',
      control_code: 'A.5.1',
    },
    {
      id: 'event-2',
      date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      type: 'finding_logged' as const,
      description: 'Befund protokolliert: Dokumentation unvollständig',
      auditor_name: 'Thomas Müller',
      control_code: 'A.6.1',
    },
    {
      id: 'event-3',
      date: new Date().toISOString(),
      type: 'remediation_planned' as const,
      description: 'Abhilfemaßnahme geplant für Befund in A.4.2',
      auditor_name: 'Dr. Maria Schmidt',
      control_code: 'A.4.2',
    },
  ];

  return jsonResponse({
    status: 'in_progress',
    audit_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    planned_duration_days: 5,
    assessors: assessors,
    total_assignments: 44,
    completed_assessments: 16,
    findings_count: findingsCounts,
    recent_events: recentEvents,
  });
}
