import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'pass';

function qualify(input: {
  companySize?: number | null;
  auditScore?: number | null;
  severity?: Severity | null;
  findings?: Array<{ severity?: string | null }>;
  requestedAutomations?: string[];
}) {
  let score = 0;
  const rationale: string[] = [];
  const modules = new Set(['DSGVO Audit']);
  const auditScore = typeof input.auditScore === 'number' ? input.auditScore : null;

  if (auditScore !== null) {
    if (auditScore < 40) { score += 35; rationale.push('Sehr niedriger Compliance-Score'); }
    else if (auditScore < 60) { score += 25; rationale.push('Deutlicher Compliance-Handlungsbedarf'); }
    else if (auditScore < 80) { score += 15; rationale.push('Mittlerer Compliance-Handlungsbedarf'); }
  }

  const critical = (input.findings ?? []).filter((f) => ['critical', 'high'].includes((f.severity ?? '').toLowerCase())).length;
  if (critical >= 5) score += 30;
  else if (critical >= 2) score += 20;
  else if (critical === 1) score += 10;
  if (critical > 0) rationale.push(`${critical} kritische/hohe Findings`);

  if (input.severity === 'critical') { score += 15; rationale.push('Audit-Severity: kritisch'); }
  else if (input.severity === 'high') { score += 10; rationale.push('Audit-Severity: hoch'); }

  if ((input.companySize ?? 0) >= 250) score += 20;
  else if ((input.companySize ?? 0) >= 50) score += 12;
  else if ((input.companySize ?? 0) >= 10) score += 5;

  const aliases: Record<string, string> = {
    telefon: 'Telefon-Automation', phone: 'Telefon-Automation',
    whatsapp: 'WhatsApp-Automation', chatbot: 'KI-Chatbot', chat: 'KI-Chatbot',
    website: 'SiteOS', monitoring: 'Continuous Monitoring',
  };
  for (const raw of input.requestedAutomations ?? []) {
    const module = aliases[raw.trim().toLowerCase()];
    if (module) { modules.add(module); score += 5; }
  }

  score = Math.min(100, score);
  const plan = score >= 75 ? 'agency' : score >= 45 ? 'growth' : 'starter';
  if (score >= 75) modules.add('Automations Engine');
  if (score >= 45) modules.add('Continuous Monitoring');
  const priority = score >= 80 ? 'hot' : score >= 60 ? 'high' : score >= 35 ? 'medium' : 'low';
  return { leadScore: score, priority, plan, modules: [...modules], rationale };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const body = await req.json().catch(() => null);
  if (!body?.lead_id) return new Response(JSON.stringify({ error: 'lead_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: lead, error: leadError } = await db.from('sales_leads').select('id,email,company,status,metadata').eq('id', body.lead_id).single();
  if (leadError || !lead) return new Response(JSON.stringify({ error: 'lead not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const { data: audit } = await db.from('gdpr_audits').select('id,score,severity,issues,domain').eq('sales_lead_id', lead.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
  const metadata = lead.metadata && typeof lead.metadata === 'object' ? lead.metadata as Record<string, unknown> : {};
  const requestedAutomations = Array.isArray(metadata.requested_automations) ? metadata.requested_automations.filter((v): v is string => typeof v === 'string') : [];

  const result = qualify({
    auditScore: audit?.score,
    severity: audit?.severity,
    findings: Array.isArray(audit?.issues) ? audit.issues : [],
    companySize: typeof metadata.company_size === 'number' ? metadata.company_size : null,
    requestedAutomations,
  });

  const nextMetadata = {
    ...metadata,
    qualification: {
      lead_score: result.leadScore,
      priority: result.priority,
      recommended_plan: result.plan,
      recommended_modules: result.modules,
      rationale: result.rationale,
      qualified_at: new Date().toISOString(),
    },
  };

  const nextStatus = result.leadScore >= 35 ? 'qualified' : lead.status === 'new' ? 'contacted' : lead.status;
  const { error: updateError } = await db.from('sales_leads').update({ status: nextStatus, metadata: nextMetadata }).eq('id', lead.id);
  if (updateError) return new Response(JSON.stringify({ error: updateError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  return new Response(JSON.stringify({ ok: true, lead_id: lead.id, ...result, domain: audit?.domain ?? null }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
