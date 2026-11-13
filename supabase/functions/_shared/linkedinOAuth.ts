/**
 * LinkedIn OAuth 2.0, Authorization Code Flow (3-legged).
 *
 * Dokumentiert (Microsoft Learn, gelesen 2026-11-13):
 *   Authorization Code Flow
 *   https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow
 *   Sign In with LinkedIn using OpenID Connect
 *   https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2
 *
 *   GET  https://www.linkedin.com/oauth/v2/authorization
 *   POST https://www.linkedin.com/oauth/v2/accessToken
 *   GET  https://api.linkedin.com/v2/userinfo
 *
 * redirect_uri kommt nur aus LINKEDIN_OAUTH_REDIRECT_URI.
 * LINKEDIN_CLIENT_ID und LINKEDIN_CLIENT_SECRET bleiben serverseitig.
 * Tokens verlassen diese Schicht nur ins Siegel, nie in Antwort oder Log.
 */

import { buildCorsHeaders, handleOptions, jsonError, jsonResponse } from './gateway.ts';
import { commitWithAudit } from './socialChannelCredentials.ts';

export const LINKEDIN_AUTHORIZE_URL = 'https://www.linkedin.com/oauth/v2/authorization';
export const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
export const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';

export const STATE_TTL_MS = 10 * 60 * 1000;

export const LINKEDIN_ENV = {
  clientId: 'LINKEDIN_CLIENT_ID',
  clientSecret: 'LINKEDIN_CLIENT_SECRET',
  redirectUri: 'LINKEDIN_OAUTH_REDIRECT_URI',
  returnUrls: 'LINKEDIN_OAUTH_RETURN_URLS',
  orgScopes: 'LINKEDIN_ORG_SCOPES',
} as const;

/** Immer. w_organization_social nur bei LINKEDIN_ORG_SCOPES=on. */
export const MEMBER_SCOPES = ['openid', 'profile', 'w_member_social'] as const;
export const ORG_SCOPE = 'w_organization_social';

const CLIENT_ID_RE = /^[A-Za-z0-9._~-]{1,200}$/;
const SUB_RE = /^[A-Za-z0-9_-]{1,128}$/;
const STATE_RE = /^[A-Za-z0-9_-]{43}$/;

const corsHeaders = buildCorsHeaders('POST, OPTIONS');

export function orgScopesEnabled(flag: string | undefined): boolean {
  return flag === 'on';
}

export function linkedInScopes(flag: string | undefined): string[] {
  return orgScopesEnabled(flag) ? [...MEMBER_SCOPES, ORG_SCOPE] : [...MEMBER_SCOPES];
}

/**
 * Menschenlesbare Reichweite fuer connector_registry.scope.
 * Behauptet nicht, dass die Community Management API freigeschaltet ist.
 */
export function registryScopeLabel(scopes: readonly string[]): string {
  const base = 'LinkedIn-Mitglied: Anmeldung, Profil, Beiträge im eigenen Namen';
  if (!scopes.includes(ORG_SCOPE)) return base;
  return `${base}. Organisationsseiten nur nach Freischaltung der Community Management API`;
}

export function memberUrn(sub: string): string | null {
  if (!SUB_RE.test(sub)) return null;
  return `urn:li:person:${sub}`;
}

/** HTTPS, ohne Query und ohne Fragment — so verlangt es LinkedIn fuer redirect_uri. */
export function parseConfiguredRedirectUri(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length < 12 || trimmed.length > 500) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  if (url.search || url.hash) return null;
  return trimmed;
}

export function parseReturnAllowlist(value: string | undefined): string[] | null {
  if (!value?.trim()) return null;
  const parts = value.split(',').map((part) => part.trim()).filter((part) => part.length > 0);
  if (parts.length === 0 || parts.length > 8) return null;
  const seen = new Set<string>();
  for (const part of parts) {
    if (part.length > 500) return null;
    let url: URL;
    try {
      url = new URL(part);
    } catch {
      return null;
    }
    const localhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const https = url.protocol === 'https:';
    const localHttp = localhost && url.protocol === 'http:';
    if (!https && !localHttp) return null;
    if (url.username || url.password || url.hash) return null;
    if (seen.has(part)) return null;
    seen.add(part);
  }
  return parts;
}

/** Exakter Vergleich mit der Allowlist. Ein leerer Wunsch nimmt die einzige URL. */
export function pickReturnUrl(allowlist: readonly string[], requested: unknown): string | null {
  if (requested === undefined || requested === null || requested === '') {
    return allowlist.length === 1 ? allowlist[0]! : null;
  }
  if (typeof requested !== 'string') return null;
  return allowlist.includes(requested) ? requested : null;
}

export function allowedReturnUrl(stored: string | null, allowlist: readonly string[] | null): string | null {
  if (stored && allowlist?.includes(stored)) return stored;
  if (allowlist && allowlist.length === 1) return allowlist[0]!;
  return null;
}

export interface LinkedInOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  returnUrls: string[];
  scopes: string[];
}

export function readLinkedInOAuthConfig(
  env: (name: string) => string | undefined,
): { ok: true; config: LinkedInOAuthConfig } | { ok: false } {
  const clientId = env(LINKEDIN_ENV.clientId)?.trim() ?? '';
  const clientSecret = env(LINKEDIN_ENV.clientSecret)?.trim() ?? '';
  const redirectUri = parseConfiguredRedirectUri(env(LINKEDIN_ENV.redirectUri));
  const returnUrls = parseReturnAllowlist(env(LINKEDIN_ENV.returnUrls));
  if (!CLIENT_ID_RE.test(clientId)) return { ok: false };
  if (clientSecret.length < 8 || clientSecret.length > 500 || /[\r\n\s]/.test(clientSecret)) {
    return { ok: false };
  }
  if (!redirectUri || !returnUrls) return { ok: false };
  return {
    ok: true,
    config: {
      clientId,
      clientSecret,
      redirectUri,
      returnUrls,
      scopes: linkedInScopes(env(LINKEDIN_ENV.orgScopes)),
    },
  };
}

export function buildAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: readonly string[];
}): string {
  const url = new URL(LINKEDIN_AUTHORIZE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('state', input.state);
  url.searchParams.set('scope', input.scopes.join(' '));
  return url.toString();
}

export interface LinkedInStateRow {
  stateHash: string;
  tenantId: string;
  userId: string;
  returnUrl: string;
  scopes: string[];
  expiresAt: string;
  consumedAt: string | null;
}

export type StateFailure = 'missing' | 'expired' | 'reused' | 'tenant_mismatch';

export type ConsumeDecision =
  | { action: 'missing' }
  | { action: 'reject'; reason: 'reused' }
  | { action: 'reject_and_consume'; reason: 'expired' | 'tenant_mismatch' }
  | { action: 'accept' };

export function decideConsume(
  row: LinkedInStateRow | null,
  now: Date,
  claimedTenantId: string | null,
): ConsumeDecision {
  if (!row) return { action: 'missing' };
  if (row.consumedAt) return { action: 'reject', reason: 'reused' };
  const expires = Date.parse(row.expiresAt);
  if (Number.isNaN(expires) || expires <= now.getTime()) {
    return { action: 'reject_and_consume', reason: 'expired' };
  }
  if (claimedTenantId !== null && claimedTenantId !== row.tenantId) {
    return { action: 'reject_and_consume', reason: 'tenant_mismatch' };
  }
  return { action: 'accept' };
}

export interface StateStore {
  insert(row: LinkedInStateRow): Promise<boolean>;
  peek(stateHash: string): Promise<LinkedInStateRow | null>;
  consume(
    stateHash: string,
    nowIso: string,
    claimedTenantId: string | null,
  ): Promise<
    | { ok: true; row: LinkedInStateRow }
    | { ok: false; reason: StateFailure; row: LinkedInStateRow | null }
  >;
}

export function createMemoryStateStore(): StateStore {
  const rows = new Map<string, LinkedInStateRow>();
  return {
    async insert(row) {
      if (rows.has(row.stateHash)) return false;
      rows.set(row.stateHash, { ...row, scopes: [...row.scopes] });
      return true;
    },
    async peek(stateHash) {
      const row = rows.get(stateHash);
      return row ? { ...row, scopes: [...row.scopes] } : null;
    },
    async consume(stateHash, nowIso, claimedTenantId) {
      const row = rows.get(stateHash) ?? null;
      const decision = decideConsume(row, new Date(nowIso), claimedTenantId);
      if (!row || decision.action === 'missing') {
        return { ok: false, reason: 'missing', row: null };
      }
      if (decision.action === 'reject') {
        return { ok: false, reason: decision.reason, row: { ...row, scopes: [...row.scopes] } };
      }
      const consumed: LinkedInStateRow = { ...row, scopes: [...row.scopes], consumedAt: nowIso };
      rows.set(stateHash, consumed);
      if (decision.action === 'reject_and_consume') {
        return { ok: false, reason: decision.reason, row: consumed };
      }
      return { ok: true, row: consumed };
    },
  };
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export async function randomState(): Promise<string> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export async function hashState(state: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(state));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function issueState(input: {
  tenantId: string;
  userId: string;
  returnUrl: string;
  scopes: string[];
  now: Date;
}): Promise<{ raw: string; row: LinkedInStateRow }> {
  const raw = await randomState();
  const stateHash = await hashState(raw);
  return {
    raw,
    row: {
      stateHash,
      tenantId: input.tenantId,
      userId: input.userId,
      returnUrl: input.returnUrl,
      scopes: [...input.scopes],
      expiresAt: new Date(input.now.getTime() + STATE_TTL_MS).toISOString(),
      consumedAt: null,
    },
  };
}

export interface LinkedInToken {
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
  tokenType?: string;
  scopes: string[];
}

export function parseTokenResponse(
  payload: unknown,
  requestedScopes: readonly string[],
): LinkedInToken | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const access = record.access_token;
  if (typeof access !== 'string' || access.length < 1 || access.length > 8000) return null;
  const expires = record.expires_in;
  if (typeof expires !== 'number' || !Number.isInteger(expires) || expires < 1 || expires > 315360000) {
    return null;
  }
  let refreshToken: string | undefined;
  if (record.refresh_token != null && record.refresh_token !== '') {
    if (typeof record.refresh_token !== 'string' || record.refresh_token.length < 1 || record.refresh_token.length > 8000) {
      return null;
    }
    refreshToken = record.refresh_token;
  }
  let tokenType: string | undefined;
  if (record.token_type != null && record.token_type !== '') {
    if (typeof record.token_type !== 'string') return null;
    const trimmed = record.token_type.trim();
    if (trimmed.length < 1 || trimmed.length > 32) return null;
    tokenType = trimmed;
  }
  if (typeof record.scope !== 'string' || record.scope.length < 1 || record.scope.length > 500) return null;
  let decoded = record.scope;
  try {
    decoded = decodeURIComponent(record.scope);
  } catch {
    return null;
  }
  const scopes = decoded.split(/[\s+]+/).map((scope) => scope.trim()).filter((scope) => scope.length > 0);
  if (scopes.length !== requestedScopes.length) return null;
  const allowed = new Set(requestedScopes);
  if (scopes.some((scope) => !allowed.has(scope))) return null;
  if (requestedScopes.some((scope) => !scopes.includes(scope))) return null;
  return { accessToken: access, expiresIn: expires, refreshToken, tokenType, scopes };
}

export function parseUserInfo(payload: unknown): { sub: string; name: string | null } | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.sub !== 'string' || !SUB_RE.test(record.sub)) return null;
  let name: string | null = null;
  if (typeof record.name === 'string') {
    const trimmed = record.name.trim();
    if (trimmed.length > 0 && trimmed.length <= 200 && !/[\u0000-\u001f\u007f]/.test(trimmed)) {
      name = trimmed;
    }
  }
  return { sub: record.sub, name };
}

export async function exchangeAuthorizationCode(
  fetchFn: typeof fetch,
  input: {
    code: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    requestedScopes: readonly string[];
  },
): Promise<{ ok: true; token: LinkedInToken } | { ok: false; status: number }> {
  let response: Response;
  try {
    response = await fetchFn(LINKEDIN_TOKEN_URL, {
      method: 'POST',
      redirect: 'error',
      cache: 'no-store',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: input.code,
        client_id: input.clientId,
        client_secret: input.clientSecret,
        redirect_uri: input.redirectUri,
      }),
    });
  } catch {
    return { ok: false, status: 0 };
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    return { ok: false, status: response.status };
  }
  try {
    const token = parseTokenResponse(await response.json(), input.requestedScopes);
    if (!token) return { ok: false, status: response.status };
    return { ok: true, token };
  } catch {
    return { ok: false, status: response.status };
  }
}

export async function fetchMemberProfile(
  fetchFn: typeof fetch,
  accessToken: string,
): Promise<{ ok: true; sub: string; name: string | null; accountExternalId: string } | { ok: false }> {
  let response: Response;
  try {
    response = await fetchFn(LINKEDIN_USERINFO_URL, {
      method: 'GET',
      redirect: 'error',
      cache: 'no-store',
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
      },
    });
  } catch {
    return { ok: false };
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    return { ok: false };
  }
  try {
    const profile = parseUserInfo(await response.json());
    if (!profile) return { ok: false };
    const accountExternalId = memberUrn(profile.sub);
    if (!accountExternalId) return { ok: false };
    return { ok: true, sub: profile.sub, name: profile.name, accountExternalId };
  } catch {
    return { ok: false };
  }
}

export type CallbackQuery =
  | { kind: 'code'; code: string; state: string; claimedTenantId: string | null }
  | { kind: 'error'; state: string | null; claimedTenantId: string | null }
  | { kind: 'invalid' };

function claimedTenant(params: URLSearchParams): string | null {
  if (!params.has('tenant_id')) return null;
  return params.get('tenant_id') ?? '';
}

export function readCallbackQuery(url: URL): CallbackQuery {
  const params = url.searchParams;
  const claimedTenantId = claimedTenant(params);
  const stateRaw = params.get('state');
  const state = stateRaw && STATE_RE.test(stateRaw) ? stateRaw : null;
  if (params.has('error')) {
    return { kind: 'error', state, claimedTenantId };
  }
  const code = params.get('code');
  if (!code || !state || code.length < 1 || code.length > 2048) return { kind: 'invalid' };
  return { kind: 'code', code, state, claimedTenantId };
}

export type FrontendReason =
  | 'denied'
  | 'state'
  | 'token'
  | 'profile'
  | 'forbidden'
  | 'store'
  | 'audit'
  | 'config';

export function frontendLocation(
  returnUrl: string,
  status: 'connected' | 'error',
  reason?: FrontendReason,
): string {
  const url = new URL(returnUrl);
  url.hash = '';
  url.searchParams.set('linkedin', status);
  if (status === 'error' && reason) url.searchParams.set('reason', reason);
  else url.searchParams.delete('reason');
  return url.toString();
}

export function redirectToFrontend(
  returnUrl: string,
  status: 'connected' | 'error',
  reason?: FrontendReason,
): Response {
  return new Response(null, {
    status: 302,
    headers: {
      location: frontendLocation(returnUrl, status, reason),
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
    },
  });
}

export function oauthAuditPayload(input: {
  accountExternalId: string;
  fieldNames: string[];
  scopes: string[];
}): Record<string, unknown> {
  return {
    channel: 'linkedin',
    account_external_id: input.accountExternalId,
    credential_fields: [...input.fieldNames].sort(),
    scopes: [...input.scopes],
    credentials_accepted_from_client: false,
  };
}

export interface ConnectionSnapshot {
  credentialsEnc: string | null;
  status: string;
  tokenExpiresAt: string | null;
  scopes: string[] | null;
  accountName: string | null;
  accountKind: string | null;
  connectedAt: string | null;
  registryId: string | null;
  lastError: string | null;
}

export interface SavedConnection {
  id: string;
  previous: ConnectionSnapshot | null;
  createdRegistryId: string | null;
}

export interface LinkedInOAuthLogEvent {
  step: 'config' | 'state' | 'denied' | 'forbidden' | 'token' | 'profile' | 'audit' | 'store';
  status?: number;
}

export interface LinkedInOAuthDeps {
  now(): Date;
  env(name: string): string | undefined;
  authorizeStart(
    req: Request,
    tenantId: string,
  ): Promise<
    | { ok: true; tenantId: string; userId: string }
    | { ok: false; response: Response }
  >;
  states: StateStore;
  isOwnerOrAdmin(tenantId: string, userId: string): Promise<boolean>;
  sealConfigured(): Promise<boolean>;
  seal(credentials: {
    access_token: string;
    refresh_token?: string;
    token_type?: string;
  }): Promise<{ ok: true; sealed: string; fieldNames: string[] } | { ok: false; error: string }>;
  savePending(input: {
    tenantId: string;
    userId: string;
    accountExternalId: string;
    accountName: string | null;
    scopes: string[];
    sealed: string;
    tokenExpiresAt: string;
  }): Promise<{ ok: true; value: SavedConnection } | { ok: false }>;
  restore(
    id: string,
    tenantId: string,
    previous: ConnectionSnapshot | null,
    createdRegistryId: string | null,
  ): Promise<void>;
  activate(id: string, tenantId: string, scopes: string[]): Promise<boolean>;
  audit(input: {
    tenantId: string;
    userId: string;
    targetId: string;
    payload: Record<string, unknown>;
  }): Promise<{ ok: boolean }>;
  fetch: typeof fetch;
  log?(event: LinkedInOAuthLogEvent): void;
  clientSuppliedCredentials(body: Record<string, unknown>): boolean;
}

function plainFailure(): Response {
  return new Response('linkedin oauth failed', {
    status: 400,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'text/plain; charset=utf-8',
      'referrer-policy': 'no-referrer',
    },
  });
}

function finish(
  returnUrl: string | null,
  status: 'connected' | 'error',
  reason?: FrontendReason,
): Response {
  if (!returnUrl) return plainFailure();
  return redirectToFrontend(returnUrl, status, reason);
}

export async function handleLinkedInOAuth(req: Request, deps: LinkedInOAuthDeps): Promise<Response> {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;
  if (req.method === 'POST') return startLinkedInOAuth(req, deps);
  if (req.method === 'GET') return callbackLinkedInOAuth(req, deps);
  return jsonError(405, 'BAD_REQUEST', 'method not allowed', corsHeaders);
}

async function startLinkedInOAuth(req: Request, deps: LinkedInOAuthDeps): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json', corsHeaders);
  }
  if (body.op !== 'start') return jsonError(400, 'BAD_REQUEST', 'unknown op', corsHeaders);

  const tenantId = typeof body.tenant_id === 'string' ? body.tenant_id : '';
  const auth = await deps.authorizeStart(req, tenantId);
  if (!auth.ok) return auth.response;
  if (deps.clientSuppliedCredentials(body)) {
    return jsonError(400, 'CREDENTIALS_NOT_ACCEPTED', 'Zugangsdaten nimmt diese Funktion nicht an', corsHeaders);
  }

  const configResult = readLinkedInOAuthConfig(deps.env);
  if (!configResult.ok) {
    deps.log?.({ step: 'config' });
    return jsonError(503, 'NOT_CONFIGURED', 'LinkedIn-OAuth ist nicht konfiguriert', corsHeaders);
  }
  if (!await deps.sealConfigured()) {
    return jsonError(503, 'NOT_CONFIGURED', 'Zugangsdaten werden ohne Siegel nicht gespeichert', corsHeaders);
  }
  const returnUrl = pickReturnUrl(configResult.config.returnUrls, body.return_to);
  if (!returnUrl) return jsonError(400, 'BAD_REQUEST', 'return_to is invalid', corsHeaders);

  const issued = await issueState({
    tenantId: auth.tenantId,
    userId: auth.userId,
    returnUrl,
    scopes: configResult.config.scopes,
    now: deps.now(),
  });
  // redirect_uri, client_id und client_secret aus dem Body werden nicht gelesen.
  const authorizationUrl = buildAuthorizationUrl({
    clientId: configResult.config.clientId,
    redirectUri: configResult.config.redirectUri,
    state: issued.raw,
    scopes: configResult.config.scopes,
  });
  const inserted = await deps.states.insert(issued.row);
  if (!inserted) {
    return jsonError(500, 'INTERNAL', 'Verbindung konnte nicht gestartet werden', corsHeaders);
  }
  return jsonResponse({ ok: true, authorization_url: authorizationUrl }, 200, corsHeaders);
}

async function callbackLinkedInOAuth(req: Request, deps: LinkedInOAuthDeps): Promise<Response> {
  const query = readCallbackQuery(new URL(req.url));
  const configResult = readLinkedInOAuthConfig(deps.env);
  const allowlist = configResult.ok
    ? configResult.config.returnUrls
    : parseReturnAllowlist(deps.env(LINKEDIN_ENV.returnUrls));

  if (query.kind === 'invalid' || !query.state) {
    return finish(allowedReturnUrl(null, allowlist), 'error', 'state');
  }

  if (!configResult.ok) {
    const peeked = await deps.states.peek(await hashState(query.state));
    deps.log?.({ step: 'config' });
    return finish(allowedReturnUrl(peeked?.returnUrl ?? null, allowlist), 'error', 'config');
  }

  const consumed = await deps.states.consume(
    await hashState(query.state),
    deps.now().toISOString(),
    query.claimedTenantId,
  );
  const returnUrl = allowedReturnUrl(consumed.row?.returnUrl ?? null, configResult.config.returnUrls);
  if (!consumed.ok) {
    deps.log?.({ step: 'state' });
    return finish(returnUrl, 'error', 'state');
  }

  if (query.kind === 'error') {
    deps.log?.({ step: 'denied' });
    return finish(returnUrl, 'error', 'denied');
  }

  const member = await deps.isOwnerOrAdmin(consumed.row.tenantId, consumed.row.userId);
  if (!member) {
    deps.log?.({ step: 'forbidden' });
    return finish(returnUrl, 'error', 'forbidden');
  }
  if (!await deps.sealConfigured()) {
    return finish(returnUrl, 'error', 'config');
  }

  const exchanged = await exchangeAuthorizationCode(deps.fetch, {
    code: query.code,
    clientId: configResult.config.clientId,
    clientSecret: configResult.config.clientSecret,
    redirectUri: configResult.config.redirectUri,
    requestedScopes: consumed.row.scopes,
  });
  if (!exchanged.ok) {
    deps.log?.({ step: 'token', status: exchanged.status });
    return finish(returnUrl, 'error', 'token');
  }

  const profile = await fetchMemberProfile(deps.fetch, exchanged.token.accessToken);
  if (!profile.ok) {
    deps.log?.({ step: 'profile' });
    return finish(returnUrl, 'error', 'profile');
  }

  const sealed = await deps.seal({
    access_token: exchanged.token.accessToken,
    ...(exchanged.token.refreshToken ? { refresh_token: exchanged.token.refreshToken } : {}),
    ...(exchanged.token.tokenType ? { token_type: exchanged.token.tokenType } : {}),
  });
  if (!sealed.ok) return finish(returnUrl, 'error', 'store');

  const tokenExpiresAt = new Date(deps.now().getTime() + exchanged.token.expiresIn * 1000).toISOString();
  let savedId: string | null = null;
  let previous: ConnectionSnapshot | null = null;
  let createdRegistryId: string | null = null;
  const outcome = await commitWithAudit<SavedConnection>({
    write: async () => {
      const saved = await deps.savePending({
        tenantId: consumed.row.tenantId,
        userId: consumed.row.userId,
        accountExternalId: profile.accountExternalId,
        accountName: profile.name,
        scopes: exchanged.token.scopes,
        sealed: sealed.sealed,
        tokenExpiresAt,
      });
      if (!saved.ok) return { ok: false as const };
      savedId = saved.value.id;
      previous = saved.value.previous;
      createdRegistryId = saved.value.createdRegistryId;
      return { ok: true as const, value: saved.value };
    },
    revert: async () => {
      if (!savedId) return;
      await deps.restore(savedId, consumed.row.tenantId, previous, createdRegistryId);
    },
    record: (saved) => deps.audit({
      tenantId: consumed.row.tenantId,
      userId: consumed.row.userId,
      targetId: saved.id,
      payload: oauthAuditPayload({
        accountExternalId: profile.accountExternalId,
        fieldNames: sealed.fieldNames,
        scopes: exchanged.token.scopes,
      }),
    }),
  });

  if (!outcome.ok) {
    // commitWithAudit: audit_failed = Zurücknahme gelungen.
    // write_failed und revert_failed sind Speicherfehler, kein Erfolg.
    const step = outcome.code === 'audit_failed' ? 'audit' : 'store';
    deps.log?.({ step });
    return finish(returnUrl, 'error', step);
  }

  const active = await deps.activate(outcome.value.id, consumed.row.tenantId, exchanged.token.scopes);
  if (!active) {
    try {
      await deps.restore(outcome.value.id, consumed.row.tenantId, outcome.value.previous, outcome.value.createdRegistryId);
    } catch {
      /* Zurücknahme nach fehlender Aktivierung: Antwort bleibt ein Fehler. */
    }
    deps.log?.({ step: 'store' });
    return finish(returnUrl, 'error', 'store');
  }
  return finish(returnUrl, 'connected');
}
