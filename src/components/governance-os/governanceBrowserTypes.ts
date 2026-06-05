export type ModuleStatus = 'live' | 'beta' | 'roadmap';
export type Plan = 'free' | 'starter' | 'professional' | 'enterprise';

export interface GovernanceModule {
  id: string;
  label: string;
  icon: string;
  route: string;
  status: ModuleStatus;
  plans: Plan[];
  description: string;
}
