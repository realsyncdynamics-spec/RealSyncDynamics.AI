-- WhatsApp-Business-Kanal für Konversations-Bots. ADDITIV / NON-BREAKING.
--
-- Kontext: Die Capability-Matrix (docs/product/capability-matrix.md, Befund 2)
-- hat gemessen, dass WhatsApp an drei Stellen verkauft wird (Plan-Modul ab
-- Growth, Add-on, Bookable Module), aber weder Function noch Tabelle existiert.
-- Diese Migration liefert die Datenbasis; die Edge Function `whatsapp-webhook`
-- liefert die Laufzeit. Entscheidung des Eigentümers vom 2026-08-23:
-- „Backend bauen".
--
-- Sicherheits-/Compliance-Bezug:
--  * RLS wie bei allen Bot-Tabellen: Lesen für Tenant-Mitglieder, Schreiben
--    nur Owner/Admin — der Webhook selbst arbeitet über die Service-Role in
--    der Edge Function, nie aus dem Browser.
--  * phone_number_id ist der Schlüssel, über den Meta-Webhooks einem Tenant
--    zugeordnet werden. UNIQUE, damit eine Geschäftsnummer nie zwei Tenants
--    beliefert (Tenant-Isolation am Eingang, nicht erst in der Query).
--  * Access-Tokens werden NICHT hier gespeichert — v1 nutzt das zentrale
--    Function-Secret (WHATSAPP_ACCESS_TOKEN); eine spätere Pro-Tenant-Ablage
--    gehört in den Supabase Vault, nicht in diese Tabelle.

-- 1. Kanal-Registry: Meta-Geschäftsnummer → (Tenant, Bot)
CREATE TABLE IF NOT EXISTS public.whatsapp_channels (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    bot_id               UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
    -- Meta-ID der Geschäftsnummer (metadata.phone_number_id im Webhook).
    phone_number_id      TEXT NOT NULL UNIQUE,
    -- Anzeigenummer (+49…), rein informativ für die Oberfläche.
    display_phone_number TEXT,
    -- WhatsApp-Business-Account-ID, informativ.
    waba_id              TEXT,
    greeting             TEXT,
    config               JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active            BOOLEAN NOT NULL DEFAULT false,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_channels_tenant_idx ON public.whatsapp_channels(tenant_id);
CREATE INDEX IF NOT EXISTS whatsapp_channels_bot_idx    ON public.whatsapp_channels(bot_id);

CREATE TRIGGER trg_whatsapp_channels_touch
    BEFORE UPDATE ON public.whatsapp_channels
    FOR EACH ROW EXECUTE FUNCTION public.bots_touch_updated_at();

ALTER TABLE public.whatsapp_channels ENABLE ROW LEVEL SECURITY;

-- Lesen: jedes Tenant-Mitglied (Kanalstatus ist Betriebsinformation).
CREATE POLICY whatsapp_channels_sel ON public.whatsapp_channels
    FOR SELECT TO authenticated
    USING (public.is_tenant_member(tenant_id));

-- Schreiben: nur Owner/Admin — das Verknüpfen einer Geschäftsnummer ist eine
-- Governance-Entscheidung, kein Alltags-Handgriff.
CREATE POLICY whatsapp_channels_ins ON public.whatsapp_channels
    FOR INSERT TO authenticated
    WITH CHECK (public.is_tenant_owner_or_admin(tenant_id));

CREATE POLICY whatsapp_channels_upd ON public.whatsapp_channels
    FOR UPDATE TO authenticated
    USING (public.is_tenant_owner_or_admin(tenant_id))
    WITH CHECK (public.is_tenant_owner_or_admin(tenant_id));

CREATE POLICY whatsapp_channels_del ON public.whatsapp_channels
    FOR DELETE TO authenticated
    USING (public.is_tenant_owner_or_admin(tenant_id));

-- 2. Dedupe-Zugriffspfad: whatsapp-webhook prüft Meta-Redeliveries über
--    bot_messages.metadata @> '{"wa_message_id": …}'.
CREATE INDEX IF NOT EXISTS bot_messages_metadata_gin
    ON public.bot_messages USING gin (metadata jsonb_path_ops);

-- 3. Entitlement-Katalog (Muster: 20260628121551_bots_entitlements.sql)
INSERT INTO public.entitlements (key, description, kind) VALUES
    ('bots.whatsapp',                         'Bot-Kanal WhatsApp Business',           'boolean'),
    ('limit.whatsapp_conversations_monthly',  'WhatsApp-Konversationen pro Monat',     'limit')
ON CONFLICT (key) DO NOTHING;

-- Konversationen sind Metas Abrechnungseinheit → metered, damit Overage über
-- Stripe abgerechnet werden kann statt still Marge zu kosten.
INSERT INTO public.usage_limits_config (entitlement_key, hard_limit, soft_limit, billing_mode, description) VALUES
    ('limit.whatsapp_conversations_monthly', NULL, NULL, 'metered', 'WhatsApp-Konversationen; Meta rechnet je Konversation ab, Overage via Stripe.')
ON CONFLICT (entitlement_key) DO NOTHING;

-- 4. Plan × Entitlement-Bindings.
--    WhatsApp ist laut shared/pricing.ts ab Growth Teil der Plan-Leiter
--    (plan.modules enthält 'whatsapp' für growth/agency/enterprise/partner).
--    'scale' existiert seit 20260802001000 nicht mehr als plan_key.
WITH plan_def(plan_key, ent_key, val) AS (VALUES
    ('growth',     'bots.whatsapp',                          1),
    ('growth',     'limit.whatsapp_conversations_monthly',   500),

    ('agency',     'bots.whatsapp',                          1),
    ('agency',     'limit.whatsapp_conversations_monthly',   2500),

    ('enterprise', 'bots.whatsapp',                          1),
    ('enterprise', 'limit.whatsapp_conversations_monthly',   -1),

    ('partner',    'bots.whatsapp',                          1),
    ('partner',    'limit.whatsapp_conversations_monthly',   -1)
)
INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT p.id, e.id, pd.val
FROM plan_def pd
JOIN public.products p     ON p.default_for_plan_key = pd.plan_key
JOIN public.entitlements e ON e.key = pd.ent_key
ON CONFLICT (product_id, entitlement_id) DO NOTHING;
