// Governance Analytics Export — CSV and PDF export functionality
//
// POST /functions/v1/governance-analytics-export
// Authorization: Bearer <user JWT>
// Body: { format: 'csv'|'pdf', tenant_id: uuid, date_range: { start, end }, include_charts?: boolean }

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse } from '../_shared/gateway.ts';

interface ExportRequest {
  format: 'csv' | 'pdf';
  tenant_id: string;
  date_range: { start: string; end: string };
  include_charts?: boolean;
}

function generateCsv(snapshots: any[]): string {
  if (snapshots.length === 0) {
    return 'No data available\n';
  }

  const headers = [
    'Date',
    'Assets',
    'Events',
    'Incidents',
    'Critical',
    'High',
    'Medium',
    'Policies',
    'Evidence %',
    'Mappings %',
    'Policies Enabled %',
  ];

  const rows = snapshots.map((s) => [
    s.captured_date,
    s.asset_count,
    s.event_count,
    s.incident_count,
    s.critical_incident_count,
    s.high_incident_count,
    s.medium_incident_count,
    s.policy_count,
    s.assets_with_evidence_percent,
    s.assets_with_mappings_percent,
    s.policies_enabled_percent,
  ]);

  // Calculate totals
  const totals = [
    'TOTAL',
    snapshots.reduce((s, r) => s + r.asset_count, 0),
    snapshots.reduce((s, r) => s + r.event_count, 0),
    snapshots.reduce((s, r) => s + r.incident_count, 0),
    snapshots.reduce((s, r) => s + r.critical_incident_count, 0),
    snapshots.reduce((s, r) => s + r.high_incident_count, 0),
    snapshots.reduce((s, r) => s + r.medium_incident_count, 0),
    snapshots.reduce((s, r) => s + r.policy_count, 0),
    (snapshots.reduce((s, r) => s + r.assets_with_evidence_percent, 0) / snapshots.length).toFixed(1),
    (snapshots.reduce((s, r) => s + r.assets_with_mappings_percent, 0) / snapshots.length).toFixed(1),
    (snapshots.reduce((s, r) => s + r.policies_enabled_percent, 0) / snapshots.length).toFixed(1),
  ];

  const csv = [headers.join('\t'), ...rows.map((r) => r.join('\t')), totals.join('\t')].join('\n');
  return csv;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return jsonResponse({ error: 'Missing environment variables' }, 500);
  }

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Missing bearer token' }, 401);
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });

  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) {
    return jsonResponse({ error: 'Invalid token' }, 401);
  }

  let body: ExportRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (!body.format || !body.tenant_id || !body.date_range) {
    return jsonResponse({ error: 'Missing required fields' }, 400);
  }

  try {
    // Verify user has access to tenant (RLS-scoped membership check).
    const { data: member } = await userClient
      .from('memberships')
      .select('id')
      .eq('tenant_id', body.tenant_id)
      .eq('user_id', userResp.user.id)
      .maybeSingle();

    if (!member) {
      return jsonResponse({ error: 'Unauthorized' }, 403);
    }

    // Fetch KPI data for date range
    const { data: snapshots, error: dataErr } = await userClient.rpc('governance_kpi_range', {
      p_tenant_id: body.tenant_id,
      p_start_date: body.date_range.start,
      p_end_date: body.date_range.end,
    });

    if (dataErr) {
      throw dataErr;
    }

    let fileData: string | Uint8Array;
    let contentType: string;
    let filename: string;

    if (body.format === 'csv') {
      fileData = generateCsv(snapshots || []);
      contentType = 'text/csv';
      filename = `analytics-${body.date_range.start}-to-${body.date_range.end}.csv`;
    } else {
      // PDF format: Return minimal PDF for now
      // In production, use a library like pdfkit or deno-pdf
      const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // PDF header stub
      fileData = pdf;
      contentType = 'application/pdf';
      filename = `analytics-${body.date_range.start}-to-${body.date_range.end}.pdf`;
    }

    // Return file content directly (in production, upload to Supabase Storage)
    return new Response(fileData, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('Export error:', err);
    return jsonResponse({
      error: err instanceof Error ? err.message : 'Export failed',
    }, 500);
  }
});
