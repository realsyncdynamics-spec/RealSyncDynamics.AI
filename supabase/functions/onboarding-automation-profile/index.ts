import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });

type SkillState = 'ready' | 'needs_binding' | 'locked' | 'planned';

type EntitlementRow = {
  key: string;
  value: boolean | number | string | null;
};

type SkillRow = {
  id: string;
  status: 'available' | 'beta' | 'planned';
  n8n_workflow_id: string | null;
};

interface RequestBody {
  tenant_id?: string;
  org_type?: string | null;
  ai_systems?: string[];
  residency_policy?: string | null;
}

function granted(rows: EntitlementRow[], key: string): boolean {
  const value = rows.find((row) => row.key === key)?.value;
  return value === true || value === -1 || (typeof value === 'number' && value > 0);
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function recommendations(input: {
  orgType: string | null;
  aiSystems: string[];
  residencyPolicy: string | null;
  entitlements: EntitlementRow[];
}): string[] {
  const out: string[] = [];

  if (granted(input.entitlements, 'website.scan')) out.push('dsgvo-audit');
  if (granted(input.entitlements, 'reports.export') || granted(input.entitlements, 'compliance.export')) {
    out.push('dokumenten-skill');
  }
  if (input.aiSystems.length > 0 && granted(input.entitlements, 'ai.tool.automations')) {
    out.push('meeting-compliance');
  }
  if (input.orgType === 'agency' && granted(input.entitlements, 'ai.tool.automations')) {
    out.push('lead-risk', 'screenshot-feedback');
  }
  if (granted(input.entitlements, 'bots.enabled') && input.aiSystems.length > 0) {
    out.push('support-skill');
  }

  return dedupe(out);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED' } }, 405);

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Bearer token required' } }, 401);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON' } }, 400);
  }

  if (!body.tenant_id) {
    return json({ ok: false, error: { code: 'BAD_REQUEST', message: 'tenant_id required' } }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ ok: false, error: { code: 'INTERNAL', message: 'Supabase configuration missing' } }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid session' } }, 401);
  }

  const { data: membership, error: membershipError } = await userClient
    .from('memberships')
    .select('id, role')
    .eq('tenant_id', body.tenant_id)
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (membershipError) {
    return json({ ok: false, error: { code: 'INTERNAL', message: membershipError.message } }, 500);
  }
  if (!membership) {
    return json({ ok: false, error: { code: 'FORBIDDEN', message: 'Not a tenant member' } }, 403);
  }

  const [{ data: entitlementData, error: entitlementError }, { data: skillData, error: skillError }] =
    await Promise.all([
      admin.rpc('tenant_entitlements', { p_tenant_id: body.tenant_id }),
      admin.from('automation_skills').select('id, status, n8n_workflow_id'),
    ]);

  if (entitlementError) {
    return json({ ok: false, error: { code: 'ENTITLEMENTS_UNAVAILABLE', message: entitlementError.message } }, 503);
  }
  if (skillError) {
    return json({ ok: false, error: { code: 'SKILLS_UNAVAILABLE', message: skillError.message } }, 503);
  }

  const entitlements = (entitlementData ?? []) as EntitlementRow[];
  const automationEntitled = granted(entitlements, 'ai.tool.automations');
  const aiSystems = dedupe((body.ai_systems ?? []).map((value) => String(value).trim()));
  const recommendedIds = recommendations({
    orgType: body.org_type ?? null,
    aiSystems,
    residencyPolicy: body.residency_policy ?? null,
    entitlements,
  });

  const skillById = new Map(((skillData ?? []) as SkillRow[]).map((skill) => [skill.id, skill]));
  const selected = recommendedIds.map((id) => {
    const skill = skillById.get(id);
    let state: SkillState = 'locked';
    let reason = 'not_entitled';

    if (!skill) {
      state = 'locked';
      reason = 'catalog_missing';
    } else if (skill.status === 'planned') {
      state = 'planned';
      reason = 'catalog_planned';
    } else if (!automationEntitled) {
      state = 'locked';
      reason = 'automation_not_entitled';
    } else if (!skill.n8n_workflow_id) {
      state = 'needs_binding';
      reason = 'runtime_not_bound';
    } else {
      state = 'ready';
      reason = 'entitled_and_bound';
    }

    return {
      skill_id: id,
      state,
      reason,
      executor: skill?.n8n_workflow_id ? 'n8n' : null,
    };
  });

  const now = new Date().toISOString();
  const automationProfile = {
    version: 1,
    generated_at: now,
    generated_by: 'onboarding-automation-profile',
    inputs: {
      org_type: body.org_type ?? null,
      ai_systems: aiSystems,
      residency_policy: body.residency_policy ?? null,
    },
    automation_entitled: automationEntitled,
    skills: selected,
  };

  const { data: existing, error: profileReadError } = await admin
    .from('company_profiles')
    .select('id, onboarding_answers')
    .eq('tenant_id', body.tenant_id)
    .maybeSingle();

  if (profileReadError) {
    return json({ ok: false, error: { code: 'PROFILE_READ_FAILED', message: profileReadError.message } }, 500);
  }

  if (existing) {
    const answers =
      existing.onboarding_answers && typeof existing.onboarding_answers === 'object'
        ? existing.onboarding_answers as Record<string, unknown>
        : {};

    const { error: updateError } = await admin
      .from('company_profiles')
      .update({
        onboarding_answers: { ...answers, automation_profile: automationProfile },
        updated_at: now,
      })
      .eq('id', existing.id);

    if (updateError) {
      return json({ ok: false, error: { code: 'PROFILE_WRITE_FAILED', message: updateError.message } }, 500);
    }
  } else {
    // SetupAssistant kennt Organisationsform, aber keine Branche. "generic" ist
    // der kanonische neutrale Sektor und aktiviert keine branchenspezifischen
    // Policy-Packs. So wird das Automation-Profil persistiert, ohne aus KMU/
    // Enterprise eine Branche zu erfinden.
    const { error: insertError } = await admin.from('company_profiles').insert({
      tenant_id: body.tenant_id,
      sector: 'generic',
      onboarding_answers: { automation_profile: automationProfile },
      updated_at: now,
    });
    if (insertError) {
      return json({ ok: false, error: { code: 'PROFILE_WRITE_FAILED', message: insertError.message } }, 500);
    }
  }

  await admin.from('inventory_audit_events').insert({
    tenant_id: body.tenant_id,
    actor_user_id: userData.user.id,
    action: 'ONBOARDING_AUTOMATION_PROFILE',
    target_type: 'tenant',
    target_id: body.tenant_id,
    new_value: automationProfile,
    reason: 'AI-assisted onboarding automation profile generated from entitlements and explicit setup choices',
    source: 'onboarding-automation-profile',
    occurred_at: now,
  });

  return json({
    ok: true,
    persisted: true,
    automation_profile: automationProfile,
  });
});
