// Governance admin audit log — fire-and-forget helper.
//
// Called from every owner/admin write path in governance-keys /
// -resources / -webhooks / -approvals. Failures are swallowed so
// the primary action never fails because logging did.

// deno-lint-ignore no-explicit-any
export async function audit(
  admin: any,
  args: {
    tenant_id: string;
    actor_user_id: string;
    actor_email: string | null;
    action: string;            // e.g. 'asset.create'
    target_type: string;       // e.g. 'governance_asset'
    target_id: string | null;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await admin.from('governance_admin_log').insert({
      tenant_id:      args.tenant_id,
      actor_user_id:  args.actor_user_id,
      actor_email:    args.actor_email,
      action:         args.action,
      target_type:    args.target_type,
      target_id:      args.target_id,
      payload:        args.payload ?? {},
    });
  } catch {
    /* swallow — audit logging must not fail the request */
  }
}
