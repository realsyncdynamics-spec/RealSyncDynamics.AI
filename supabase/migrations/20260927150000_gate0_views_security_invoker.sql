-- Gate 0 — Views über Mandantentabellen laufen mit den Rechten des Aufrufers
--
-- Gemessen am 2026-09-27 gegen das voll migrierte Schema: Sieben Views in
-- public lesen RLS-geschützte Tabellen mit tenant_id, filtern selbst nicht
-- nach Mandant, gehören postgres und laufen ohne security_invoker — also mit
-- Eigentümerrechten, an der RLS der Basistabelle vorbei. anon und
-- authenticated haben SELECT darauf. Ergebnis: Daten aller Mandanten.
--
--   ai_token_daily_totals          ← tenant_cost_ledger (Token, USD)
--   browser_actions_with_context   ← browser_actions, workflows, workflow_runs
--   compliance_report_ready        ← audit_reports, audit_findings
--   nis2_deadline_status           ← nis2_incident_deadlines (NIS2-Fristen)
--   v_determinism_fixture_summary  ← audit_determinism_tests
--   vw_distribution_queue_errors   ← distribution_queue_entries
--   vw_distribution_queue_metrics  ← distribution_queue_entries
--
-- Dasselbe Muster hat #1629 für agent_token_usage_analytics und
-- api_monthly_usage geschlossen. Korrektur: security_invoker = on — dann gilt
-- die Lese-Policy der Basistabelle.
--
-- Vorher geprüft, dass jede Basistabelle eine Leseregel über die kanonische
-- Mitgliedschaft hat (is_tenant_member bzw. memberships-Subquery) — mit einer
-- Ausnahme: tenant_cost_ledger prüft über has_tenant_membership() gegen
-- tenant_memberships (einmal befüllt, kein Sync-Trigger). Mit security_invoker
-- sähen Mitglieder, die nur in memberships stehen, ihre eigenen Kosten in
-- ai_token_daily_totals nicht mehr — dieselbe Falle wie bei api_calls (#1630).
-- Deshalb additiv eine Leseregel über is_tenant_member; die alte bleibt.
--
-- Nicht destruktiv: keine View-Definition, Tabelle oder Policy entfernt.
-- Geprüft durch test/runtime/db/gate0-views-security-invoker.db.test.ts.

ALTER VIEW public.ai_token_daily_totals         SET (security_invoker = on);
ALTER VIEW public.browser_actions_with_context  SET (security_invoker = on);
ALTER VIEW public.compliance_report_ready       SET (security_invoker = on);
ALTER VIEW public.nis2_deadline_status          SET (security_invoker = on);
ALTER VIEW public.v_determinism_fixture_summary SET (security_invoker = on);
ALTER VIEW public.vw_distribution_queue_errors  SET (security_invoker = on);
ALTER VIEW public.vw_distribution_queue_metrics SET (security_invoker = on);

DROP POLICY IF EXISTS "tenant_cost_ledger member_read_canonical" ON public.tenant_cost_ledger;
CREATE POLICY "tenant_cost_ledger member_read_canonical"
  ON public.tenant_cost_ledger FOR SELECT
  TO authenticated
  USING (public.is_tenant_member(tenant_id));
