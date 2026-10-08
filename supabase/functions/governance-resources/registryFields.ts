// KI-Register-Felder (Auftrag §14) — Prüfung für create_asset / update_asset.
//
// Rein (keine Deno-/jsr-Importe), aus Vitest testbar. Die Wertelisten sind
// dieselben wie die CHECK-Constraints in
// 20261005130000_governance_assets_ai_registry_fields.sql und in
// src/features/governance/ai-registry/registryModel.ts
// (Parität: test/governance/ai-registry-parity.test.ts).

export const AI_SYSTEM_TYPES = ['external_ai', 'local_ai', 'agent', 'bot', 'workflow', 'browser_agent'] as const;
export const DEPLOYMENT_MODELS = ['vendor_cloud', 'own_cloud', 'on_premises', 'local_device'] as const;
export const DATA_RESIDENCIES = ['eu', 'adequacy', 'third_country', 'unknown'] as const;
/** Über update_asset setzbar; archiviert wird nur über archive_asset. */
export const EDITABLE_STATUSES = ['draft', 'active', 'under_review', 'approved'] as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Patch = Record<string, string | null>;
export type FieldsResult = { ok: true; patch: Patch } | { ok: false; error: string };

function has(b: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(b, key);
}

/** null/'' → null; sonst getrimmter String bis `max`, oder Fehler. */
function optionalText(v: unknown, max: number): string | null | undefined {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  if (t.length === 0) return null;
  return t.length <= max ? t : undefined;
}

function optionalEnum(v: unknown, allowed: readonly string[]): string | null | undefined {
  if (v === null || v === undefined || v === '') return null;
  return typeof v === 'string' && allowed.includes(v) ? v : undefined;
}

/**
 * Liest die Register-Felder aus dem Body. Nur vorhandene Schlüssel landen im
 * Patch — ein fehlender Schlüssel ändert nichts, `null` leert das Feld.
 * `update` erlaubt zusätzlich Stammdaten und Status und verlangt mindestens
 * ein Feld.
 */
export function parseRegistryFields(b: Record<string, unknown>, mode: 'create' | 'update'): FieldsResult {
  const patch: Patch = {};

  const enums: Array<[string, readonly string[]]> = [
    ['ai_system_type', AI_SYSTEM_TYPES],
    ['deployment_model', DEPLOYMENT_MODELS],
    ['data_residency', DATA_RESIDENCIES],
  ];
  for (const [key, allowed] of enums) {
    if (!has(b, key)) continue;
    const v = optionalEnum(b[key], allowed);
    if (v === undefined) return { ok: false, error: `${key} must be one of ${allowed.join('|')}` };
    patch[key] = v;
  }

  const texts: Array<[string, number]> = [['model_name', 200], ['intended_purpose', 2000]];
  if (mode === 'update') texts.push(['description', 2000], ['vendor', 200]);
  for (const [key, max] of texts) {
    if (!has(b, key)) continue;
    const v = optionalText(b[key], max);
    if (v === undefined) return { ok: false, error: `${key}: text up to ${max} characters` };
    patch[key] = v;
  }

  if (mode === 'update') {
    if (has(b, 'name')) {
      const v = optionalText(b.name, 200);
      if (!v) return { ok: false, error: 'name: 1–200 characters' };
      patch.name = v;
    }
    if (has(b, 'owner_email')) {
      const v = optionalText(b.owner_email, 254);
      if (v === undefined || (v !== null && !EMAIL.test(v))) return { ok: false, error: 'owner_email must be an e-mail address' };
      patch.owner_email = v;
    }
    if (has(b, 'status')) {
      const v = b.status;
      if (typeof v !== 'string' || !(EDITABLE_STATUSES as readonly string[]).includes(v)) {
        return { ok: false, error: `status must be one of ${EDITABLE_STATUSES.join('|')} (archive via archive_asset)` };
      }
      patch.status = v;
    }
    if (Object.keys(patch).length === 0) return { ok: false, error: 'no editable fields' };
  }

  return { ok: true, patch };
}

/**
 * Client-Metadaten ohne `system_type`: Die Durchsetzbarkeits-Klasse wird
 * abgeleitet, nie eingegeben (shared/enforcement-classes.ts). Ein
 * mitgeschickter Systemtyp wie `ai_gateway` hätte sonst für ein von Hand
 * erfasstes System „Inline — anhaltbar" behauptet.
 */
export function sanitizeAssetMetadata(meta: unknown): Record<string, unknown> {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {};
  const { system_type: _ignored, ...rest } = meta as Record<string, unknown>;
  return rest;
}
