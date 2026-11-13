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
    expect(migration).toContain("'social_channel'");
    expect(migration).toContain('registry_id');
    for (const line of connect.split('\n')) {
      if (!line.includes('credentials_enc') && !line.includes('access_token')) continue;
      expect(line).not.toContain('jsonResponse');
    }
  });

  it('schreibt Verbindung, Registratur und Audit in einer Transaktion', () => {
    expect(connect).toContain('social_channel_connection_apply');
    expect(connect).not.toContain("from('connector_registry')");
    expect(connect).not.toContain('upsertRegistry');
    const fn = migration.slice(migration.indexOf('FUNCTION public.social_channel_connection_apply'));
    const connectionInsert = fn.indexOf('INSERT INTO public.social_channel_connections');
    const registryInsert = fn.indexOf('INSERT INTO public.connector_registry');
    const auditInsert = fn.indexOf('INSERT INTO public.governance_admin_log');
    expect(connectionInsert).toBeGreaterThan(-1);
    expect(registryInsert).toBeGreaterThan(connectionInsert);
    expect(auditInsert).toBeGreaterThan(registryInsert);
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('SET search_path = public, pg_catalog');
    expect(migration).toContain('FROM anon, authenticated');
    expect(migration).toContain('credentials_accepted');
    expect(migration).toContain("'social_channel.configure'");
    expect(migration).toContain("'social_channel.rotate'");
    expect(migration).toContain("'social_channel.remove'");
    expect(helper).toContain("code: 'revert_failed'");
  });
});

describe('Worker liest den Token je Mandant', () => {
  it('ruft LinkedIn nur, wenn das Flag an ist', () => {
    expect(worker).toContain('resolveSocialAccessToken');
    expect(worker).toContain('https://api.linkedin.com/v2/ugcPosts');
    expect(worker).toContain('urn:li:person:ABC123');
    expect(worker).toContain('urn:li:person:XYZ789');
    expect(worker).not.toContain('LINKEDIN_ACCESS_TOKEN');
    expect(worker).not.toContain('config.linkedinToken');
    const fn = worker.slice(worker.indexOf('async function publishLinkedIn'));
    const gate = fn.indexOf('linkedinPublishingEnabled');
    const call = fn.indexOf('https://api.linkedin.com/v2/ugcPosts');
    expect(gate).toBeGreaterThan(-1);
    expect(call).toBeGreaterThan(gate);
    expect(fn).toContain('LINKEDIN_PUBLISH_DISABLED_MESSAGE');
    expect(worker).toContain('LINKEDIN_PUBLISH_FLAG');
    expect(helper).toContain("SOCIAL_PUBLISHER_LINKEDIN_ENABLED");
  });

  it('loggt den Legacy-Fallback ohne Tokenwert', () => {
    expect(worker).toContain('social_publisher_legacy_env_token');
    expect(worker).toContain("resolved.source === 'legacy_env'");
    for (const line of worker.split('\n')) {
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
