export interface ObserveStatusResolution {
  status: number;
  body: Record<string, unknown>;
}

export function resolveObserveStatusResponse(input: {
  hasValidUser: boolean;
  profileLookupFailed: boolean;
  isSuperAdmin: boolean;
}): ObserveStatusResolution {
  if (!input.hasValidUser) return { status: 401, body: { error: 'invalid_token' } };
  if (input.profileLookupFailed) return { status: 500, body: { error: 'profile_lookup_failed' } };
  return { status: 200, body: { is_super_admin: input.isSuperAdmin } };
}
