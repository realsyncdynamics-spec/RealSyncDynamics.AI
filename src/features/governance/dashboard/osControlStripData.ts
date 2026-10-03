/**
 * Datenquellen der OS-Kachelreihe auf `/app/dashboard` (WP4).
 *
 * Die Reihe macht fünf Dinge sichtbar: KI-Inventar, Bots/Agenten des
 * Mandanten, Residualrisiko, wartende Freigaben, Evidence-Status. Jede Zahl
 * muss auf eine echte Quelle zurückführbar sein — deshalb liegt die
 * Beschaffung hier und nicht in der Komponente, und deshalb ist jeder
 * Kachelzustand ein ausdrücklicher Wert statt eines stillen `0`.
 *
 * ## Warum ein eigener Zähler für `ai_systems`
 *
 * `useAiGovernanceData` fällt bei leerer Tabelle ODER RLS-Block auf
 * `demoAiSystems` zurück (`liveSystems.length > 0 ? liveSystems : demoAiSystems`).
 * Im Mandanten-Dashboard wäre das eine erfundene Zahl. `countAiSystems`
 * liest stattdessen direkt über RLS und **wirft** bei einem Fehler, damit
 * „nicht lesbar" nie als „keine KI-Systeme" erscheint — dieselbe Regel, die
 * `test/governance/count-helpers-throw.test.ts` für die übrigen
 * Pflicht-Zähler festschreibt.
 */

import { getSupabase } from '../../../lib/supabase';
import { countPendingApprovals } from '../approvalsApi';
import { loadGovernanceActivation } from '../../activation/activationApi';
import { countSelected, NONE_OPTION_ID } from '../../activation/aiSetupCatalog';
import { sourcesOk, type CockpitData } from '../cockpit/cockpitData';
import type { EvidenceHealth, RiskIndex } from './complianceStatus';

/**
 * Zustand einer Kachel. `value` trägt auch die 0 — die Komponente entscheidet,
 * ob eine 0 als Empty State gelesen wird. `error` ist bewusst von `value: 0`
 * getrennt: ein RLS-Fehler darf nicht aussehen wie ein leerer Mandant.
 */
export type TileState<T> =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'value'; value: T };

/**
 * Gemeinsamer Ladezustand. Bewusst eng typisiert (nicht `TileState<never>`),
 * damit die Zuweisung an `TileState<number>` & Co. nicht von der Varianz
 * eines `never`-Parameters abhängt.
 */
export const TILE_LOADING: { readonly kind: 'loading' } = { kind: 'loading' };

/** Bots/Agenten, die der Mandant im AI-OS-Setup (WP3) selbst angegeben hat. */
export interface TenantAgents {
  /** Wurde der Setup-Schritt überhaupt schon gespeichert? */
  configured: boolean;
  /** Erfasste Einträge ohne „none". */
  count: number;
  /** Mandant hat ausdrücklich „keine Bots oder Agenten geplant" gewählt. */
  declaredNone: boolean;
}

/**
 * Teillader von `loadCockpitData`, aus denen `riskIndex` entsteht
 * (`computeRiskIndex`: assetScores, newRisks24h, openIncidents, dsrOverdue).
 * Fehlt einer, ist der Index keine Messung.
 */
export const RISK_INDEX_SOURCES = ['assets', 'summary-24h', 'incidents', 'dsr'] as const;

/**
 * Teillader, aus denen `evidenceHealth` entsteht (`computeEvidenceHealth`:
 * Abdeckung aus der Posture, Gesamt-/Hash-Zahl, jüngster Nachweis, 24h).
 */
export const EVIDENCE_SOURCES = [
  'evidence-total',
  'evidence-hashed',
  'evidence-latest',
  'summary-24h',
] as const;

/** Teillader hinter `riskIndex.highRiskAssets` — eine echte Zählquelle. */
export const HIGH_RISK_ASSET_SOURCES = ['assets'] as const;

/**
 * Anzahl der KI-Systeme des Mandanten. Direkt über RLS, kein
 * Edge-Function-Hop, kein Demo-Fallback.
 *
 * Wirft bei einem Fehler: `0` bedeutet hier ausschliesslich „Tabelle für
 * diesen Mandanten leer".
 */
export async function countAiSystems(tenantId: string): Promise<number> {
  const sb = getSupabase();
  const { count, error } = await sb
    .from('ai_systems')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Bots/Agenten des Mandanten aus `governance_activations.organization.aiSetup`
 * (WP3). Ausdrücklich **nicht** aus dem globalen Agenten-Katalog (WP5): der
 * Katalog sagt, was die Plattform anbietet, nicht was dieser Mandant betreibt.
 *
 * `loadGovernanceActivation` wirft bei einem Lesefehler und liefert `null`,
 * wenn es keine Zeile gibt — beides bleibt unterscheidbar.
 */
export async function loadTenantAgents(tenantId: string): Promise<TenantAgents> {
  const record = await loadGovernanceActivation(tenantId);
  const aiSetup = record?.organization.aiSetup;
  if (!aiSetup) return { configured: false, count: 0, declaredNone: false };
  return {
    configured: true,
    count: countSelected(aiSetup.botsAgents),
    declaredNone: aiSetup.botsAgents.includes(NONE_OPTION_ID),
  };
}

/** Die drei Kacheln mit eigener Beschaffung (Cockpit-Daten kommen von aussen). */
export interface OsControlStripData {
  aiSystems: TileState<number>;
  tenantAgents: TileState<TenantAgents>;
  pendingApprovals: TileState<number>;
}

function settled<T>(result: PromiseSettledResult<T>): TileState<T> {
  if (result.status === 'fulfilled') return { kind: 'value', value: result.value };
  const reason = result.reason as unknown;
  return {
    kind: 'error',
    message: reason instanceof Error ? reason.message : String(reason),
  };
}

/**
 * Lädt die drei eigenen Quellen nebeneinander. `allSettled` wie in
 * `loadCockpitData`: ein Fehlschlag darf die anderen Kacheln nicht leeren.
 */
export async function loadOsControlStripData(tenantId: string): Promise<OsControlStripData> {
  const [aiSystems, tenantAgents, pendingApprovals] = await Promise.allSettled([
    countAiSystems(tenantId),
    loadTenantAgents(tenantId),
    countPendingApprovals(tenantId),
  ]);
  return {
    aiSystems: settled(aiSystems),
    tenantAgents: settled(tenantAgents),
    pendingApprovals: settled(pendingApprovals),
  };
}

/**
 * Risiko-Kachel aus den bereits geladenen Cockpit-Daten. Kein zweiter RPC.
 *
 * Fehlt einer der Teillader hinter `computeRiskIndex`, ist der Index keine
 * Messung — dann `error`, nicht „0 Risiko".
 */
export function riskTileFrom(
  data: CockpitData | null,
  loading: boolean,
  error: string | null,
): TileState<RiskIndex> {
  if (error) return { kind: 'error', message: error };
  if (loading || !data) return { kind: 'loading' };
  if (!sourcesOk(data, RISK_INDEX_SOURCES)) {
    return { kind: 'error', message: 'Risiko-Quellen nicht vollständig geladen' };
  }
  return { kind: 'value', value: data.riskIndex };
}

/** Evidence-Kachel aus den bereits geladenen Cockpit-Daten. */
export function evidenceTileFrom(
  data: CockpitData | null,
  loading: boolean,
  error: string | null,
): TileState<EvidenceHealth> {
  if (error) return { kind: 'error', message: error };
  if (loading || !data) return { kind: 'loading' };
  if (!sourcesOk(data, EVIDENCE_SOURCES)) {
    return { kind: 'error', message: 'Nachweis-Quellen nicht vollständig geladen' };
  }
  return { kind: 'value', value: data.evidenceHealth };
}

/**
 * Darf `riskIndex.highRiskAssets` als Anzahl gezeigt werden? Nur wenn der
 * Asset-Lader durchgelaufen ist — sonst wäre die 0 unbelegt.
 */
export function highRiskAssetsCountable(data: CockpitData | null): boolean {
  return sourcesOk(data, HIGH_RISK_ASSET_SOURCES);
}
