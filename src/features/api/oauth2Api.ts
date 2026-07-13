import { getSupabase } from '../../lib/supabase';

export interface CreateOAuth2AppRequest {
  name: string;
  description?: string;
  redirect_uris: string[];
  scopes: string[];
}

export interface OAuth2Application {
  id: string;
  client_id: string;
  client_secret?: string; // Only returned on creation
  client_secret_hash: string;
  name: string;
  description?: string;
  redirect_uris: string[];
  scopes: string[];
  is_active: boolean;
  created_at: string;
  last_used_at?: string;
  tenant_id: string;
}

export interface OAuth2Token {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export interface RateLimitStatus {
  requests_used: number;
  requests_limit: number;
  reset_at: string;
  requests_daily_used: number;
  requests_daily_limit: number;
}

/**
 * Create a new OAuth2 application for third-party integrations.
 */
export async function createOAuth2App(
  tenantId: string,
  request: CreateOAuth2AppRequest
): Promise<OAuth2Application> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('create_oauth2_app', {
    p_tenant_id: tenantId,
    p_name: request.name,
    p_description: request.description,
    p_redirect_uris: request.redirect_uris,
    p_scopes: request.scopes,
  });

  if (error) throw error;
  return data as OAuth2Application;
}

/**
 * List all OAuth2 applications for a tenant.
 */
export async function listOAuth2Apps(tenantId: string): Promise<OAuth2Application[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('oauth2_applications')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as OAuth2Application[];
}

/**
 * Rotate/renew client secret for an OAuth2 application.
 */
export async function rotateOAuth2Secret(appId: string): Promise<Pick<OAuth2Application, 'client_secret'>> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('rotate_oauth2_secret', {
    p_app_id: appId,
  });

  if (error) throw error;
  return data as Pick<OAuth2Application, 'client_secret'>;
}

/**
 * Delete an OAuth2 application (revokes all tokens).
 */
export async function deleteOAuth2App(appId: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from('oauth2_applications').delete().eq('id', appId);

  if (error) throw error;
}

/**
 * Update OAuth2 app configuration (scopes, redirect_uris, etc).
 */
export async function updateOAuth2App(
  appId: string,
  updates: Partial<CreateOAuth2AppRequest>
): Promise<OAuth2Application> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('oauth2_applications')
    .update(updates)
    .eq('id', appId)
    .select();

  if (error) throw error;
  return data?.[0] as OAuth2Application;
}

/**
 * Get current rate limit status for an API token.
 */
export async function getRateLimitStatus(): Promise<RateLimitStatus> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('get_rate_limit_status');

  if (error) throw error;
  return data as RateLimitStatus;
}

/**
 * Revoke an OAuth2 token (can be access or refresh token).
 */
export async function revokeOAuth2Token(token: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.rpc('revoke_oauth2_token', {
    p_token: token,
  });

  if (error) throw error;
}

/**
 * List active OAuth2 tokens for an application (admin only).
 */
export async function listOAuth2Tokens(appId: string): Promise<Array<{ token_id: string; created_at: string; last_used_at?: string; scope: string }>> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('oauth2_tokens')
    .select('id, created_at, last_used_at, scope')
    .eq('app_id', appId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((d: any) => ({
    token_id: d.id,
    created_at: d.created_at,
    last_used_at: d.last_used_at,
    scope: d.scope,
  }));
}
