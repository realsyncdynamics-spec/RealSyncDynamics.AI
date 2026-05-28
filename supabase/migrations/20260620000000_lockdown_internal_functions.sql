-- Lockdown rein interner SECURITY-DEFINER-Funktionen gegen direkten REST-Zugriff.
--
-- Kontext (Systemcheck 2026-05-28, docs/runtime/SYSTEMCHECK-2026-05-28.md):
-- Der Supabase-Security-Advisor flaggte diese Funktionen als via /rest/v1/rpc/*
-- durch anon/authenticated aufrufbar. Sie werden ausschliesslich intern genutzt:
--   - resolve_ai_residency           → nur Edge Functions (service_role, _shared/ai.ts)
--   - pii_redaction_log_block_modification → Trigger-Funktion (feuert grant-unabhaengig)
--   - prune_business_metric_snapshots → Cron-Wartung
-- Daher: REST-EXECUTE fuer public/anon/authenticated entziehen, service_role behalten.
--
-- NICHT angefasst (bewusst): admin_*/analytics_* (self-gaten via profiles.is_super_admin),
-- is_tenant_member/is_tenant_owner_or_admin (in RLS-Policies referenziert),
-- affiliate_validate/audit_share_get/report_unknown_tracker (absichtlich oeffentlich),
-- tenant_entitlements (Frontend + Edge).
--
-- Idempotent: REVOKE/GRANT sind wiederholbar.

revoke execute on function public.resolve_ai_residency(uuid, uuid) from public, anon, authenticated;
grant  execute on function public.resolve_ai_residency(uuid, uuid) to service_role;

revoke execute on function public.pii_redaction_log_block_modification() from public, anon, authenticated;

revoke execute on function public.prune_business_metric_snapshots() from public, anon, authenticated;
grant  execute on function public.prune_business_metric_snapshots() to service_role;
