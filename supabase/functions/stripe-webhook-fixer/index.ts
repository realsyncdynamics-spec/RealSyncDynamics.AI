/**
 * DEPRECATED: Ad-hoc Stripe Webhook Fixer (Decommissioned 2026-07-20)
 *
 * SECURITY INCIDENT MITIGATION:
 * This function was a temporary admin tool created for one-off Stripe webhook repairs.
 * It accepted Bearer token auth from a shared secret stored in Vault and could:
 * - List Stripe webhook endpoints
 * - Modify webhook URLs
 * - Write arbitrary stripe_secret_key values to Vault
 *
 * INCIDENT:
 * - Deployed ad-hoc (not via git/CI), entrypoint in /tmp/ (outside tracked history)
 * - No role-based access control (only secret-based auth)
 * - Could overwrite payment credentials
 *
 * MITIGATION APPLIED (2026-07-20):
 * - stripe_meter_shared_secret rotated in Vault → all old tokens now 403
 * - Legitimate cron job stripe-meter-sync-hourly unaffected (reads fresh secret)
 * - Function remains live in Supabase but non-functional
 *
 * REMEDIATION PATH:
 * 1. Supabase plan upgraded (or spend cap raised) to clear function limit
 * 2. This function deleted from Supabase dashboard
 * 3. Stub removed from repository
 *
 * If Stripe webhook admin operations are needed long-term:
 * → Build as proper protected route with role-based access control (cf. document_vault)
 * → Never as ad-hoc edge function with shared secrets
 */

Deno.serve(async (_req) => {
  return new Response(
    JSON.stringify({
      error: "DEPRECATED_FUNCTION",
      message: "This function has been decommissioned. See source for incident details.",
      deployed_at: "2026-07-20T00:00:00Z",
    }),
    { status: 410, headers: { "Content-Type": "application/json" } }
  );
});
