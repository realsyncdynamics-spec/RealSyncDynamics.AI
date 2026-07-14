// Hermes Governance-Brief — reine Logik (Prompt-Bau + Antwort-Validierung).
//
// Keine Netzwerk-/Deno-Abhängigkeit → in Vitest direkt testbar. Der Runner
// (governanceBriefRunner.ts) sammelt den Kontext, ruft ai-gateway und
// persistiert; diese Datei kapselt nur den deterministischen Teil.

export interface BriefContext {
  tenant_name: string | null;
  brief_date: string; // YYYY-MM-DD
  open_incidents: number;
  overdue_dsr: number;
  open_dpias: number;
  vendors_no_dpa: number;
  pending_approvals: number;
  mappings_percent: number | null;
  evidence_percent: number | null;
  policies_enabled_percent: number | null;
  observations: { severity: string; title: string }[];
}

export interface BriefRisk {
  title: string;
  severity: string;
}

export interface BriefPayload {
  narrative_de: string;
  top_3_risks: BriefRisk[];
  recommended_actions_today: string[];
}

const SYSTEM_PROMPT = [
  'Du bist Hermes, ein nüchterner Governance-Analyst für eine EU-souveräne Compliance-Plattform (DSGVO, EU AI Act).',
  'Verdichte den übergebenen Tenant-Status zu einem kurzen Tagesbrief für die Geschäftsführung.',
  'Antworte AUSSCHLIESSLICH mit gültigem JSON in genau diesem Schema:',
  '{',
  '  "narrative_de": string,   // 50–110 Wörter, sachliches Deutsch, keine Floskeln, nennt die wichtigsten offenen Punkte und Fristen',
  '  "top_3_risks": [ { "title": string, "severity": "critical"|"high"|"medium"|"low" } ],  // max 3, nach Priorität',
  '  "recommended_actions_today": [ string ]  // max 5 konkrete Handlungen für heute',
  '}',
  'Erfinde keine Zahlen — nutze nur die übergebenen Daten. Kein Text außerhalb des JSON.',
].join('\n');

export function briefSystemPrompt(): string {
  return SYSTEM_PROMPT;
}

/** Baut System- und User-Prompt für den ai-gateway-Aufruf. */
export function buildBriefPrompt(ctx: BriefContext): { system: string; user: string } {
  const user = JSON.stringify(
    {
      mandant: ctx.tenant_name ?? 'Unbenannt',
      datum: ctx.brief_date,
      offene_pflichten: {
        vorfaelle: ctx.open_incidents,
        dsr_ueberfaellig: ctx.overdue_dsr,
        dsfa_offen: ctx.open_dpias,
        vendoren_ohne_avv: ctx.vendors_no_dpa,
        freigaben_offen: ctx.pending_approvals,
      },
      abdeckung_prozent: {
        kontroll_mapping: ctx.mappings_percent,
        evidence: ctx.evidence_percent,
        richtlinien_aktiv: ctx.policies_enabled_percent,
      },
      jüngste_beobachtungen: ctx.observations.slice(0, 10).map((o) => ({
        schwere: o.severity,
        titel: o.title,
      })),
    },
    null,
    2,
  );
  return { system: SYSTEM_PROMPT, user };
}

const SEVERITIES = new Set(['critical', 'high', 'medium', 'low']);

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Validiert + normalisiert die LLM-Antwort. Wirft bei unbrauchbarem JSON. */
export function validateBriefPayload(raw: unknown): BriefPayload {
  if (!raw || typeof raw !== 'object') throw new Error('brief payload not an object');
  const obj = raw as Record<string, unknown>;

  const narrative = asString(obj.narrative_de);
  if (!narrative) throw new Error('narrative_de missing or empty');

  const risksRaw = Array.isArray(obj.top_3_risks) ? obj.top_3_risks : [];
  const top_3_risks: BriefRisk[] = risksRaw
    .map((r): BriefRisk | null => {
      if (typeof r === 'string') {
        const t = r.trim();
        return t ? { title: t, severity: 'medium' } : null;
      }
      if (r && typeof r === 'object') {
        const title = asString((r as Record<string, unknown>).title);
        if (!title) return null;
        const sevRaw = asString((r as Record<string, unknown>).severity).toLowerCase();
        return { title, severity: SEVERITIES.has(sevRaw) ? sevRaw : 'medium' };
      }
      return null;
    })
    .filter((r): r is BriefRisk => r !== null)
    .slice(0, 3);

  const actionsRaw = Array.isArray(obj.recommended_actions_today) ? obj.recommended_actions_today : [];
  const recommended_actions_today = actionsRaw
    .map(asString)
    .filter((s) => s.length > 0)
    .slice(0, 5);

  return { narrative_de: narrative, top_3_risks, recommended_actions_today };
}
