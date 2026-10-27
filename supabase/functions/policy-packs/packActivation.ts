/**
 * Reine Hilfsfunktionen für `policy-packs` (`op: 'activate'` / `'sync'` / `'list'`):
 *
 * 1. Idempotentes Anlegen der Standard-`governance_policies` aus `policy_rule_templates`
 *    (inkl. Fallback-Templates für Katalog-Packs ohne DB-Templates wie `dora-financial`,
 *    `fintech-compliance`, `tisax-automotive`) mit ehrlich gesetztem `condition.system_type`
 *    (`ai_gateway`, `agent_runtime` oder `siteos_publish`), damit `EnforcementPanel`
 *    und `verdictIsHonest` die Policies sauber als Klasse A/B einstufen.
 * 2. Ausführung von `computeAutoMappings` (`auto_map`) über alle vorhandenen
 *    `governance_assets` des Mandanten plus Initial-Seeding (`status: 'gap'`, `source: 'auto'`)
 *    für die Controls des aktivierten Packs, ohne bestehende `manual`-Mappings zu überschreiben.
 */

import {
  computeAutoMappings,
  type ControlRef,
  type CurrentMapping,
  type ControlStatus,
} from '../_shared/autoMap.ts';

export interface PolicyRuleTemplateRow {
  template_id: string;
  pack_id: string;
  version: number;
  name: string;
  description: string | null;
  policy_type: string;
  severity: string;
  condition: Record<string, unknown> | null;
  action: string;
  enabled_by_default: boolean;
}

export interface ExistingGovernancePolicyRow {
  id: string;
  source_template_id: string | null;
  source_pack_id: string | null;
  name: string;
  condition: Record<string, unknown> | null;
}

export interface GovernancePolicyInsertRow {
  tenant_id: string;
  name: string;
  description: string | null;
  policy_type: string;
  severity: string;
  action: string;
  enforce_action: string;
  mode: 'enforce';
  condition: Record<string, unknown>;
  enabled: boolean;
  source_pack_id: string;
  source_template_id: string;
  template_version: number;
}

/**
 * Fallback-Regelvorlagen für alle 8 Katalog-Packs, falls `policy_rule_templates`
 * in der DB für ein Pack keine Zeilen führt (z. B. `dora-financial`, `fintech-compliance`,
 * `tisax-automotive`) oder leer ist.
 */
export const FALLBACK_PACK_TEMPLATES: readonly PolicyRuleTemplateRow[] = [
  {
    template_id: 'dsgvo-art9-special-categories-block',
    pack_id: 'dsgvo-essentials',
    version: 1,
    name: 'DSGVO Art. 9 — Besondere Kategorien blockieren',
    description: 'Blockiert Prompts mit Gesundheits-, biometrischen oder anderen Art.-9-Daten an externe KI-Anbieter.',
    policy_type: 'gdpr',
    severity: 'critical',
    condition: { system_type: 'agent_runtime', event_source: 'agent_runtime', contains_special_category_pii: true },
    action: 'block',
    enabled_by_default: true,
  },
  {
    template_id: 'dsgvo-non-eu-transfer-pii-block',
    pack_id: 'dsgvo-essentials',
    version: 1,
    name: 'DSGVO Art. 44 — Drittlandtransfer mit PII blockieren',
    description: 'Verhindert die Übermittlung personenbezogener Daten an KI-Modelle außerhalb EU/EWR ohne Freigabe.',
    policy_type: 'data_transfer',
    severity: 'high',
    condition: { system_type: 'ai_gateway', contains_pii: true, vendor_region_not_in: ['EU', 'EEA'] },
    action: 'block',
    enabled_by_default: true,
  },
  {
    template_id: 'dsgvo-retention-audit-log',
    pack_id: 'dsgvo-essentials',
    version: 1,
    name: 'DSGVO Art. 5 Abs. 2 — Rechenschaftspflicht Audit-Log',
    description: 'Protokolliert alle produktiven KI-Aufrufe revisionssicher im Governance-Evidence-Log.',
    policy_type: 'logging_required',
    severity: 'medium',
    condition: { system_type: 'ai_gateway', always: true },
    action: 'log',
    enabled_by_default: true,
  },
  {
    template_id: 'eu-ai-act-art5-prohibited-block',
    pack_id: 'eu-ai-act-high-risk',
    version: 1,
    name: 'EU AI Act Art. 5 — Verbotene Praktiken blockieren',
    description: 'Blockiert KI-Systeme, die als verbotene Praktik nach Art. 5 EU AI Act klassifiziert sind.',
    policy_type: 'ai_act',
    severity: 'critical',
    condition: { system_type: 'ai_gateway', ai_act_class: 'prohibited' },
    action: 'block',
    enabled_by_default: true,
  },
  {
    template_id: 'eu-ai-act-high-risk-human-oversight',
    pack_id: 'eu-ai-act-high-risk',
    version: 1,
    name: 'EU AI Act Art. 14 — Menschliche Aufsicht bei Hochrisiko-KI',
    description: 'Erzwingt Vier-Augen-Freigabe für Entscheidungen von Hochrisiko-KI-Systemen.',
    policy_type: 'human_review',
    severity: 'high',
    condition: { system_type: 'ai_gateway', ai_act_class: 'high' },
    action: 'require_approval',
    enabled_by_default: true,
  },
  {
    template_id: 'eu-ai-act-transparency-notice',
    pack_id: 'eu-ai-act-high-risk',
    version: 1,
    name: 'EU AI Act Art. 50 — Transparenzhinweis bei Nutzerinteraktion',
    description: 'Warnt, wenn ein KI-System direkt mit Nutzern interagiert, ohne dass die Transparenzkennzeichnung aktiv ist.',
    policy_type: 'ai_act',
    severity: 'medium',
    condition: { system_type: 'ai_gateway', ai_act_class: 'limited', interacts_with_humans: true },
    action: 'warn',
    enabled_by_default: true,
  },
  {
    template_id: 'iso27001-a8-secret-in-prompt-block',
    pack_id: 'iso-27001-foundation',
    version: 1,
    name: 'ISO 27001 A.8 — Geheimnisse und API-Keys im Prompt blockieren',
    description: 'Blockiert KI-Aufrufe, die Zugangsdaten, API-Schlüssel oder vertraulichen Quellcode enthalten.',
    policy_type: 'security',
    severity: 'critical',
    condition: { system_type: 'ai_gateway', contains_secret_or_key: true },
    action: 'block',
    enabled_by_default: true,
  },
  {
    template_id: 'nis2-incident-high-severity-approval',
    pack_id: 'nis2-cybersecurity',
    version: 1,
    name: 'NIS2 Art. 21 — Kritische Risiko-Aktionen freigabepflichtig',
    description: 'Erfordert Freigabe für KI- und Automationsläufe auf Assets mit erhöhtem Sicherheitsrisiko (Score ≥ 80).',
    policy_type: 'security',
    severity: 'high',
    condition: { system_type: 'ai_gateway', risk_score_gte: 80 },
    action: 'require_approval',
    enabled_by_default: true,
  },
  {
    template_id: 'tdddg-analytics-without-consent-block',
    pack_id: 'tdddg-consent',
    version: 1,
    name: 'TDDDG § 25 — Analytics-Tracker ohne Einwilligung blockieren',
    description: 'Blockiert Website-Releases mit nicht-essentiellen Analytics-Skripten ohne dokumentierte Einwilligung.',
    policy_type: 'gdpr',
    severity: 'high',
    condition: { system_type: 'siteos_publish', consent_analytics: false, tracker_category: 'analytics' },
    action: 'block',
    enabled_by_default: true,
  },
  {
    template_id: 'tdddg-marketing-without-consent-block',
    pack_id: 'tdddg-consent',
    version: 1,
    name: 'TDDDG § 25 — Marketing-Tracker ohne Einwilligung blockieren',
    description: 'Blockiert Website-Releases mit Marketing-Pixeln ohne dokumentierte Einwilligung.',
    policy_type: 'gdpr',
    severity: 'high',
    condition: { system_type: 'siteos_publish', consent_marketing: false, tracker_category: 'marketing' },
    action: 'block',
    enabled_by_default: true,
  },
  {
    template_id: 'dora-ict-third-party-model-restriction',
    pack_id: 'dora-financial',
    version: 1,
    name: 'DORA Art. 28 — IKT-Drittparteien-Risiko bei Finanzdaten',
    description: 'Erzwingt Freigabe vor der Verarbeitung vertraulicher Finanzdaten durch externe KI-Drittanbieter.',
    policy_type: 'vendor_restriction',
    severity: 'high',
    condition: { system_type: 'ai_gateway', data_classification: 'confidential', contains_financial_data: true },
    action: 'require_approval',
    enabled_by_default: true,
  },
  {
    template_id: 'fintech-pii-financial-transfer-block',
    pack_id: 'fintech-compliance',
    version: 1,
    name: 'FinTech Kombi (DSGVO/NIS2/DORA) — Zahlungs- & Kontodaten schützen',
    description: 'Blockiert unautorisierte Übermittlung von IBAN-, Karten- oder Kundendaten an nicht freigegebene Modelle.',
    policy_type: 'data_transfer',
    severity: 'critical',
    condition: { system_type: 'ai_gateway', contains_pii: true, signals: ['iban', 'card_number'] },
    action: 'block',
    enabled_by_default: true,
  },
  {
    template_id: 'tisax-prototype-ip-protection-block',
    pack_id: 'tisax-automotive',
    version: 1,
    name: 'TISAX AL3 — Prototypen- und Konstruktionsdaten schützen',
    description: 'Blockiert die Weitergabe von Geschäftsgeheimnissen und F&E-Daten an externe KI-Dienste.',
    policy_type: 'data_transfer',
    severity: 'critical',
    condition: { system_type: 'ai_gateway', data_classification: 'confidential', contains_trade_secret: true },
    action: 'block',
    enabled_by_default: true,
  },
];

/**
 * Ergänzt `condition.system_type`, falls in einer Vorlage aus `policy_rule_templates`
 * noch kein `system_type` hinterlegt ist, damit `EnforcementPanel` und `verdictIsHonest`
 * die Durchsetzungsklasse ehrlich bestimmen können.
 */
export function inferPolicySystemType(
  packId: string,
  condition: Record<string, unknown> | null | undefined,
): string {
  const cond = condition ?? {};
  if (typeof cond.system_type === 'string' && cond.system_type.trim().length > 0) {
    return cond.system_type.trim();
  }
  if (cond.event_source === 'agent_runtime') {
    return 'agent_runtime';
  }
  if (packId === 'tdddg-consent' || typeof cond.tracker_category === 'string') {
    return 'siteos_publish';
  }
  return 'ai_gateway';
}

export function normalizeTemplateCondition(
  packId: string,
  condition: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const base = (condition && typeof condition === 'object' && !Array.isArray(condition))
    ? { ...condition }
    : {};
  if (typeof base.system_type !== 'string' || base.system_type.trim().length === 0) {
    base.system_type = inferPolicySystemType(packId, base);
  }
  return base;
}

/**
 * Berechnet idempotent, welche Standard-`governance_policies` für die aktivierten
 * Packs neu angelegt werden müssen und bei welchen bestehenden Template-Policies
 * `condition.system_type` nachgezogen werden soll.
 */
export function planPackPolicySeeding(
  tenantId: string,
  packIds: readonly string[],
  dbTemplates: readonly PolicyRuleTemplateRow[],
  existingPolicies: readonly ExistingGovernancePolicyRow[],
): {
  toInsert: GovernancePolicyInsertRow[];
  toUpgradeCondition: Array<{ id: string; condition: Record<string, unknown> }>;
} {
  const packSet = new Set(packIds.map((p) => p.trim()).filter(Boolean));
  const templatesByPack = new Map<string, PolicyRuleTemplateRow[]>();

  for (const t of dbTemplates) {
    if (!packSet.has(t.pack_id)) continue;
    const list = templatesByPack.get(t.pack_id) ?? [];
    list.push(t);
    templatesByPack.set(t.pack_id, list);
  }

  for (const packId of packSet) {
    if (!templatesByPack.has(packId) || templatesByPack.get(packId)!.length === 0) {
      const fallbacks = FALLBACK_PACK_TEMPLATES.filter((t) => t.pack_id === packId);
      if (fallbacks.length > 0) {
        templatesByPack.set(packId, [...fallbacks]);
      }
    }
  }

  const existingByTemplateId = new Set<string>();
  const existingByName = new Set<string>();
  const toUpgradeCondition: Array<{ id: string; condition: Record<string, unknown> }> = [];

  for (const ep of existingPolicies) {
    if (ep.source_template_id) existingByTemplateId.add(ep.source_template_id);
    if (ep.name) existingByName.add(ep.name);
    const cond = ep.condition && typeof ep.condition === 'object' ? ep.condition : {};
    if (
      ep.source_template_id &&
      (typeof cond.system_type !== 'string' || cond.system_type.trim().length === 0)
    ) {
      const packId = ep.source_pack_id ?? '';
      toUpgradeCondition.push({
        id: ep.id,
        condition: normalizeTemplateCondition(packId, cond),
      });
    }
  }

  const toInsert: GovernancePolicyInsertRow[] = [];
  for (const packId of packSet) {
    const templates = templatesByPack.get(packId) ?? [];
    for (const tpl of templates) {
      if (existingByTemplateId.has(tpl.template_id) || existingByName.has(tpl.name)) {
        continue;
      }
      existingByTemplateId.add(tpl.template_id);
      existingByName.add(tpl.name);
      toInsert.push({
        tenant_id: tenantId,
        name: tpl.name,
        description: tpl.description ?? null,
        policy_type: tpl.policy_type,
        severity: tpl.severity,
        action: tpl.action,
        enforce_action: tpl.action,
        mode: 'enforce',
        condition: normalizeTemplateCondition(packId, tpl.condition),
        enabled: tpl.enabled_by_default !== false,
        source_pack_id: packId,
        source_template_id: tpl.template_id,
        template_version: tpl.version ?? 1,
      });
    }
  }

  return { toInsert, toUpgradeCondition };
}

export interface TenantAssetForAutoMap {
  id: string;
  asset_type: string;
  ai_act_class: string;
  data_types: string[] | null;
}

export interface FrameworkControlRow {
  id: string;
  framework: string;
  control_code: string;
}

export interface PackControlRow {
  pack_id: string;
  framework: string;
  control_code: string;
  required?: boolean;
}

export interface ExistingAssetControlMappingRow {
  asset_id: string;
  control_id: string;
  status: ControlStatus;
  source?: string | null;
}

export interface PlannedControlMappingUpsert {
  asset_id: string;
  control_id: string;
  status: ControlStatus;
  notes: string;
  source: 'auto';
  updated_at: string;
}

/**
 * Berechnet für die vorhandenen `governance_assets` des Mandanten:
 * 1. alle `computeAutoMappings`-Ableitungen über den gesamten `framework_controls`-Katalog,
 * 2. für jedes Control der aktivierten Packs (`packControls`), das danach noch auf keinem
 *    Asset des Mandanten ein Mapping besitzt, ein initiales Mapping (`status: 'gap'`,
 *    `source: 'auto'`) auf dem primären Asset (`assets[0]`), damit `asset_control_mappings`
 *    sofort befüllt ist und `PolicyPacksView` die Pack-Controls umschaltbar anzeigt.
 *
 * Manuell gesetzte Mappings (`source: 'manual'`) werden niemals überschrieben.
 */
export function planPackControlMappings(
  assets: readonly TenantAssetForAutoMap[],
  packControls: readonly PackControlRow[],
  frameworkControls: readonly FrameworkControlRow[],
  existingMappings: readonly ExistingAssetControlMappingRow[],
  nowIso: string = new Date().toISOString(),
): PlannedControlMappingUpsert[] {
  if (assets.length === 0 || frameworkControls.length === 0) return [];

  const ctrlById = new Map<string, FrameworkControlRow>();
  const ctrlByKey = new Map<string, FrameworkControlRow>();
  for (const c of frameworkControls) {
    ctrlById.set(c.id, c);
    ctrlByKey.set(`${c.framework}:${c.control_code}`, c);
  }

  const catalog: ControlRef[] = frameworkControls.map((c) => ({
    framework: c.framework,
    control_code: c.control_code,
  }));

  const existingByAsset = new Map<string, ExistingAssetControlMappingRow[]>();
  const mappedControlIdsAcrossTenant = new Set<string>();

  for (const m of existingMappings) {
    mappedControlIdsAcrossTenant.add(m.control_id);
    const list = existingByAsset.get(m.asset_id) ?? [];
    list.push(m);
    existingByAsset.set(m.asset_id, list);
  }

  const plannedByKey = new Map<string, PlannedControlMappingUpsert>();

  // 1. Standard computeAutoMappings für jedes vorhandene Asset des Mandanten
  for (const asset of assets) {
    const assetExisting = existingByAsset.get(asset.id) ?? [];
    const current: CurrentMapping[] = [];
    for (const row of assetExisting) {
      const c = ctrlById.get(row.control_id);
      if (!c) continue;
      current.push({
        framework: c.framework,
        control_code: c.control_code,
        status: row.status,
        source: row.source === 'auto' ? 'auto' : 'manual',
      });
    }

    const proposals = computeAutoMappings(
      {
        assetType: asset.asset_type,
        aiActClass: asset.ai_act_class,
        dataTypes: Array.isArray(asset.data_types) ? asset.data_types : [],
      },
      catalog,
      current,
    );

    for (const p of proposals) {
      const ctrl = ctrlByKey.get(`${p.framework}:${p.control_code}`);
      if (!ctrl) continue;
      const key = `${asset.id}:${ctrl.id}`;
      plannedByKey.set(key, {
        asset_id: asset.id,
        control_id: ctrl.id,
        status: p.status,
        notes: p.rationale,
        source: 'auto',
        updated_at: nowIso,
      });
      mappedControlIdsAcrossTenant.add(ctrl.id);
    }
  }

  // 2. Sicherstellen, dass jedes Control des aktivierten Packs ein initiales Mapping
  //    auf dem primären Asset hat, falls weder ein bestehendes noch ein Auto-Mapping greift.
  const primaryAsset = assets[0];
  const primaryExistingIds = new Set(
    (existingByAsset.get(primaryAsset.id) ?? []).map((m) => m.control_id),
  );

  for (const pc of packControls) {
    const ctrl = ctrlByKey.get(`${pc.framework}:${pc.control_code}`);
    if (!ctrl) continue;
    if (mappedControlIdsAcrossTenant.has(ctrl.id) || primaryExistingIds.has(ctrl.id)) {
      continue;
    }
    const key = `${primaryAsset.id}:${ctrl.id}`;
    if (!plannedByKey.has(key)) {
      plannedByKey.set(key, {
        asset_id: primaryAsset.id,
        control_id: ctrl.id,
        status: 'gap',
        notes: `Policy Pack "${pc.pack_id}" aktiviert — Erstbewertung ausstehend.`,
        source: 'auto',
        updated_at: nowIso,
      });
      mappedControlIdsAcrossTenant.add(ctrl.id);
    }
  }

  return Array.from(plannedByKey.values());
}
