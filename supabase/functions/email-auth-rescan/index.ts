// email-auth-rescan — daily DNS re-check of SPF / DMARC / DKIM for every
// website domain of every tenant; opens, refreshes and auto-resolves
// email-auth findings and appends email_auth_finding / email_auth_resolved
// governance events with a hash-chained DNS snapshot as evidence.
//
// Auth: Bearer == CRON_WEBSITE_RESCAN_KEY. pg_cron sends the same value via
// Vault `cron_website_rescan_key` (dispatch_cron_function, job
// `website-rescan-daily`, 03:30 UTC). Resolution: function secret, else vault
// (`resolveCronKey`). Fail-closed: both empty → 500 CRON_KEY_MISSING (no work,
// structured log, no key material), wrong/missing bearer → 401 "cron only".
// The inbound Authorization is never compared to SUPABASE_SERVICE_ROLE_KEY;
// service_role is only used for DB access after the check and for the vault
// fallback.
//
//   SELECT cron.schedule('website-rescan-daily', '30 3 * * *',
//     $$ SELECT public.dispatch_cron_function('email-auth-rescan',
//          'cron_website_rescan_key', jsonb_build_object('trigger','cron')) $$);
//
// verify_jwt = false (supabase/config.toml). Logic: handler.ts / logic.ts /
// repo.ts, tested in test/edge/email-auth-rescan.test.ts.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { resolveCronKey } from '../_shared/cronKey.ts';
import { jsonError } from '../_shared/gateway.ts';
import { loadEntitlementsForTenant, hasFeature } from '../_shared/entitlements.ts';
import { erlaubteKadenz } from '../_shared/monitoring-cadence.ts';
import { handleEmailAuthRescan } from './handler.ts';
import { createSupabaseRepo } from './repo.ts';
import {
  CRON_ENV,
  CRON_VAULT,
  DNS_TIMEOUT_MS,
  checkCronAuth,
  classifyDnsError,
  cronKeyMissingEvent,
  cronKeyMissingMessage,
  joinTxt,
  type DnsResolver,
  type TenantMode,
} from './logic.ts';

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      const e = new Error(`DNS lookup timed out after ${ms}ms`);
      e.name = 'TimedOut';
      reject(e);
    }, ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

const dns: DnsResolver = {
  async txt(name) {
    try {
      const raw = await withTimeout(
        Deno.resolveDns(name, 'TXT', { signal: AbortSignal.timeout(DNS_TIMEOUT_MS) }),
        DNS_TIMEOUT_MS + 250,
      );
      const records = joinTxt(raw);
      return records.length ? { status: 'ok', records } : { status: 'nodata' };
    } catch (e) {
      return classifyDnsError(e);
    }
  },
  async cname(name) {
    try {
      const raw = await withTimeout(
        Deno.resolveDns(name, 'CNAME', { signal: AbortSignal.timeout(DNS_TIMEOUT_MS) }),
        DNS_TIMEOUT_MS + 250,
      );
      const targets = (raw as string[]).map(String);
      return targets.length ? { status: 'ok', targets } : { status: 'nodata' };
    } catch (e) {
      const c = classifyDnsError(e);
      return c.status === 'error' ? c : { status: 'nodata' };
    }
  },
};

Deno.serve(async (req) => {
  try {
    // OPTIONS stays free of a vault round-trip. A missing function secret is
    // not an outage while the vault entry pg_cron already sends still resolves.
    // The handler repeats the same fail-closed check.
    const CRON_KEY = req.method === 'OPTIONS' ? '' : await resolveCronKey(CRON_ENV, CRON_VAULT);
    const pre = checkCronAuth(CRON_KEY, req.headers.get('Authorization'));
    if (!pre.ok && req.method !== 'OPTIONS') {
      if (pre.code === 'CRON_KEY_MISSING') {
        console.error(JSON.stringify(cronKeyMissingEvent()));
        return jsonError(pre.status, pre.code, cronKeyMissingMessage());
      }
      return jsonError(pre.status, pre.code, pre.message);
    }

    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    // Plan gate, same rule as governance-monitoring-scheduler: a monitoring
    // entitlement (monitoring.daily or monitoring.monthly) enables the full
    // scan; without it the tenant is only re-checked where it has open
    // email-auth findings/events, and only resolutions are written.
    const planMode = async (tenantId: string): Promise<TenantMode> => {
      const ent = await loadEntitlementsForTenant(db, tenantId);
      const kadenz = erlaubteKadenz(hasFeature(ent, 'monitoring.daily'), hasFeature(ent, 'monitoring.monthly'));
      return kadenz === null ? 'resolve_only' : 'full';
    };

    return await handleEmailAuthRescan(req, {
      cronKey: CRON_KEY,
      repo: createSupabaseRepo(db),
      dns,
      planMode,
    });
  } catch (e) {
    console.error('[email-auth-rescan] unhandled', e);
    return jsonError(500, 'INTERNAL', 'internal error');
  }
});
