// ai-act-classify — LLM-basierte Signal-Extraktion für den AI-Act-Klassifikator.
//
// POST /functions/v1/ai-act-classify   { description: string, registry_version?: string }
// verify_jwt = false (öffentlich, Free-Tier-Tool)
//
// Strategie:
//   - System-Prompt enthält die Annex-III-Use-Cases mit Triggers + Categories
//   - User-Prompt = die System-Beschreibung des Users
//   - Output: structured JSON { matches: SignalMatch[], hint: string }
//
// LLM-Hierarchie (graceful fallback):
//   1. OPENAI_API_KEY in Vault → OpenAI gpt-4o-mini mit Structured-Output
//   2. ANTHROPIC_API_KEY in Vault → Claude haiku
//   3. weder noch → 400 LLM_NOT_CONFIGURED, Frontend macht local fallback
//
// Bewusst kein "Best of beide" — der Edge-Function-Output speist nur die
// Vorauswahl der Kategorien, finale Klassifikation läuft deterministisch
// durch die Q&A im Frontend.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SignalMatch {
  useCaseId: string;
  category: string;
  matchedTriggers: string[];
  confidence: 'low' | 'medium' | 'high';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return jsonError(405, 'BAD_REQUEST', 'POST only');

  let body: { description?: string; registry_version?: string };
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const description = (body.description ?? '').trim();
  if (description.length < 10) {
    return jsonError(400, 'DESCRIPTION_TOO_SHORT', 'mindestens 10 Zeichen erforderlich');
  }
  if (description.length > 4000) {
    return jsonError(400, 'DESCRIPTION_TOO_LONG', 'max 4000 Zeichen');
  }

  // Registry laden — wir kopieren sie hier inline statt sie aus dem Frontend
  // zu importieren, damit die Edge-Function deploy-stabil ist.
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  // LLM-Key-Hierarchie: erst aus Supabase Vault probieren, sonst Env-Vars.
  const openaiKey = await getSecret(admin, 'OPENAI_API_KEY');
  const anthropicKey = openaiKey ? null : await getSecret(admin, 'ANTHROPIC_API_KEY');

  if (!openaiKey && !anthropicKey) {
    return jsonError(400, 'LLM_NOT_CONFIGURED',
      'Weder OPENAI_API_KEY noch ANTHROPIC_API_KEY im Supabase-Vault konfiguriert. Frontend nutzt lokalen Fallback.');
  }

  const registry = ANNEX_III_REGISTRY_INLINE;
  const systemPrompt = buildSystemPrompt(registry);

  let llmOutput: { matches: SignalMatch[]; hint: string | null };
  try {
    if (openaiKey) {
      llmOutput = await callOpenAI(openaiKey, systemPrompt, description);
    } else {
      llmOutput = await callAnthropic(anthropicKey!, systemPrompt, description);
    }
  } catch (e) {
    return jsonError(500, 'LLM_CALL_FAILED', `LLM-Call: ${(e as Error).message}`);
  }

  // Sanity-check: useCaseIds müssen in der Registry existieren
  const validIds = new Set(registry.use_cases.map((uc) => uc.id));
  const filtered = llmOutput.matches.filter((m) => validIds.has(m.useCaseId));

  return new Response(JSON.stringify({
    matches: filtered,
    hint: llmOutput.hint,
    registry_version: registry.version,
  }), { status: 200, headers: { ...corsHeaders, 'content-type': 'application/json' } });
});

async function getSecret(admin: ReturnType<typeof createClient>, name: string): Promise<string | null> {
  // Versuche Vault, dann Env
  try {
    const { data, error } = await admin.rpc('get_app_secret', { p_name: name });
    if (!error && typeof data === 'string' && data.length > 0) return data;
  } catch (_) { /* fallthrough */ }
  return Deno.env.get(name) ?? null;
}

function buildSystemPrompt(registry: typeof ANNEX_III_REGISTRY_INLINE): string {
  const ucList = registry.use_cases.map((uc) =>
    `  - id: "${uc.id}" (Kategorie: ${uc.category}) — ${uc.title}\n    Trigger: ${uc.triggers.join('; ')}`
  ).join('\n');

  return `Du bist ein EU-AI-Act-Klassifikations-Experte.

Aufgabe: Analysiere die Beschreibung eines KI-Systems und identifiziere, welche Annex-III-Use-Cases der Verordnung 2024/1689 davon betroffen sind.

Verfügbare Use-Cases:
${ucList}

Regeln:
1. Match nur Use-Cases, deren Trigger eindeutig in der Beschreibung erkennbar sind. Keine Über-Interpretation.
2. Confidence: "high" = mehrere Trigger explizit, "medium" = ein Trigger explizit oder mehrere implizit, "low" = thematisch passend aber nicht explizit.
3. Wenn die Beschreibung kein Annex-III-Risiko enthält, gib leere matches-Liste zurück.
4. Output ist JSON-only, keine Erklärungen.

Antwort-Format (JSON):
{
  "matches": [
    {
      "useCaseId": "<id aus der Liste>",
      "category": "<category aus der Liste>",
      "matchedTriggers": ["<welche Trigger haben getroffen>"],
      "confidence": "low" | "medium" | "high"
    }
  ],
  "hint": "<optional: kurzer Hinweis für den User wenn unklar>"
}`;
}

async function callOpenAI(apiKey: string, systemPrompt: string, userText: string): Promise<{ matches: SignalMatch[]; hint: string | null }> {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.1,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText },
      ],
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`OpenAI ${resp.status}: ${txt.slice(0, 200)}`);
  }

  const json = await resp.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI: empty response');

  const parsed = JSON.parse(content);
  return { matches: parsed.matches ?? [], hint: parsed.hint ?? null };
}

async function callAnthropic(apiKey: string, systemPrompt: string, userText: string): Promise<{ matches: SignalMatch[]; hint: string | null }> {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: systemPrompt + '\n\nWICHTIG: Antworte NUR mit dem JSON-Objekt, keine Markdown-Code-Fences.',
      messages: [{ role: 'user', content: userText }],
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`Anthropic ${resp.status}: ${txt.slice(0, 200)}`);
  }

  const json = await resp.json();
  const content = json.content?.[0]?.text;
  if (!content) throw new Error('Anthropic: empty response');

  // Strip potential markdown fences if Claude added them anyway
  const cleaned = content.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  const parsed = JSON.parse(cleaned);
  return { matches: parsed.matches ?? [], hint: parsed.hint ?? null };
}

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status, headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Annex-III-Registry inline — minimal version, nur was die LLM-Prompt
// braucht. Synced manuell mit src/rules/annex-iii.json bei Updates.
// (Edge-Functions können nicht aus src/ importieren, daher Duplikat.)
// ---------------------------------------------------------------------------
const ANNEX_III_REGISTRY_INLINE = {
  version: '2026.05.0',
  use_cases: [
    { id: 'biometric_remote_identification', category: 'biometrics', title: 'Fern-biometrische Identifikation', triggers: ['Gesichtserkennung in Video-Streams', 'Identitätsabgleich gegen biometrische Datenbank', 'Wiedererkennung von Personen über mehrere Kamera-Standorte', 'Stimm-Identifikation aus Audio-Aufnahmen'] },
    { id: 'biometric_categorisation', category: 'biometrics', title: 'Biometrische Kategorisierung', triggers: ['Demografie-Analyse aus Gesichts-/Körpermerkmalen', 'Alters-Schätzung für Werbe-Targeting', 'Geschlechts-Klassifikation aus Audio/Video', 'Ethnische Zuordnung'] },
    { id: 'emotion_recognition', category: 'biometrics', title: 'Emotion Recognition', triggers: ['Stimmungs-Analyse von Mitarbeitern', 'Aufmerksamkeits-Tracking von Schülern', 'Customer-Service-Stimmungsanalyse', 'Emotion-Tagging in Video-Calls'] },
    { id: 'critical_infrastructure_safety', category: 'critical_infrastructure', title: 'Sicherheitskomponente in kritischer Infrastruktur', triggers: ['Verkehrssteuerung mit ML-basierter Optimierung', 'Stromnetz-Lastprognose mit autonomer Steuerung', 'Wasser-Versorgungs-Anomaly-Detection', 'Eisenbahn-Signalsteuerung mit ML'] },
    { id: 'education_admission', category: 'education', title: 'Zugang & Auswahl in Bildung', triggers: ['Zulassungs-Algorithmus für Hochschule', 'Schulplatz-Vergabe via ML', 'Berufs-Eignungstests mit KI-Auswertung'] },
    { id: 'education_evaluation', category: 'education', title: 'Bewertung & Prüfungs-Aufsicht', triggers: ['Auto-Korrektur von Klausuren', 'Online-Proctoring (Webcam/Mikrofon-Überwachung)', 'Lernpfad-Empfehlung mit ML', 'Plagiats-Detektion'] },
    { id: 'employment_recruiting', category: 'employment', title: 'Recruiting & Bewerber-Auswahl', triggers: ['CV-Screening mit ML-Ranking', 'Video-Interview-Analyse', 'Sprach-Tests mit KI-Auswertung', 'Targeted Job-Ads via algorithmischer Selektion'] },
    { id: 'employment_workforce_management', category: 'employment', title: 'Workforce-Management & arbeitsrechtl. Entscheidungen', triggers: ['Performance-Scoring von Mitarbeitern', 'Kündigungs-Empfehlungen via ML', 'Schicht-Planung mit individuellem Performance-Score', 'Bonus-Berechnung via algorithmischer Bewertung'] },
    { id: 'essential_services_public_benefits', category: 'essential_services', title: 'Öffentliche Sozialleistungen-Vergabe', triggers: ['Hartz-IV/Bürgergeld-Bewilligungs-Algorithmus', 'Wohngeld-Prüfung via ML', 'Sozial-Hilfe-Ranking', 'Arbeitslosen-Profiling'] },
    { id: 'essential_services_credit_scoring', category: 'essential_services', title: 'Kreditwürdigkeit & Credit Scoring', triggers: ['Konsumentenkredit-Scoring', 'Hypothekendarlehen-ML-Prüfung', 'Buy-Now-Pay-Later Risiko-Score', 'Geschäftskonto-Onboarding mit ML-Bonität'] },
    { id: 'essential_services_insurance_risk', category: 'essential_services', title: 'Versicherungs-Risikobewertung & Pricing', triggers: ['Lebensversicherungs-Antrags-Prüfung mit ML', 'Krankenversicherungs-Underwriting via KI', 'Tarif-Personalisierung anhand Gesundheits-Daten'] },
    { id: 'law_enforcement_profiling', category: 'law_enforcement', title: 'Polizei-Profiling & Crime-Analytics', triggers: ['Predictive-Policing-Software', 'Beweis-Authentizitäts-Bewertung', 'Lügendetektor-ähnliche Tools', 'Verdächtigen-Risiko-Score'] },
    { id: 'migration_visa_asylum', category: 'migration', title: 'Visum, Asyl- & Aufenthalts-Prüfung', triggers: ['Asyl-Antrag-Pre-Screening mit ML', 'Visum-Risiko-Scoring', 'Grenzkontroll-Risiko-Vorhersage', 'Sprach-/Dialekt-Analyse zur Herkunftsbestimmung'] },
    { id: 'justice_judicial_assistance', category: 'justice_democracy', title: 'Justiz-Unterstützung & Wahl-Beeinflussung', triggers: ['Urteils-Empfehlungs-System für Richter', 'Beweis-Auswertungs-KI', 'Mikro-Targeted-Wahl-Werbung', 'Deepfake-Wahlkampf-Material'] },
  ],
};
