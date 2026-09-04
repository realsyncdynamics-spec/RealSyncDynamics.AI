/**
 * Verdict-Adapter — übersetzt die Ergebnisse aller bestehenden Policy-Engines
 * in das kanonische Vokabular `ALLOW` / `DENY` / `REQUIRE_CONFIRMATION`.
 *
 * ## Warum dieses Modul existiert
 *
 * Im Repo entscheiden vier Engines mit vier verschiedenen Ergebnisformen
 * (Bestandsaufnahme: `docs/architecture/policy-verdict-audit.md`). Zwei davon
 * laufen produktiv (`governance-ingest`, `telemetry-ai-event`), eine im
 * Node-Gateway, eine im Enterprise-OS-Pfad. Keine darf geändert werden.
 *
 * Dieses Modul ist deshalb ein **Übersetzer, kein Entscheider**. Es wertet
 * nichts aus, liest keine Policies und trifft keine eigene Wahl — es bildet ein
 * bereits gefälltes Urteil auf das gemeinsame Vokabular ab. Eine fünfte Engine
 * entsteht hier ausdrücklich nicht.
 *
 * ## Warum das Mapping nicht bei drei Werten aufhört
 *
 * Die Quellen kennen fünf Stufen, das kanonische Modell drei. `warn` und `log`
 * fallen beide auf `ALLOW` — der Unterschied ist aber prüfungsrelevant:
 * „durchgelassen, Nutzer wurde gewarnt" ist nicht „durchgelassen, still
 * protokolliert". Wer nur den kanonischen Wert speichert, kann eine
 * Aufsichtsanfrage nicht mehr beantworten.
 *
 * Deshalb trägt jede Entscheidung `advisory` (nicht entscheidungswirksam) und
 * `sourceVerdict` (Originalwert, unverändert) mit. Die Rückrichtung bleibt
 * damit verlustfrei; `verdict` allein bleibt maßgeblich für die Durchsetzung.
 *
 * ## Laufzeit
 *
 * Pure ESM ohne externe Imports — läuft in Deno (Edge Functions), in
 * Cloudflare Workers und in Vitest gleichzeitig. Gleiches Muster wie
 * `policy-engine.ts`. Eingabetypen sind bewusst strukturell nachgebildet
 * statt importiert, damit dieses Modul keine der Engines an sich bindet.
 */

export type CanonicalVerdict = 'ALLOW' | 'DENY' | 'REQUIRE_CONFIRMATION';

/** Beiwerk zum Urteil. Ändert die Durchsetzung nicht, erhält den Prüfpfad. */
export type Advisory = 'log' | 'warn';

export type SourceEngine =
  /** supabase/functions/_shared/policyEngine.ts — Event + Asset */
  | 'asset-policy'
  /** supabase/functions/_shared/policy-engine.ts — Runtime-AI-Events */
  | 'runtime-ai'
  /** apps/agent-runtime/src/policy-engine.ts — Node-Gateway */
  | 'agent-gateway'
  /** src/lib/enterprise-ai-os/policy-engine.ts + Edge-Kopie */
  | 'enterprise-os'
  /** workers/govard-gateway/src/policy/engine.ts — Cloudflare Worker */
  | 'govard-gateway';

export interface CanonicalDecision {
  /** Maßgeblich für die Durchsetzung. */
  verdict: CanonicalVerdict;
  /** Nur bei ALLOW gesetzt; sonst null. */
  advisory: Advisory | null;
  sourceEngine: SourceEngine;
  /** Originalwert der Quelle, unverändert — für den Prüfpfad. */
  sourceVerdict: string;
  /** IDs der ausschlaggebenden Policies, sofern die Quelle sie kennt. */
  matchedPolicyIds: string[];
  /** Klartextbegründungen, sofern die Quelle sie liefert. */
  reasons: string[];
}

// ─── Eingabeformen (strukturell, nicht importiert) ───────────────────────────

/** `policyEngine.ts` → `PolicyDecision | null` (null = keine Policy matchte). */
export interface AssetPolicyResult {
  policy_id: string;
  action: string;
}

/** `policy-engine.ts` → `PolicyVerdict`. */
export interface RuntimeAiResult {
  status: string;
  matched_policy_id?: string;
  matched_policy_ids?: string[];
}

/** `apps/agent-runtime` → `PolicyDecision`. */
export type AgentGatewayResult =
  | { ok: true; reviewRequired: boolean }
  | { ok: false; reason: string };

/**
 * `workers/govard-gateway` → `PolicyEvaluation`.
 *
 * Diese Engine ist unabhängig auf fast dasselbe Vokabular gekommen: drei
 * Ausgänge, deny-by-default. Nur `APPROVAL` heißt hier, was der Contract
 * `REQUIRE_CONFIRMATION` nennt.
 */
export interface GovardGatewayResult {
  decision: string;
  violations?: Array<{ policy_id?: string; reason?: string }>;
  evaluation_hash?: string;
}

/** `evaluateAgentAction()` — Browser wie Edge-Kopie. */
export interface EnterpriseOsResult {
  allowed: boolean;
  requiresApproval: boolean;
  auditRequired: boolean;
  reasons: string[];
}

// ─── Übersetzungstabellen ────────────────────────────────────────────────────

/**
 * Fail-closed: was hier nicht steht, wird zu DENY. Ein unbekannter Wert
 * bedeutet, dass eine Engine ein Vokabular erweitert hat, ohne diesen Adapter
 * nachzuziehen — dann ist Durchlassen die falsche Vorgabe.
 */
const ASSET_POLICY_MAP: Record<string, { verdict: CanonicalVerdict; advisory: Advisory | null }> = {
  allow:            { verdict: 'ALLOW',                advisory: null },
  log:              { verdict: 'ALLOW',                advisory: 'log' },
  warn:             { verdict: 'ALLOW',                advisory: 'warn' },
  require_approval: { verdict: 'REQUIRE_CONFIRMATION', advisory: null },
  block:            { verdict: 'DENY',                 advisory: null },
};

const RUNTIME_AI_MAP: Record<string, { verdict: CanonicalVerdict; advisory: Advisory | null }> = {
  allowed:           { verdict: 'ALLOW',                advisory: null },
  logged:            { verdict: 'ALLOW',                advisory: 'log' },
  warned:            { verdict: 'ALLOW',                advisory: 'warn' },
  requires_approval: { verdict: 'REQUIRE_CONFIRMATION', advisory: null },
  blocked:           { verdict: 'DENY',                 advisory: null },
};

// ─── Übersetzer ──────────────────────────────────────────────────────────────

/**
 * `policyEngine.ts` (Asset/Event-Governance).
 *
 * `null` heißt „keine Policy hat gematcht". Das ist kein Fehler und kein
 * Blocker — es entspricht dem `logged` der Runtime-Engine: durchgelassen,
 * aber protokollpflichtig. Beide Engines werden hier gleich behandelt, damit
 * derselbe Sachverhalt nicht je nach Aufrufer verschieden aussieht.
 */
export function fromAssetPolicy(result: AssetPolicyResult | null): CanonicalDecision {
  if (result === null) {
    return {
      verdict: 'ALLOW',
      advisory: 'log',
      sourceEngine: 'asset-policy',
      sourceVerdict: 'no_match',
      matchedPolicyIds: [],
      reasons: ['Keine Policy hat gematcht.'],
    };
  }
  const mapped = ASSET_POLICY_MAP[result.action];
  if (!mapped) {
    return denyUnknown('asset-policy', result.action, result.policy_id ? [result.policy_id] : []);
  }
  return {
    verdict: mapped.verdict,
    advisory: mapped.advisory,
    sourceEngine: 'asset-policy',
    sourceVerdict: result.action,
    matchedPolicyIds: result.policy_id ? [result.policy_id] : [],
    reasons: [],
  };
}

/** `policy-engine.ts` (Runtime-AI-Events). */
export function fromRuntimeAi(result: RuntimeAiResult): CanonicalDecision {
  const ids = result.matched_policy_ids ?? (result.matched_policy_id ? [result.matched_policy_id] : []);
  const mapped = RUNTIME_AI_MAP[result.status];
  if (!mapped) {
    return denyUnknown('runtime-ai', result.status, ids);
  }
  return {
    verdict: mapped.verdict,
    advisory: mapped.advisory,
    sourceEngine: 'runtime-ai',
    sourceVerdict: result.status,
    matchedPolicyIds: ids,
    reasons: [],
  };
}

/**
 * `apps/agent-runtime` (Node-Gateway).
 *
 * Das Gateway kennt kein `warn`/`log` — es hat nur zulassen, zulassen mit
 * Review, ablehnen. Daher bleibt `advisory` hier immer null.
 */
export function fromAgentGateway(result: AgentGatewayResult): CanonicalDecision {
  if (!result.ok) {
    return {
      verdict: 'DENY',
      advisory: null,
      sourceEngine: 'agent-gateway',
      sourceVerdict: result.reason,
      matchedPolicyIds: [],
      reasons: [result.reason],
    };
  }
  return {
    verdict: result.reviewRequired ? 'REQUIRE_CONFIRMATION' : 'ALLOW',
    advisory: null,
    sourceEngine: 'agent-gateway',
    sourceVerdict: result.reviewRequired ? 'ok:reviewRequired' : 'ok',
    matchedPolicyIds: [],
    reasons: [],
  };
}

/**
 * `evaluateAgentAction()` — Browser-Fassung wie Edge-Kopie.
 *
 * Reihenfolge ist bedeutsam: `allowed: false` schlägt `requiresApproval`.
 * Eine abgelehnte Aktion wird nicht durch eine Bestätigung zulässig; sonst
 * ließe sich ein DENY per Klick in eine Ausführung verwandeln.
 */
export function fromEnterpriseOs(result: EnterpriseOsResult): CanonicalDecision {
  if (!result.allowed) {
    return {
      verdict: 'DENY',
      advisory: null,
      sourceEngine: 'enterprise-os',
      sourceVerdict: 'allowed:false',
      matchedPolicyIds: [],
      reasons: result.reasons,
    };
  }
  return {
    verdict: result.requiresApproval ? 'REQUIRE_CONFIRMATION' : 'ALLOW',
    advisory: null,
    sourceEngine: 'enterprise-os',
    sourceVerdict: result.requiresApproval ? 'allowed:requiresApproval' : 'allowed',
    matchedPolicyIds: [],
    reasons: result.reasons,
  };
}

/**
 * `workers/govard-gateway` (Cloudflare Worker).
 *
 * Kennt kein `warn`/`log`, daher bleibt `advisory` null. Die Begründungen der
 * verletzten Policies wandern in `reasons`, ihre IDs in `matchedPolicyIds` —
 * bei DENY und APPROVAL ist genau das der Prüfpfad.
 */
export function fromGovardGateway(result: GovardGatewayResult): CanonicalDecision {
  const violations = result.violations ?? [];
  const base = {
    advisory: null,
    sourceEngine: 'govard-gateway' as const,
    sourceVerdict: result.decision,
    matchedPolicyIds: violations.map((v) => v.policy_id ?? '').filter(Boolean),
    reasons: violations.map((v) => v.reason ?? '').filter(Boolean),
  };
  switch (result.decision) {
    case 'ALLOW':
      return { verdict: 'ALLOW', ...base };
    case 'APPROVAL':
      return { verdict: 'REQUIRE_CONFIRMATION', ...base };
    case 'DENY':
      return { verdict: 'DENY', ...base };
    default:
      return denyUnknown('govard-gateway', result.decision, base.matchedPolicyIds);
  }
}

// ─── Hilfen ──────────────────────────────────────────────────────────────────

function denyUnknown(engine: SourceEngine, raw: string, ids: string[]): CanonicalDecision {
  return {
    verdict: 'DENY',
    advisory: null,
    sourceEngine: engine,
    sourceVerdict: raw,
    matchedPolicyIds: ids,
    reasons: [`Unbekannter Verdict-Wert "${raw}" aus ${engine} — fail-closed.`],
  };
}

/** Darf die Aktion ohne weitere Zustimmung ausgeführt werden? */
export function isExecutable(decision: CanonicalDecision): boolean {
  return decision.verdict === 'ALLOW';
}

/**
 * Jede Entscheidung ist beweispflichtig — auch DENY. Existiert als Funktion
 * und nicht als Feld, damit kein Aufrufer sie versehentlich auf false setzt.
 */
export function requiresEvidence(_decision: CanonicalDecision): true {
  return true;
}
