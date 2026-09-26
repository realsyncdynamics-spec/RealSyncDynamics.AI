// Skills API — Routing only. KEIN externer LLM-Call, KEINE Persistenz,
// KEINE Auto-Aktion.
//
// GET  /functions/v1/skills          → Liste aller registrierten Skills
// POST /functions/v1/skills  body:{input}
//   → { selectedSkill, confidence, reason, requiresWebResearch, riskLevel,
//       candidates, guardrails }

import { buildCorsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

const corsHeaders = buildCorsHeaders('GET, POST, OPTIONS');

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

// Spiegel von src/lib/skills/registry.ts. Bewusst dupliziert: Edge-Functions
// koennen nicht aus src/ importieren (separate Build-Roots).
//
// Diese Kopie war bis 2026-09-20 keine: sie fuehrte 7 statt 9 Skills und
// gekuerzte Beschreibungen, Anwendungsfaelle und Guardrails. `gdpr-audit` und
// `ai-act-risk` fehlten vollstaendig — beide `riskLevel: 'high'` und
// `reviewRequired: true`. Eine Anfrage nach einem DSGVO-Website-Audit wurde
// deshalb an `finance-audit-support` geroutet, eine nach der
// AI-Act-Risikoklasse an `legal-compliance`, und „cookie scan",
// „security header", „annex iii", „transparenzpflicht" trafen gar nichts.
//
// Der Inhalt unten ist jetzt Feld fuer Feld aus der Quelle uebernommen.
// `test/skills/registry-drift.test.ts` erzwingt das — ohne den Test waere
// „Spiegel" wieder nur eine Behauptung im Kommentar.
const SKILLS: SkillDef[] = [
  {
    key: 'ai-act-risk', label: 'EU AI Act Risikoeinordnung',
    description:
      'Ordnet eine KI-Nutzung in die vier EU-AI-Act-Risikoklassen ein (prohibited/high/limited/minimal) und leitet die Pflichten ab. Keine Rechtsberatung.',
    triggers: ['ai act', 'ki-vo', 'ki verordnung', 'risikoklasse', 'annex iii', 'hochrisiko', 'transparenzpflicht', 'verbotene praktik', 'ai act klassifizierung'],
    useCases: ['Nutzungs-Kategorie einer AI-Act-Risikoklasse zuordnen', 'Pflichten je Risikoklasse ableiten (Doku, Human Oversight, Audit-Trail)', 'Transparenz-/Offenlegungspflichten fuer Chatbots und generierte Inhalte pruefen'],
    guardrails: ['Diese Auswertung ist eine technische Heuristik und stellt keine Rechtsberatung dar. Fuer rechtsverbindliche Bewertungen wenden Sie sich an qualifizierte Fachleute.'],
    riskLevel: 'high', requiresWebResearch: false, requiresUserData: false, reviewRequired: true,
  },
  {
    key: 'data-exploration', label: 'Data Exploration',
    description:
      'Schnelle Profilierung tabellarischer Daten: Spaltentypen, Null-Anteile, Kardinalitaet, Range, einfache Korrelationen.',
    triggers: ['explore', 'profile', 'dataset', 'spalten', 'csv', 'tabelle', 'data profiling', 'datenuebersicht', 'data exploration'],
    useCases: ['CSV-Upload erst-explorieren', 'Spalten klassifizieren (numerisch / kategorisch / datetime / id / text)', 'Profilierungs-Plan vorschlagen'],
    guardrails: ['Keine sensiblen Rohdaten (PII, Finanzdetails, Healthdata) im Output wiederholen. Aggregate und Hashes bevorzugen.'],
    riskLevel: 'medium', requiresWebResearch: false, requiresUserData: true, reviewRequired: false,
  },
  {
    key: 'finance-audit-support', label: 'Finance / Audit Support',
    description:
      'Strukturhilfe fuer interne Pruefungen: Deficiency-Klassifikation, Stichprobengroessen-Vorschlag, Working-Paper-Outlines.',
    triggers: ['audit', 'pruefung', 'control', 'kontrolle', 'sox', 'isae', 'deficiency', 'finding', 'sample size', 'stichprobe'],
    useCases: ['Schwere eines Befunds klassifizieren (control deficiency / significant / material)', 'Stichprobengroesse fuer Kontrollfrequenz vorschlagen'],
    guardrails: ['Output ersetzt keine Pruefungs- oder Auditmeinung. Vor Verwendung durch Fachpruefer freigeben.', 'Keine sensiblen Rohdaten (PII, Finanzdetails, Healthdata) im Output wiederholen. Aggregate und Hashes bevorzugen.'],
    riskLevel: 'high', requiresWebResearch: false, requiresUserData: true, reviewRequired: true,
  },
  {
    key: 'gdpr-audit', label: 'DSGVO-Audit (Website)',
    description:
      'Technische DSGVO-/TDDDG-Heuristik fuer Websites: Consent-Timing, Tracker, Drittlandtransfers, Pflichtseiten, Security-Header. Keine Rechtsberatung.',
    triggers: ['dsgvo audit', 'gdpr audit', 'website scan', 'website audit', 'cookie scan', 'tracker', 'consent timing', 'consent banner', 'security header'],
    useCases: ['Website auf DSGVO-/TDDDG-Risiken pruefen (Consent-Timing, Tracker)', 'Befund klassifizieren (critical/high/medium/low) inkl. Remediation-Hinweis', 'Pruefplan fuer ein Website-Audit erzeugen'],
    guardrails: ['Diese Auswertung ist eine technische Heuristik und stellt keine Rechtsberatung dar. Fuer rechtsverbindliche Bewertungen wenden Sie sich an qualifizierte Fachleute.'],
    riskLevel: 'high', requiresWebResearch: true, requiresUserData: false, reviewRequired: true,
  },
  {
    key: 'legal-compliance', label: 'Legal Compliance Support',
    description:
      'Checklisten zur Selbstpruefung von DSGVO/AI-Act-Themen: DSAR, AVV-/DPA-Reviews, Sub-Processor-Checks. Keine Rechtsberatung.',
    triggers: ['dsgvo', 'gdpr', 'datenschutz', 'dsar', 'avv', 'dpa', 'subprocessor', 'ai act', 'ki-vo', 'compliance'],
    useCases: ['DSAR-Bearbeitungs-Checkliste fuer eine Regulation aufstellen', 'DPA-Pruefkriterien als Checkliste erzeugen'],
    guardrails: ['Diese Auswertung ist eine technische Heuristik und stellt keine Rechtsberatung dar. Fuer rechtsverbindliche Bewertungen wenden Sie sich an qualifizierte Fachleute.', 'Keine sensiblen Rohdaten (PII, Finanzdetails, Healthdata) im Output wiederholen. Aggregate und Hashes bevorzugen.'],
    riskLevel: 'high', requiresWebResearch: true, requiresUserData: false, reviewRequired: true,
  },
  {
    key: 'legal-contract-review', label: 'Legal Contract Review',
    description:
      'Strukturhilfe fuer Vertrags-Reviews: Klausel-Abweichungsklassifikation, Redline-Reihenfolge. Liefert keine Rechtsmeinung.',
    triggers: ['contract', 'vertrag', 'mnda', 'nda', 'dpa', 'msa', 'redline', 'klausel', 'haftung', 'liability'],
    useCases: ['Schweregrad einer Klausel-Abweichung einordnen', 'Redline-Review-Plan nach Risikoklasse anlegen'],
    guardrails: ['Diese Auswertung ist eine technische Heuristik und stellt keine Rechtsberatung dar. Fuer rechtsverbindliche Bewertungen wenden Sie sich an qualifizierte Fachleute.'],
    riskLevel: 'high', requiresWebResearch: false, requiresUserData: true, reviewRequired: true,
  },
  {
    key: 'marketing-performance-analytics', label: 'Marketing Performance Analytics',
    description:
      'Trichter- und Kanal-Metriken (CR, CTR, ROAS) plus priorisierte Optimierungs-Hypothesen. Benchmarks sind nur Orientierung.',
    triggers: ['marketing', 'ctr', 'cvr', 'roas', 'funnel', 'conversion', 'attribution', 'campaign', 'kampagne'],
    useCases: ['Conversion-Rate / CTR / ROAS berechnen', 'Optimierungs-Vorschlaege nach Impact priorisieren'],
    guardrails: ['Branchen-Benchmarks dienen nur zur Orientierung und ersetzen keine eigene Datenanalyse.'],
    riskLevel: 'low', requiresWebResearch: false, requiresUserData: true, reviewRequired: false,
  },
  {
    key: 'sales-call-prep', label: 'Sales Call Prep',
    description:
      'Brief und Talking-Points fuer ein Sales-Gespraech. Liefert keine erfundenen Fakten ueber Firmen oder Personen.',
    triggers: ['call prep', 'meeting prep', 'sales call', 'gespraechsleitfaden', 'demo prep', 'discovery call', 'kickoff'],
    useCases: ['Discovery-Call-Outline mit offenen Fragen anlegen', 'Stakeholder-Map als Hypothese (klar markiert) skizzieren'],
    guardrails: ['Keine erfundenen Firmen-/Personenangaben. Unbekannte Felder bleiben leer oder werden klar als Hypothese markiert.'],
    riskLevel: 'medium', requiresWebResearch: true, requiresUserData: true, reviewRequired: false,
  },
  {
    key: 'sales-draft-outreach', label: 'Sales Outreach Drafting',
    description:
      'Erstellt Outreach-Entwuerfe (E-Mail/LinkedIn) als DRAFT. Niemals automatisch versendet, keine erfundenen Fakten.',
    triggers: ['outreach', 'cold email', 'kaltakquise', 'sequence', 'follow-up', 'linkedin message', 'anschreiben'],
    useCases: ['Research-Plan fuer ein Target-Account anlegen', 'Personalisierte Erstkontakt-Draft als Vorschlag erzeugen'],
    guardrails: ['Keine erfundenen Firmen-/Personenangaben. Unbekannte Felder bleiben leer oder werden klar als Hypothese markiert.', 'Keine automatische Versendung. Drafts muessen vor Versand durch einen Menschen freigegeben werden.'],
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
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;

  if (req.method === 'GET') return jsonResponse({ ok: true, skills: SKILLS }, 200, corsHeaders);

  if (req.method === 'POST') {
    let body: { input?: unknown };
    try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json', corsHeaders); }
    const input = typeof body?.input === 'string' ? body.input : '';
    if (!input) return jsonError(400, 'BAD_REQUEST', 'input required', corsHeaders);
    return jsonResponse({ ok: true, ...route(input) }, 200, corsHeaders);
  }

  return jsonError(405, 'BAD_REQUEST', 'GET or POST only', corsHeaders);
});
