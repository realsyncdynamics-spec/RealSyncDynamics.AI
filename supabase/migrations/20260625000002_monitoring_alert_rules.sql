-- Persistenz für Monitoring-Alert-Regeln pro Tenant.
--
-- Bisher waren die Alert-Regeln im Monitoring-View hartkodierte „Vorlagen"
-- mit nur lokalem Toggle (kein Speichern). Diese Tabelle macht sie echt
-- pro Arbeitsbereich konfigurierbar (Audit-Befund K1, Monitoring-Stubs).
--
-- Default-Regeln werden NICHT hier geseedet (tenant-agnostisch); das Frontend
-- legt sie beim ersten Laden eines Tenants ohne Regeln an (seed-on-read).

CREATE TABLE IF NOT EXISTS public.monitoring_alert_rules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    rule_key    TEXT NOT NULL,              -- stabiler Schlüssel (Default-Regeln) bzw. 'custom_*'
    name        TEXT NOT NULL,
    channels    TEXT NOT NULL DEFAULT 'Dashboard',
    active      BOOLEAN NOT NULL DEFAULT true,
    is_custom   BOOLEAN NOT NULL DEFAULT false,
    sort_order  INTEGER NOT NULL DEFAULT 100,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, rule_key)
);

CREATE INDEX IF NOT EXISTS idx_monitoring_alert_rules_tenant
    ON public.monitoring_alert_rules(tenant_id, sort_order);

ALTER TABLE public.monitoring_alert_rules ENABLE ROW LEVEL SECURITY;

-- service_role darf alles (für Cron/Edge-Functions, die Regeln auswerten).
CREATE POLICY "service_role_all_alert_rules"
    ON public.monitoring_alert_rules
    FOR ALL
    USING (auth.role() = 'service_role');

-- Tenant-Mitglieder dürfen die Regeln ihres Arbeitsbereichs vollständig verwalten.
CREATE POLICY "members_manage_own_tenant_alert_rules"
    ON public.monitoring_alert_rules
    FOR ALL
    USING ((SELECT public.is_tenant_member(tenant_id)))
    WITH CHECK ((SELECT public.is_tenant_member(tenant_id)));

COMMENT ON TABLE public.monitoring_alert_rules IS
    'Pro-Tenant konfigurierbare Monitoring-Alert-Regeln. Default-Regeln werden vom Frontend beim ersten Laden angelegt (seed-on-read).';
