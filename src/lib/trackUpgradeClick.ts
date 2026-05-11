/**
 * Fire-and-forget upgrade-click tracking.
 *
 * Posts a lightweight lead-event to the existing `sales-lead` Edge Function
 * so the team can attribute downstream Stripe checkouts back to the audit
 * report that triggered them. Never blocks navigation: errors are swallowed
 * and the function returns immediately.
 *
 * No new table, no new Edge Function, no Stripe touch.
 *
 * Why we don't try to update sales_leads.status with new values:
 *   sales_leads.status has a CHECK constraint that allows only
 *   { new, contacted, qualified, lost, won }. The funnel-stage signal
 *   instead rides in `use_case` (free text, 50-char cap) plus a structured
 *   message body. See FixPaket.tsx for the same pattern.
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export type UpgradePlan = 'starter' | 'growth';

export function trackUpgradeClick(
  plan: UpgradePlan,
  opts: { auditId?: string | null; source?: string; email?: string } = {},
): void {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

  const lines: string[] = [];
  lines.push(`Upgrade-Plan: ${plan}`);
  if (opts.auditId) lines.push(`Audit-ID: ${opts.auditId}`);
  if (opts.source) lines.push(`Source: ${opts.source}`);

  const body = JSON.stringify({
    // The endpoint requires an email; for anonymous upgrade clicks where the
    // visitor has not yet given one, route the event to a sentinel inbox
    // owned by the team so the rate-limiter and storage path remain unchanged.
    email: opts.email || 'anon-upgrade@realsyncdynamicsai.de',
    use_case: `upgrade_click_${plan}`.slice(0, 50),
    message: lines.join('\n'),
    source: 'upgrade_cta_click',
    path: typeof window !== 'undefined' ? window.location.pathname : null,
  });

  try {
    // Prefer the sendBeacon API so the request survives a fast page-nav.
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(`${SUPABASE_URL}/functions/v1/sales-lead`, blob);
      return;
    }
    void fetch(`${SUPABASE_URL}/functions/v1/sales-lead`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body,
      keepalive: true,
    }).catch(() => { /* swallow — never block the navigation */ });
  } catch { /* swallow */ }
}
