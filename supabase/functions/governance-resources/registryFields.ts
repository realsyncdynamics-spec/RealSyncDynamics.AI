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

// Klassifizierung (classify_asset) — dieselben Wertelisten wie die
// CHECK-Constraints auf governance_assets und src/lib/ai-act/annexCategories.ts.
export const AI_ACT_CLASSES = ['minimal', 'limited', 'high', 'prohibited', 'unknown'] as const;
export const ANNEX_III_CATEGORIES = [
  'biometrics', 'critical_infrastructure', 'education', 'employment',
  'essential_services', 'law_enforcement', 'migration', 'justice_democracy',
] as const;

export type ClassificationPatch = {
  ai_act_class?: string;
  annex_iii_category?: string | null;
  /** landet in metadata.art50 (art50Of im Frontend liest dort) */
  art50?: boolean;
};
export type ClassificationResult = { ok: true; patch: ClassificationPatch } | { ok: false; error: string };

/**
 * Liest Risikostufe, Annex-III-Kategorie und Art.-50-Pflicht. Nur vorhandene
 * Schlüssel landen im Patch; `annex_iii_category: null` leert die Kategorie.
 * Mindestens ein Feld ist Pflicht.
 */
export function parseClassificationFields(b: Record<string, unknown>): ClassificationResult {
  const patch: ClassificationPatch = {};
  if (has(b, 'ai_act_class')) {
    const v = b.ai_act_class;
    if (typeof v !== 'string' || !(AI_ACT_CLASSES as readonly string[]).includes(v)) {
      return { ok: false, error: `ai_act_class must be one of ${AI_ACT_CLASSES.join('|')}` };
    }
    patch.ai_act_class = v;
  }
  if (has(b, 'annex_iii_category')) {
    const v = optionalEnum(b.annex_iii_category, ANNEX_III_CATEGORIES);
    if (v === undefined) return { ok: false, error: `annex_iii_category must be one of ${ANNEX_III_CATEGORIES.join('|')}` };
    patch.annex_iii_category = v;
  }
  if (has(b, 'art50')) {
    if (typeof b.art50 !== 'boolean') return { ok: false, error: 'art50 must be a boolean' };
    patch.art50 = b.art50;
  }
  if (Object.keys(patch).length === 0) return { ok: false, error: 'no classification fields' };
  return { ok: true, patch };
}
