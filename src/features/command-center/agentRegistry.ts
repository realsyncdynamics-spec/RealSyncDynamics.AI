/**
 * M1-a Command Center — Agentenregister (Domänenlogik, rein & testbar).
 *
 * Grundregel: Ein Status wird nur angezeigt, wenn er aus einer belegten
 * Quelle stammt. Alles andere ist 'unknown' (UNBEKANNT).
 */

export type AgentStatus =
  | 'active'
  | 'working'
  | 'waiting'
  | 'blocked'
  | 'error'
  | 'offline'
  | 'unknown';

export const STATUS_LABEL: Record<AgentStatus, string> = {
  active: 'AKTIV',
  working: 'ARBEITET',
  waiting: 'WARTET',
  blocked: 'BLOCKIERT',
  error: 'FEHLER',
  offline: 'OFFLINE',
  unknown: 'UNBEKANNT',
};

export type AgentSource = 'autonomous_agents' | 'agent_profiles' | 'runtime_static' | 'grok_soll';

export interface RegistryAgent {
  registryId: string;
  source: AgentSource;
  name: string;
  agentType: string;
  description: string | null;
  project: string | null;
  priority: 'P0' | 'P1' | 'P2' | 'P3' | null;
  status: AgentStatus;
  /** Woher der Status stammt; 'none' = nicht belegt. */
  statusSource: string;
  lastActivityAt: string | null;
  currentTask: string | null;
  lastError: string | null;
  /** Offene Entscheidungen — Datenquelle folgt in M2; bis dahin null (= unbekannt). */
  openDecisions: number | null;
}

/** Zeile aus public.agent_registry_v. */
export interface AgentRegistryRow {
  registry_id: string;
  source: string;
  name: string;
  agent_type: string;
  description: string | null;
  status: string | null;
  status_source: string | null;
  last_activity_at: string | null;
  current_run_id: string | null;
  current_run_status: string | null;
  last_error: string | null;
}

import { listAgents } from '../../../apps/agent-runtime/src/agent-registry';

/** Filterwert für „Feld nicht gesetzt“ (Projekt/Priorität ohne Soll-Wert). */
export const UNSET = '__unset__';

/**
 * Soll-Konfiguration für Projekt und Priorität (manuell gepflegt, keine
 * Live-Daten). Priorität ist bewusst leer, bis Dominik sie festlegt —
 * nichts wird erfunden. Schlüssel = registryId.
 */
export const SOLL_CONFIG: Readonly<Record<string, { project?: string; priority?: RegistryAgent['priority'] }>> = {};

const DEFAULT_PROJECT_BY_SOURCE: Partial<Record<AgentSource, string>> = {
  grok_soll: 'RealSyncDynamics.AI',
  runtime_static: 'Governance Runtime',
};

/** Wendet Soll-Projekt/-Priorität an; überschreibt niemals Status oder Laufzeitdaten. */
export function applySoll(a: RegistryAgent): RegistryAgent {
  const soll = SOLL_CONFIG[a.registryId];
  return {
    ...a,
    project: soll?.project ?? a.project ?? DEFAULT_PROJECT_BY_SOURCE[a.source] ?? null,
    priority: soll?.priority ?? a.priority ?? null,
  };
}

/**
 * Statische Agenten aus apps/agent-runtime (Code-Registry). Keine Laufzeit-
 * Telemetrie an dieser Stelle → Status immer 'unknown'.
 */
export function runtimeStaticAgents(): RegistryAgent[] {
  return listAgents().map((a) => ({
    registryId: `runtime:${a.id}`,
    source: 'runtime_static' as const,
    name: a.name,
    agentType: a.type,
    description: `Risiko ${a.riskLevel}${a.requiresHumanReview ? ' · Human Review' : ''} · Tools: ${a.tools.join(', ')}`,
    project: null,
    priority: null,
    status: 'unknown' as const,
    statusSource: 'none',
    lastActivityAt: null,
    currentTask: null,
    lastError: null,
    openDecisions: null,
  }));
}

const KNOWN: ReadonlySet<string> = new Set(Object.keys(STATUS_LABEL));

export function normalizeStatus(raw: string | null | undefined, statusSource: string | null | undefined): AgentStatus {
  if (!raw || !statusSource || statusSource === 'none') {
    // Ohne belegte Quelle ist nur 'offline' (aus enabled=false) zulässig.
    return raw === 'offline' ? 'offline' : 'unknown';
  }
  return KNOWN.has(raw) ? (raw as AgentStatus) : 'unknown';
}

export function fromRow(row: AgentRegistryRow): RegistryAgent {
  const source: AgentSource = row.source === 'agent_profiles' ? 'agent_profiles' : 'autonomous_agents';
  return {
    registryId: row.registry_id,
    source,
    name: row.name,
    agentType: row.agent_type,
    description: row.description,
    project: null,
    priority: null,
    status: normalizeStatus(row.status, row.status_source),
    statusSource: row.status_source ?? 'none',
    lastActivityAt: row.last_activity_at,
    currentTask: row.current_run_id ? `Run ${row.current_run_id.slice(0, 8)} (${row.current_run_status ?? '?'})` : null,
    lastError: row.last_error,
    openDecisions: null,
  };
}

/**
 * Grok-Bots: Soll-Konfiguration (manuell gepflegt). Es gibt keine geprüfte
 * Admin-/Status-API für Grok-Bots im Repo — daher IMMER 'unknown',
 * nie ein simulierter Live-Status.
 */
export const GROK_SOLL_AGENTS: ReadonlyArray<RegistryAgent> = [
  ['grok-master', 'Grok Master Orchestrator', 'Strategie & Orchestrierung'],
  ['rsd-frontend', 'RSD Frontend', 'Frontend-Entwicklung'],
  ['rsd-backend', 'RSD Backend', 'Backend, Supabase, Edge Functions'],
  ['github-bot', 'Git Hub Bot', 'PRs, Reviews, CI'],
  ['claudecode-bot', 'ClaudeCode Bot', 'Implementierung & Tests'],
  ['cloudflare-manager', 'Claudeflare Manager', 'Hosting & Infrastruktur'],
  ['rsd-dashboard', 'RSD Dashboard', 'Status & Reporting'],
  ['monetization', 'Monetisierung/Stripe', 'Billing & Preise'],
].map(([id, name, role]) => ({
  registryId: `grok:${id}`,
  source: 'grok_soll' as const,
  name,
  agentType: 'grok-bot',
  description: role,
  project: 'RealSyncDynamics.AI',
  priority: null,
  status: 'unknown' as const,
  statusSource: 'none',
  lastActivityAt: null,
  currentTask: null,
  lastError: null,
  openDecisions: null,
}));

export interface AgentFilter {
  query: string;
  type: string | 'all';
  project: string | 'all';
  priority: string | 'all';
  status: AgentStatus | 'all';
  onlyOpenDecisions: boolean;
}

export const EMPTY_FILTER: AgentFilter = {
  query: '', type: 'all', project: 'all', priority: 'all', status: 'all', onlyOpenDecisions: false,
};

export function filterAgents(agents: ReadonlyArray<RegistryAgent>, f: AgentFilter): RegistryAgent[] {
  const q = f.query.trim().toLowerCase();
  return agents.filter((a) => {
    if (q && !`${a.name} ${a.description ?? ''} ${a.agentType}`.toLowerCase().includes(q)) return false;
    if (f.type !== 'all' && a.agentType !== f.type) return false;
    if (f.project !== 'all' && (f.project === UNSET ? a.project !== null : a.project !== f.project)) return false;
    if (f.priority !== 'all' && (f.priority === UNSET ? a.priority !== null : a.priority !== f.priority)) return false;
    if (f.status !== 'all' && a.status !== f.status) return false;
    // Unbekannte Anzahl (null) zählt NICHT als "hat offene Entscheidungen".
    if (f.onlyOpenDecisions && !(a.openDecisions && a.openDecisions > 0)) return false;
    return true;
  });
}

export function distinct(agents: ReadonlyArray<RegistryAgent>, key: 'agentType' | 'project' | 'priority'): string[] {
  return [...new Set(agents.map((a) => a[key]).filter((v): v is string => Boolean(v)))].sort();
}
