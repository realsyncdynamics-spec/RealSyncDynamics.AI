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
//
// ## Schranken des anonymen Pfads
//
// Öffentlich heißt hier: ohne jedes Token erreichbar, und jeder Aufruf löst
// einen bezahlten Provider-Call auf Betreiber-Keys aus. Deshalb gilt für
// diese Function dasselbe Verfahren wie für die anderen anonymen
// LLM-Flächen (governance-agent, siteos, ai-gateway `audit_anon`):
//
//   1. Reserve-Insert in `anon_chat_runs` VOR der Arbeit. Schlägt er fehl,
//      antwortet die Function 503 und arbeitet nicht (fail-closed).
//   2. Kontingent je IP-Hash über 24 Stunden, gezählt IN DER DATENBANK.
//   3. Abschluss-Update mit Modell, Tokens, Dauer und Ergebnis.
//
// Der Free-Tier bleibt offen — das Werkzeug ist weiter ohne Konto benutzbar.
// Abgewiesene Aufrufe kosten den Besucher nichts: das Frontend fällt bei
// jeder Nicht-200-Antwort auf `extractSignalsLocal()` zurück
// (deterministisch, ohne Provider), siehe src/lib/ai-act/signal-extraction.ts.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  decideRateLimit,
  clientIp,
  type WindowState,
} from '../_shared/aiGateway/rateLimit.ts';
import { sha256Hex } from '../_shared/hash.ts';
import { corsHeaders, handleOptions, jsonResponse } from '../_shared/gateway.ts';
import {
  reserveAnonAudit,
  completeAnonAudit,
  extractPayloadKeys,
  type AnonOp,
} from '../_shared/anonAudit.ts';

// Erste, billige Bremse gegen Wiederholung im selben Ausführungskontext.
//
// Was sie NICHT leistet — am 2026-09-27 gegen die deployte Function gemessen:
// Bei 11 aufeinanderfolgenden Anfragen aus derselben Quelle hat das
// dokumentierte Limit (4/Minute, FEATURE_LIMITS['ai_act_classify']) NICHT
// EINMAL gegriffen — 11× HTTP 200 und 11 verschiedene Ausführungskontexte in
// den Plattform-Logs. Der Zähler liegt im Arbeitsspeicher des Isolate, und
// die Plattform verteilt Anfragen darauf; er kann per Konstruktion nicht
// zuverlässig greifen. Die tragende Schranke ist deshalb das Kontingent
// unten, das in der Datenbank steht und Kaltstarts wie Isolate überlebt.
// Diese Maps bleiben, weil sie nichts kosten und Bursts im selben Kontext
// abfangen — sie sind nur nicht mehr die Begründung.
const MINUTE_WINDOWS = new Map<string, WindowState>();
const HOUR_WINDOWS   = new Map<string, WindowState>();

// Der IP-Hash bleibt gesalzen (unverändert). Die anderen anonymen Pfade
// schreiben nach `anon_chat_runs.ip_hash` heute rohes sha256(IP); diese
// Function salzt. Beides bewusst nicht angeglichen: Die Spalte wird laut
// Migration 20260606000000 ohnehin auf einen HMAC-Schlüssel umgestellt
// (P2-impl-2, siehe _shared/subject-ref.ts), und das ist eine eigene
// Operation über alle Pfade. Fürs Kontingent genügt Konsistenz innerhalb
// dieser Operation, und ein gesalzener Hash ist nicht der schlechtere.
const IP_HASH_SALT = Deno.env.get('AI_GATEWAY_IP_HASH_SALT') ?? 'ai-gateway-default-salt';

/** Wert für `anon_chat_runs.op`. Neu per Migration 20260927100000. */
const ANON_OP: AnonOp = 'ai_act_classify_anon';

// 20 Klassifikationen je IP-Hash und 24 Stunden.
//
// Bemessung: Eine echte Nutzung beschreibt ein KI-System, vielleicht eine
// Handvoll. 20 lässt auch eine geteilte Büro-IP durch und begrenzt den
// Schaden je Quelle auf rund 0,25 USD am Tag, selbst beim teureren der
// beiden Anbieter. Zum Vergleich: siteos lässt 10 anonyme Entwürfe je Tag zu
// (ANON_BUILD_QUOTA_PER_DAY) — dort kostet ein Aufruf deutlich mehr.
const QUOTA_PER_DAY   = 20;
const QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000;

interface SignalMatch {
  useCaseId: string;
  category: string;
  matchedTriggers: string[];
  confidence: 'low' | 'medium' | 'high';
}

/**
 * Was ein Provider-Call zurückgibt — samt dem, was ins Protokoll gehört.
 *
 * Modell und Tokens sind nicht Zierrat: Ohne sie steht in `anon_chat_runs`
 * die Anfrage, aber nicht ihr Preis, und die beiden Anbieter unterscheiden
 * sich je Aufruf um mehr als das Zwanzigfache. Tokens können fehlen, wenn
 * ein Provider das `usage`-Feld nicht mitschickt — dann bleibt die Spalte
 * leer, statt eine Null zu behaupten.
 */
interface LlmResult {
  matches: SignalMatch[];
  hint: string | null;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

const OPENAI_MODEL    = 'gpt-4o-mini';
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';

/** Wie in siteos/handlers/anonymous.ts — derselbe Client, dieselbe Form. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = ReturnType<typeof createClient<any, 'public', any>>;

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
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

  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  const ip = clientIp(req.headers);
  const ipHash = await sha256Hex(ip + ':' + IP_HASH_SALT);
  const ua = req.headers.get('user-agent');
  const uaHash = ua ? await sha256Hex(ua) : undefined;

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin: AdminClient = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  // (1) Prüfpfad vor der Arbeit. Ohne Zeile keine Arbeit — dieselbe Regel
  // wie in governance-agent und siteos. `payload_keys` führt nur
  // Schlüsselnamen, nie die Beschreibung des Users.
  try {
    await reserveAnonAudit(admin, {
      request_id: requestId,
      op: ANON_OP,
      ip_hash: ipHash,
      user_agent_hash: uaHash,
      payload_keys: extractPayloadKeys(body as Record<string, unknown>),
    });
  } catch (e) {
    return jsonError(503, 'AUDIT_UNAVAILABLE',
      `anon path refused: audit log not writable (${(e as Error).message})`);
  }

  // (2) Billige Bremse im Ausführungskontext. Siehe Kommentar an
  // MINUTE_WINDOWS: greift nicht zuverlässig, kostet aber nichts.
  const decision = decideRateLimit({
    key: `${ipHash}:ai_act_classify`,
    feature: 'ai_act_classify',
    now: Date.now(),
    minuteWindows: MINUTE_WINDOWS,
    hourWindows:   HOUR_WINDOWS,
  });
  if (!decision.ok) {
    const retryAfterSec = Math.max(1, Math.ceil(decision.retryAfterMs / 1000));
    await completeAnonAudit(admin, requestId, {
      outcome: 'rate_limited',
      error_code: `RATE_LIMITED_${decision.scope.toUpperCase()}`,
      duration_ms: Date.now() - startedAt,
    });
    return new Response(
      JSON.stringify({
        ok: false,
        error: {
          code: 'RATE_LIMITED',
          message: `Rate limit exceeded (${decision.scope}). Retry after ${retryAfterSec}s.`,
          scope: decision.scope,
          retry_after_ms: decision.retryAfterMs,
        },
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          'content-type': 'application/json',
          'retry-after': String(retryAfterSec),
        },
      },
    );
  }

  // (3) Die tragende Schranke: Kontingent aus der Datenbank.
  const quota = await checkClassifyQuota(admin, ipHash, requestId);
  if (quota.status === 'unavailable') {
    // Fail closed, aus demselben Grund wie beim Prüfpfad: Ein Kontingent,
    // das bei jedem Lesefehler alles durchlässt, ist keines.
    await completeAnonAudit(admin, requestId, {
      outcome: 'error', error_code: 'QUOTA_UNAVAILABLE', duration_ms: Date.now() - startedAt,
    });
    return jsonError(503, 'QUOTA_UNAVAILABLE', 'anon path refused: quota not readable');
  }
  if (quota.status === 'exceeded') {
    await completeAnonAudit(admin, requestId, {
      outcome: 'rate_limited', error_code: 'QUOTA_EXCEEDED', duration_ms: Date.now() - startedAt,
    });
    return jsonError(
      429,
      'QUOTA_EXCEEDED',
      `Kontingent erschöpft: ${QUOTA_PER_DAY} Klassifikationen in 24 Stunden. ` +
      `Die lokale Vorauswahl im Browser arbeitet weiter.`,
    );
  }

  // LLM-Key-Hierarchie: erst aus Supabase Vault probieren, sonst Env-Vars.
  const openaiKey = await getSecret(admin, 'OPENAI_API_KEY');
  const anthropicKey = openaiKey ? null : await getSecret(admin, 'ANTHROPIC_API_KEY');

  if (!openaiKey && !anthropicKey) {
    await completeAnonAudit(admin, requestId, {
      outcome: 'error', error_code: 'LLM_NOT_CONFIGURED', duration_ms: Date.now() - startedAt,
    });
    return jsonError(400, 'LLM_NOT_CONFIGURED',
      'Weder OPENAI_API_KEY noch ANTHROPIC_API_KEY im Supabase-Vault konfiguriert. Frontend nutzt lokalen Fallback.');
  }

  // Registry laden — wir kopieren sie hier inline statt sie aus dem Frontend
  // zu importieren, damit die Edge-Function deploy-stabil ist.
  const registry = ANNEX_III_REGISTRY_INLINE;
  const systemPrompt = buildSystemPrompt(registry);

  let llmOutput: LlmResult;
  try {
    if (openaiKey) {
      llmOutput = await callOpenAI(openaiKey, systemPrompt, description);
    } else {
      llmOutput = await callAnthropic(anthropicKey!, systemPrompt, description);
    }
  } catch (e) {
    await completeAnonAudit(admin, requestId, {
      outcome: 'error',
      error_code: 'LLM_CALL_FAILED',
      model: openaiKey ? OPENAI_MODEL : ANTHROPIC_MODEL,
      duration_ms: Date.now() - startedAt,
    });
    return jsonError(500, 'LLM_CALL_FAILED', `LLM-Call: ${(e as Error).message}`);
  }

  // Sanity-check: useCaseIds müssen in der Registry existieren
  const validIds = new Set(registry.use_cases.map((uc) => uc.id));
  const filtered = llmOutput.matches.filter((m) => validIds.has(m.useCaseId));

  // (4) Abschluss mit Modell und Tokens — das, was vorher nirgends stand.
  await completeAnonAudit(admin, requestId, {
    outcome: 'success',
    model: llmOutput.model,
    input_tokens: llmOutput.inputTokens,
    output_tokens: llmOutput.outputTokens,
    duration_ms: Date.now() - startedAt,
  });

  return jsonResponse({
    matches: filtered,
    hint: llmOutput.hint,
    registry_version: registry.version,
  });
});

/**
 * Zählt die Klassifikationen dieses IP-Hashes im laufenden 24-Stunden-Fenster.
 *
 * `head: true` mit `count: 'exact'` holt nur die Zahl, keine Zeilen.
 *
 * Zwei Ausschlüsse, beide notwendig:
 *
 *   * `request_id != requestId` — die Reservierung DIESER Anfrage steht
 *     schon in der Tabelle (der Prüfpfad kommt vor dem Kontingent). Ohne
 *     den Ausschluss wäre das Kontingent still um eins kleiner als die
 *     Zahl, die hier steht.
 *   * `outcome != 'rate_limited'` — abgewiesene Anfragen haben keinen
 *     Provider erreicht und nichts gekostet. Würden sie mitzählen, könnte
 *     ein Burst hinter einer geteilten IP das Tageskontingent aufbrauchen,
 *     ohne dass je eine Klassifikation zustande kam.
 */
async function checkClassifyQuota(
  admin: AdminClient,
  ipHash: string,
  requestId: string,
): Promise<{ status: 'ok' | 'exceeded' | 'unavailable'; used: number }> {
  const since = new Date(Date.now() - QUOTA_WINDOW_MS).toISOString();
  const { count, error } = await admin
    .from('anon_chat_runs')
    .select('id', { count: 'exact', head: true })
    .eq('op', ANON_OP)
    .eq('ip_hash', ipHash)
    .gte('occurred_at', since)
    .neq('request_id', requestId)
    .neq('outcome', 'rate_limited');

  if (error || count === null || count === undefined) {
    console.error(JSON.stringify({
      level: 'error',
      scope: 'ai_act_classify_quota_unreadable',
      error: error?.message ?? 'no count',
    }));
    return { status: 'unavailable', used: 0 };
  }
  return { status: count >= QUOTA_PER_DAY ? 'exceeded' : 'ok', used: count };
}

async function getSecret(admin: AdminClient, name: string): Promise<string | null> {
  // Versuche Vault, dann Env
  try {
    const { data, error } = await admin.rpc('get_app_secret', { secret_name: name });
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

async function callOpenAI(apiKey: string, systemPrompt: string, userText: string): Promise<LlmResult> {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
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
  return {
    matches: parsed.matches ?? [],
    hint: parsed.hint ?? null,
    model: typeof json.model === 'string' ? json.model : OPENAI_MODEL,
    inputTokens:  numOrUndefined(json.usage?.prompt_tokens),
    outputTokens: numOrUndefined(json.usage?.completion_tokens),
  };
}

async function callAnthropic(apiKey: string, systemPrompt: string, userText: string): Promise<LlmResult> {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
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
  return {
    matches: parsed.matches ?? [],
    hint: parsed.hint ?? null,
    model: typeof json.model === 'string' ? json.model : ANTHROPIC_MODEL,
    inputTokens:  numOrUndefined(json.usage?.input_tokens),
    outputTokens: numOrUndefined(json.usage?.output_tokens),
  };
}

/**
 * Nur echte Zahlen ins Protokoll. Fehlt `usage`, bleibt die Spalte NULL —
 * eine 0 wäre die Behauptung, der Aufruf habe nichts verbraucht.
 */
function numOrUndefined(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function jsonError(status: number, code: string, message: string): Response {
  return jsonResponse({ error: { code, message } }, status);
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
