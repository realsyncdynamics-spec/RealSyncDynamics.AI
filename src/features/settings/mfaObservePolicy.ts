const PRIVILEGED_TENANT_ROLES = new Set(['owner', 'admin', 'dpo']);

export function shouldShowMfaObserveBanner(role: string | null | undefined, isSuperAdmin: boolean): boolean {
  return isSuperAdmin || (!!role && PRIVILEGED_TENANT_ROLES.has(role));
}

export function effectiveMfaEnforced(isPublicSector: boolean, persistedMfaEnforced: boolean): boolean {
  return isPublicSector || persistedMfaEnforced;
}
