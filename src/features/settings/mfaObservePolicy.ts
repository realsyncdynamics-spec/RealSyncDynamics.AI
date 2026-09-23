const PRIVILEGED_TENANT_ROLES = new Set(['owner', 'admin', 'dpo']);

export function shouldShowMfaObserveBanner(role: string | null | undefined, isSuperAdmin: boolean): boolean {
  return isSuperAdmin || (!!role && PRIVILEGED_TENANT_ROLES.has(role));
}

export function effectiveMfaEnforced(persistedMfaEnforced: boolean, isPublicSector: boolean): boolean {
  return isPublicSector || persistedMfaEnforced;
}

export function requiresAal2ForUnenroll(currentLevel: string | null, factorStatuses: string[]): boolean {
  const hasVerified = factorStatuses.includes('verified');
  return hasVerified && currentLevel !== 'aal2';
}
