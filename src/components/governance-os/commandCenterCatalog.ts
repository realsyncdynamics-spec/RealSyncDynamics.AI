/**
 * Command Center catalog — maps real Governance OS routes/actions.
 * Roadmap modules are listed but marked Coming Soon (not runnable).
 * Beta modules stay navigable and are labeled Beta.
 */
import { GOVERNANCE_MODULES } from './governanceModules';
import type { ModuleStatus } from './governanceBrowserTypes';

export type CommandState = 'ready' | 'preview' | 'coming_soon';

export type CommandActionId = 'open-assistant' | 'close-command-center';

export interface CommandDefinition {
  id: string;
  label: string;
  group: string;
  keywords: string[];
  state: CommandState;
  /** Navigation target when state is ready/preview and path is set. */
  path?: string;
  /** Non-navigation action when path is absent. */
  actionId?: CommandActionId;
  /** Short status label shown in the list (Beta / Vorschau / Coming Soon). */
  badge?: string;
  description?: string;
}

const STATUS_TO_STATE: Record<ModuleStatus, CommandState> = {
  live: 'ready',
  beta: 'ready',
  roadmap: 'coming_soon',
};

const STATUS_BADGE: Partial<Record<ModuleStatus, string>> = {
  beta: 'Beta',
  roadmap: 'Coming Soon',
};

const GROUP_BY_STATUS: Record<ModuleStatus, string> = {
  live: 'Navigation',
  beta: 'Navigation',
  roadmap: 'Roadmap',
};

/** Extra high-value destinations not represented as primary tab modules. */
const EXTRA_NAV_COMMANDS: CommandDefinition[] = [
  {
    id: 'nav-audit-start',
    label: 'Audit starten',
    group: 'Aktionen',
    keywords: ['audit', 'scan', 'prüfen', 'website', 'compliance'],
    state: 'ready',
    path: '/audit',
    description: 'Öffentlichen Governance-Audit starten',
  },
  {
    id: 'nav-scans',
    label: 'Scans öffnen',
    group: 'Aktionen',
    keywords: ['scans', 'scan', 'systeme', 'ai', 'audit'],
    state: 'ready',
    path: '/app/scans',
    description: 'Scan-Historie und Detailansichten',
  },
  {
    id: 'nav-pricing',
    label: 'Preise & Pläne',
    group: 'Konto',
    keywords: ['pricing', 'preise', 'upgrade', 'plan', 'billing'],
    state: 'ready',
    path: '/pricing',
    description: 'Planvergleich und Upgrade',
  },
  {
    id: 'nav-team-invite',
    label: 'Team einladen',
    group: 'Konto',
    keywords: ['team', 'invite', 'einladen', 'mitglieder', 'rollen'],
    state: 'ready',
    path: '/app/team',
    description: 'Mitglieder und Einladungen verwalten',
  },
  {
    id: 'nav-settings-security',
    label: 'Sicherheitseinstellungen',
    group: 'Konto',
    keywords: ['security', 'aal2', 'mfa', 'sicherheit', 'settings'],
    state: 'ready',
    path: '/app/settings',
    description: 'Konto- und Sicherheitseinstellungen',
  },
];

const ACTION_COMMANDS: CommandDefinition[] = [
  {
    id: 'action-assistant',
    label: 'Assistent öffnen',
    group: 'Aktionen',
    keywords: ['assistent', 'chat', 'ai', 'hilfe', 'assistant'],
    state: 'ready',
    actionId: 'open-assistant',
    description: 'Governance-Assistent in der Sidebar',
  },
];

function moduleToCommand(mod: (typeof GOVERNANCE_MODULES)[number]): CommandDefinition {
  const state = STATUS_TO_STATE[mod.status];
  return {
    id: `mod-${mod.id}`,
    label: mod.label,
    group: GROUP_BY_STATUS[mod.status],
    keywords: [
      mod.label,
      mod.id,
      mod.description,
      mod.route,
      ...(mod.status === 'roadmap' ? ['coming soon', 'vorschau', 'roadmap'] : []),
    ]
      .join(' ')
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean),
    state,
    path: state === 'coming_soon' ? undefined : mod.route,
    badge: STATUS_BADGE[mod.status],
    description: mod.description,
  };
}

/** Stable catalog used by the Command Center UI and unit tests. */
export function buildCommandCatalog(): CommandDefinition[] {
  const fromModules = GOVERNANCE_MODULES.map(moduleToCommand);
  return [...ACTION_COMMANDS, ...EXTRA_NAV_COMMANDS, ...fromModules];
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

/** Filter by label, group, path, keywords, description. */
export function filterCommands(
  items: CommandDefinition[],
  query: string,
): CommandDefinition[] {
  const q = normalize(query);
  if (!q) return items;
  return items.filter((item) => {
    const haystack = [
      item.label,
      item.group,
      item.path ?? '',
      item.description ?? '',
      item.badge ?? '',
      ...item.keywords,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q) || q.split(/\s+/).every((token) => haystack.includes(token));
  });
}

/** Runnable = ready or preview with a path/action; coming_soon never runs. */
export function isCommandRunnable(item: CommandDefinition): boolean {
  if (item.state === 'coming_soon') return false;
  if (item.state === 'preview') return false;
  return Boolean(item.path || item.actionId);
}

export function resolveCommandPath(item: CommandDefinition): string | null {
  if (!isCommandRunnable(item)) return null;
  return item.path ?? null;
}
