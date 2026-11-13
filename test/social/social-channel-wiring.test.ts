import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const MIGRATION = 'supabase/migrations/20261113120000_social_channel_connections.sql';
const CONNECT = 'supabase/functions/social-channel-connect/index.ts';
const WORKER = 'supabase/functions/social-publisher-worker/index.ts';
const HELPER = 'supabase/functions/_shared/socialChannelCredentials.ts';
const CONFIG = 'supabase/config.toml';

const migration = readFileSync(MIGRATION, 'utf8');
const connect = readFileSync(CONNECT, 'utf8');
const worker = readFileSync(WORKER, 'utf8');
const helper = readFileSync(HELPER, 'utf8');
const config = readFileSync(CONFIG, 'utf8');

function codeWithoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('social_channel_connections Grants und RLS', () => {
  it('vergibt credentials_enc nicht an authenticated', () => {
    expect(migration).toContain('REVOKE ALL ON public.social_channel_connections FROM authenticated');
    expect(migration).toContain('REVOKE ALL ON public.social_channel_connections FROM anon');
    const grant = migration.slice(migration.indexOf('GRANT SELECT ('));
    const columns = grant.slice(0, grant.indexOf(') ON public.social_channel_connections TO authenticated'));
    expect(columns).not.toContain('credentials_enc');
    expect(columns).not.toContain('scopes');
    expect(columns).not.toContain('last_error');
    expect(columns).not.toContain('created_by');
    expect(columns).toContain('account_name');
    expect(columns).toContain('token_expires_at');
    expect(columns).toContain('updated_at');
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('public.is_tenant_member(tenant_id)');
    expect(migration).toContain('UNIQUE (tenant_id, channel, account_external_id)');
    expect(migration).toContain('GRANT SELECT, INSERT, UPDATE, DELETE');
    expect(migration).toContain('TO service_role');
  });

  it('erlaubt mehrere Konten desselben Kanals und die fuenf Provider', () => {
    expect(migration).not.toContain('UNIQUE (tenant_id, channel)');
    for (const provider of ['linkedin', 'instagram', 'facebook', 'tiktok', 'x']) {
      expect(migration).toContain(`'${provider}'`);
    }
  });
});

describe('social-channel-connect gibt keine Secrets heraus', () => {
  it('lehnt facebook ab, weil der Kanal in Entwicklung ist', () => {
    const configure = connect.slice(connect.indexOf('async function configure'));
    const guard = configure.indexOf('isSocialProviderInDevelopment');
    const write = configure.indexOf('commitWithAudit');
    expect(guard).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(guard);
    expect(configure).toContain('NOT_AVAILABLE');
    expect(configure).toContain('in development and has no queue channel');
    const rotate = connect.slice(connect.indexOf('async function rotate'));
    const rotateGuard = rotate.indexOf('isSocialProviderInDevelopment');
    expect(rotateGuard).toBeGreaterThan(-1);
    expect(rotateGuard).toBeLessThan(rotate.indexOf('commitWithAudit'));
    expect(migration).toContain('facebook ist in Entwicklung');
  });

  it('bleibt hinter dem Plattform-JWT und owner/admin', () => {
    expect(config).not.toContain('[functions.social-channel-connect]');
    expect(connect).toContain("['owner', 'admin']");
    expect(connect).toContain('requireAuthAndTenant');
  });

  it('nimmt keine Client-Credentials an und siegelt sie nicht', () => {
    expect(connect).toContain('clientSuppliedCredentials');
    expect(connect).toContain('CREDENTIALS_NOT_ACCEPTED');
    expect(connect).toContain('parseClientScopes');
    const code = codeWithoutComments(connect);
    expect(code).not.toContain('sealSocialCredentials');
    expect(code).not.toContain('loadIntegrationSealKey');
    expect(connect).toContain("system_type: 'social_channel'");
    expect(connect).toContain('registry_id');
    for (const line of connect.split('\n')) {
      if (!line.includes('credentials_enc') && !line.includes('access_token')) continue;
      expect(line).not.toContain('jsonResponse');
    }
  });

  it('bricht ab, wenn das Audit fehlschlägt, und nimmt die Schreibe zurück', () => {
    expect(connect).toContain('commitWithAudit');
    expect(connect).toContain('AUDIT_FAILED');
    expect(connect).toContain('credentials_accepted: false');
    const payloads = connect.split('\n').filter((line) => line.includes('payload:'));
    expect(payloads.length).toBeGreaterThan(0);
    for (const line of payloads) {
      expect(line).not.toContain('access_token');
      expect(line).not.toContain('sealed');
    }
  });
});

describe('Worker liest den Token je Mandant', () => {
  it('sendet ueber die Posts API nur, wenn das Flag an ist', () => {
    const workerCode = codeWithoutComments(worker);
    expect(workerCode).toContain('publishLinkedInQueueJob');
    expect(workerCode).not.toContain('ugcPosts');
    expect(workerCode).not.toContain('urn:li:person:ABC123');
    expect(workerCode).not.toContain('urn:li:person:XYZ789');
    expect(workerCode).not.toContain('LINKEDIN_ACCESS_TOKEN');
    expect(workerCode).not.toContain('config.linkedinToken');
    expect(workerCode).not.toContain('legacy_env');
    expect(workerCode).toContain('LINKEDIN_PUBLISH_FLAG');
    expect(workerCode).toContain('LINKEDIN_PUBLISH_DISABLED_MESSAGE');
    const fn = workerCode.slice(workerCode.indexOf('async function publishLinkedIn'));
    const gate = fn.indexOf('linkedinPublishingEnabled');
    const call = fn.indexOf('publishLinkedInQueueJob');
    expect(gate).toBeGreaterThan(-1);
    expect(call).toBeGreaterThan(gate);
    const posts = readFileSync('supabase/functions/_shared/linkedinPosts.ts', 'utf8');
    expect(posts).toContain('https://api.linkedin.com/rest/posts');
    expect(posts).toContain("'LinkedIn-Version': LINKEDIN_API_VERSION");
    expect(posts).toContain("'X-Restli-Protocol-Version': LINKEDIN_RESTLI_PROTOCOL");
    expect(posts).toContain('allowLegacyEnv: false');
    expect(posts).toContain('linkedinPublishingEnabled');
    expect(posts).toContain('LINKEDIN_PUBLISH_DISABLED_MESSAGE');
    expect(helper).toContain("export const LINKEDIN_PUBLISH_FLAG = 'SOCIAL_PUBLISHER_LINKEDIN_ENABLED'");
    expect(helper).toContain("return flag === 'on'");
    expect(posts).toContain("response.headers.get('x-restli-id')");
    expect(codeWithoutComments(posts)).not.toContain('ugcPosts');
    expect(codeWithoutComments(posts)).not.toContain('/rest/images');
  });

  it('loggt keinen Tokenwert', () => {
    const posts = readFileSync('supabase/functions/_shared/linkedinPosts.ts', 'utf8');
    for (const line of `${worker}\n${posts}`.split('\n')) {
      if (!/console\.(log|warn|error)/.test(line)) continue;
      expect(line).not.toContain('accessToken');
      expect(line).not.toContain('credentials_enc');
    }
  });

  it('liest den Env-Token im Helfer nur nach dem Flag und nur ohne Zeile', () => {
    const code = codeWithoutComments(helper);
    const resolve = code.slice(code.indexOf('export async function resolveSocialAccessToken'));
    const flag = resolve.indexOf('legacyEnvTokenEnabled(');
    const envRead = resolve.indexOf("readEnvOrDeno(input.readEnv, 'LINKEDIN_ACCESS_TOKEN')");
    const none = resolve.indexOf("choice.kind === 'none'");
    expect(none).toBeGreaterThan(-1);
    expect(flag).toBeGreaterThan(none);
    expect(envRead).toBeGreaterThan(flag);
    expect(code).toContain("from './secretBox.ts'");
  });
});
