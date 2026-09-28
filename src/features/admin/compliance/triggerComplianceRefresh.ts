/**
 * Optional admin refresh — triggers dashboard-intelligence / digest-generate.
 * HTTP meta only (ok, counts, timestamp_utc). Scores are NEVER taken from
 * the function response; callers must re-read compliance_score_history.
 */
import { getSupabase } from '../../../lib/supabase';
import { getSupabaseAnonKey, getSupabaseUrl } from '../../../lib/supabaseUrl';
import type { ComplianceRefreshMeta } from './complianceTypes';

async function postFunction(
  name: string,
  body: Record<string, unknown>,
): Promise<ComplianceRefreshMeta> {
  const sb = getSupabase();
  const { data: sessionData } = await sb.auth.getSession();
  const token = sessionData.session?.access_token ?? getSupabaseAnonKey();

  try {
    const res = await fetch(`${getSupabaseUrl()}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: getSupabaseAnonKey(),
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        error: typeof json.error === 'string'
          ? json.error
          : typeof json.message === 'string'
            ? json.message
            : `HTTP ${res.status}`,
        timestamp_utc: new Date().toISOString(),
      };
    }
    return {
      ok: json.ok === true,
      action: typeof json.action === 'string' ? json.action : undefined,
      updated_count: typeof json.updated_count === 'number' ? json.updated_count : undefined,
      insights_generated: typeof json.insights_generated === 'number' ? json.insights_generated : undefined,
      digests_created: typeof json.digests_created === 'number' ? json.digests_created : undefined,
      timestamp_utc: typeof json.timestamp_utc === 'string'
        ? json.timestamp_utc
        : new Date().toISOString(),
    };
  } catch (e) {
    return {
      ok: false,
      error: (e as Error).message,
      timestamp_utc: new Date().toISOString(),
    };
  }
}

/** Trigger score update; returns meta only — re-read tables for scores. */
export async function triggerComplianceScoreRefresh(
  tenantId?: string | null,
): Promise<ComplianceRefreshMeta> {
  return postFunction('dashboard-intelligence', {
    ...(tenantId ? { tenant_id: tenantId } : {}),
    action: 'update_scores',
  });
}

/** Trigger digest generation; returns meta only. */
export async function triggerDigestRefresh(
  tenantId?: string | null,
): Promise<ComplianceRefreshMeta> {
  return postFunction('dashboard-digest-generate', {
    ...(tenantId ? { tenant_id: tenantId } : {}),
    action: tenantId ? 'generate_single' : 'generate_digests',
  });
}
