/**
 * PDP v2 — Policy Decision Point, Kern (rein, importfrei).
 *
 * Governance-Zweck: Eine einzige Entscheidungsinstanz fuer alle
 * Durchsetzungspunkte (PEPs). Der Kern ist eine reine Funktion ueber
 * (Snapshot, Request) — laeuft identisch in Deno (Edge Functions) und
 * Vitest (Node), analog zu `_shared/policy-engine.ts`.
 *
 * Sicherheitsrelevanz: Dieses Modul entscheidet, ob Aktionen erlaubt,
 * gewarnt, blockiert oder freigabepflichtig sind. Semantik-Aenderungen
 * koennen Kundenpolicies still ausser Kraft setzen — deshalb laeuft v2
 * zunaechst im Shadow-Mode NEBEN den Alt-Engines (policy-engine.ts,
 * policyEngine.ts) und ersetzt sie erst nach gemessener Deckungsgleichheit
 * (siehe docs/architecture/governance-os-enforcement-plan.md, P0-5).
 *
 * EU-AI-Act-Bezug: Art. 14 (Human Oversight — require_approval),
 * Art. 12 (Logging — jede Nicht-allow-Entscheidung erzeugt Evidence).
 * DSGVO-Bezug: data_transfer-Regeln setzen Art. 44 ff. (Drittlandtransfer)
 * und Art. 32 (Sicherheit der Verarbeitung) technisch durch.
 *
 * Kompilierung: Beide Alt-Policy-Formate werden verlustfrei in ein
 * normalisiertes `CompiledPolicy` ueberfuehrt. Die Match-Semantik ist
 * bewusst eine exakte Portierung der jeweiligen Alt-Engine — NICHT
 * vereinheitlicht. Vereinheitlichung waere eine stille Semantik-Aenderung
 * (Befund K1 im Plan).
 */

// ─── Entscheidungsvertrag v1 ─────────────────────────────────────────────────

export type PdpDecision = 'allow' | 'warn' | 'block' | 'require_approval' | 'log_only';

/** Ausfallverhalten, wenn der PDP nicht erreichbar ist (Plan §2.5, K3). */
export type FailMode = 'allow' | 'block';

export interface DecisionPrincipal {
  type: 'user' | 'service' | 'agent' | 'device';
  id?: string;
  org_unit?: string;
  /**
   * Materialisierter Pfad '/<root>/<...>/<unit>' aus org_units.org_path.
   * Wird vom PIP (decide.ts) angereichert; erlaubt Policies auf einen
   * Teilbaum ("gilt fuer Standort X inkl. aller Abteilungen darunter").
   */
  org_path?: string;
  roles?: string[];
}

/** Zerlegt einen org_path in die Unit-IDs von der Wurzel bis zur eigenen. */
export function orgAncestors(orgPath: string | undefined): string[] {
  if (!orgPath) return [];
  return orgPath.split('/').filter((s) => s.length > 0);
}

export interface DecisionRequest {
  contract: 'v1';
  /** null = nur globale Policies (z. B. ai-gateway ohne Tenant-Kontext). */
  tenant_id: string | null;
  principal?: DecisionPrincipal;
  action: {
    verb: string;                 // transfer | invoke | publish | deploy | …
    channel: string;              // ai_gateway | telemetry | governance_ingest | …
    event_type?: string;          // legacy: prompt_sent, tool_call, …
    event_source?: string;        // legacy governance_events.event_source
  };
  target?: {
    system_id?: string;
    vendor?: string;
    model?: string;
    approved?: boolean;
  };
  data?: {
    classification?: string;      // public | internal | … | personal_data
    data_types?: string[];
    prompt_category?: string;
    risk_level?: string;
  };
  /** Asset-Kontext (governance_assets) fuer generic-Bedingungen. */
  asset?: {
    id?: string;
    asset_type?: string;
    ai_act_class?: string;
    data_types?: string[];
    vendor?: string | null;
  };
  payload?: Record<string, unknown>;
  context?: { request_id?: string; feature?: string };
}

export interface DecisionReason {
  policy_id: string;
  policy_source: PolicySource;
  rule: string;
  action: PdpDecision;
  /** Menschenlesbare Begruendung, deutsch — entsteht hier, nie im PEP (Plan §2.2). */
  text_de: string;
}

export interface DecisionResult {
  contract: 'v1';
  decision: PdpDecision;
  reasons: DecisionReason[];
  matched_policy_ids: string[];
  primary_policy_id: string | null;
  engine: 'pdp-v2';
  snapshot_version: string;
  /** Cache-Erlaubnis fuer den PEP. 0 = nicht cachen. */
  ttl_ms: number;
  /**
   * Freigabe-Kette (P1-4), vom PDP-Glue gefuellt:
   * - decision=require_approval  -> offenes/neues Gate (status 'pending')
   * - decision=allow mit covered -> eine erteilte Freigabe deckt die Aktion
   */
  approval?: {
    gate_id: string | null;
    approver_role: string;
    status: 'pending' | 'approved';
  };
}

export const PDP_DEFAULT_TTL_MS = 30_000;

// ─── Kompilierte Policies / Snapshot ─────────────────────────────────────────

export type PolicySource = 'ai_policies' | 'governance_policies';

export type CompiledRule =
  // Portierung policy-engine.ts (ai_policies):
  | 'data_transfer'
  | 'model_usage'
  | 'human_review'
  | 'logging_required'
  | 'vendor_restriction'
  // Portierung policyEngine.ts (governance_policies):
  | 'generic_condition';

export interface CompiledPolicy {
  id: string;
  source: PolicySource;
  rule: CompiledRule;
  name?: string;
  action: PdpDecision;                    // normalisiert (log → log_only)
  condition: Record<string, unknown>;
  /**
   * Verhalten bei PDP-Ausfall. Solange E2 offen ist, gilt der dokumentierte
   * Default: fail open — AUSSER die Policy blockiert selbst, dann fail closed.
   * Ueberschreibbar per `on_engine_unavailable` in der Condition-JSONB.
   */
  on_engine_unavailable: FailMode;
  /**
   * Rolle, die eine require_approval-Entscheidung dieser Policy freigeben
   * darf (P1-4). Aus `approver_role` in der Condition-JSONB; Default
   * 'approver'. Der CEO muss nicht jede Aktion freigeben — die Freigabe
   * adressiert eine Rolle, keine Person (Auftrag §2).
   */
  approver_role: string;
}

export interface PolicySnapshot {
  contract: 'v1';
  tenant_id: string | null;
  version: string;
  policies: CompiledPolicy[];
}

// ─── Praezedenz (identisch zu beiden Alt-Engines) ────────────────────────────

const DECISION_SEVERITY: Record<PdpDecision, number> = {
  allow: 0,
  log_only: 1,
  warn: 2,
  require_approval: 3,
  block: 4,
};

export function strictestDecision(a: PdpDecision, b: PdpDecision): PdpDecision {
  return DECISION_SEVERITY[a] >= DECISION_SEVERITY[b] ? a : b;
}

function normalizeAction(raw: unknown): PdpDecision {
  switch (raw) {
    case 'allow': return 'allow';
    case 'log': return 'log_only';
    case 'log_only': return 'log_only';
    case 'warn': return 'warn';
    case 'require_approval': return 'require_approval';
    case 'block': return 'block';
    default: return 'log_only'; // unbekannte Action nie eskalieren, nur dokumentieren
  }
}

function approverRoleOf(condition: Record<string, unknown>): string {
  const raw = condition['approver_role'];
  return typeof raw === 'string' && raw.length > 0 ? raw : 'approver';
}

function failModeOf(condition: Record<string, unknown>, action: PdpDecision): FailMode {
  const explicit = condition['on_engine_unavailable'];
  if (explicit === 'allow' || explicit === 'block') return explicit;
  // Default bis E2 entschieden ist: blockierende Policies fail closed, Rest fail open.
  return action === 'block' ? 'block' : 'allow';
}

// ─── Kompilierung: ai_policies (Schema wie _shared/policy-engine.ts) ─────────

export interface AiPolicyRowInput {
  id: string;
  name?: string;
  rule_type: string;
  action: string;
  enabled: boolean;
  condition: Record<string, unknown> | null;
}

const AI_RULE_TYPES = new Set<CompiledRule>([
  'data_transfer', 'model_usage', 'human_review', 'logging_required', 'vendor_restriction',
]);

export function compileAiPolicies(rows: AiPolicyRowInput[]): CompiledPolicy[] {
  const out: CompiledPolicy[] = [];
  for (const r of rows) {
    if (!r.enabled) continue;
    if (!AI_RULE_TYPES.has(r.rule_type as CompiledRule)) continue; // wie Alt-Engine: unbekannter Typ matched nie
    const action = normalizeAction(r.action);
    const condition = r.condition ?? {};
    out.push({
      id: r.id,
      source: 'ai_policies',
      rule: r.rule_type as CompiledRule,
      name: r.name,
      action,
      condition,
      on_engine_unavailable: failModeOf(condition, action),
      approver_role: approverRoleOf(condition),
    });
  }
  return out;
}

// ─── Kompilierung: governance_policies (Schema wie _shared/policyEngine.ts) ──

export interface GovernancePolicyRowInput {
  id: string;
  policy_type?: string;
  action: string;
  enabled: boolean;
  condition: Record<string, unknown> | null;
}

export function compileGovernancePolicies(rows: GovernancePolicyRowInput[]): CompiledPolicy[] {
  const out: CompiledPolicy[] = [];
  for (const r of rows) {
    if (!r.enabled) continue;
    const action = normalizeAction(r.action);
    const condition = r.condition ?? {};
    out.push({
      id: r.id,
      source: 'governance_policies',
      rule: 'generic_condition',
      name: r.policy_type,
      action,
      condition,
      on_engine_unavailable: failModeOf(condition, action),
      approver_role: approverRoleOf(condition),
    });
  }
  return out;
}

/**
 * Snapshot-Version: FNV-1a ueber die kanonische JSON-Form der kompilierten
 * Policies. Kein kryptographischer Hash noetig — die Version dient der
 * Cache-Invalidierung und Nachvollziehbarkeit, nicht der Integritaet
 * (die liegt bei der Evidence-Hash-Kette).
 */
export function snapshotVersion(policies: CompiledPolicy[]): string {
  const canonical = JSON.stringify(
    [...policies].sort((a, b) => a.id.localeCompare(b.id)),
  );
  let h = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    h ^= canonical.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `v1:${policies.length}:${h.toString(16).padStart(8, '0')}`;
}

export function buildSnapshot(
  tenantId: string | null,
  aiRows: AiPolicyRowInput[],
  govRows: GovernancePolicyRowInput[],
): PolicySnapshot {
  const policies = [...compileAiPolicies(aiRows), ...compileGovernancePolicies(govRows)];
  return { contract: 'v1', tenant_id: tenantId, version: snapshotVersion(policies), policies };
}

// ─── Matching: exakte Portierung policy-engine.ts ────────────────────────────

const EXTERNAL_VENDORS = new Set(['openai', 'anthropic', 'google', 'perplexity']);

function isExternalVendor(vendor?: string): boolean {
  if (!vendor) return false;
  return EXTERNAL_VENDORS.has(vendor.toLowerCase());
}

function asArr(v: unknown): string[] | undefined {
  return Array.isArray(v) && v.length > 0 ? (v as string[]) : undefined;
}

function matchAiPolicy(req: DecisionRequest, p: CompiledPolicy): boolean {
  const c = p.condition;
  const vendor = req.target?.vendor;
  const eventType = req.action.event_type ?? '';
  switch (p.rule) {
    case 'data_transfer': {
      const classes = asArr(c['data_classes']);
      if (classes) {
        const cls = req.data?.classification;
        if (!cls || !classes.includes(cls)) return false;
      }
      const toExt = c['to_external_vendor'];
      if (toExt !== undefined) {
        const ext = isExternalVendor(vendor);
        if (toExt === true && !ext) return false;
        if (toExt === false && ext) return false;
      }
      return true;
    }
    case 'model_usage': {
      const vendors = asArr(c['vendors']);
      if (vendors && (!vendor || !vendors.includes(vendor.toLowerCase()))) return false;
      const models = asArr(c['models']);
      if (models && (!req.target?.model || !models.includes(req.target.model))) return false;
      const eventTypes = asArr(c['event_types']);
      if (eventTypes && !eventTypes.includes(eventType)) return false;
      return true;
    }
    case 'human_review': {
      const risks = asArr(c['risk_levels']);
      if (risks) {
        const rl = req.data?.risk_level;
        if (!rl || !risks.includes(rl)) return false;
      }
      const cats = asArr(c['prompt_categories']);
      if (cats) {
        const pc = req.data?.prompt_category;
        if (!pc || !cats.includes(pc)) return false;
      }
      return true;
    }
    case 'logging_required': {
      const eventTypes = asArr(c['event_types']);
      if (eventTypes) return eventTypes.includes(eventType);
      return true;
    }
    case 'vendor_restriction': {
      const v = vendor?.toLowerCase();
      if (!v) return false;
      const blocked = asArr(c['blocked_vendors']);
      if (blocked) return blocked.includes(v);
      const allowed = asArr(c['allowed_vendors']);
      if (allowed) return !allowed.includes(v);
      return false;
    }
    default:
      return false;
  }
}

// ─── Matching: exakte Portierung policyEngine.ts (generic_condition) ─────────

function genericFieldValue(req: DecisionRequest, key: string): unknown {
  switch (key) {
    case 'event_type':   return req.action.event_type;
    case 'event_source': return req.action.event_source;
    case 'vendor':       return req.target?.vendor ?? null;
    case 'model_name':   return req.target?.model ?? null;
    case 'data_types':   return req.data?.data_types;
    case 'risk_level':   return req.data?.risk_level;
    case 'asset_type':   return req.asset?.asset_type;
    case 'ai_act_class': return req.asset?.ai_act_class;
    // Principal-Schluessel (P1-1). Nur wenn ein Principal am Request haengt —
    // sonst payload-Fallback, damit die Shadow-Aequivalenz mit der Alt-Engine
    // fuer alle Alt-Pfade (die keinen Principal setzen) erhalten bleibt (K1).
    case 'principal_type':
      return req.principal ? req.principal.type : req.payload?.[key];
    case 'principal_roles':
      return req.principal ? (req.principal.roles ?? []) : req.payload?.[key];
    case 'org_unit':
      // Liste aus eigener Unit + allen Vorfahren: eine Bedingung
      // { org_unit: '<id>' } matcht damit den ganzen Teilbaum darunter.
      return req.principal
        ? orgAncestors(req.principal.org_path ?? (req.principal.org_unit ? `/${req.principal.org_unit}` : undefined))
        : req.payload?.[key];
    default:             return req.payload?.[key];
  }
}

const ASSET_KEYS = new Set(['asset_type', 'ai_act_class']);

function matchGenericValue(expected: unknown, actual: unknown): boolean {
  if (expected === null || expected === undefined) return actual === expected;
  if (Array.isArray(expected)) {
    if (Array.isArray(actual)) return expected.some((e) => actual.includes(e));
    return expected.includes(actual);
  }
  return expected === actual;
}

// Schluessel, deren Ist-Wert bei vorhandenem Principal eine LISTE ist
// (Rollen, Vorfahren-Units). Ein skalarer Soll-Wert wird dann als
// Ein-Element-Liste gelesen — { org_unit: 'X' } und { org_unit: ['X'] }
// meinen dasselbe. Ohne Principal (payload-Fallback) bleibt die exakte
// Alt-Semantik unangetastet (K1).
const PRINCIPAL_LIST_KEYS = new Set(['principal_roles', 'org_unit']);

function matchGenericPolicy(req: DecisionRequest, p: CompiledPolicy): boolean {
  for (const [k, rawExpected] of Object.entries(p.condition)) {
    if (k === 'on_engine_unavailable' || k === 'approver_role') continue; // Meta-Felder, keine Match-Bedingung
    const v = req.principal && PRINCIPAL_LIST_KEYS.has(k) && !Array.isArray(rawExpected)
      ? [rawExpected]
      : rawExpected;
    if (ASSET_KEYS.has(k) && !req.asset) {
      // Alt-Engine: Asset-Felder ohne Asset fallen in payload zurueck
      if (!matchGenericValue(v, req.payload?.[k])) return false;
      continue;
    }
    if (!matchGenericValue(v, genericFieldValue(req, k))) return false;
  }
  return true;
}

export function matchCompiledPolicy(req: DecisionRequest, p: CompiledPolicy): boolean {
  return p.rule === 'generic_condition' ? matchGenericPolicy(req, p) : matchAiPolicy(req, p);
}

// ─── Deutsche Begruendungen (Plan §2.2: entstehen im PDP, nie im PEP) ────────

const DECISION_VERB_DE: Record<PdpDecision, string> = {
  allow: 'erlaubt',
  log_only: 'dokumentiert',
  warn: 'mit Warnung versehen',
  require_approval: 'freigabepflichtig',
  block: 'blockiert',
};

function reasonTextDe(req: DecisionRequest, p: CompiledPolicy): string {
  const verb = DECISION_VERB_DE[p.action];
  const vendor = req.target?.vendor;
  const name = p.name ? `„${p.name}"` : `${p.rule}`;
  switch (p.rule) {
    case 'data_transfer':
      return `Diese Aktion überträgt Daten der Klasse „${req.data?.classification ?? 'unbekannt'}"${vendor ? ` an ${vendor}` : ''} und ist gemäß Unternehmensrichtlinie ${name} ${verb}.`;
    case 'vendor_restriction':
      return `Der Anbieter „${vendor ?? 'unbekannt'}" ist gemäß Unternehmensrichtlinie ${name} nicht freigegeben — die Aktion wird ${verb}.`;
    case 'model_usage':
      return `Die Nutzung von ${vendor ?? 'diesem Anbieter'}${req.target?.model ? ` / ${req.target.model}` : ''} ist gemäß Unternehmensrichtlinie ${name} ${verb}.`;
    case 'human_review':
      return `Diese Aktion erfordert gemäß Unternehmensrichtlinie ${name} eine menschliche Prüfung — sie ist ${verb}.`;
    case 'logging_required':
      return `Diese Aktion wird gemäß Unternehmensrichtlinie ${name} vollständig protokolliert.`;
    default:
      return `Die Aktion ist gemäß Unternehmensrichtlinie ${name} ${verb}.`;
  }
}

// ─── Auswertung ──────────────────────────────────────────────────────────────

/**
 * Reine Auswertung: Snapshot + Request → Ergebnis. Kein IO.
 *
 * Kein Match ⇒ `allow` mit leerer Begruendungsliste. (Die Alt-Engine meldet
 * dafuer 'logged' — Mapping siehe toLegacyAiStatus(), fuer den Shadow-Vergleich.)
 */
export function evaluateSnapshot(snapshot: PolicySnapshot, req: DecisionRequest): DecisionResult {
  const matched: CompiledPolicy[] = [];
  for (const p of snapshot.policies) {
    if (matchCompiledPolicy(req, p)) matched.push(p);
  }

  const sorted = [...matched].sort(
    (a, b) => DECISION_SEVERITY[b.action] - DECISION_SEVERITY[a.action],
  );
  const winner = sorted[0] ?? null;
  const decision: PdpDecision = winner ? winner.action : 'allow';

  return {
    contract: 'v1',
    decision,
    reasons: sorted.map((p) => ({
      policy_id: p.id,
      policy_source: p.source,
      rule: p.rule,
      action: p.action,
      text_de: reasonTextDe(req, p),
    })),
    matched_policy_ids: sorted.map((p) => p.id),
    primary_policy_id: winner?.id ?? null,
    engine: 'pdp-v2',
    snapshot_version: snapshot.version,
    // Blockierende/freigabepflichtige Entscheidungen nicht cachen — eine
    // zwischenzeitliche Freigabe muss sofort wirken.
    ttl_ms: decision === 'block' || decision === 'require_approval' ? 0 : PDP_DEFAULT_TTL_MS,
  };
}

/**
 * Aggregiertes Ausfallverhalten eines Snapshots: fail closed, sobald EINE
 * Policy fail closed verlangt. PEPs nutzen das, wenn der PDP nicht antwortet
 * und kein gueltiger Cache vorliegt (Plan K3).
 */
export function snapshotFailMode(snapshot: PolicySnapshot): FailMode {
  return snapshot.policies.some((p) => p.on_engine_unavailable === 'block') ? 'block' : 'allow';
}

// ─── Shadow-Vergleich mit den Alt-Engines (P0-5) ─────────────────────────────

/**
 * Mappt ein v2-Ergebnis auf das Status-Vokabular von policy-engine.ts
 * ('allowed'|'warned'|'blocked'|'requires_approval'|'logged'), damit der
 * Shadow-Vergleich Feld gegen Feld moeglich ist.
 */
export function toLegacyAiStatus(result: DecisionResult): string {
  if (result.matched_policy_ids.length === 0) return 'logged';
  switch (result.decision) {
    case 'allow': return 'allowed';
    case 'warn': return 'warned';
    case 'block': return 'blocked';
    case 'require_approval': return 'requires_approval';
    case 'log_only': return 'logged';
  }
}

/** Mappt auf das Action-Vokabular von policyEngine.ts (null = kein Match). */
export function toLegacyGovAction(result: DecisionResult): string | null {
  if (result.matched_policy_ids.length === 0) return null;
  return result.decision === 'log_only' ? 'log' : result.decision;
}

// ─── Approval-Fingerprint (P1-4) ─────────────────────────────────────────────

/**
 * Deterministischer Fingerprint eines Entscheidungs-Requests. Eine erteilte
 * Freigabe deckt exakt die Wiederholung DERSELBEN Aktion — gleicher Kanal,
 * gleiches Verb, gleiches Ziel, gleiche Datenklasse, gleicher Principal.
 * Bewusst NICHT enthalten: payload/context (zu volatil — jede Freigabe
 * waere sonst wirkungslos) und risk_level (abgeleitet, nicht identitaets-
 * stiftend). FNV-1a genuegt: Der Fingerprint ist ein Schluessel, kein
 * Integritaetsnachweis.
 */
export function approvalFingerprint(req: DecisionRequest): string {
  const canonical = JSON.stringify([
    req.tenant_id ?? '',
    req.action.channel,
    req.action.verb,
    req.action.event_type ?? '',
    req.target?.system_id ?? '',
    (req.target?.vendor ?? '').toLowerCase(),
    req.target?.model ?? '',
    req.data?.classification ?? '',
    [...(req.data?.data_types ?? [])].sort(),
    req.principal?.id ?? '',
  ]);
  let h = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    h ^= canonical.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  let h2 = 0xcbf29ce4;
  for (let i = canonical.length - 1; i >= 0; i--) {
    h2 ^= canonical.charCodeAt(i);
    h2 = Math.imul(h2, 0x01000193) >>> 0;
  }
  return `fp1:${h.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}
