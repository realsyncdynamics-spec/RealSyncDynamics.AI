// Governance admin audit log — best-effort helper mit beobachtbarem Fehlerpfad.
//
// Called from every owner/admin write path in governance-keys /
// -resources / -webhooks / -approvals. Die Primaeraktion soll nicht an einem
// Logging-Fehler scheitern (kein throw) — ABER der Fehler wird ab jetzt
// strukturiert nach stderr geloggt (Supabase-Function-Logs → Sentry/Alerting),
// statt still verschluckt zu werden: ein fehlender Audit-Eintrag ist auf einer
// Compliance-Plattform eine meldepflichtige Luecke.

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
  } catch (e) {
    console.error(JSON.stringify({
      level: 'error',
      scope: 'audit_log_failed',
      action: args.action,
      target_type: args.target_type,
      target_id: args.target_id,
      tenant_id: args.tenant_id,
      error: (e as Error)?.message ?? String(e),
    }));
  }
}
