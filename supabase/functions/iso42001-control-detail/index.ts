// ISO 42001 Control Detail & Implementation Updates
// GET: Load control details with audit history and evidence
// POST: Update control status, maturity level, and dates

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { audit } from '../_shared/auditLog.ts';

interface SupabaseClient {
  from(table: string): {
    select(columns: string): {
      eq(col: string, val: unknown): {
        eq(col2: string, val2: unknown): {
          single(): Promise<{ data: unknown; error: unknown }>;
        };
        single(): Promise<{ data: unknown; error: unknown }>;
      };
      in(col: string, vals: unknown[]): Promise<{ data: unknown; error: unknown }>;
    };
  };
}

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

  try {
    if (req.method === 'GET') {
      return await handleGet(userClient, userId, req.url);
    } else if (req.method === 'POST') {
      return await handlePost(admin, userClient, userId, userEmail, req);
    } else {
      return jsonError(405, 'BAD_REQUEST', 'GET or POST only');
    }
  } catch (e) {
    console.error('Error:', e);
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});

async function handleGet(client: SupabaseClient, userId: string, urlStr: string) {
  const url = new URL(urlStr);
  const tenantId = url.searchParams.get('tenant_id');
  const controlId = url.searchParams.get('control_id');

  if (!tenantId || !controlId) {
    return jsonError(400, 'BAD_REQUEST', 'tenant_id and control_id required');
  }

  // Load control implementation
  const { data: control, error: controlErr } = await client
    .from('iso42001_implementations')
    .select('*')
    .eq('id', controlId)
    .eq('tenant_id', tenantId)
    .single();

  if (controlErr || !control) {
    return jsonError(404, 'NOT_FOUND', 'control not found');
  }

  // Load audit history
  const { data: auditHistory } = await client
    .from('iso_audit_history')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('control_id', controlId)
    .eq('audit_type', 'iso42001')
    .order('audit_date', { ascending: false })
    .limit(50);

  // Load evidence items (stored as IDs in control.evidence_item_ids)
  let evidence: Record<string, unknown>[] = [];
  if (control.evidence_item_ids && Array.isArray(control.evidence_item_ids) && control.evidence_item_ids.length > 0) {
    const { data: evidenceData } = await client
      .from('evidence_items')
      .select('*')
      .in('id', control.evidence_item_ids);
    evidence = evidenceData || [];
  }

  return jsonResponse({
    control,
    audit_history: auditHistory || [],
    evidence: evidence || [],
  });
}

async function handlePost(admin: SupabaseClient, userClient: SupabaseClient, userId: string, userEmail: string | null, req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  const tenantId = body.tenant_id as string;
  const controlId = body.control_id as string;
  const status = body.status as string | undefined;
  const maturityLevel = body.maturity_level as number | undefined;
  const implementationNotes = body.implementation_notes as string | undefined;
  const implementationDate = body.implementation_date as string | undefined;
  const nextReviewDate = body.next_review_date as string | undefined;

  if (!tenantId || !controlId) {
    return jsonError(400, 'BAD_REQUEST', 'tenant_id and control_id required');
  }

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

  // Load existing control for audit trail
  const { data: existingControl } = await admin
    .from('iso42001_implementations')
    .select('*')
    .eq('id', controlId)
    .eq('tenant_id', tenantId)
    .single();

  if (!existingControl) {
    return jsonError(404, 'NOT_FOUND', 'control not found');
  }

  // Update control
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (status !== undefined) updates.status = status;
  if (maturityLevel !== undefined) updates.maturity_level = maturityLevel;
  if (implementationNotes !== undefined) updates.implementation_notes = implementationNotes;
  if (implementationDate !== undefined) updates.implementation_date = implementationDate;
  if (nextReviewDate !== undefined) updates.next_review_date = nextReviewDate;
  if (status !== undefined) updates.last_review_date = new Date().toISOString();

  const { data: updated, error: updateErr } = await admin
    .from('iso42001_implementations')
    .update(updates)
    .eq('id', controlId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (updateErr || !updated) {
    return jsonError(500, 'INTERNAL', 'failed to update control');
  }

  // Log audit trail
  if (status !== undefined || maturityLevel !== undefined) {
    await admin
      .from('iso_audit_history')
      .insert({
        tenant_id: tenantId,
        audit_type: 'iso42001',
        control_id: controlId,
        audit_date: new Date().toISOString(),
        status_before: existingControl.status,
        status_after: status || existingControl.status,
        maturity_level_before: existingControl.maturity_level,
        maturity_level_after: maturityLevel !== undefined ? maturityLevel : existingControl.maturity_level,
        auditor_id: userId,
        findings: null,
        recommendations: null,
      });
  }

  // Audit log
  await audit(admin, {
    tenant_id: tenantId,
    user_id: userId,
    user_email: userEmail,
    action: 'iso42001_control_updated',
    resource_type: 'iso42001_implementation',
    resource_id: controlId,
    changes: updates,
    severity: 'info',
  });

  return jsonResponse({ control: updated });
}
