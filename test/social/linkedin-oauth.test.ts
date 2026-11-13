import { describe, expect, it, vi } from 'vitest';
import { importSecretKey, open } from '../../supabase/functions/_shared/secretBox';
import {
  LINKEDIN_ENV,
  MEMBER_SCOPES,
  ORG_SCOPE,
  allowedReturnUrl,
  buildAuthorizationUrl,
  createMemoryStateStore,
  decideConsume,
  exchangeAuthorizationCode,
  frontendLocation,
  handleLinkedInOAuth,
  hashState,
  issueState,
  linkedInScopes,
  memberUrn,
  oauthAuditPayload,
  orgScopesEnabled,
  parseConfiguredRedirectUri,
  parseReturnAllowlist,
  parseTokenResponse,
  parseUserInfo,
  pickReturnUrl,
  readCallbackQuery,
  readLinkedInOAuthConfig,
  registryScopeLabel,
  type LinkedInOAuthDeps,
} from '../../supabase/functions/_shared/linkedinOAuth';
import {
  clientSuppliedCredentials,
  parseSocialCredentials,
  sealSocialCredentials,
} from '../../supabase/functions/_shared/socialChannelCredentials';
import { readLinkedInAuthorizationUrl } from '../../src/features/social-studio/linkedinOAuth';

const TENANT = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';
const REDIRECT = 'https://project.example/functions/v1/linkedin-oauth';
const RETURN = 'https://app.example/app/social';
const ACCESS = 'fixture-linkedin-access-ZZZ';
const REFRESH = 'fixture-linkedin-refresh-ZZZ';
const SECRET = 'fixture-linkedin-client-secret-ZZZ';
const CODE = 'fixture-linkedin-auth-code-ZZZ';
const DESC = 'fixture-error-description-ZZZ';
const EMAIL = 'fixture-member-email-ZZZ@example.com';

async function fixtureKey(): Promise<CryptoKey> {
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  let bin = '';
  for (const byte of raw) bin += String.fromCharCode(byte);
  return importSecretKey(btoa(bin));
}

function env(flag?: string): (name: string) => string | undefined {
  const values = new Map<string, string>([
    [LINKEDIN_ENV.clientId, 'linkedin-client-id'],
    [LINKEDIN_ENV.clientSecret, SECRET],
    [LINKEDIN_ENV.redirectUri, REDIRECT],
    [LINKEDIN_ENV.returnUrls, RETURN],
  ]);
  if (flag !== undefined) values.set(LINKEDIN_ENV.orgScopes, flag);
  return (name) => values.get(name);
}

function tokenBody(scopes = 'openid profile w_member_social') {
  return {
    access_token: ACCESS,
    expires_in: 5184000,
    refresh_token: REFRESH,
    token_type: 'Bearer',
    scope: scopes,
    id_token: 'fixture-id-token-ZZZ',
  };
}

describe('LinkedIn-OAuth, Konfiguration und Scopes', () => {
  it('bildet Scopes nur bei exakt on mit dem Organisations-Scope', () => {
    expect(orgScopesEnabled(undefined)).toBe(false);
    expect(orgScopesEnabled('')).toBe(false);
    expect(orgScopesEnabled('ON')).toBe(false);
    expect(orgScopesEnabled('true')).toBe(false);
    expect(linkedInScopes(undefined)).toEqual([...MEMBER_SCOPES]);
    expect(linkedInScopes('on')).toEqual([...MEMBER_SCOPES, ORG_SCOPE]);
    expect(registryScopeLabel(MEMBER_SCOPES)).not.toMatch(/Community Management/);
    expect(registryScopeLabel([...MEMBER_SCOPES, ORG_SCOPE])).toMatch(/nur nach Freischaltung/);
  });

  it('fixiert die Redirect-URI auf die Konfiguration', () => {
    expect(parseConfiguredRedirectUri('https://evil.example/cb?next=1')).toBeNull();
    expect(parseConfiguredRedirectUri('https://evil.example/cb#x')).toBeNull();
    expect(parseConfiguredRedirectUri('http://localhost/cb')).toBeNull();
    expect(parseConfiguredRedirectUri(REDIRECT)).toBe(REDIRECT);

    const config = readLinkedInOAuthConfig(env());
    expect(config.ok).toBe(true);
    if (!config.ok) return;
    const url = new URL(buildAuthorizationUrl({
      clientId: config.config.clientId,
      redirectUri: config.config.redirectUri,
      state: 'a'.repeat(43),
      scopes: config.config.scopes,
    }));
    expect(url.origin + url.pathname).toBe('https://www.linkedin.com/oauth/v2/authorization');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT);
    expect(url.searchParams.get('scope')).toBe('openid profile w_member_social');
    expect(url.toString()).not.toContain(SECRET);

    const org = readLinkedInOAuthConfig(env('on'));
    expect(org.ok).toBe(true);
    if (!org.ok) return;
    expect(new URL(buildAuthorizationUrl({
      clientId: org.config.clientId,
      redirectUri: org.config.redirectUri,
      state: 'a'.repeat(43),
      scopes: org.config.scopes,
    })).searchParams.get('scope')).toBe('openid profile w_member_social w_organization_social');
  });

  it('nimmt die Rücksprungseite nur aus der Allowlist', () => {
    expect(parseReturnAllowlist('https://app.example/a, http://evil.example/a')).toBeNull();
    expect(parseReturnAllowlist(`${RETURN}, https://app.example/other`)).toEqual([
      RETURN,
      'https://app.example/other',
    ]);
    expect(pickReturnUrl([RETURN], undefined)).toBe(RETURN);
    expect(pickReturnUrl([RETURN, 'https://app.example/other'], undefined)).toBeNull();
    expect(pickReturnUrl([RETURN], 'https://evil.example/phish')).toBeNull();
    expect(allowedReturnUrl('https://evil.example/phish', [RETURN])).toBe(RETURN);
  });
});

describe('LinkedIn-OAuth, State', () => {
  it('brennt Ablauf, Wiederverwendung und Mandanten-Abweichung', async () => {
    const now = new Date('2026-11-13T12:00:00.000Z');
    const store = createMemoryStateStore();
    const issued = await issueState({
      tenantId: TENANT,
      userId: USER,
      returnUrl: RETURN,
      scopes: [...MEMBER_SCOPES],
      now,
    });
    expect(issued.raw).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(issued.row.stateHash).toHaveLength(64);
    expect(issued.row.stateHash).not.toContain(issued.raw);
    expect(await hashState(issued.raw)).toBe(issued.row.stateHash);
    expect(decideConsume(issued.row, now, OTHER)).toEqual({
      action: 'reject_and_consume',
      reason: 'tenant_mismatch',
    });
    expect(decideConsume({ ...issued.row, expiresAt: now.toISOString() }, now, null).action).toBe('reject_and_consume');

    await store.insert(issued.row);
    const mismatch = await store.consume(issued.row.stateHash, now.toISOString(), OTHER);
    expect(mismatch.ok).toBe(false);
    if (mismatch.ok) return;
    expect(mismatch.reason).toBe('tenant_mismatch');
    const again = await store.consume(issued.row.stateHash, now.toISOString(), null);
    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.reason).toBe('reused');

    const fresh = await issueState({
      tenantId: TENANT,
      userId: USER,
      returnUrl: RETURN,
      scopes: [...MEMBER_SCOPES],
      now,
    });
    fresh.row.expiresAt = now.toISOString();
    await store.insert(fresh.row);
    const expired = await store.consume(fresh.row.stateHash, new Date(now.getTime() + 1000).toISOString(), null);
    expect(expired.ok).toBe(false);
    if (expired.ok) return;
    expect(expired.reason).toBe('expired');
    const expiredAgain = await store.consume(fresh.row.stateHash, now.toISOString(), TENANT);
    expect(expiredAgain.ok).toBe(false);
    if (expiredAgain.ok) return;
    expect(expiredAgain.reason).toBe('reused');
  });
});

describe('LinkedIn-OAuth, Token-Tausch', () => {
  it('lehnt abweichende Scopes und ein fehlendes sub ab, ohne den Token zu spiegeln', () => {
    const ok = parseTokenResponse(tokenBody(), MEMBER_SCOPES);
    expect(ok?.accessToken).toBe(ACCESS);
    expect(ok?.refreshToken).toBe(REFRESH);
    expect(parseTokenResponse(tokenBody('openid profile'), MEMBER_SCOPES)).toBeNull();
    expect(parseTokenResponse({ ...tokenBody(), scope: 'openid profile w_member_social w_organization_social' }, MEMBER_SCOPES)).toBeNull();
    expect(parseTokenResponse({ access_token: ACCESS, expires_in: 60 }, MEMBER_SCOPES)).toBeNull();
    expect(JSON.stringify(parseTokenResponse({ access_token: ACCESS, expires_in: '5184000', scope: 'openid' }, MEMBER_SCOPES))).not.toContain(ACCESS);
    expect(parseUserInfo({ sub: '782bbtaQ', name: 'Ada', email: EMAIL })?.name).toBe('Ada');
    expect(memberUrn('782bbtaQ')).toBe('urn:li:person:782bbtaQ');
    expect(memberUrn('bad sub')).toBeNull();
    expect(JSON.stringify(parseUserInfo({ sub: 'bad sub', email: EMAIL }))).not.toContain(EMAIL);
  });

  it('tauscht den Code und legt das Token nicht in die Antwort', async () => {
    const bodies: string[] = [];
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      bodies.push(String(init?.body ?? ''));
      if (url.endsWith('/accessToken')) {
        return new Response(JSON.stringify(tokenBody()), { status: 200 });
      }
      return new Response(JSON.stringify({ sub: '782bbtaQ', name: 'Ada', email: EMAIL }), { status: 200 });
    });
    const exchanged = await exchangeAuthorizationCode(fetchFn, {
      code: CODE,
      clientId: 'linkedin-client-id',
      clientSecret: SECRET,
      redirectUri: REDIRECT,
      requestedScopes: MEMBER_SCOPES,
    });
    expect(exchanged.ok).toBe(true);
    expect(bodies[0]).toContain('grant_type=authorization_code');
    expect(bodies[0]).toContain(encodeURIComponent(REDIRECT));
    expect(bodies[0]).not.toContain('https://evil.example');
    const failed = await exchangeAuthorizationCode(async () => new Response('nope', { status: 400 }), {
      code: CODE,
      clientId: 'linkedin-client-id',
      clientSecret: SECRET,
      redirectUri: REDIRECT,
      requestedScopes: MEMBER_SCOPES,
    });
    expect(failed).toEqual({ ok: false, status: 400 });
  });
});

describe('LinkedIn-OAuth, Ablauf', () => {
  it('speichert nur ein Siegel, aktiviert erst nach dem Audit und zeigt keine Tokens', async () => {
    const key = await fixtureKey();
    const harness = createHarness(key);
    const started = await handleLinkedInOAuth(jsonRequest({
      op: 'start',
      tenant_id: TENANT,
      redirect_uri: 'https://evil.example/cb',
    }), harness.deps);
    const startText = await started.text();
    expect(started.status).toBe(200);
    expect(startText).not.toContain(SECRET);
    expect(startText).not.toContain(ACCESS);
    expect(startText).not.toContain('evil.example');
    expect(startText).not.toContain('fixture-body-secret-ZZZ');
    const startBody = JSON.parse(startText) as { authorization_url: string };
    const authorization = new URL(startBody.authorization_url);
    expect(authorization.searchParams.get('redirect_uri')).toBe(REDIRECT);
    expect(readLinkedInAuthorizationUrl(JSON.parse(startText))).toBe(startBody.authorization_url);

    const state = authorization.searchParams.get('state') ?? '';
    const done = await handleLinkedInOAuth(callbackRequest(state, { code: CODE }), harness.deps);
    const location = done.headers.get('location') ?? '';
    expect(done.status).toBe(302);
    expect(done.headers.get('referrer-policy')).toBe('no-referrer');
    expect(location.startsWith(`${RETURN}?linkedin=connected`)).toBe(true);
    expect(harness.row?.status).toBe('connected');
    expect(harness.row?.sealed.startsWith('v1:')).toBe(true);
    expect(harness.row?.sealed).not.toContain(ACCESS);
    expect(harness.row?.sealed).not.toContain(REFRESH);
    const opened = parseSocialCredentials(await open(key, harness.row?.sealed ?? ''));
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.secrets.access_token).toBe(ACCESS);
    expect(harness.row?.accountExternalId).toBe('urn:li:person:782bbtaQ');
    expect(JSON.stringify(harness.auditPayload)).not.toContain(ACCESS);
    expect(JSON.stringify(harness.auditPayload)).not.toContain(EMAIL);
    expect(JSON.stringify(harness.savedInput)).not.toContain(EMAIL);
    expect(location).not.toContain(ACCESS);
    expect(location).not.toContain(CODE);
    expect(location).not.toContain(SECRET);
    expect(harness.calls).toEqual(['write', 'audit', 'activate']);

    const replay = await handleLinkedInOAuth(callbackRequest(state, { code: CODE }), harness.deps);
    expect(new URL(replay.headers.get('location') ?? RETURN).searchParams.get('reason')).toBe('state');
    expect(harness.fetchCalls).toBe(2);
  });

  it('lässt den Token bei Audit-Fehler nicht verbunden', async () => {
    const key = await fixtureKey();
    const harness = createHarness(key, { auditOk: false });
    const started = await handleLinkedInOAuth(jsonRequest({ op: 'start', tenant_id: TENANT }), harness.deps);
    const state = new URL((await started.json()).authorization_url).searchParams.get('state') ?? '';
    const done = await handleLinkedInOAuth(callbackRequest(state, { code: CODE }), harness.deps);
    expect(new URL(done.headers.get('location') ?? RETURN).searchParams.get('reason')).toBe('audit');
    expect(done.headers.get('location')).not.toContain(ACCESS);
    expect(harness.calls).toEqual(['write', 'audit', 'revert']);
    expect(harness.row?.sealed).toBe('v1:previous:old-seal');
    expect(harness.row?.sealed).not.toContain(ACCESS);
    expect(harness.calls).not.toContain('activate');
  });

  it('reicht Provider-Fehler, Ablauf und Mandanten-Abweichung generisch zurück', async () => {
    const key = await fixtureKey();
    const logs: string[] = [];
    const harness = createHarness(key, {
      log: (event) => logs.push(JSON.stringify(event)),
    });
    const started = await handleLinkedInOAuth(jsonRequest({ op: 'start', tenant_id: TENANT }), harness.deps);
    const state = new URL((await started.json()).authorization_url).searchParams.get('state') ?? '';

    const denied = await handleLinkedInOAuth(
      callbackRequest(state, { error: 'user_cancelled_authorize', error_description: DESC }),
      harness.deps,
    );
    const deniedUrl = new URL(denied.headers.get('location') ?? RETURN);
    expect(deniedUrl.searchParams.get('reason')).toBe('denied');
    expect(denied.headers.get('location')).not.toContain(DESC);
    expect(logs.join('')).not.toContain(DESC);
    expect(harness.fetchCalls).toBe(0);

    const second = createHarness(key);
    let now = new Date('2026-11-13T12:00:00.000Z');
    second.deps.now = () => now;
    const startedLate = await handleLinkedInOAuth(jsonRequest({ op: 'start', tenant_id: TENANT }), second.deps);
    const lateState = new URL((await startedLate.json()).authorization_url).searchParams.get('state') ?? '';
    now = new Date('2026-11-13T12:11:00.000Z');
    const expired = await handleLinkedInOAuth(callbackRequest(lateState, { code: CODE }), second.deps);
    expect(new URL(expired.headers.get('location') ?? RETURN).searchParams.get('reason')).toBe('state');
    expect(second.fetchCalls).toBe(0);

    const third = createHarness(key);
    const startedOther = await handleLinkedInOAuth(jsonRequest({ op: 'start', tenant_id: TENANT }), third.deps);
    const otherState = new URL((await startedOther.json()).authorization_url).searchParams.get('state') ?? '';
    const mismatch = await handleLinkedInOAuth(
      callbackRequest(otherState, { code: CODE, tenant_id: OTHER }),
      third.deps,
    );
    expect(new URL(mismatch.headers.get('location') ?? RETURN).searchParams.get('reason')).toBe('state');
    expect(third.fetchCalls).toBe(0);
    expect(mismatch.headers.get('location')).not.toContain(CODE);
  });

  it('lehnt mitgeschickte Zugangsdaten ab', async () => {
    const key = await fixtureKey();
    const harness = createHarness(key);
    const response = await handleLinkedInOAuth(jsonRequest({
      op: 'start',
      tenant_id: TENANT,
      access_token: ACCESS,
      client_secret: 'fixture-body-secret-ZZZ',
    }), harness.deps);
    expect(response.status).toBe(400);
    const rejected = await response.text();
    expect(rejected).not.toContain(ACCESS);
    expect(rejected).not.toContain('fixture-body-secret-ZZZ');
    expect(harness.calls).toEqual([]);
  });
});

describe('LinkedIn-OAuth, Frontend-Helfer', () => {
  it('nimmt nur die Authorization-URL und kein Token-Feld', () => {
    const url = buildAuthorizationUrl({
      clientId: 'linkedin-client-id',
      redirectUri: REDIRECT,
      state: 'a'.repeat(43),
      scopes: MEMBER_SCOPES,
    });
    expect(readLinkedInAuthorizationUrl({ ok: true, authorization_url: url })).toBe(url);
    expect(readLinkedInAuthorizationUrl({ ok: true, authorization_url: url, access_token: ACCESS })).toBeNull();
    expect(readLinkedInAuthorizationUrl({ ok: true, authorization_url: 'https://evil.example/oauth' })).toBeNull();
    expect(frontendLocation(RETURN, 'error', 'token')).toBe(`${RETURN}?linkedin=error&reason=token`);
    const query = readCallbackQuery(new URL(`https://project.example/cb?code=${CODE}&state=${'a'.repeat(43)}&error_description=${DESC}`));
    expect(query.kind).toBe('code');
    expect(JSON.stringify(query)).not.toContain(DESC);
    expect(JSON.stringify(oauthAuditPayload({
      accountExternalId: 'urn:li:person:782bbtaQ',
      fieldNames: ['access_token'],
      scopes: [...MEMBER_SCOPES],
    }))).not.toContain(ACCESS);
  });
});

function jsonRequest(body: Record<string, unknown>): Request {
  return new Request('https://project.example/functions/v1/linkedin-oauth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function callbackRequest(state: string, query: Record<string, string>): Request {
  const url = new URL(REDIRECT);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  url.searchParams.set('state', state);
  return new Request(url, { method: 'GET' });
}

function createHarness(key: CryptoKey, options?: {
  auditOk?: boolean;
  log?: (event: { step: string; status?: number }) => void;
}): {
  deps: LinkedInOAuthDeps;
  calls: string[];
  row: { status: string; sealed: string; accountExternalId: string } | null;
  auditPayload: unknown;
  savedInput: unknown;
  fetchCalls: number;
} {
  const states = createMemoryStateStore();
  const calls: string[] = [];
  let row: { status: string; sealed: string; accountExternalId: string } | null = null;
  let auditPayload: unknown = null;
  let savedInput: unknown = null;
  let fetchCalls = 0;
  const previousSeal = 'v1:previous:old-seal';
  const deps: LinkedInOAuthDeps = {
    now: () => new Date('2026-11-13T12:00:00.000Z'),
    env: env(),
    states,
    fetch: async (input, init) => {
      fetchCalls += 1;
      const url = String(input);
      const body = String(init?.body ?? '');
      expect(body).not.toContain('https://evil.example');
      if (url.endsWith('/accessToken')) {
        expect(body).toContain(encodeURIComponent(REDIRECT));
        expect(body).toContain(encodeURIComponent(SECRET));
        return new Response(JSON.stringify(tokenBody()), { status: 200 });
      }
      expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${ACCESS}`);
      return new Response(JSON.stringify({ sub: '782bbtaQ', name: 'Ada', email: EMAIL }), { status: 200 });
    },
    log: options?.log,
    clientSuppliedCredentials,
    async authorizeStart(_req, tenantId) {
      if (tenantId !== TENANT) {
        return { ok: false, response: new Response('forbidden', { status: 403 }) };
      }
      return { ok: true, tenantId: TENANT, userId: USER };
    },
    async isOwnerOrAdmin(tenantId, userId) {
      return tenantId === TENANT && userId === USER;
    },
    async sealConfigured() {
      return true;
    },
    async seal(credentials) {
      return sealSocialCredentials(key, credentials);
    },
    async savePending(input) {
      calls.push('write');
      savedInput = input;
      row = {
        status: 'pending',
        sealed: input.sealed,
        accountExternalId: input.accountExternalId,
      };
      return {
        ok: true,
        value: {
          id: 'connection-1',
          previous: {
            credentialsEnc: previousSeal,
            status: 'connected',
            tokenExpiresAt: null,
            scopes: ['openid', 'profile'],
            accountName: 'Alt',
            accountKind: 'member',
            connectedAt: '2026-11-01T00:00:00.000Z',
            registryId: null,
            lastError: null,
          },
          createdRegistryId: null,
        },
      };
    },
    async restore() {
      calls.push('revert');
      if (row) {
        row = { ...row, status: 'connected', sealed: previousSeal };
      }
    },
    async activate() {
      calls.push('activate');
      if (row) row = { ...row, status: 'connected' };
      return true;
    },
    async audit(input) {
      calls.push('audit');
      auditPayload = input.payload;
      return { ok: options?.auditOk !== false };
    },
  };
  return {
    deps,
    calls,
    get row() {
      return row;
    },
    get auditPayload() {
      return auditPayload;
    },
    get savedInput() {
      return savedInput;
    },
    get fetchCalls() {
      return fetchCalls;
    },
  };
}
