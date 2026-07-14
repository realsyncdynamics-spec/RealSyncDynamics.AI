// Governance Evidence Handler
// Creates and manages evidence items with framework mapping
// POST /functions/v1/governance-evidence-handler
// Authorization: Bearer <user JWT>

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });

  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');

  let body: {
    tenant_id?: string;
    action?: 'create' | 'tag' | 'link';
    evidence_id?: string;
    title?: string;
    description?: string;
    frameworks?: string[];
    gap_ids?: string[];
    file_hash?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  if (!body.tenant_id || !body.action) {
    return jsonError(400, 'BAD_REQUEST', 'tenant_id and action required');
  }

  // Verify membership
  const { data: membership, error: memberErr } = await userClient
    .from('memberships')
    .select('role')
    .eq('tenant_id', body.tenant_id)
    .eq('user_id', userResp.user.id)
    .maybeSingle();

  if (memberErr) return jsonError(500, 'INTERNAL', memberErr.message);
  if (!membership) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');

  try {
    if (body.action === 'create') {
      if (!body.title) return jsonError(400, 'BAD_REQUEST', 'title required for create');

      const { data: evidence, error: createErr } = await userClient
        .from('evidence_items')
        .insert({
          tenant_id: body.tenant_id,
          title: body.title,
          description: body.description,
          framework_codes: body.frameworks || [],
          gap_ids: body.gap_ids || [],
          file_hash: body.file_hash,
          created_by: userResp.user.id,
          tags: ['governance_workflow'],
        })
        .select()
        .single();

      if (createErr) throw new Error(`Evidence creation: ${createErr.message}`);

      return jsonResponse(200, {
        ok: true,
        action: 'create',
        evidence_id: evidence.id,
        frameworks: evidence.framework_codes,
      });
    } else if (body.action === 'tag') {
      if (!body.evidence_id) return jsonError(400, 'BAD_REQUEST', 'evidence_id required for tag');

      const { data: existing } = await userClient
        .from('evidence_items')
        .select('framework_codes, gap_ids')
        .eq('id', body.evidence_id)
        .eq('tenant_id', body.tenant_id)
        .single();

      if (!existing) return jsonError(404, 'NOT_FOUND', 'evidence item not found');

      const updatedFrameworks = new Set([...(existing.framework_codes || []), ...(body.frameworks || [])]);
      const updatedGaps = new Set([...(existing.gap_ids || []), ...(body.gap_ids || [])]);

      const { error: updateErr } = await userClient
        .from('evidence_items')
        .update({
          framework_codes: Array.from(updatedFrameworks),
          gap_ids: Array.from(updatedGaps),
          updated_at: new Date().toISOString(),
        })
        .eq('id', body.evidence_id)
        .eq('tenant_id', body.tenant_id);

      if (updateErr) throw new Error(`Tag update: ${updateErr.message}`);

      return jsonResponse(200, {
        ok: true,
        action: 'tag',
        evidence_id: body.evidence_id,
        frameworks: Array.from(updatedFrameworks),
        gaps: Array.from(updatedGaps),
      });
    } else if (body.action === 'link') {
      if (!body.evidence_id) return jsonError(400, 'BAD_REQUEST', 'evidence_id required for link');

      const { error: linkErr } = await userClient
        .from('evidence_links')
        .insert({
          evidence_id: body.evidence_id,
          link_type: 'gap',
          link_entity_id: body.gap_ids?.[0] || '',
          reason: 'Linked via workflow',
          linked_by: userResp.user.id,
        });

      if (linkErr) throw new Error(`Link creation: ${linkErr.message}`);

      return jsonResponse(200, {
        ok: true,
        action: 'link',
        evidence_id: body.evidence_id,
      });
    }

    return jsonError(400, 'BAD_REQUEST', 'invalid action');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonError(500, 'INTERNAL', message);
  }
});
