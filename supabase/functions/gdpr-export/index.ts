// GDPR Art. 15 — Auskunftsrecht / Datenexport.
//
// GET /functions/v1/gdpr-export
// Authorization: Bearer <user JWT>
//
// Liefert ein JSON-Bundle mit allen personenbezogenen Daten dieses Users:
//   - profile
//   - memberships (Tenants, Rollen)
//   - workflows die er besitzt
//   - workflow_runs die er getriggert hat
//   - ai_tool_runs die er getriggert hat
//   - c2pa_assets die er besitzt
//   - subscriptions seiner Tenants (Co-Owner sehen evtl. mit, daher
//     nur die mit Membership des Users)
//
// Content-Disposition: attachment — Browser bietet Download an.
// Filename: gdpr-export-<user_id>-<YYYYMMDD>.json

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'GET') return jsonError(405, 'BAD_REQUEST', 'GET only');

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  const userId = userResp.user.id;
  const userEmail = userResp.user.email;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Sammle alle Tabellen, die personenbezogen sind. Failures pro Tabelle
  // setzen wir in das Bundle als "_error" — nicht den ganzen Export brechen.
  const fetchTable = async <T,>(
    label: string,
    query: () => Promise<{ data: T[] | null; error: { message: string } | null }>,
  ): Promise<{ rows?: T[]; error?: string }> => {
    const { data, error } = await query();
    if (error) return { error: error.message };
    return { rows: data ?? [] };
  };

  const [
    profile,
    memberships,
    workflows,
    workflowRuns,
    aiToolRuns,
    c2paAssets,
  ] = await Promise.all([
    fetchTable('profile', () => admin.from('profiles').select('*').eq('id', userId)),
    fetchTable('memberships', () => admin
      .from('memberships').select('*, tenant:tenants(*)').eq('user_id', userId)),
    fetchTable('workflows', () => admin.from('workflows').select('*').eq('owner_id', userId)),
    fetchTable('workflow_runs', () => admin
      .from('workflow_runs').select('*').eq('triggered_by', userId).order('started_at', { ascending: false }).limit(5000)),
    fetchTable('ai_tool_runs', () => admin
      .from('ai_tool_runs').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(5000)),
    fetchTable('c2pa_assets', () => admin.from('c2pa_assets').select('*').eq('owner_id', userId)),
  ]);

  const tenantIds: string[] = ((memberships.rows ?? []) as Array<{ tenant_id: string }>)
    .map((m) => m.tenant_id)
    .filter(Boolean);

  const subscriptions = tenantIds.length === 0
    ? { rows: [] as unknown[] }
    : await fetchTable('subscriptions', () => admin
        .from('subscriptions').select('*').in('tenant_id', tenantIds));

  const bundle = {
    _meta: {
      generated_at: new Date().toISOString(),
      user: { id: userId, email: userEmail },
      legal_basis: 'DSGVO Art. 15 Abs. 1 — Auskunftsrecht',
      retention_note:
        'workflow_runs und ai_tool_runs werden bis zur Account-Löschung aufbewahrt. ' +
        'subscriptions unterliegen handels- und steuerrechtlichen Aufbewahrungspflichten (10 Jahre, HGB/AO).',
    },
    profile: profile.rows?.[0] ?? profile.error ?? null,
    memberships: memberships.rows ?? memberships.error ?? null,
    workflows: workflows.rows ?? workflows.error ?? null,
    workflow_runs: workflowRuns.rows ?? workflowRuns.error ?? null,
    ai_tool_runs: aiToolRuns.rows ?? aiToolRuns.error ?? null,
    c2pa_assets: c2paAssets.rows ?? c2paAssets.error ?? null,
    subscriptions: subscriptions.rows ?? subscriptions.error ?? null,
  };

  const filename = `gdpr-export-${userId}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json`;
  return new Response(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      ...corsHeaders,
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
});

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ ok: false, error: { code, message } }), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
