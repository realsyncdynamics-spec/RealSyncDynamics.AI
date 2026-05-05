// MarketGapScanner — autonomes Daily-Research-System.
//
// POST /functions/v1/market-scanner   (verify_jwt = false; auth via Bearer secret)
// Body: { industry?, sector?, depth?: 'surface'|'deep', rotate?: boolean }
//
// Trigger:
//   - täglich via pg_cron (rotate:true → 12-Industries-Zyklus, ein Tag pro Industrie)
//   - manuell via super-admin UI mit explizitem industry/sector
//
// Auth:
//   Header `Authorization: Bearer <MARKET_SCANNER_SECRET>` (env-Secret).
//   pg_cron schickt diesen Header mit; ohne Secret → 401.
//
// Flow:
//   1. INSERT research_runs (status='running')
//   2. Pick industry: explicit > rotation > error
//   3. Build structured prompt → Claude (Anthropic, callProvider)
//   4. Parse strikt JSON-Output → INSERT market_gaps
//   5. Wenn revenue_potential ∈ {high, very_high}: INSERT ceo_briefs
//   6. UPDATE research_runs (status='success', counters, duration)

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { callProvider, ProviderError } from '../_shared/providers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// 12-Industries-Rotation. Index = (day_of_year - 1) mod 12.
const INDUSTRIES: Array<{ industry: string; default_sector: string }> = [
  { industry: 'HealthTech',    default_sector: 'Pflege & Klinik' },
  { industry: 'Legal',         default_sector: 'Anwaltskanzleien' },
  { industry: 'FinTech',       default_sector: 'BaFin-regulierte Banken' },
  { industry: 'Behörden',      default_sector: 'öffentlicher Sektor / Kommunal' },
  { industry: 'HR',            default_sector: 'Mittelstand 50-500 MA' },
  { industry: 'Logistik',      default_sector: 'Speditionen & 3PL' },
  { industry: 'Handwerk',      default_sector: 'Handwerksbetriebe & Innungen' },
  { industry: 'Gastronomie',   default_sector: 'Hotellerie & Restaurants' },
  { industry: 'Bildung',       default_sector: 'Schulen & Hochschulen' },
  { industry: 'Immobilien',    default_sector: 'Verwalter & Makler' },
  { industry: 'Marketing',     default_sector: 'Agenturen & In-house-Teams' },
  { industry: 'Fertigung',     default_sector: 'Mittelstand-Industrie' },
];

interface GapPayload {
  industry: string;
  sector: string;
  job_category: string;
  audience: 'employer' | 'employee' | 'both';
  gap_description: string;
  saas_solution: string;
  stripe_model: 'subscription' | 'metered' | 'one-time' | 'marketplace';
  tam_estimate?: string | null;
  urgency_score: number;
  revenue_potential: 'low' | 'medium' | 'high' | 'very_high';
  build_complexity: 'low' | 'medium' | 'high';
  ceo_profile?: string | null;
  sources?: Array<{ title?: string; url?: string; note?: string }>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')   return jsonError(405, 'BAD_REQUEST', 'POST only');

  const SECRET = Deno.env.get('MARKET_SCANNER_SECRET');
  if (!SECRET) return jsonError(500, 'NOT_CONFIGURED', 'MARKET_SCANNER_SECRET missing');

  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${SECRET}`) return jsonError(401, 'UNAUTHORIZED', 'invalid bearer');

  let body: { industry?: string; sector?: string; depth?: string; rotate?: boolean } = {};
  try { body = await req.json(); } catch { /* empty body OK */ }

  const depth: 'surface' | 'deep' = body.depth === 'surface' ? 'surface' : 'deep';

  let industry: string | null = body.industry?.trim() || null;
  let sector:   string | null = body.sector?.trim()   || null;

  if (!industry && body.rotate) {
    const today = new Date();
    const start = new Date(today.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
    const slot = INDUSTRIES[(dayOfYear - 1 + INDUSTRIES.length) % INDUSTRIES.length];
    industry = slot.industry;
    if (!sector) sector = slot.default_sector;
  }

  if (!industry) return jsonError(400, 'BAD_REQUEST', 'industry or rotate:true required');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const startedAt = Date.now();
  const { data: runRow, error: runErr } = await admin
    .from('research_runs')
    .insert({ industry, depth, status: 'running' })
    .select('id').single();
  if (runErr) return jsonError(500, 'INTERNAL', `research_runs insert: ${runErr.message}`);
  const runId = runRow!.id as string;

  try {
    const systemPrompt = buildSystemPrompt(depth);
    const userPrompt   = buildUserPrompt(industry, sector);

    const result = await callProvider({
      provider: 'anthropic',
      modelId: 'claude-opus-4-7',
      systemPrompt,
      userPrompt,
      maxTokens: depth === 'deep' ? 4096 : 2048,
      temperature: 0.4,
    });

    const gap = parseGap(result.text, industry, sector);

    const { data: gapRow, error: gapErr } = await admin.from('market_gaps').insert({
      industry: gap.industry,
      sector: gap.sector,
      job_category: gap.job_category,
      audience: gap.audience,
      gap_description: gap.gap_description,
      saas_solution: gap.saas_solution,
      stripe_model: gap.stripe_model,
      tam_estimate: gap.tam_estimate ?? null,
      urgency_score: gap.urgency_score,
      revenue_potential: gap.revenue_potential,
      build_complexity: gap.build_complexity,
      ceo_profile: gap.ceo_profile ?? null,
      sources: gap.sources ?? [],
      raw_research: result.text.slice(0, 50_000),
    }).select('id').single();
    if (gapErr) throw new Error(`market_gaps insert: ${gapErr.message}`);
    const gapId = gapRow!.id as string;

    let briefsCreated = 0;
    if (gap.revenue_potential === 'high' || gap.revenue_potential === 'very_high') {
      const brief = buildCeoBrief(gap);
      const { error: briefErr } = await admin.from('ceo_briefs').insert({
        market_gap_id: gapId,
        title: brief.title,
        body_md: brief.body_md,
        target_profile: gap.ceo_profile ?? null,
      });
      if (briefErr) throw new Error(`ceo_briefs insert: ${briefErr.message}`);
      briefsCreated = 1;
    }

    await admin.from('research_runs').update({
      status: 'success',
      gaps_found: 1,
      briefs_created: briefsCreated,
      duration_ms: Date.now() - startedAt,
      finished_at: new Date().toISOString(),
    }).eq('id', runId);

    return json({ ok: true, run_id: runId, gap_id: gapId, briefs_created: briefsCreated });
  } catch (e) {
    const err = e as Error;
    const code = e instanceof ProviderError ? e.code : 'INTERNAL';
    await admin.from('research_runs').update({
      status: 'error',
      duration_ms: Date.now() - startedAt,
      error_code: code,
      error_message: err.message.slice(0, 1000),
      finished_at: new Date().toISOString(),
    }).eq('id', runId);
    return jsonError(500, code, err.message);
  }
});

function buildSystemPrompt(depth: 'surface' | 'deep'): string {
  return [
    'Du bist Senior-Markt-Analyst für SaaS-Geschäftsmodelle im DACH-Raum.',
    'Aufgabe: Identifiziere EINE konkrete, monetarisierbare Markt-Lücke in der angegebenen Branche.',
    '',
    'Kriterien für eine Lücke:',
    '- existiert messbarer Pain (Zeitverlust, Compliance-Risiko, Umsatzverlust)',
    '- noch nicht durch etablierte SaaS abgedeckt (oder nur lückenhaft)',
    '- Endkunde hätte ≥ 50€/Monat Zahlungsbereitschaft',
    '- in 4-12 Wochen mit Edge-Functions + Stripe baubar',
    '',
    'Antworte AUSSCHLIESSLICH mit einem einzigen JSON-Objekt — kein Vor-/Nachtext, kein Markdown-Code-Fence.',
    'Felder (alle Pflicht außer tam_estimate, ceo_profile, sources):',
    '{',
    '  "industry": "string",                              // exakt der vorgegebenen Branche',
    '  "sector": "string",                                // konkretisiert (z.B. "Pflegeheime 50-200 Betten")',
    '  "job_category": "string",                          // z.B. "Pflegekraft", "Anwalt", "Steuerberater"',
    '  "audience": "employer" | "employee" | "both",',
    '  "gap_description": "string",                       // 2-4 Sätze, präzise',
    '  "saas_solution": "string",                         // 2-4 Sätze, was die SaaS konkret tut',
    '  "stripe_model": "subscription" | "metered" | "one-time" | "marketplace",',
    '  "tam_estimate": "string|null",                     // z.B. "DACH ~12.000 Betriebe × 200€/M = 28M€/J"',
    '  "urgency_score": 1..10,                            // wie dringend ist der Pain',
    '  "revenue_potential": "low" | "medium" | "high" | "very_high",',
    '  "build_complexity": "low" | "medium" | "high",',
    '  "ceo_profile": "string|null",                      // welcher CEO-Typ entscheidet (für Outreach)',
    '  "sources": [{"title": "...", "url": "...", "note": "..."}]',
    '}',
    '',
    depth === 'deep'
      ? 'Recherche-Tiefe: deep. Nutze dein Branchenwissen + Awareness von 2024-2026 News (Regulatorik, KI-Adoption, Förderprogramme).'
      : 'Recherche-Tiefe: surface. Schnell-Scan auf Basis deines Trainings.',
  ].join('\n');
}

function buildUserPrompt(industry: string, sector: string | null): string {
  return [
    `Branche: ${industry}`,
    sector ? `Subsektor / Fokus: ${sector}` : 'Subsektor: frei wählbar (wähle den unterversorgsten)',
    '',
    'Identifiziere genau EINE Markt-Lücke nach dem im System-Prompt definierten Schema.',
    'Antworte mit reinem JSON.',
  ].join('\n');
}

// Strict JSON-Parse mit Fallback-Strip von Code-Fences.
function parseGap(text: string, fallbackIndustry: string, fallbackSector: string | null): GapPayload {
  let raw = text.trim();
  // Strip ```json ... ``` if model insists
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) raw = fence[1].trim();
  // Falls Vortext: ersten { bis letzten } extrahieren
  const first = raw.indexOf('{');
  const last  = raw.lastIndexOf('}');
  if (first >= 0 && last > first) raw = raw.slice(first, last + 1);

  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(raw); }
  catch (e) { throw new Error(`AI returned non-JSON: ${(e as Error).message}; head=${text.slice(0, 200)}`); }

  const required = ['industry','sector','job_category','audience','gap_description','saas_solution',
                    'stripe_model','urgency_score','revenue_potential','build_complexity'];
  for (const k of required) {
    if (parsed[k] === undefined || parsed[k] === null || parsed[k] === '') {
      throw new Error(`AI output missing field: ${k}`);
    }
  }

  const audience = String(parsed.audience);
  if (!['employer','employee','both'].includes(audience)) throw new Error(`bad audience: ${audience}`);
  const stripeModel = String(parsed.stripe_model);
  if (!['subscription','metered','one-time','marketplace'].includes(stripeModel)) throw new Error(`bad stripe_model: ${stripeModel}`);
  const revenue = String(parsed.revenue_potential);
  if (!['low','medium','high','very_high'].includes(revenue)) throw new Error(`bad revenue_potential: ${revenue}`);
  const complexity = String(parsed.build_complexity);
  if (!['low','medium','high'].includes(complexity)) throw new Error(`bad build_complexity: ${complexity}`);
  const urgency = Number(parsed.urgency_score);
  if (!Number.isFinite(urgency) || urgency < 1 || urgency > 10) throw new Error(`bad urgency_score: ${parsed.urgency_score}`);

  return {
    industry: String(parsed.industry) || fallbackIndustry,
    sector: String(parsed.sector) || fallbackSector || 'general',
    job_category: String(parsed.job_category),
    audience: audience as GapPayload['audience'],
    gap_description: String(parsed.gap_description),
    saas_solution: String(parsed.saas_solution),
    stripe_model: stripeModel as GapPayload['stripe_model'],
    tam_estimate: parsed.tam_estimate ? String(parsed.tam_estimate) : null,
    urgency_score: Math.round(urgency),
    revenue_potential: revenue as GapPayload['revenue_potential'],
    build_complexity: complexity as GapPayload['build_complexity'],
    ceo_profile: parsed.ceo_profile ? String(parsed.ceo_profile) : null,
    sources: Array.isArray(parsed.sources) ? parsed.sources as GapPayload['sources'] : [],
  };
}

function buildCeoBrief(gap: GapPayload): { title: string; body_md: string } {
  const title = `${gap.industry} · ${gap.job_category} — ${gap.saas_solution.split('.')[0].slice(0, 80)}`;
  const body_md = [
    `# ${title}`,
    '',
    `**Branche:** ${gap.industry} → ${gap.sector}`,
    `**Zielgruppe:** ${gap.audience}`,
    `**Urgency:** ${gap.urgency_score}/10 · **Revenue:** ${gap.revenue_potential} · **Build:** ${gap.build_complexity}`,
    gap.tam_estimate ? `**TAM:** ${gap.tam_estimate}` : '',
    '',
    '## Pain',
    gap.gap_description,
    '',
    '## Lösung',
    gap.saas_solution,
    '',
    `**Monetarisierung:** Stripe ${gap.stripe_model}`,
    '',
    gap.ceo_profile ? `## Ziel-CEO\n${gap.ceo_profile}\n` : '',
    gap.sources && gap.sources.length
      ? '## Quellen\n' + gap.sources.map((s) => `- ${s.title ?? s.url ?? s.note ?? ''} ${s.url ? `(${s.url})` : ''}`).join('\n')
      : '',
  ].filter(Boolean).join('\n');
  return { title, body_md };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
function jsonError(status: number, code: string, message: string): Response {
  return json({ ok: false, error: { code, message } }, status);
}
