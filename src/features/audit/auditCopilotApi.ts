import { AiGatewayEdgeClient, AiGatewayEdgeError } from '../../core/ai-gateway/edgeClient';

// Audit-Copilot helpers. Talk to the `ai-gateway` Edge Function via
// `AiGatewayEdgeClient` and return structured payloads for the panel UI.
//
// Why a feature-local helper instead of inlining the calls in the panel:
//   - keeps prompt text + JSON-schema expectations co-located,
//   - makes the calls unit-testable with an injected fetchImpl,
//   - leaves room for an audit-result variant (per-audit memory) without
//     touching the panel component.
//
// Why ai-gateway directly (not via governance-agent like the free-form
// chat path): structured outputs (code snippets, remediation plans) work
// best when we ask for JSON shape. The native op API exposes
// `extract_json` for exactly that.

export type AuditCmsTarget = 'wordpress' | 'shopify' | 'webflow' | 'custom-html' | 'nginx';

export interface AuditFindingInput {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  detail: string;
  paragraph_ref?: string;
}

export interface FixSnippet {
  cms: AuditCmsTarget;
  language: string;       // "html" | "php" | "javascript" | "nginx" | …
  snippet: string;
  notes: string;          // 1-3 sentences explaining why this fixes the finding
}

export interface RemediationPlan {
  summary: string;
  steps: Array<{ title: string; detail: string }>;
  legal_reference?: string;
}

export interface AiGatewayClientDeps {
  /** Test/SSR hook: inject a preconfigured client (e.g. mocked fetch). */
  client?: AiGatewayEdgeClient;
  /** Test/SSR hook: override env-derived config without monkey-patching env. */
  supabaseUrl?: string;
  /** Test/SSR hook: override env-derived anon key. */
  supabaseAnonKey?: string;
}

function resolveClient(deps?: AiGatewayClientDeps): AiGatewayEdgeClient {
  if (deps?.client) return deps.client;
  const url = deps?.supabaseUrl     ?? (import.meta.env.VITE_SUPABASE_URL      as string | undefined);
  const key = deps?.supabaseAnonKey ?? (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);
  if (!url || !key) {
    throw new AiGatewayEdgeError(503, 'AI_GATEWAY_NOT_CONFIGURED',
      'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY fehlen — ai-gateway nicht aufrufbar.');
  }
  return new AiGatewayEdgeClient({ supabaseUrl: url, apiKey: key });
}

const FIX_SNIPPET_SYSTEM_PROMPT = `Du bist Audit-Co-Pilot für DSGVO-/AI-Act-Compliance.
Aufgabe: Generiere einen knappen, kopierfähigen Code-/Konfigurationsschnipsel,
der den genannten Befund auf der gewählten Plattform behebt.

Regeln:
- Antworte AUSSCHLIESSLICH mit gültigem JSON. Kein Markdown-Wrapper.
- Schema: { "cms": string, "language": string, "snippet": string, "notes": string }
- snippet: maximal 30 Zeilen, kein Beispiel-Output, nur produktionsfähiger Code/Config.
- notes: 1-3 Sätze, warum das den Befund behebt. KEINE Rechtsberatung.
- Wenn der Befund nicht via Snippet behebbar ist (z. B. Prozess-Issue),
  setze snippet auf "" und beschreibe im notes-Feld die manuellen Schritte.`;

const REMEDIATION_SYSTEM_PROMPT = `Du bist Audit-Co-Pilot für DSGVO-/AI-Act-Compliance.
Aufgabe: Erzeuge einen knappen, umsetzbaren Maßnahmenplan zu den genannten Befunden.

Regeln:
- Antworte AUSSCHLIESSLICH mit gültigem JSON.
- Schema: { "summary": string, "steps": [{ "title": string, "detail": string }], "legal_reference": string }
- summary: 1-2 Sätze, was zu tun ist.
- steps: 3-6 konkrete Schritte. detail-Texte erwähnen NIE „Beratung", sondern „technische Umsetzung".
- legal_reference: relevanter DSGVO-Artikel oder TTDSG-Paragraph, sonst "".
- Keine Marketing-Sprache. Keine Rechtsberatung.`;

/**
 * Generate a CMS-targeted code snippet that fixes a single audit finding.
 *
 * Uses model_profile `strict-json` because we need a parseable structured
 * answer. Throws AiGatewayEdgeError on upstream failure — caller renders
 * a fallback bubble.
 */
export async function generateFixSnippet(
  finding: AuditFindingInput,
  cms: AuditCmsTarget,
  deps?: AiGatewayClientDeps,
): Promise<FixSnippet> {
  const client = resolveClient(deps);
  const input = [
    `Befund-ID: ${finding.id}`,
    `Severity: ${finding.severity}`,
    `Titel: ${finding.title}`,
    `Detail: ${finding.detail}`,
    finding.paragraph_ref ? `Rechtsgrundlage: ${finding.paragraph_ref}` : '',
    '',
    `Ziel-Plattform: ${cms}`,
  ].filter(Boolean).join('\n');

  const resp = await client.extractJson<FixSnippet>({
    feature:       'audit_copilot.fix_snippet',
    task_type:     'extract_json',
    model_profile: 'strict-json',
    input,
    system_prompt: FIX_SNIPPET_SYSTEM_PROMPT,
    max_tokens:    900,
    temperature:   0.1,
    metadata:      { cms },
  });
  return resp.output;
}

/**
 * Generate an actionable remediation plan covering one or more findings.
 *
 * Used for the "Maßnahmenplan anzeigen" CTA in the audit copilot panel.
 */
export async function generateRemediationPlan(
  findings: AuditFindingInput[],
  deps?: AiGatewayClientDeps,
): Promise<RemediationPlan> {
  if (findings.length === 0) {
    throw new AiGatewayEdgeError(400, 'BAD_REQUEST', 'Mindestens ein Befund erforderlich.');
  }
  const client = resolveClient(deps);
  const input = findings.map((f, i) => [
    `Befund ${i + 1}:`,
    `  Severity: ${f.severity}`,
    `  Titel: ${f.title}`,
    `  Detail: ${f.detail}`,
    f.paragraph_ref ? `  Rechtsgrundlage: ${f.paragraph_ref}` : '',
  ].filter(Boolean).join('\n')).join('\n\n');

  const resp = await client.extractJson<RemediationPlan>({
    feature:       'audit_copilot.remediation_plan',
    task_type:     'extract_json',
    model_profile: 'strict-json',
    input,
    system_prompt: REMEDIATION_SYSTEM_PROMPT,
    max_tokens:    1200,
    temperature:   0.2,
    metadata:      { finding_count: findings.length },
  });
  return resp.output;
}

export { AiGatewayEdgeError };
