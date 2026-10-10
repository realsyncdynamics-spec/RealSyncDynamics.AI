-- ai_act_risk_inventory: Schreiben nur noch über die Edge Function.
--
-- Die Policies aus 20260612100000 erlaubten INSERT, UPDATE und DELETE für
-- jedes Mitglied (is_tenant_member, ohne TO-Klausel) — auch viewer_auditor,
-- direkt über PostgREST und damit am Entitlement-Gate
-- (governance.risk_register) der Function vorbei. Gate 0 (20260927120000)
-- hat diese Tabelle nicht erfasst.
--
-- Die Function ai-act-risk-inventory schreibt mit service_role (BYPASSRLS)
-- und prüft vorher Mitgliedschaft, schreibende Rolle und Entitlement. Lesen
-- bleibt mandantenbezogen erhalten (Zähler-Widget liest direkt).
--
-- Additiv: entfernt nur Schreib-Policies, ändert keine Daten.

DROP POLICY IF EXISTS "ai_act_risk_inventory tenant-insert" ON public.ai_act_risk_inventory;
DROP POLICY IF EXISTS "ai_act_risk_inventory tenant-update" ON public.ai_act_risk_inventory;
DROP POLICY IF EXISTS "ai_act_risk_inventory tenant-delete" ON public.ai_act_risk_inventory;

-- Lesen nur für angemeldete Mitglieder (vorher ohne TO-Klausel, also PUBLIC).
DROP POLICY IF EXISTS "ai_act_risk_inventory tenant-select" ON public.ai_act_risk_inventory;
CREATE POLICY "ai_act_risk_inventory tenant-select"
    ON public.ai_act_risk_inventory FOR SELECT TO authenticated
    USING (public.is_tenant_member(tenant_id));

COMMENT ON POLICY "ai_act_risk_inventory tenant-select" ON public.ai_act_risk_inventory IS
  'Mitglieder lesen das Inventar ihres Mandanten. Schreiben nur service_role über ai-act-risk-inventory (Rolle + Entitlement geprüft).';
