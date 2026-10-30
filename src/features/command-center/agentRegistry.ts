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
  /** Nur grok_soll: zugeordnete echte Grok-Bot-IDs (Soll-Ist-Abgleich 30.10.2026). */
  mappedBotIds?: ReadonlyArray<string>;
}

/** Anzeige-Abschnitt im Command Center. */
export type AgentSection = 'grok_bots' | 'product_agents';

export const SECTION_LABEL: Record<AgentSection, string> = {
  grok_bots: 'Grok-Bots',
  product_agents: 'Produkt-Agenten',
};

/** Grok-Soll → „Grok-Bots“; Runtime-Code und DB-Profile → „Produkt-Agenten“. */
export function sectionOf(a: Pick<RegistryAgent, 'source'>): AgentSection {
  return a.source === 'grok_soll' ? 'grok_bots' : 'product_agents';
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
export const SOLL_CONFIG: Readonly<Record<string, { project?: string; priority?: RegistryAgent['priority'] }>> = {
  // Prioritäten laut Entscheidungspaket Dominik (30.10.2026).
  'grok:infra-manager': { priority: 'P0' },
  'grok:rsd-frontend': { priority: 'P0' },
  'grok:rsd-backend': { priority: 'P0' },
  'grok:monetization': { priority: 'P1' },
  'grok:cloudflare-manager': { priority: 'P1' },
  'grok:marketing-social': { priority: 'P2' },
  'grok:dsgvo-check': { priority: 'P2' },
};

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
/**
 * Mapping Soll-Karte → echte Grok-Bot-IDs (Soll-Ist-Abgleich 30.10.2026,
 * Entscheidungspaket Dominik). Gruppen/Räume (adb041be, 2e04fda9, 52d75e55)
 * werden bewusst NICHT als Agent angezeigt.
 *
 * Später (nur nach Go Dominik, nicht Teil dieses Codes):
 * - Bot 273579fb „Dashboard“ (leer) ist Duplikat von RSD Dashboard 5d002d07 → später archivieren.
 * - Grok Master Orchestrator 949611b4 hat im Bot selbst noch keine Beschreibung;
 *   die Rollenbeschreibung unten ist nur Soll.
 */
const GROK_SOLL_DEFS: ReadonlyArray<readonly [id: string, name: string, role: string, botIds: readonly string[]]> = [
  ['infra-manager', 'INFRASTRUKTUR MANAGER', 'Operativer Orchestrator für FE/BE/Stripe/Dashboard', ['202942d8-e3b8-4c62-abba-6e3766514cbc']],
  ['grok-master', 'Grok Master Orchestrator', 'Strategie & Priorisierung (Soll-Rolle; Bot-Beschreibung noch leer)', ['949611b4-aae5-4e31-a04d-434c3aa88ac0']],
  ['co-ceo-manager', 'CO/CEO Manager', 'Control Center: Register, Entscheidungen, Governance', ['cf19cd96-f6df-43d2-9fe9-bbb1024cb9da']],
  ['rsd-frontend', 'RSD Frontend', 'Frontend-Entwicklung', ['0b1f98f8-82f8-4d5f-807e-28424dead719']],
  ['rsd-backend', 'RSD Backend', 'Backend, Supabase, Edge Functions', ['3a70a151-7159-4245-afb2-12f56ccc3341']],
  ['github-bot', 'Git Hub Bot', 'PRs, Reviews, CI', ['583b4c6f-a1a0-4c87-9bd7-485054d21cae', '7cc5d0b7-7729-41be-a82e-259f4818424d']],
  ['claudecode-bot', 'ClaudeCode Bot', 'Implementierung & Tests', ['e90386f9-981a-4143-87e7-36e2ca6e14fd', 'd15e9d2d-37b1-4189-9196-79ec7d7554c8']],
  ['cloudflare-manager', 'Claudeflare Manager', 'Hosting & Infrastruktur', ['49abd938-c283-44e8-8d81-f48fa94ecc23']],
  ['hostinger-manager', 'Hostinger Manager', 'Hostinger-Hosting, Domains, DNS', ['b04a9796-4095-4176-9a0f-2cebcb6a8588']],
  ['rsd-dashboard', 'RSD Dashboard', 'Status & Reporting', ['5d002d07-c7c4-4f0f-87a7-5414262c872e']],
  ['monetization', 'Monetisierung/Stripe', 'Billing & Preise (Stripe-Live nur mit Go)', ['46fb80dd-3749-4de4-b4dd-0aaac490c3e0', 'a11acbf7-be30-406c-9c29-1f89980408e6', '5e325d40-4ca7-4366-8187-436f38f5d8b7']],
  ['marketing-social', 'Marketing/Social', 'X, LinkedIn, YouTube, Instagram, TikTok, Kropa', [
    '66b847e3-1cf4-4e5e-bd1e-e94c5c66f877', // X Bot
    '6d07cc73-7b53-44bb-89f1-53f22a844546', // LinkedIn Bot
    '94f76828-141c-4a21-a3fe-4299c1c7a16b', // YouTube Bot
    'b700a409-984b-4b0a-9b29-fedf52128a30', // Instagram Bot
    'c795a288-1b3f-4e90-a42e-b2fa27f35f17', // TikTok Bot
    '1ace6b18-c4db-4493-a155-39b396d3f07d', // Kropa
    'c28809b4-e217-4f7e-ae0a-444a235be323', // Sozial Media Manager (leer)
    '29a70fc3-c850-48fc-9c50-37dee25e0bee', // Promotion MANAGER (leer)
    'a807fcde-9bc7-46ee-bdfa-dce45c1a7532', // Facebook Bot (leer)
    '6c35210c-cebe-4ea7-af54-c70d293ddaab', // YouTubeChannel (leer, Duplikat YouTube Bot)
  ]],
  ['dsgvo-check', 'DSGVO Check Bot', 'Datenschutz-Prüfungen', ['a468c3cc-9439-4658-947a-a48393b75aae']],
  ['vertical-voice', 'Vertical Voice Agent', 'Voice-Agent (Bot); Produkt-Voice „Nora“ separat', ['fa780edc-a2ce-47b5-819a-a60de3a3de56']],
];

export const GROK_SOLL_AGENTS: ReadonlyArray<RegistryAgent> = GROK_SOLL_DEFS.map(([id, name, role, botIds]) => ({
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
  mappedBotIds: botIds,
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
