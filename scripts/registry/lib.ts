// Gates der Anbieter-/Deployment-Registry (CI, Node).
//
// Fuenf Gates, jeweils als npm-Script (registry:*) und in test/registry/*.test.ts
// gegen das echte Verzeichnis registry/ sowie gegen positive und negative
// Fixtures:
//
//   parse                  jede Registry-Datei ist lesbares JSON
//   schema                 echte JSON-Schema-Validierung Draft 2020-12 (Ajv2020 + ajv-formats, strict)
//   referential-integrity  IDs eindeutig, Referenzen aufloesbar, captured_at plausibel
//   evidence               kein PASS/CONDITIONAL aus unbelegten Claims, belegte Fakten tragen Quellen,
//                          inputs_hash stimmt
//   policy-invariants      (a)-(e) + Residency-Ableitung monoton und fail-closed
//
// Ein leeres Registry-Verzeichnis ist gruen. Die Gates schreiben nichts.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import type { ErrorObject, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

import type { AssessmentSnapshot, DeploymentFile, ResidencyClass, VendorFile } from '../../supabase/functions/_shared/registry/types.ts';
import { checkAssessmentInvariants, checkEvidenceBacking } from '../../supabase/functions/_shared/registry/invariants.ts';
import { assessmentInputsHash, ASSESSMENT_INPUTS_HASH_METHOD } from '../../supabase/functions/_shared/registry/inputsHash.ts';
import { RESIDENCY_CLASSES, residencyEligibility } from '../../supabase/functions/_shared/registry/residency.ts';

export const GATES = ['parse', 'schema', 'referential-integrity', 'evidence', 'policy-invariants'] as const;
export type GateName = (typeof GATES)[number];

export type Kind = 'vendor' | 'deployment' | 'assessment';
const KIND_DIRS: Record<Kind, string> = { vendor: 'vendors', deployment: 'deployments', assessment: 'assessments' };
const IGNORED_FILES = new Set(['README.md', '.gitkeep']);

export interface GateIssue { gate: GateName; file: string; code: string; message: string }
export interface GateResult { gate: GateName; ok: boolean; issues: GateIssue[]; counts: Record<Kind, number> }

export interface LoadedFile<T = unknown> { kind: Kind; file: string; data: T }
export interface LoadedRegistry { files: LoadedFile[]; parseIssues: GateIssue[] }

// ─── Laden ──────────────────────────────────────────────────────────────────

export function loadRegistry(registryDir: string): LoadedRegistry {
  const files: LoadedFile[] = [];
  const parseIssues: GateIssue[] = [];
  for (const kind of Object.keys(KIND_DIRS) as Kind[]) {
    const dir = join(registryDir, KIND_DIRS[kind]);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      if (IGNORED_FILES.has(name) || statSync(full).isDirectory()) continue;
      const rel = `${KIND_DIRS[kind]}/${name}`;
      if (!name.endsWith('.json')) {
        parseIssues.push({ gate: 'parse', file: rel, code: 'UNSUPPORTED_EXTENSION', message: 'Nur .json wird gelesen (YAML ist noch nicht freigegeben, siehe registry/README.md).' });
        continue;
      }
      const raw = readFileSync(full, 'utf8');
      if (raw.trim().length === 0) {
        parseIssues.push({ gate: 'parse', file: rel, code: 'EMPTY_FILE', message: 'Datei ist leer.' });
        continue;
      }
      try {
        files.push({ kind, file: rel, data: JSON.parse(raw) });
      } catch (e) {
        parseIssues.push({ gate: 'parse', file: rel, code: 'INVALID_JSON', message: (e as Error).message });
      }
    }
  }
  return { files, parseIssues };
}

function countKinds(reg: LoadedRegistry): Record<Kind, number> {
  const c: Record<Kind, number> = { vendor: 0, deployment: 0, assessment: 0 };
  for (const f of reg.files) c[f.kind]++;
  return c;
}

// ─── Schema (Draft 2020-12) ─────────────────────────────────────────────────

export interface Validators { vendor: ValidateFunction; deployment: ValidateFunction; assessment: ValidateFunction }

export function createValidators(schemaDir: string): Validators {
  // strict: unbekannte Keywords, fehlerhafte Schemas usw. sind Fehler, nicht Warnungen.
  // strictRequired aus: if/then-Zweige verlangen Properties, die im Elternschema
  // definiert sind (Standardmuster in 2020-12, z. B. verified => verification).
  const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true, allowUnionTypes: true });
  addFormats(ajv);
  for (const name of ['common', 'vendor', 'deployment', 'assessment']) {
    ajv.addSchema(JSON.parse(readFileSync(join(schemaDir, `${name}.schema.json`), 'utf8')));
  }
  const get = (name: string): ValidateFunction => {
    const fn = ajv.getSchema(`https://realsyncdynamics.ai/schemas/registry/${name}.schema.json`);
    if (!fn) throw new Error(`Schema ${name} nicht kompilierbar`);
    return fn;
  };
  return { vendor: get('vendor'), deployment: get('deployment'), assessment: get('assessment') };
}

function formatAjvError(e: ErrorObject): string {
  return `${e.instancePath || '/'} ${e.message ?? e.keyword}${e.params && Object.keys(e.params).length ? ' ' + JSON.stringify(e.params) : ''}`;
}

function schemaIssues(reg: LoadedRegistry, v: Validators, gate: GateName): GateIssue[] {
  const out: GateIssue[] = [];
  for (const f of reg.files) {
    const fn = v[f.kind];
    if (!fn(f.data)) {
      for (const e of fn.errors ?? []) out.push({ gate, file: f.file, code: 'SCHEMA', message: formatAjvError(e) });
    }
  }
  return out;
}

// ─── Hilfen ─────────────────────────────────────────────────────────────────

const byKind = <T>(reg: LoadedRegistry, kind: Kind) => reg.files.filter((f) => f.kind === kind) as LoadedFile<T>[];

/** Gates 3-5 setzen parse+schema voraus; sonst melden sie das als eigenen Befund. */
function prerequisites(reg: LoadedRegistry, v: Validators, gate: GateName): GateIssue[] {
  const out: GateIssue[] = reg.parseIssues.map((i) => ({ ...i, gate, code: `PREREQ_${i.code}` }));
  for (const i of schemaIssues(reg, v, gate)) out.push({ ...i, code: 'PREREQ_SCHEMA' });
  return out;
}

function walk(node: unknown, visit: (obj: Record<string, unknown>, path: string) => void, path = ''): void {
  if (Array.isArray(node)) node.forEach((n, i) => walk(n, visit, `${path}/${i}`));
  else if (node && typeof node === 'object') {
    visit(node as Record<string, unknown>, path || '/');
    for (const [k, val] of Object.entries(node)) walk(val, visit, `${path}/${k}`);
  }
}

// ─── Gate 1: parse ──────────────────────────────────────────────────────────

export function gateParse(registryDir: string): GateResult {
  const reg = loadRegistry(registryDir);
  return { gate: 'parse', ok: reg.parseIssues.length === 0, issues: reg.parseIssues, counts: countKinds(reg) };
}

// ─── Gate 2: schema ─────────────────────────────────────────────────────────

export function gateSchema(registryDir: string, schemaDir: string): GateResult {
  const reg = loadRegistry(registryDir);
  const v = createValidators(schemaDir);
  const issues = [...reg.parseIssues.map((i) => ({ ...i, gate: 'schema' as const })), ...schemaIssues(reg, v, 'schema')];
  return { gate: 'schema', ok: issues.length === 0, issues, counts: countKinds(reg) };
}

// ─── Gate 3: referentielle Integritaet ──────────────────────────────────────

export function gateReferentialIntegrity(registryDir: string, schemaDir: string, now: Date = new Date()): GateResult {
  const gate: GateName = 'referential-integrity';
  const reg = loadRegistry(registryDir);
  const v = createValidators(schemaDir);
  const issues = prerequisites(reg, v, gate);
  if (issues.length > 0) return { gate, ok: false, issues, counts: countKinds(reg) };

  const vendors = byKind<VendorFile>(reg, 'vendor');
  const deployments = byKind<DeploymentFile>(reg, 'deployment');
  const assessments = byKind<AssessmentSnapshot>(reg, 'assessment');
  const add = (file: string, code: string, message: string) => issues.push({ gate, file, code, message });

  const expectName = (f: LoadedFile, id: string) => {
    if (basename(f.file) !== `${id}.json`) add(f.file, 'FILENAME_ID_MISMATCH', `Dateiname muss ${id}.json lauten.`);
  };
  const dup = <T>(list: LoadedFile<T>[], id: (d: T) => string, code: string) => {
    const seen = new Map<string, string>();
    for (const f of list) {
      const key = id(f.data);
      if (seen.has(key)) add(f.file, code, `${key} ist bereits in ${seen.get(key)} vergeben.`);
      else seen.set(key, f.file);
    }
  };
  dup(vendors, (d) => d.vendor_id, 'DUPLICATE_VENDOR_ID');
  dup(deployments, (d) => d.deployment_id, 'DUPLICATE_DEPLOYMENT_ID');
  dup(assessments, (d) => d.assessment_id, 'DUPLICATE_ASSESSMENT_ID');

  const vendorIds = new Set(vendors.map((f) => f.data.vendor_id));
  const depById = new Map(deployments.map((f) => [f.data.deployment_id, f.data]));
  const skusByVendor = new Map<string, Set<string>>();
  for (const { data: d } of deployments) {
    if (!skusByVendor.has(d.vendor_id)) skusByVendor.set(d.vendor_id, new Set());
    skusByVendor.get(d.vendor_id)!.add(d.product_sku);
  }

  const tomorrow = now.getTime() + 86_400_000;
  const checkDates = (f: LoadedFile) => {
    walk(f.data, (obj, path) => {
      const ca = obj.captured_at;
      if (typeof ca === 'string' && Date.parse(ca) > tomorrow) add(f.file, 'CAPTURED_AT_IN_FUTURE', `${path}: captured_at ${ca} liegt in der Zukunft.`);
      const from = obj.valid_from, until = obj.valid_until;
      if (typeof from === 'string' && typeof until === 'string' && Date.parse(until) < Date.parse(from)) {
        add(f.file, 'VALIDITY_RANGE_INVERTED', `${path}: valid_until vor valid_from.`);
      }
      if ('sources' in obj && Array.isArray(obj.sources) && !('captured_at' in obj) && !path.includes('/sources/')) {
        add(f.file, 'CAPTURED_AT_MISSING', `${path}: belegpflichtiger Wert ohne captured_at.`);
      }
    });
  };

  const checkCerts = (file: string, vendorId: string, certs: { cert_id: string; applies_to_sku: string[] }[], where: string) => {
    const skus = skusByVendor.get(vendorId) ?? new Set<string>();
    const seen = new Set<string>();
    for (const c of certs) {
      if (seen.has(c.cert_id)) add(file, 'DUPLICATE_CERT_ID', `${where}: cert_id ${c.cert_id} doppelt.`);
      seen.add(c.cert_id);
      for (const sku of c.applies_to_sku) {
        if (!skus.has(sku)) add(file, 'CERT_SKU_UNKNOWN', `${where}: ${c.cert_id} verweist auf SKU ${sku}, die kein Deployment von ${vendorId} traegt.`);
      }
    }
  };

  for (const f of vendors) {
    expectName(f, f.data.vendor_id);
    checkDates(f);
    checkCerts(f.file, f.data.vendor_id, f.data.certifications, 'vendor');
  }

  for (const f of deployments) {
    const d = f.data;
    expectName(f, d.deployment_id);
    checkDates(f);
    if (!vendorIds.has(d.vendor_id)) add(f.file, 'VENDOR_NOT_FOUND', `vendor_id ${d.vendor_id} existiert nicht.`);
    const op = d.infrastructure_operator.vendor_id;
    if (op !== null && !vendorIds.has(op)) add(f.file, 'HOST_VENDOR_NOT_FOUND', `infrastructure_operator.vendor_id ${op} existiert nicht.`);
    checkCerts(f.file, d.vendor_id, d.certifications, 'deployment');
    for (const sku of d.jurisdiction.eu_commission_seal.applies_to_sku) {
      if (!(skusByVendor.get(d.vendor_id) ?? new Set()).has(sku)) add(f.file, 'SEAL_SKU_UNKNOWN', `eu_commission_seal verweist auf SKU ${sku} ausserhalb von ${d.vendor_id}.`);
    }

    const modelIds = new Set<string>();
    const categoryIds = new Set(d.pricing.categories.map((c) => c.category_id));
    for (const m of d.models) {
      if (modelIds.has(m.model_id)) add(f.file, 'DUPLICATE_MODEL_ID', `model_id ${m.model_id} doppelt.`);
      modelIds.add(m.model_id);
      const cat = m.price_category?.value;
      if (cat && !categoryIds.has(cat)) add(f.file, 'PRICE_CATEGORY_NOT_FOUND', `${m.model_id}: price_category ${cat} fehlt in pricing.categories.`);
      const dev = m.model_origin.developer_vendor_id;
      if (dev && !vendorIds.has(dev)) add(f.file, 'MODEL_DEVELOPER_VENDOR_NOT_FOUND', `${m.model_id}: developer_vendor_id ${dev} existiert nicht.`);
    }
    const claimIds = new Set<string>();
    for (const c of d.claims) {
      if (claimIds.has(c.claim_id)) add(f.file, 'DUPLICATE_CLAIM_ID', `claim_id ${c.claim_id} doppelt.`);
      claimIds.add(c.claim_id);
      if (c.subject.deployment_id !== d.deployment_id) {
        add(f.file, 'CLAIM_DEPLOYMENT_MISMATCH', `${c.claim_id}: subject.deployment_id ${c.subject.deployment_id} ist nicht ${d.deployment_id}.`);
        if (!depById.has(c.subject.deployment_id)) add(f.file, 'CLAIM_DEPLOYMENT_NOT_FOUND', `${c.claim_id}: Deployment ${c.subject.deployment_id} existiert nicht.`);
      }
      for (const mid of c.subject.model_ids) {
        if (!modelIds.has(mid)) add(f.file, 'CLAIM_MODEL_NOT_FOUND', `${c.claim_id}: Modell ${mid} existiert in ${d.deployment_id} nicht.`);
      }
    }
  }

  for (const f of assessments) {
    const a = f.data;
    expectName(f, a.assessment_id);
    checkDates(f);
    const d = depById.get(a.deployment_id);
    if (!d) { add(f.file, 'ASSESSMENT_DEPLOYMENT_NOT_FOUND', `deployment_id ${a.deployment_id} existiert nicht.`); continue; }
    if (a.inputs.deployment_id !== a.deployment_id) add(f.file, 'ASSESSMENT_INPUT_DEPLOYMENT_MISMATCH', 'inputs.deployment_id weicht ab.');
    if (a.inputs.product_sku !== d.product_sku) add(f.file, 'ASSESSMENT_SKU_MISMATCH', `inputs.product_sku ${a.inputs.product_sku} ist nicht ${d.product_sku}.`);
    if (a.model_id !== null && !d.models.some((m) => m.model_id === a.model_id)) add(f.file, 'ASSESSMENT_MODEL_NOT_FOUND', `model_id ${a.model_id} existiert in ${d.deployment_id} nicht.`);
    const claimIds = new Set(d.claims.map((c) => c.claim_id));
    const certIds = new Set(d.certifications.map((c) => c.cert_id));
    for (const e of a.inputs.evidence) {
      const [kind, id] = [e.ref.slice(0, e.ref.indexOf(':')), e.ref.slice(e.ref.indexOf(':') + 1)];
      if (kind === 'claim' && !claimIds.has(id)) add(f.file, 'EVIDENCE_CLAIM_NOT_FOUND', `${e.ref} existiert in ${d.deployment_id} nicht.`);
      if (kind === 'certification' && !certIds.has(id)) add(f.file, 'EVIDENCE_CERT_NOT_FOUND', `${e.ref} existiert in ${d.deployment_id} nicht.`);
    }
  }

  return { gate, ok: issues.length === 0, issues, counts: countKinds(reg) };
}

// ─── Gate 4: Evidence ───────────────────────────────────────────────────────

const STATUS_RANK = { unknown: 0, claimed: 1, verified: 2 } as const;

export async function gateEvidence(registryDir: string, schemaDir: string): Promise<GateResult> {
  const gate: GateName = 'evidence';
  const reg = loadRegistry(registryDir);
  const v = createValidators(schemaDir);
  const issues = prerequisites(reg, v, gate);
  if (issues.length > 0) return { gate, ok: false, issues, counts: countKinds(reg) };
  const add = (file: string, code: string, message: string) => issues.push({ gate, file, code, message });

  // E1: jeder als claimed/verified gefuehrte Wert in Registry-Dateien traegt eine Quelle.
  for (const f of reg.files.filter((x) => x.kind !== 'assessment')) {
    walk(f.data, (obj, path) => {
      if (!Array.isArray(obj.sources)) return;
      const backedStatus = (x: unknown) => x === 'claimed' || x === 'verified';
      const st = backedStatus(obj.status) ? obj.status : obj.verification_status;
      if (backedStatus(st) && obj.sources.length === 0) {
        add(f.file, 'UNSOURCED_CLAIM', `${path}: status=${st} ohne Quelle – nur 'unknown' ist ohne Quelle zulaessig.`);
      }
    });
  }

  const depById = new Map(byKind<DeploymentFile>(reg, 'deployment').map((f) => [f.data.deployment_id, f.data]));
  for (const f of byKind<AssessmentSnapshot>(reg, 'assessment')) {
    const a = f.data;
    // E2: kein PASS/CONDITIONAL aus unbelegten Claims.
    for (const x of checkEvidenceBacking(a)) add(f.file, x.code, x.message);
    // E3: inputs_hash = sha256(JCS(inputs)).
    if (a.inputs_hash_method !== ASSESSMENT_INPUTS_HASH_METHOD) add(f.file, 'INPUTS_HASH_METHOD', `inputs_hash_method muss ${ASSESSMENT_INPUTS_HASH_METHOD} sein.`);
    const expected = await assessmentInputsHash(a.inputs);
    if (expected !== a.inputs_hash) add(f.file, 'INPUTS_HASH_MISMATCH', `inputs_hash ${a.inputs_hash} != ${expected}.`);
    // E4: Evidenzeintraege duerfen nicht besser belegt sein als der Registry-Datensatz.
    const d = depById.get(a.deployment_id);
    if (!d) continue;
    for (const e of a.inputs.evidence) {
      const id = e.ref.slice(e.ref.indexOf(':') + 1);
      const rec = e.ref.startsWith('claim:') ? d.claims.find((c) => c.claim_id === id)
        : e.ref.startsWith('certification:') ? d.certifications.find((c) => c.cert_id === id) : undefined;
      if (!rec) continue;
      if (STATUS_RANK[e.status] > STATUS_RANK[rec.status] || e.source_count > rec.sources.length) {
        add(f.file, 'EVIDENCE_OVERSTATED', `${e.ref}: Snapshot sagt ${e.status}/${e.source_count} Quellen, Registry ${rec.status}/${rec.sources.length}.`);
      }
    }
  }
  return { gate, ok: issues.length === 0, issues, counts: countKinds(reg) };
}

// ─── Gate 5: Policy-Invarianten ─────────────────────────────────────────────

/** Schluessel, die in Registry-Dateien nie vorkommen duerfen (abgeleitete oder Immunitaets-Werte). */
export const FORBIDDEN_FACT_KEYS = ['cloud_act_safe', 'routing_allowed', 'routing_eligible', 'assessment_result', 'compliance_status', 'status_color', 'ui_color'];

export function gatePolicyInvariants(registryDir: string, schemaDir: string): GateResult {
  const gate: GateName = 'policy-invariants';
  const reg = loadRegistry(registryDir);
  const v = createValidators(schemaDir);
  const issues = prerequisites(reg, v, gate);
  if (issues.length > 0) return { gate, ok: false, issues, counts: countKinds(reg) };
  const add = (file: string, code: string, message: string) => issues.push({ gate, file, code, message });

  for (const f of reg.files.filter((x) => x.kind !== 'assessment')) {
    walk(f.data, (obj, path) => {
      for (const k of FORBIDDEN_FACT_KEYS) if (k in obj) add(f.file, 'DERIVED_VALUE_STORED', `${path}: '${k}' ist abgeleitet bzw. ein Immunitaets-Flag und wird nie gespeichert.`);
    });
  }

  for (const f of byKind<DeploymentFile>(reg, 'deployment')) {
    const d = f.data;
    for (const m of [null, ...d.models]) {
      const label = m ? `${d.deployment_id}/${m.model_id}` : d.deployment_id;
      const el = Object.fromEntries(RESIDENCY_CLASSES.map((c) => [c, residencyEligibility(d, c, m)])) as Record<ResidencyClass, ReturnType<typeof residencyEligibility>>;
      // Residency-Ableitung ist monoton: DE_ONLY => EU_ONLY => EU_EFTA => GLOBAL_ALLOWED.
      for (let i = 0; i < RESIDENCY_CLASSES.length - 1; i++) {
        const a = RESIDENCY_CLASSES[i]!, b = RESIDENCY_CLASSES[i + 1]!;
        if (el[a].eligible && !el[b].eligible) add(f.file, 'RESIDENCY_NOT_MONOTONE', `${label}: ${a} zulaessig, ${b} nicht.`);
      }
      // Fail-closed: unbekannte Region nur unter GLOBAL_ALLOWED.
      const region = m?.inference_region ?? d.inference_region;
      if (region.scope === 'unknown' && (el.DE_ONLY.eligible || el.EU_ONLY.eligible || el.EU_EFTA.eligible)) {
        add(f.file, 'RESIDENCY_FAIL_OPEN', `${label}: unbekannte Region ist ausserhalb GLOBAL_ALLOWED zulaessig.`);
      }
      // (a) Externe Weitergabe der Inferenz ist ausserhalb GLOBAL_ALLOWED nie zulaessig.
      if (d.external_inference_egress.value === true && (el.DE_ONLY.eligible || el.EU_ONLY.eligible || el.EU_EFTA.eligible)) {
        add(f.file, 'RESIDENCY_WITH_EGRESS', `${label}: external_inference_egress=true, trotzdem residency-zulaessig.`);
      }
      // (e) EU-Region schliesst Drittstaatenzugriff nicht aus – die Ableitung muss das als Bedingung fuehren.
      if (d.jurisdiction.third_country_access.status !== 'no_access_claimed') {
        for (const c of ['DE_ONLY', 'EU_ONLY', 'EU_EFTA'] as const) {
          if (el[c].eligible && !el[c].conditions.includes('THIRD_COUNTRY_ACCESS_NOT_EXCLUDED')) {
            add(f.file, 'THIRD_COUNTRY_INFERRED_FROM_REGION', `${label}: ${c} ohne Bedingung THIRD_COUNTRY_ACCESS_NOT_EXCLUDED.`);
          }
        }
      }
    }
  }

  for (const f of byKind<AssessmentSnapshot>(reg, 'assessment')) {
    for (const x of checkAssessmentInvariants(f.data)) add(f.file, x.code, x.message);
  }
  return { gate, ok: issues.length === 0, issues, counts: countKinds(reg) };
}

// ─── Sammellauf ─────────────────────────────────────────────────────────────

export async function runGate(gate: GateName, registryDir: string, schemaDir: string, now?: Date): Promise<GateResult> {
  switch (gate) {
    case 'parse': return gateParse(registryDir);
    case 'schema': return gateSchema(registryDir, schemaDir);
    case 'referential-integrity': return gateReferentialIntegrity(registryDir, schemaDir, now);
    case 'evidence': return gateEvidence(registryDir, schemaDir);
    case 'policy-invariants': return gatePolicyInvariants(registryDir, schemaDir);
  }
}

export async function runAllGates(registryDir: string, schemaDir: string, now?: Date): Promise<GateResult[]> {
  const out: GateResult[] = [];
  for (const g of GATES) out.push(await runGate(g, registryDir, schemaDir, now));
  return out;
}
