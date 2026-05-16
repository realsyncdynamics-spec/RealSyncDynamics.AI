// Runtime Spec Validator — Node/Deno-only.
//
// Loads the 9 JSON Schemas from spec/runtime/schemas/, registers them
// with ajv (so cross-schema $refs resolve), and exposes typed
// validation functions for each spec.
//
// Pure validation library. NEVER import from a React component —
// ajv adds ~150 kB to the bundle. The validator is consumed by:
//   - the runtime-core agent registry at registration time,
//   - the spec-CI workflow (scripts/validate-agent-manifest.mjs),
//   - the test suite (test/runtime/validator.test.ts).
//
// The JSON Schemas themselves cover SHAPE conformance. The v1.1
// CROSS-BLOCK consistency rules (ACS §9b, CPS §9c) are not
// expressible in pure JSON Schema and live in this file as
// `consistencyCheckAgentContract`.

// JSON Schemas in this repo use draft-2020-12 (see each schema's
// `$schema` field), so we import the draft-2020 entry point of ajv.
import Ajv2020 from 'ajv/dist/2020';
import type { ErrorObject, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

// JSON imports rely on tsconfig.json#resolveJsonModule (already true).
import eventSchema             from '../../spec/runtime/schemas/event.schema.json';
import agentContractSchema     from '../../spec/runtime/schemas/agent-contract.schema.json';
import runtimeContextSchema    from '../../spec/runtime/schemas/runtime-context.schema.json';
import evidenceChainSchema     from '../../spec/runtime/schemas/evidence-chain.schema.json';
import capabilitySchema        from '../../spec/runtime/schemas/capability.schema.json';
import policySchema            from '../../spec/runtime/schemas/policy.schema.json';
import evidenceCouplingSchema  from '../../spec/runtime/schemas/evidence-coupling.schema.json';
import escalationMatrixSchema  from '../../spec/runtime/schemas/escalation-matrix.schema.json';
import outputConstraintsSchema from '../../spec/runtime/schemas/output-constraints.schema.json';

// ── ajv setup ──────────────────────────────────────────────────────

const ajv = new Ajv2020({
  allErrors:   true,    // collect every error, not just the first
  strict:      false,   // schemas use `default` + custom keywords that are fine
  validateFormats: true,
});
// `addFormats` provides `date-time`, `uri`, `hostname`, `email`, etc.
// Cast — ajv-formats' typing expects an Ajv class shape that drifts
// between major versions.
addFormats(ajv as unknown as Parameters<typeof addFormats>[0]);

// Register the three v1.1 leaf schemas FIRST so the agent-contract +
// capability schemas' $refs to them resolve. Ajv uses $id from the
// schema body as the registration key — registration is idempotent
// per $id, so calling addSchema with the schema-with-$id is enough.
for (const s of [
  evidenceCouplingSchema,
  escalationMatrixSchema,
  outputConstraintsSchema,
  capabilitySchema,
]) {
  ajv.addSchema(s);
}

// Compile validators (eager — fast for the small schema set, surfaces
// schema-author mistakes at module load).
const v_event             = ajv.compile(eventSchema);
const v_agentContract     = ajv.compile(agentContractSchema);
const v_runtimeContext    = ajv.compile(runtimeContextSchema);
const v_evidenceChain     = ajv.compile(evidenceChainSchema);
const v_capability        = ajv.compile(capabilitySchema);
const v_policy            = ajv.compile(policySchema);
const v_evidenceCoupling  = ajv.compile(evidenceCouplingSchema);
const v_escalationMatrix  = ajv.compile(escalationMatrixSchema);
const v_outputConstraints = ajv.compile(outputConstraintsSchema);

// ── Public result shape ────────────────────────────────────────────

export interface ValidationError {
  /** JSON pointer to the offending node, e.g. '/capability/trust_level'. */
  path:    string;
  /** Human-readable message. */
  message: string;
  /** ajv keyword that triggered the error ('required', 'enum', etc.). */
  keyword: string;
  /** Extra params from ajv (allowedValues, missingProperty, etc.). */
  params?: Record<string, unknown>;
}

export interface ValidationResult {
  valid:  boolean;
  errors: ValidationError[];
}

function format(errs: ErrorObject[] | null | undefined): ValidationError[] {
  if (!errs) return [];
  return errs.map(e => ({
    path:    e.instancePath || '/',
    message: e.message ?? 'invalid',
    keyword: e.keyword,
    params:  e.params as Record<string, unknown>,
  }));
}

function run(v: ValidateFunction, data: unknown): ValidationResult {
  const valid = v(data) as boolean;
  return { valid, errors: valid ? [] : format(v.errors) };
}

// ── Per-spec validators ────────────────────────────────────────────

export const validateEvent             = (e: unknown) => run(v_event,             e);
export const validateAgentContract     = (m: unknown) => run(v_agentContract,     m);
export const validateRuntimeContext    = (c: unknown) => run(v_runtimeContext,    c);
export const validateEvidenceChainLink = (l: unknown) => run(v_evidenceChain,     l);
export const validateCapability        = (c: unknown) => run(v_capability,        c);
export const validatePolicy            = (p: unknown) => run(v_policy,            p);
export const validateEvidenceCoupling  = (b: unknown) => run(v_evidenceCoupling,  b);
export const validateEscalationMatrix  = (b: unknown) => run(v_escalationMatrix,  b);
export const validateOutputConstraints = (b: unknown) => run(v_outputConstraints, b);

// ── Cross-block consistency (NOT expressible in JSON Schema) ───────
//
// ACS §9b — cross-block consistency rules the registry MUST enforce.
// CPS §9c — additional v1.1 consistency rules.
//
// These rules require state from multiple fields at once, which JSON
// Schema's `dependentRequired` / `if-then` can express only awkwardly
// and not for the conditions we need. Pure code is clearer.

interface AgentContractLike {
  spec_version?: string;
  capability?: {
    permissions?:    string[];
    trust_level?:    string;
    isolation?: {
      pii_access?:             string;
      cross_tenant_visibility?: string;
    };
  };
  compliance?: {
    decides?: boolean;
  };
  agent?: { owner?: string };
  returns?: Array<{ subject?: string; requires_human_review?: boolean }>;
  evidence_coupling?:  { mode?: string };
  escalation_matrix?:  Record<string, { human_review_required?: boolean } | undefined>;
  output_constraints?: {
    template_locked?:    boolean;
    confidence_score?:   string;
    format?:             string;
  };
}

export function consistencyCheckAgentContract(manifest: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!manifest || typeof manifest !== 'object') return errors;
  const m = manifest as AgentContractLike & { permissions?: string[] };
  // Permissions can be declared at the top level (ACS root-level
  // permissions[]) AND/OR inside the capability block (CPS
  // capability.permissions[]). For consistency we union both — an
  // agent contract that lists a permission in either spot has it.
  const perms = new Set<string>([
    ...(m.permissions ?? []),
    ...(m.capability?.permissions ?? []),
  ]);
  const returns = m.returns ?? [];

  const push = (path: string, message: string, keyword = 'consistency') =>
    errors.push({ path, message, keyword });

  // ACS §9b — evidence_coupling.mode = mandatory
  //   ⇒ permissions MUST include both 'evidence.create' AND 'chain.append'.
  if (m.evidence_coupling?.mode === 'mandatory') {
    if (!perms.has('evidence.create')) {
      push('/evidence_coupling/mode',
        "mode='mandatory' requires permission 'evidence.create'");
    }
    if (!perms.has('chain.append')) {
      push('/evidence_coupling/mode',
        "mode='mandatory' requires permission 'chain.append'");
    }
  }

  // ACS §9b — evidence_coupling.mode = forbidden
  //   ⇒ permissions MUST NOT include 'evidence.create'.
  if (m.evidence_coupling?.mode === 'forbidden' && perms.has('evidence.create')) {
    push('/evidence_coupling/mode',
      "mode='forbidden' is incompatible with permission 'evidence.create'");
  }

  // ACS §9b — escalation_matrix.<tier>.human_review_required = true
  //   ⇒ at least one returns[] entry MUST have requires_human_review = true.
  if (m.escalation_matrix) {
    const anyReviewRequired = Object.values(m.escalation_matrix).some(
      t => t?.human_review_required === true,
    );
    if (anyReviewRequired) {
      const hasHrpReturn = returns.some(r => r?.requires_human_review === true);
      if (!hasHrpReturn) {
        push('/escalation_matrix',
          "any tier with human_review_required=true requires at least one returns[] entry with requires_human_review=true (HRP §3 alignment)");
      }
    }
  }

  // ACS §9b — output_constraints.template_locked = true
  //   ⇒ permissions MUST include 'tenant.read' (template loading).
  if (m.output_constraints?.template_locked === true && !perms.has('tenant.read')) {
    push('/output_constraints/template_locked',
      "template_locked=true requires permission 'tenant.read' (to load the template)");
  }

  // ACS §9b — output_constraints.confidence_score = mandatory
  //   ⇒ output_constraints.format MUST be strict_json or json.
  if (m.output_constraints?.confidence_score === 'mandatory') {
    const fmt = m.output_constraints.format;
    if (fmt !== 'strict_json' && fmt !== 'json') {
      push('/output_constraints/confidence_score',
        `confidence_score='mandatory' requires format='strict_json' or 'json' (got '${fmt ?? 'undefined'}')`);
    }
  }

  // CPS §9c — pii_access = full
  //   ⇒ compliance.decides MUST be false
  //   ⇒ at least one returns[] entry MUST require_human_review.
  if (m.capability?.isolation?.pii_access === 'full') {
    if (m.compliance?.decides !== false) {
      push('/capability/isolation/pii_access',
        "pii_access='full' requires compliance.decides=false");
    }
    const hasHrpReturn = returns.some(r => r?.requires_human_review === true);
    if (!hasHrpReturn) {
      push('/capability/isolation/pii_access',
        "pii_access='full' requires at least one returns[] entry with requires_human_review=true");
    }
  }

  // CPS §9c — cross_tenant_visibility in (aggregate_only, full)
  //   ⇒ trust_level MUST be observe_only or annotate.
  const ctv = m.capability?.isolation?.cross_tenant_visibility;
  if (ctv === 'aggregate_only' || ctv === 'full') {
    const tl = m.capability?.trust_level;
    if (tl !== 'observe_only' && tl !== 'annotate') {
      push('/capability/isolation/cross_tenant_visibility',
        `cross_tenant_visibility='${ctv}' requires trust_level='observe_only' or 'annotate' (got '${tl ?? 'undefined'}')`);
    }
  }

  // CPS §9c — cross_tenant_visibility = full
  //   ⇒ agent.owner MUST be 'realsync-platform' (not a tenant-installed agent).
  if (ctv === 'full' && m.agent?.owner !== 'realsync-platform') {
    push('/capability/isolation/cross_tenant_visibility',
      "cross_tenant_visibility='full' requires agent.owner='realsync-platform'");
  }

  return errors;
}

/** Schema-conformant AND consistency-conformant. The registry SHOULD
 *  call this, not just `validateAgentContract`. */
export function validateAgentContractFull(manifest: unknown): ValidationResult {
  const shape = validateAgentContract(manifest);
  const consistency = consistencyCheckAgentContract(manifest);
  return {
    valid:  shape.valid && consistency.length === 0,
    errors: [...shape.errors, ...consistency],
  };
}

// ── Loaded-schemas registry (for callers that want to introspect) ──

export const REGISTERED_SCHEMAS = {
  event:             eventSchema,
  agentContract:     agentContractSchema,
  runtimeContext:    runtimeContextSchema,
  evidenceChain:     evidenceChainSchema,
  capability:        capabilitySchema,
  policy:            policySchema,
  evidenceCoupling:  evidenceCouplingSchema,
  escalationMatrix:  escalationMatrixSchema,
  outputConstraints: outputConstraintsSchema,
} as const;

export type RegisteredSchemaKey = keyof typeof REGISTERED_SCHEMAS;
