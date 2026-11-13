// Rate-Limit für öffentliche Ersatz-Endpunkte (platform_stats, audit_share_get, tenant-branding-get).
// Nutzt die bereits vorhandene RPC public.bot_rate_hit und denselben
// IP-Hash (hashClientIp) wie bot-chat. Eigene Bucket-Präfixe, damit die
// Zähler nicht mit dem Chat-Limit kollidieren.
//
// Deno-frei bis auf den übergebenen Admin-Client.

import { clientIpFromHeaders, hashClientIp, type RateDecision } from './bot-budget.ts';

export const PUBLIC_STATS_RATE = { windowSeconds: 60, max: 20 } as const;
export const PUBLIC_SHARE_RATE = { windowSeconds: 60, max: 20 } as const;
export const PUBLIC_BRANDING_RATE = { windowSeconds: 60, max: 20 } as const;

type RpcAdmin = {
  rpc(
    fn: string,
    args: { p_bucket_key: string; p_window_seconds: number; p_max: number },
  ): Promise<{ data: unknown; error: { message: string } | null }>;
};

export async function enforceAnonIpLimit(
  admin: RpcAdmin,
  req: Request,
  bucketPrefix: string,
  limit: { windowSeconds: number; max: number },
  secret: string,
): Promise<RateDecision> {
  const ipHash = await hashClientIp(clientIpFromHeaders(req.headers), secret, new Date());
  const { data, error } = await admin.rpc('bot_rate_hit', {
    p_bucket_key: `${bucketPrefix}:${ipHash}`,
    p_window_seconds: limit.windowSeconds,
    p_max: limit.max,
  });
  if (error) return { allowed: false, scope: 'unavailable' };
  const row = Array.isArray(data) ? data[0] as { allowed?: boolean } | undefined : data as { allowed?: boolean } | null;
  return row?.allowed ? { allowed: true } : { allowed: false, scope: 'ip' };
}

export function rateLimitedResponse(
  jsonError: (status: number, code: string, message: string) => Response,
  decision: RateDecision,
): Response {
  const unavailable = !decision.allowed && decision.scope === 'unavailable';
  const res = jsonError(
    unavailable ? 503 : 429,
    unavailable ? 'RATE_LIMIT_UNAVAILABLE' : 'RATE_LIMITED',
    'Zu viele Anfragen. Bitte kurz warten und erneut versuchen.',
  );
  if (!unavailable) res.headers.set('Retry-After', '60');
  return res;
}
