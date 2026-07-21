/**
 * DEPRECATED: Ad-hoc Stripe Webhook Provisioner (Decommissioned 2026-07-20)
 *
 * SECURITY INCIDENT:
 * This function was a temporary admin tool for one-off Stripe webhook setup.
 * It accepted auth via header x-provision-token with a hardcoded string:
 *   rsd_prov_7Qk2Vx9mB4tLpZ0aN8se_2026
 *
 * Capabilities:
 * - Delete Stripe webhook endpoint
 * - Create new Stripe webhook endpoint
 * - Write webhook signing secret to Vault
 *
 * RISK FACTORS:
 * - Deployed ad-hoc (not via git/CI), entrypoint in /tmp/ (outside tracked history)
 * - Auth token hardcoded in compiled function source (no secret rotation possible)
 * - Could completely replace payment webhook configuration
 * - Token potentially leaked in deploy logs, runbooks, or shared terminals
 *
 * MITIGATION APPLIED (2026-07-20):
 * - Function remains live but is now a known security risk
 * - Token is public (this repo is private, but commit history is retained)
 * - Blocked from further development due to Supabase function limit
 *
 * REMEDIATION PATH:
 * 1. Audit deploy logs / runbooks for token exposure
 * 2. Supabase plan upgraded (or spend cap raised)
 * 3. This function deleted from Supabase dashboard
 * 4. If hardcoded token was used elsewhere, rotate all Stripe webhook secrets
 * 5. Stub removed from repository
 *
 * LESSON LEARNED:
 * - Temporary admin tools must not be deployed outside version control
 * - Auth must use role-based checks (cf. document_vault), never hardcoded secrets
 * - Webhook provisioning is a high-risk operation → requires audit trail + approval flow
 */

Deno.serve(async (_req) => {
  return new Response(
    JSON.stringify({
      error: "DEPRECATED_FUNCTION",
      message: "This function has been decommissioned. See source for security details.",
      deployed_at: "2026-07-20T00:00:00Z",
      warning: "If you used the hardcoded token, rotate all Stripe webhook secrets immediately.",
    }),
    { status: 410, headers: { "Content-Type": "application/json" } }
  );
});
