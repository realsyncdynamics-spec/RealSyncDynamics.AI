import type { TierId } from '../../config/pricing';

export type ModuleStatus = 'live' | 'beta' | 'roadmap';
export type Plan = TierId;

export interface GovernanceModule {
  id: string;
  label: string;
  icon: string;
  route: string;
  status: ModuleStatus;
  /** Tiers that may access this module (inclusive: a higher tier always includes lower). */
  plans: Plan[];
  description: string;
}
