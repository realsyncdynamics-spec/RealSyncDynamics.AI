/**
 * Handoff v2 — reine Ableitungen für die App-Screens (keine I/O).
 *
 * Alles, was hier entschieden wird, stützt sich auf zwei Quellen:
 *   - `shared/enforcement-classes.ts` (Klasse, Begründung, erlaubte Verdikte)
 *   - die echten Zeilen aus `governance_assets`, `governance_policies`,
 *     `connector_registry` und `asset_control_mappings`.
 *
 * Der Prototyp rechnete mit Beispieldaten und einer Score-Formel
 * (`38 + …`). Beides ist hier bewusst nicht übernommen.
 */
import {
  ENFORCEMENT_CLASSES,
  enforcementClassOf,
  enforcementReasonOf,
  systemLabelOf,
  verdictIsHonest,
  type EnforcementClass,
  type Verdict,
} from '../../../../shared/enforcement-classes';
import type { DbGovernanceAsset, DbGovernancePolicy } from '../governanceApi';
import type { ConnectorRegistryEntry } from '../gatesApi';
import type { AiActClass, GovernancePolicyAction } from '../types';

export type { EnforcementClass, Verdict };

export const CLASS_ORDER: readonly EnforcementClass[] = ['A', 'B', 'C', 'D'] as const;

/** Reihenfolge des Verdikt-Segments aus dem Entwurf. */
export const VERDICTS: readonly Verdict[] = [
  'allow',
  'log_only',
  'warn',
  'block',
  'require_approval',
  'react',
] as const;

/** Klassenfarben (HANDOFF §6) als Token-Referenz. */
export const CLASS_COLOR_VAR: Readonly<Record<EnforcementClass, string>> = {
  A: 'var(--color-rs-success)',
  B: 'var(--color-rs-cyan)',
  C: 'var(--color-rs-warning)',
  D: 'var(--color-rs-danger)',
};

// ── KI-Systeme ──────────────────────────────────────────────────────────────

/** Asset-Typen, die im Inventar „KI-Systeme" stehen (wie bisher: ai_system). */
export function isAiSystemAsset(asset: Pick<DbGovernanceAsset, 'asset_type'>): boolean {
  return asset.asset_type === 'ai_system';
}

export type ClassSource = 'connector' | 'system_type' | 'fallback';

export interface AssetClassification {
  klasse: EnforcementClass;
  systemType: string | null;
  systemLabel: string | null;
  reason: string;
  source: ClassSource;
}

function stringField(record: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = record?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Klasse eines Assets.
 *
 * 1. Ein Connector, der auf das Asset zeigt, trägt die vom DB-Trigger
 *    abgeleitete Klasse — die ist maßgeblich.
 * 2. Sonst der Systemtyp aus `metadata.system_type` über `enforcementClassOf`.
 * 3. Fehlt beides, gilt die vorsichtige Annahme der SSoT: unbekannt ⇒ C.
 */
export function classifyAsset(
  asset: Pick<DbGovernanceAsset, 'id' | 'metadata'>,
  connectors: readonly Pick<ConnectorRegistryEntry, 'source_table' | 'source_id' | 'system_type' | 'enforcement_class'>[] = [],
): AssetClassification {
  const linked = connectors.find(
    (c) => c.source_table === 'governance_assets' && c.source_id === asset.id,
  );
  if (linked) {
    return {
      klasse: linked.enforcement_class,
      systemType: linked.system_type,
      systemLabel: systemLabelOf(linked.system_type),
      reason: enforcementReasonOf(linked.system_type),
      source: 'connector',
    };
  }
  const systemType = stringField(asset.metadata, 'system_type');
  if (systemType) {
    return {
      klasse: enforcementClassOf(systemType),
      systemType,
      systemLabel: systemLabelOf(systemType),
      reason: enforcementReasonOf(systemType),
      source: 'system_type',
    };
  }
  return {
    klasse: enforcementClassOf(''),
    systemType: null,
    systemLabel: null,
    reason: enforcementReasonOf(''),
    source: 'fallback',
  };
}

/** Zählt Klassen; jede Klasse ist immer vorhanden (0, wenn leer). */
export function classDistribution(classes: readonly EnforcementClass[]): Record<EnforcementClass, number> {
  const out: Record<EnforcementClass, number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const k of classes) out[k] += 1;
  return out;
}

/**
 * Klassen aller erfassten Systeme: KI-Assets plus Connectoren, die nicht
 * schon über ein Asset gezählt sind. Keine Zeile ⇒ leeres Array.
 */
export function classifiedSystemClasses(
  assets: readonly DbGovernanceAsset[],
  connectors: readonly ConnectorRegistryEntry[],
): EnforcementClass[] {
  const aiAssets = assets.filter(isAiSystemAsset);
  const assetIds = new Set(aiAssets.map((a) => a.id));
  const fromAssets = aiAssets.map((a) => classifyAsset(a, connectors).klasse);
  const fromConnectors = connectors
    .filter((c) => !(c.source_table === 'governance_assets' && c.source_id && assetIds.has(c.source_id)))
    .map((c) => c.enforcement_class);
  return [...fromAssets, ...fromConnectors];
}

// ── Risikostufen (EU AI Act) ────────────────────────────────────────────────

export type TierId = 'unacceptable' | 'high' | 'limited' | 'minimal';

export interface TierDefinition {
  id: TierId;
  /** Wert in `governance_assets.ai_act_class`. */
  dbValue: Exclude<AiActClass, 'unknown'>;
  colorVar: string;
  article: string;
  labelKey: 'tierUnacceptable' | 'tierHigh' | 'tierLimited' | 'tierMinimal';
}

export const TIERS: readonly TierDefinition[] = [
  { id: 'unacceptable', dbValue: 'prohibited', colorVar: 'var(--color-rs-danger)', article: 'Art. 5', labelKey: 'tierUnacceptable' },
  { id: 'high', dbValue: 'high', colorVar: 'var(--color-rs-warning)', article: 'Art. 6 · Annex III', labelKey: 'tierHigh' },
  { id: 'limited', dbValue: 'limited', colorVar: 'var(--color-rs-cyan)', article: 'Art. 50', labelKey: 'tierLimited' },
  { id: 'minimal', dbValue: 'minimal', colorVar: 'var(--color-rs-success)', article: '—', labelKey: 'tierMinimal' },
] as const;

export function tierOf(aiActClass: AiActClass | null | undefined): TierId | null {
  return TIERS.find((t) => t.dbValue === aiActClass)?.id ?? null;
}

export function tierDefinition(id: TierId): TierDefinition {
  return TIERS.find((t) => t.id === id)!;
}

export interface Obligation {
  article: string;
  de: string;
  en: string;
}

/** Pflichten je Stufe (HANDOFF §8: Art. 9/11/14/49 · Art. 50/4 · Art. 4/95 · Art. 5). */
export const OBLIGATIONS: Readonly<Record<TierId, readonly Obligation[]>> = {
  unacceptable: [
    { article: 'Art. 5', de: 'Verbotene Praxis — Einsatz einstellen', en: 'Prohibited practice — stop using it' },
  ],
  high: [
    { article: 'Art. 9', de: 'Risikomanagementsystem', en: 'Risk management system' },
    { article: 'Art. 11', de: 'Technische Dokumentation (Annex IV)', en: 'Technical documentation (Annex IV)' },
    { article: 'Art. 14', de: 'Menschliche Aufsicht', en: 'Human oversight' },
    { article: 'Art. 49', de: 'Registrierung in der EU-Datenbank', en: 'Registration in the EU database' },
  ],
  limited: [
    { article: 'Art. 50', de: 'Transparenzpflichten gegenüber Nutzenden', en: 'Transparency obligations towards users' },
    { article: 'Art. 4', de: 'KI-Kompetenz der Beschäftigten', en: 'AI literacy of staff' },
  ],
  minimal: [
    { article: 'Art. 4', de: 'KI-Kompetenz der Beschäftigten', en: 'AI literacy of staff' },
    { article: 'Art. 95', de: 'Freiwillige Verhaltenskodizes', en: 'Voluntary codes of conduct' },
  ],
};

/**
 * Art.-50-Flag, soweit hinterlegt (`metadata.art50` / `metadata.art50_transparency`).
 * `null` heißt: nicht hinterlegt — nicht „nein".
 */
export function art50Of(asset: Pick<DbGovernanceAsset, 'metadata'>): boolean | null {
  const m = asset.metadata ?? {};
  for (const key of ['art50', 'art50_transparency']) {
    const v = (m as Record<string, unknown>)[key];
    if (typeof v === 'boolean') return v;
  }
  return null;
}

// ── Policies / Verdikte ─────────────────────────────────────────────────────

const ACTION_TO_VERDICT: Readonly<Record<GovernancePolicyAction, Verdict>> = {
  allow: 'allow',
  log: 'log_only',
  warn: 'warn',
  block: 'block',
  require_approval: 'require_approval',
};

export function verdictOfAction(action: GovernancePolicyAction): Verdict {
  return ACTION_TO_VERDICT[action] ?? 'log_only';
}

export interface PolicyClassification {
  klasse: EnforcementClass;
  systemType: string | null;
  systemLabel: string | null;
  reason: string;
}

/** Klasse einer Policy über `condition.system_type`; fehlt er ⇒ vorsichtig C. */
export function classifyPolicy(policy: Pick<DbGovernancePolicy, 'condition'>): PolicyClassification {
  const systemType = stringField(policy.condition, 'system_type');
  return {
    klasse: enforcementClassOf(systemType ?? ''),
    systemType,
    systemLabel: systemType ? systemLabelOf(systemType) : null,
    reason: enforcementReasonOf(systemType ?? ''),
  };
}

export type VerdictDecision =
  | { ok: true; verdict: Verdict }
  | { ok: false; verdict: Verdict; klasse: EnforcementClass };

/** Ein Verdikt wird nur übernommen, wenn die Klasse es technisch hergibt. */
export function decideVerdict(klasse: EnforcementClass, verdict: Verdict): VerdictDecision {
  return verdictIsHonest(klasse, verdict) ? { ok: true, verdict } : { ok: false, verdict, klasse };
}

export type PolicyBucket = 'blocking' | 'observing' | 'paper';

/** Anhaltend (A/B) · Nachgelagert (C) · Nur Papier (D). */
export function bucketOfClass(klasse: EnforcementClass): PolicyBucket {
  if (ENFORCEMENT_CLASSES[klasse].kannBlockieren) return 'blocking';
  return klasse === 'D' ? 'paper' : 'observing';
}

// ── Rahmenwerke ────────────────────────────────────────────────────────────

export interface FrameworkProgress {
  framework: string;
  implemented: number;
  total: number;
  percent: number;
}

/**
 * Umsetzungsgrad je Rahmenwerk aus echten Control-Mappings.
 * `not_applicable` zählt nicht mit; ein Rahmenwerk ohne Mapping fehlt.
 */
export function frameworkProgress(
  mappings: readonly { framework: string; status: string }[],
  frameworks: readonly string[],
): FrameworkProgress[] {
  const out: FrameworkProgress[] = [];
  for (const fw of frameworks) {
    const rows = mappings.filter((m) => m.framework === fw && m.status !== 'not_applicable');
    if (rows.length === 0) continue;
    const implemented = rows.filter((m) => m.status === 'implemented').length;
    out.push({ framework: fw, implemented, total: rows.length, percent: Math.round((implemented / rows.length) * 100) });
  }
  return out;
}

/** Hash-Kurzform für Tabellen (keine erfundenen Werte: null bleibt „—"). */
export function shortHash(hash: string | null | undefined, len = 12): string {
  if (!hash) return '—';
  const clean = hash.replace(/^0x/, '');
  return clean.length <= len ? clean : `${clean.slice(0, len)}…`;
}

/** Initialen aus einer E-Mail („dominik.steiner@…" ⇒ „DS"). */
export function initialsFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const local = email.split('@')[0] ?? '';
  const parts = local.split(/[._\-+]+/).filter(Boolean);
  if (parts.length === 0) return null;
  const letters = parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : parts[0].slice(0, 2);
  return letters.toUpperCase();
}
