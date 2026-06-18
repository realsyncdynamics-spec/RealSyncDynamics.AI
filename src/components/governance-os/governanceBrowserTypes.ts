import type { TierId } from '../../config/pricing';

export type ModuleStatus = 'live' | 'beta' | 'roadmap';
export type Plan = TierId;

/** Navigations-Gruppen der linken Sidebar (Reihenfolge = Anzeige-Reihenfolge). */
export type ModuleGroup = 'Übersicht' | 'Governance' | 'Arbeit' | 'Organisation';

export const MODULE_GROUP_ORDER: ModuleGroup[] = [
  'Übersicht', 'Governance', 'Arbeit', 'Organisation',
];

export interface GovernanceModule {
  id: string;
  label: string;
  icon: string;
  route: string;
  status: ModuleStatus;
  /** Tiers that may access this module (inclusive: a higher tier always includes lower). */
  plans: Plan[];
  description: string;
  /** Navigations-Gruppe in der linken Sidebar. */
  group: ModuleGroup;
}
