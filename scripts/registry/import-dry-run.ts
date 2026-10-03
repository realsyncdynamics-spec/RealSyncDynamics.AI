// Import-Pfad (Trockenlauf): Registry-Dateien -> Zeilen der globalen
// Registry-Tabellen (Migration 20260926020000_vendor_deployment_registry.sql).
//
// Schreibt NICHTS: kein DB-Zugriff, keine Netzwerkaufrufe. Erst laufen alle
// Gates; nur wenn sie gruen sind, wird der Plan gebaut. Ein spaeterer
// Import-Job (service_role, eigener PR) fuehrt genau diese Zeilen per
// UPSERT aus. Die Zuordnung Datei-Feld -> Spalte ist in registry/README.md
// dokumentiert.
//
//   npm run registry:import:dry-run            Zusammenfassung
//   npm run registry:import:dry-run -- --json  kompletter Plan als JSON

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Certification, DeploymentFile, VendorFile } from '../../supabase/functions/_shared/registry/types.ts';
import { loadRegistry, runAllGates, type GateResult } from './lib.ts';

export interface ImportPlan {
  ok: boolean;
  gates: GateResult[];
  tables: {
    registry_vendors: Record<string, unknown>[];
    registry_deployments: Record<string, unknown>[];
    registry_models: Record<string, unknown>[];
    registry_certifications: Record<string, unknown>[];
    registry_claims: Record<string, unknown>[];
  };
}

/** Spalten, die es in den Registry-Tabellen bewusst NICHT gibt. */
export const FORBIDDEN_COLUMNS = ['result', 'routing_allowed', 'routing_eligible', 'cloud_act_safe', 'assessment_result', 'status_color', 'ui_color'];

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

function certRow(c: Certification, vendorId: string, deploymentId: string | null) {
  return {
    owner_kind: deploymentId ? 'deployment' : 'vendor',
    vendor_id: vendorId,
    deployment_id: deploymentId,
    cert_id: c.cert_id,
    scheme: c.scheme,
    name: c.name,
    scope: c.scope,
    applies_to_sku: c.applies_to_sku,
    status: c.status,
    sources: c.sources,
    captured_at: c.captured_at,
    valid_from: c.valid_from,
    valid_until: c.valid_until,
    verification: c.verification ?? null,
    note: c.note ?? null,
  };
}

export async function buildImportPlan(registryDir: string, schemaDir: string): Promise<ImportPlan> {
  const gates = await runAllGates(registryDir, schemaDir);
  const empty: ImportPlan['tables'] = { registry_vendors: [], registry_deployments: [], registry_models: [], registry_certifications: [], registry_claims: [] };
  if (!gates.every((g) => g.ok)) return { ok: false, gates, tables: empty };

  const reg = loadRegistry(registryDir);
  const tables = empty;
  const meta = (file: string) => ({ source_file: `registry/${file}`, source_sha256: sha256(readFileSync(join(registryDir, file), 'utf8')) });

  for (const f of reg.files) {
    if (f.kind === 'vendor') {
      const v = f.data as VendorFile;
      tables.registry_vendors.push({
        vendor_id: v.vendor_id,
        display_name: v.display_name,
        legal_name: v.legal_name.value,
        legal_name_status: v.legal_name.status,
        legal_seat_country: v.legal_seat_country.value,
        brands: v.brands,
        control_change_status: v.control_change.status,
        facts: v,
        schema_version: v.schema_version,
        ...meta(f.file),
      });
      for (const c of v.certifications) tables.registry_certifications.push(certRow(c, v.vendor_id, null));
    }
    if (f.kind === 'deployment') {
      const d = f.data as DeploymentFile;
      const seal = d.jurisdiction.eu_commission_seal;
      const tca = d.jurisdiction.third_country_access;
      tables.registry_deployments.push({
        deployment_id: d.deployment_id,
        vendor_id: d.vendor_id,
        brand: d.brand,
        product_name: d.product_name,
        product_sku: d.product_sku,
        deployment_kind: d.deployment_kind,
        listing_status: d.listing_status,
        connector_type: d.connector.connector_type,
        api_base_url: d.connector.api_base_url,
        inference_region_scope: d.inference_region.scope,
        inference_country_codes: d.inference_region.country_codes,
        inference_region_code: d.inference_region.provider_region_code,
        inference_region_status: d.inference_region.status,
        external_inference_egress: d.external_inference_egress.value,
        external_inference_egress_status: d.external_inference_egress.status,
        third_country_access_status: tca.status,
        third_country_requires_review: tca.requires_subprocessor_review,
        eu_commission_seal_status: seal.status,
        eu_commission_seal_level: seal.level,
        eu_commission_seal_applies_to_sku: seal.applies_to_sku,
        pricing_scheme: d.pricing.scheme,
        capabilities: d.capabilities,
        pricing: d.pricing,
        jurisdiction: d.jurisdiction,
        facts: d,
        schema_version: d.schema_version,
        ...meta(f.file),
      });
      for (const m of d.models) {
        tables.registry_models.push({
          deployment_id: d.deployment_id,
          model_id: m.model_id,
          api_model_id: m.api_model_id,
          display_name: m.display_name,
          model_type: m.model_type,
          availability: m.availability.value,
          inference_region_scope: m.inference_region?.scope ?? null,
          inference_country_codes: m.inference_region?.country_codes ?? null,
          price_category: m.price_category?.value ?? null,
          price: m.price ?? null,
          capabilities: m.capabilities,
          facts: m,
        });
      }
      for (const c of d.certifications) tables.registry_certifications.push(certRow(c, d.vendor_id, d.deployment_id));
      for (const c of d.claims) {
        tables.registry_claims.push({
          deployment_id: d.deployment_id,
          claim_id: c.claim_id,
          claim_type: c.claim_type,
          model_ids: c.subject.model_ids,
          value: c.value,
          statement: c.statement,
          status: c.status,
          sources: c.sources,
          captured_at: c.captured_at,
          verification: c.verification ?? null,
          note: c.note ?? null,
        });
      }
    }
  }
  return { ok: true, gates, tables };
}

async function main(): Promise<number> {
  const argv = process.argv;
  const i = argv.indexOf('--dir');
  const dir = resolve(i === -1 ? 'registry' : argv[i + 1]!);
  const plan = await buildImportPlan(dir, join(dir, 'schema'));
  if (argv.includes('--json')) {
    console.log(JSON.stringify(plan.tables, null, 2));
  } else {
    console.log(`[registry:import:dry-run] ${plan.ok ? 'OK' : 'ABGEBROCHEN (Gates rot)'} – es wird nichts geschrieben.`);
    for (const [t, rows] of Object.entries(plan.tables)) console.log(`  ${t}: ${rows.length} Zeile(n)`);
    for (const g of plan.gates.filter((x) => !x.ok)) for (const is of g.issues) console.log(`  ✗ [${g.gate}] ${is.file} [${is.code}] ${is.message}`);
  }
  return plan.ok ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().then((c) => process.exit(c), (e) => { console.error(e); process.exit(2); });
}
