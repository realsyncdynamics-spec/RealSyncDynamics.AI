import type { OnboardingProfile } from '@/shared/onboarding';

export const ONBOARDING_PROFILE_KEY = 'rsd.onboarding.profile';
export const ONBOARDING_CHECKLIST_KEY = 'rsd.onboarding.checklist';

export function readOnboardingProfile(): OnboardingProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ONBOARDING_PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OnboardingProfile;
  } catch {
    return null;
  }
}

export function writeOnboardingProfile(profile: OnboardingProfile): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ONBOARDING_PROFILE_KEY, JSON.stringify(profile));
  window.dispatchEvent(
    new CustomEvent('rsd-evidence', {
      detail: {
        type: 'onboarding.profile_saved',
        industry: profile.industry,
        jobs: profile.jobs,
        plan_suggested: profile.plan_suggested,
        locked_limits: profile.locked_limits,
      },
    }),
  );
}

export function readChecklistFlags(total: number): boolean[] {
  if (typeof window === 'undefined') return Array.from({ length: total }, () => false);
  try {
    const raw = window.localStorage.getItem(ONBOARDING_CHECKLIST_KEY);
    if (!raw) return Array.from({ length: total }, () => false);
    const parsed = JSON.parse(raw) as boolean[];
    return Array.from({ length: total }, (_, i) => Boolean(parsed[i]));
  } catch {
    return Array.from({ length: total }, () => false);
  }
}

export function writeChecklistFlags(flags: boolean[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ONBOARDING_CHECKLIST_KEY, JSON.stringify(flags));
}
