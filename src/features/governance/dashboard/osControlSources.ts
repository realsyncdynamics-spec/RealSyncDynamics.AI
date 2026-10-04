/**
 * WP4 — Quellen und Kachelmodelle der OS-Kachelreihe im Command Center
 * (/app/dashboard). Reine Ableitung, keine Schätzung, kein Demo-Fallback.
 *
 * Mandantenbezug: jede Abfrage filtert auf die übergebene `activeTenantId`
 * (aus TenantProvider: JWT → memberships). RLS bleibt die Autorität; bei
 * Mehrfach-Mitgliedschaft wird nie über alle Mandanten gezählt.
 *
 * Quellen je Kachel:
 * - KI-Inventar      → `ai_systems` (count, RLS „ai_systems tenant_read“) über
 *                      countTenantAiSystems — NICHT useAiGovernanceData (Demo-Fallback).
 * - Bots/Agenten     → `governance_activations.organization.aiSetup.botsAgents` (WP3,
 *                      Selbstauskunft). Der WP5-Katalog ist keine Mandantenzahl.
 * - Residualrisiko   → CockpitData.riskIndex (gewichteter Index 0–100, keine Anzahl);
 *                      Anzahl nur aus `ai_act_risk_inventory` (countRiskInventory).
 * - Wartende Freigaben → CockpitData.counts.approvals (countPendingApprovals:
 *                      `governance_approvals.status = 'pending'`).
 * - Evidence-Status  → CockpitData.evidenceHealth.
 *
 * Ein Fehler einer Quelle blockiert die anderen nicht (allSettled wie cockpitData).
 */
import { getSupabase } from '../../../lib/supabase';
import { loadGovernanceActivation, type GovernanceActivationRecord } from '../../activation/activationApi';
import { BOT_AGENT_OPTIONS, NONE_OPTION_ID, countSelected } from '../../activation/aiSetupCatalog';
import { countRiskInventory } from '../aiActRiskInventoryApi';
import { sourcesOk, type CockpitData } from '../cockpit/cockpitData';
import { settled, type LoadState } from '../handoff/useTenantLoad';

/**
 * Anzahl der KI-Systeme des Mandanten in `ai_systems`.
 * `0` = leer, Wurf = Fehler. Kein Fallback auf Demo-Daten.
 */
export async function countTenantAiSystems(tenantId: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from('ai_systems')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);
  if (error) throw new Error(error.message || 'ai_systems count fehlgeschlagen');
  return count ?? 0;
}

/** countRiskInventory liefert bei Fehler `null` — hier als Wurf für allSettled. */
async function countRiskInventoryOrThrow(tenantId: string) {
  const result = await countRiskInventory(tenantId);
  if (result === null) throw new Error('ai_act_risk_inventory nicht lesbar');
  return result;
}

export interface OsControlSources {
  /** `null` nur bei Fehler (siehe `failures`). */
  aiSystems: number | null;
  /** `null` = kein Activation-Datensatz ODER Fehler (siehe `failures`). */
  activation: GovernanceActivationRecord | null;
  /** `null` nur bei Fehler (siehe `failures`). */
  riskInventory: { total: number; high_risk: number } | null;
  failures: string[];
}

export async function loadOsControlSources(tenantId: string): Promise<OsControlSources> {
  const [aiSystemsR, activationR, riskInventoryR] = await Promise.allSettled([
    countTenantAiSystems(tenantId),
    loadGovernanceActivation(tenantId),
    countRiskInventoryOrThrow(tenantId),
  ]);
  const failures: string[] = [];
  return {
    aiSystems: settled<number | null>(aiSystemsR, null, 'ai-systems', failures),
    activation: settled(activationR, null, 'activation', failures),
    riskInventory: settled<OsControlSources['riskInventory']>(riskInventoryR, null, 'risk-inventory', failures),
    failures,
  };
}

/** Teillader aus loadCockpitData, auf denen riskIndex beruht. */
export const RISK_INDEX_SOURCES = ['assets', 'incidents', 'dsr', 'summary-24h'] as const;
/** Teillader aus loadCockpitData, auf denen evidenceHealth beruht. */
export const EVIDENCE_SOURCES = ['evidence-total', 'evidence-hashed', 'evidence-latest'] as const;

export type OsTileId = 'inventory' | 'agents' | 'risk' | 'approvals' | 'evidence';

export type OsTileState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'empty'; message: string }
  /** `value: null` = Quelle geladen, aber noch kein belastbarer Wert (z. B. zu wenig Nachweise). */
  | { kind: 'data'; value: number | null; unit?: string; detail: string | null };

export interface OsTileModel {
  id: OsTileId;
  label: string;
  /** Quelle in Klartext — jede Zahl ist darauf rückführbar. */
  source: string;
  state: OsTileState;
  /** Zusätzliche, echte Zählungen (z. B. AI-Act-Inventar unter dem Index). */
  facts: string[];
  to: string;
  linkLabel: string;
  /** Separat beschrifteter Zusatzlink (z. B. Agenten-Katalog — keine Mandantenzahl). */
  extraLink?: { label: string; to: string };
}

export interface CockpitInput {
  data: CockpitData | null;
  loading: boolean;
  error: string | null;
}

const LOADING: OsTileState = { kind: 'loading' };

function has(sources: OsControlSources, name: string): boolean {
  return !sources.failures.some((failure) => failure.startsWith(`${name}:`));
}

function sourcesState(state: LoadState<OsControlSources>): OsControlSources | OsTileState {
  if (state.status === 'ready') return state.data;
  if (state.status === 'error') return { kind: 'error', message: 'Quelle nicht ladbar' };
  return LOADING;
}

function isTileState(value: OsControlSources | OsTileState): value is OsTileState {
  return 'kind' in value;
}

/** Cockpit-Zustand für Kacheln aus loadCockpitData; `null` = Daten bereit. */
function cockpitState(cockpit: CockpitInput, names: readonly string[], errorMessage: string): OsTileState | null {
  if (cockpit.error) return { kind: 'error', message: errorMessage };
  if (!cockpit.data) return LOADING;
  if (!sourcesOk(cockpit.data, names)) return { kind: 'error', message: errorMessage };
  return null;
}

export function inventoryTile(state: LoadState<OsControlSources>): OsTileModel {
  const base = {
    id: 'inventory' as const,
    label: 'KI-Inventar',
    source: 'Quelle: ai_systems (Mandant)',
    facts: [],
  };
  const sources = sourcesState(state);
  if (isTileState(sources)) return { ...base, state: sources, to: '/app/ai-systems', linkLabel: 'KI-Systeme' };
  if (!has(sources, 'ai-systems') || sources.aiSystems === null) {
    return { ...base, state: { kind: 'error', message: 'KI-Inventar nicht ladbar' }, to: '/app/ai-systems', linkLabel: 'KI-Systeme' };
  }
  if (sources.aiSystems === 0) {
    return {
      ...base,
      state: { kind: 'empty', message: 'Noch keine KI-Systeme erfasst' },
      to: '/app/activation',
      linkLabel: 'Im AI-OS-Setup erfassen',
    };
  }
  return {
    ...base,
    state: { kind: 'data', value: sources.aiSystems, detail: 'Einträge im KI-System-Register' },
    to: '/app/ai-systems',
    linkLabel: 'KI-Systeme',
  };
}

const BOT_AGENT_LABEL = new Map<string, string>(BOT_AGENT_OPTIONS.map((o) => [o.id, o.label]));

export function agentsTile(state: LoadState<OsControlSources>): OsTileModel {
  const base = {
    id: 'agents' as const,
    label: 'Bots/Agenten des Mandanten',
    source: 'Quelle: AI-OS-Setup (Selbstauskunft)',
    facts: [],
    to: '/app/activation',
    // WP5-Katalog: was die Plattform anbietet — nie als Mandantenzahl.
    extraLink: { label: 'Verfügbare Agenten', to: '/app/ai-systems/agents' },
  };
  const sources = sourcesState(state);
  if (isTileState(sources)) return { ...base, state: sources, linkLabel: 'AI-OS-Setup' };
  if (!has(sources, 'activation')) {
    return { ...base, state: { kind: 'error', message: 'AI-OS-Setup nicht ladbar' }, linkLabel: 'AI-OS-Setup' };
  }
  const botsAgents = sources.activation?.organization.aiSetup?.botsAgents;
  if (!botsAgents) {
    return {
      ...base,
      state: { kind: 'empty', message: 'AI-OS-Setup noch nicht ausgefüllt' },
      linkLabel: 'Bots/Agenten erfassen',
    };
  }
  if (botsAgents.includes(NONE_OPTION_ID)) {
    return {
      ...base,
      state: { kind: 'empty', message: 'Laut AI-OS-Setup keine Bots oder Agenten geplant' },
      linkLabel: 'AI-OS-Setup prüfen',
    };
  }
  const count = countSelected(botsAgents);
  if (count === 0) {
    return {
      ...base,
      state: { kind: 'empty', message: 'Noch keine Bots oder Agenten erfasst' },
      linkLabel: 'Bots/Agenten erfassen',
    };
  }
  const labels = botsAgents.map((id) => BOT_AGENT_LABEL.get(id) ?? id);
  const shown = labels.slice(0, 2).join(', ');
  const rest = labels.length - 2;
  return {
    ...base,
    state: { kind: 'data', value: count, detail: rest > 0 ? `${shown} +${rest}` : shown },
    linkLabel: 'AI-OS-Setup',
  };
}

function riskInventoryFact(state: LoadState<OsControlSources>): string[] {
  if (state.status !== 'ready') return [];
  const sources = state.data;
  if (!has(sources, 'risk-inventory') || sources.riskInventory === null) {
    return ['AI-Act-Inventar nicht ladbar'];
  }
  const { total, high_risk } = sources.riskInventory;
  if (total === 0) return ['AI-Act-Inventar: keine Einträge'];
  return [`AI-Act-Inventar: ${high_risk} von ${total} Einträgen hoch/verboten`];
}

export function riskTile(cockpit: CockpitInput, state: LoadState<OsControlSources>): OsTileModel {
  const base = {
    id: 'risk' as const,
    label: 'Residualrisiko (Index 0–100)',
    source: 'Quelle: Cockpit-Risikoindex (gewichtet, keine Anzahl)',
    facts: riskInventoryFact(state),
    to: '/app/risk-inventory',
    linkLabel: 'Risiko-Inventar',
  };
  const pending = cockpitState(cockpit, RISK_INDEX_SOURCES, 'Risikoindex nicht vollständig ladbar');
  if (pending) return { ...base, state: pending };
  const risk = cockpit.data!.riskIndex;
  if (risk.score === null) {
    return { ...base, state: { kind: 'empty', message: 'Noch keine Assets oder Vorfälle — kein Index' } };
  }
  return { ...base, state: { kind: 'data', value: risk.score, unit: '/100', detail: risk.label } };
}

export function approvalsTile(cockpit: CockpitInput): OsTileModel {
  const base = {
    id: 'approvals' as const,
    label: 'Wartende Freigaben',
    source: "Quelle: governance_approvals (status 'pending')",
    facts: [],
    to: '/app/approvals',
    linkLabel: 'Freigaben',
  };
  const pending = cockpitState(cockpit, ['approvals'], 'Freigaben nicht ladbar');
  if (pending) return { ...base, state: pending };
  const count = cockpit.data!.counts.approvals;
  if (count === 0) return { ...base, state: { kind: 'empty', message: 'Keine Freigaben offen' } };
  return { ...base, state: { kind: 'data', value: count, detail: 'warten auf menschliche Entscheidung' } };
}

export function evidenceTile(cockpit: CockpitInput): OsTileModel {
  const base = {
    id: 'evidence' as const,
    label: 'Evidence-Status',
    source: 'Quelle: Evidence-Health (Cockpit)',
    to: '/app/evidence',
    linkLabel: 'Evidence',
  };
  const pending = cockpitState(cockpit, EVIDENCE_SOURCES, 'Evidence nicht ladbar');
  if (pending) return { ...base, facts: [], state: pending };
  const health = cockpit.data!.evidenceHealth;
  if (health.totalCount === 0) {
    return { ...base, facts: [], state: { kind: 'empty', message: 'Noch keine Nachweise' } };
  }
  return {
    ...base,
    facts: [`${health.hashedCount} von ${health.totalCount} Nachweisen gehasht`],
    state: {
      kind: 'data',
      value: health.percent,
      unit: health.percent === null ? undefined : '%',
      detail: health.label,
    },
  };
}

/** Fünf Kacheln in fester Reihenfolge. */
export function buildOsTiles(cockpit: CockpitInput, state: LoadState<OsControlSources>): OsTileModel[] {
  return [
    inventoryTile(state),
    agentsTile(state),
    riskTile(cockpit, state),
    approvalsTile(cockpit),
    evidenceTile(cockpit),
  ];
}
