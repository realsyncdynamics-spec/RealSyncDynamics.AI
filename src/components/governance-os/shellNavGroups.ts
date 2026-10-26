/**
 * Unterkategorien der Seitenleiste — Produktgerüst Discover · Classify ·
 * Enforce · Prove, ergänzt um Start, Agenten und Verwaltung.
 *
 * Ordnet die festen Hauptbereiche (`SHELL_NAV`) und die übrigen Module
 * (`TAB_MODULES`) denselben Gruppen zu. Kein Modul entfällt: Was hier nicht
 * zugeordnet ist, landet in der Gruppe „Weitere".
 */
import type { HandoffKey } from '../../i18n/handoff';
import type { ShellNavId } from './shellNav';

export type ShellNavGroupId =
  | 'start'
  | 'discover'
  | 'assess'
  | 'enforce'
  | 'prove'
  | 'agents'
  | 'admin'
  | 'other';

export interface ShellNavGroupDef {
  id: ShellNavGroupId;
  labelKey: HandoffKey;
  /** Hauptbereiche aus SHELL_NAV, in dieser Reihenfolge zuerst. */
  shell: readonly ShellNavId[];
  /** Modul-IDs aus GOVERNANCE_MODULES. */
  modules: readonly string[];
}

export const SHELL_NAV_GROUPS: readonly ShellNavGroupDef[] = [
  { id: 'start', labelKey: 'shellGroupStart', shell: ['overview'], modules: ['home', 'activation', 'modules'] },
  {
    id: 'discover',
    labelKey: 'shellGroupDiscover',
    shell: ['systems', 'classify'],
    modules: ['websites', 'ambient-ai', 'vendors', 'vendor-exposure', 'local-ai'],
  },
  {
    id: 'assess',
    labelKey: 'shellGroupAssess',
    shell: [],
    modules: ['risks', 'dpia', 'monitoring', 'security-signals', 'alerts'],
  },
  {
    id: 'enforce',
    labelKey: 'shellGroupEnforce',
    shell: ['enforce'],
    modules: ['policy-packs', 'remediation', 'actions', 'workflows', 'automations', 'scheduler', 'bulk', 'governance-router'],
  },
  {
    id: 'prove',
    labelKey: 'shellGroupProve',
    shell: ['evidence', 'reports', 'voice'],
    modules: ['evidence-vault', 'provenance', 'audit', 'documents'],
  },
  { id: 'agents', labelKey: 'shellGroupAgents', shell: [], modules: ['agents', 'bots', 'kodee', 'marketplace'] },
  { id: 'admin', labelKey: 'shellGroupAdmin', shell: ['billing'], modules: ['team', 'settings'] },
];

export const OTHER_GROUP: ShellNavGroupDef = { id: 'other', labelKey: 'shellGroupOther', shell: [], modules: [] };

export interface GroupedNav<S, M> {
  group: ShellNavGroupDef;
  shell: S[];
  modules: M[];
}

/**
 * Verteilt Hauptbereiche und Module auf die Gruppen. Leere Gruppen fallen
 * weg; nicht zugeordnete Module sammelt „Weitere" am Ende.
 */
export function groupShellNav<S extends { id: ShellNavId }, M extends { id: string }>(
  shellItems: readonly S[],
  modules: readonly M[],
): GroupedNav<S, M>[] {
  const assigned = new Set<string>();
  const groups = SHELL_NAV_GROUPS.map((group) => {
    const shell = group.shell
      .map((id) => shellItems.find((item) => item.id === id))
      .filter((item): item is S => item !== undefined);
    const mods = group.modules
      .map((id) => modules.find((m) => m.id === id))
      .filter((m): m is M => m !== undefined);
    mods.forEach((m) => assigned.add(m.id));
    return { group, shell, modules: mods };
  });
  const knownShell = new Set(SHELL_NAV_GROUPS.flatMap((g) => g.shell));
  const otherShell = shellItems.filter((item) => !knownShell.has(item.id));
  const otherModules = modules.filter((m) => !assigned.has(m.id));
  groups.push({ group: OTHER_GROUP, shell: otherShell, modules: otherModules });
  return groups.filter((g) => g.shell.length + g.modules.length > 0);
}
