// Skills API — Routing only. KEIN externer LLM-Call, KEINE Persistenz,
// KEINE Auto-Aktion.
//
// GET  /functions/v1/skills          → Liste aller registrierten Skills
// POST /functions/v1/skills  body:{input}
//   → { selectedSkill, confidence, reason, requiresWebResearch, riskLevel,
//       candidates, guardrails }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

type RiskLevel = 'low' | 'medium' | 'high';

interface SkillDef {
  key: string;
  label: string;
  description: string;
  triggers: string[];
  useCases: string[];
  guardrails: string[];
  riskLevel: RiskLevel;
  requiresWebResearch: boolean;
  requiresUserData: boolean;
  reviewRequired: boolean;
}

// Mirror der src/lib/skills/registry.ts. Bewusst dupliziert: Edge-Functions
// koennen nicht aus src/ importieren (separate Build-Roots).
const NO_LEGAL = 'Diese Auswertung ist eine technische Heuristik und stellt keine Rechtsberatung dar.';
const NO_AUDIT = 'Output ersetzt keine Pruefungs- oder Auditmeinung. Vor Verwendung freigeben.';
const NO_AUTO_SEND = 'Keine automatische Versendung. Drafts brauchen Mensch-Review.';
const NO_FAKE = 'Keine erfundenen Firmen-/Personenangaben. Unbekanntes als Hypothese kennzeichnen.';
const BENCH = 'Benchmarks dienen nur zur Orientierung.';
const NO_RAW = 'Keine sensiblen Rohdaten im Output wiederholen.';

const SKILLS: SkillDef[] = [
  {
    key: 'data-exploration', label: 'Data Exploration',
    description: 'Tabellen-Profilierung und Spalten-Klassifikation.',
    triggers: ['explore', 'profile', 'dataset', 'spalten', 'csv', 'tabelle', 'data profiling', 'datenuebersicht', 'data exploration'],
    useCases: ['CSV-Upload erst-explorieren', 'Spalten klassifizieren', 'Profilierungs-Plan vorschlagen'],
    guardrails: [NO_RAW],
    riskLevel: 'medium', requiresWebResearch: false, requiresUserData: true, reviewRequired: false,
  },
  {
    key: 'finance-audit-support', label: 'Finance / Audit Support',
    description: 'Strukturhilfe fuer Pruefungen. KEINE Audit-Opinion.',
    triggers: ['audit', 'pruefung', 'control', 'kontrolle', 'sox', 'isae', 'deficiency', 'finding', 'sample size', 'stichprobe'],
    useCases: ['Schwere eines Befunds einordnen', 'Stichprobengroesse vorschlagen'],
    guardrails: [NO_AUDIT, NO_RAW],
    riskLevel: 'high', requiresWebResearch: false, requiresUserData: true, reviewRequired: true,
  },
  {
    key: 'legal-compliance', label: 'Legal Compliance Support',
    description: 'Checklisten zur DSGVO/AI-Act-Selbstpruefung. KEINE Rechtsberatung.',
    triggers: ['dsgvo', 'gdpr', 'datenschutz', 'dsar', 'avv', 'dpa', 'subprocessor', 'ai act', 'ki-vo', 'compliance'],
    useCases: ['DSAR-Checkliste', 'DPA-Pruefkriterien'],
    guardrails: [NO_LEGAL, NO_RAW],
    riskLevel: 'high', requiresWebResearch: true, requiresUserData: false, reviewRequired: true,
  },
  {
    key: 'legal-contract-review', label: 'Legal Contract Review',
    description: 'Klausel-Abweichungsklassifikation und Redline-Outline.',
    triggers: ['contract', 'vertrag', 'mnda', 'nda', 'dpa', 'msa', 'redline', 'klausel', 'haftung', 'liability'],
    useCases: ['Klausel-Abweichung einordnen', 'Redline-Review-Plan'],
    guardrails: [NO_LEGAL],
    riskLevel: 'high', requiresWebResearch: false, requiresUserData: true, reviewRequired: true,
  },
  {
    key: 'marketing-performance-analytics', label: 'Marketing Performance Analytics',
    description: 'Funnel- und Kanal-Metriken plus Priorisierung.',
    triggers: ['marketing', 'ctr', 'cvr', 'roas', 'funnel', 'conversion', 'attribution', 'campaign', 'kampagne'],
    useCases: ['CR/CTR/ROAS berechnen', 'Optimierungen priorisieren'],
    guardrails: [BENCH],
    riskLevel: 'low', requiresWebResearch: false, requiresUserData: true, reviewRequired: false,
  },
  {
    key: 'sales-call-prep', label: 'Sales Call Prep',
    description: 'Brief und Talking-Points fuer Sales-Calls.',
    triggers: ['call prep', 'meeting prep', 'sales call', 'gespraechsleitfaden', 'demo prep', 'discovery call', 'kickoff'],
    useCases: ['Discovery-Call-Outline', 'Stakeholder-Map als Hypothese'],
    guardrails: [NO_FAKE],
    riskLevel: 'medium', requiresWebResearch: true, requiresUserData: true, reviewRequired: false,
  },
  {
    key: 'sales-draft-outreach', label: 'Sales Outreach Drafting',
    description: 'Outreach-Entwurf als DRAFT. KEINE automatische Versendung.',
    triggers: ['outreach', 'cold email', 'kaltakquise', 'sequence', 'follow-up', 'linkedin message', 'anschreiben'],
    useCases: ['Research-Plan fuer Target-Account', 'Erstkontakt-Draft als Vorschlag'],
    guardrails: [NO_FAKE, NO_AUTO_SEND],
    riskLevel: 'medium', requiresWebResearch: true, requiresUserData: true, reviewRequired: true,
  },
];

interface RouteCandidate { key: string; score: number; matchedTriggers: string[] }

function scoreSkill(input: string, skill: SkillDef): RouteCandidate {
  const matched: string[] = [];
  for (const trigger of skill.triggers) if (input.includes(trigger)) matched.push(trigger);
  const score = matched.length === 0
    ? 0
    : matched.length + matched.reduce((acc, t) => acc + t.length, 0) / 100;
  return { key: skill.key, score, matchedTriggers: matched };
}

function route(rawInput: string) {
  const input = (rawInput ?? '').toLowerCase();
  if (!input.trim()) {
    return {
      selectedSkill: null, confidence: 0, reason: 'leerer Input',
      candidates: [], requiresWebResearch: false, riskLevel: null, guardrails: [],
    };
  }
  const scored = SKILLS.map((s) => scoreSkill(input, s)).filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) {
    return {
      selectedSkill: null, confidence: 0, reason: 'kein Trigger getroffen',
      candidates: [], requiresWebResearch: false, riskLevel: null, guardrails: [],
    };
  }
  const top = scored[0]!;
  const second = scored[1]?.score ?? 0;
  const confidence = Math.min(1, top.score / 4 + (top.score - second) / 4);
  const sel = SKILLS.find((s) => s.key === top.key)!;
  return {
    selectedSkill: top.key,
    confidence: Math.round(confidence * 100) / 100,
    reason: `Trigger getroffen: ${top.matchedTriggers.join(', ')}`,
    candidates: scored.slice(0, 5),
    requiresWebResearch: sel.requiresWebResearch,
    riskLevel: sel.riskLevel,
    guardrails: sel.guardrails,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (req.method === 'GET') return json({ ok: true, skills: SKILLS });

  if (req.method === 'POST') {
    let body: { input?: unknown };
    try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }
    const input = typeof body?.input === 'string' ? body.input : '';
    if (!input) return jsonError(400, 'BAD_REQUEST', 'input required');
    return json({ ok: true, ...route(input) });
  }

  return jsonError(405, 'BAD_REQUEST', 'GET or POST only');
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } });
}
function jsonError(status: number, code: string, message: string): Response {
  return json({ ok: false, error: { code, message } }, status);
}
