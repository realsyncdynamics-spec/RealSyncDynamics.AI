-- Bots — Fundament: Konversations-Bots für Chat/Voice mit Terminbuchung
-- und Bestellannahme. Multi-Tenant, RLS-geschützt.
--
-- Tabellen:
--   bots                Bot-Definition pro Tenant (Persona, Kanal, Config)
--   bot_conversations   Eine Konversation (Chat-Session, Anruf, Telegram-Chat)
--   bot_messages        Einzelne Nachrichten einer Konversation (Prüfpfad)
--   bot_appointments    Vom Bot erfasste Terminanfragen
--   bot_orders          Vom Bot erfasste Bestellungen
--
-- Schreibpfade laufen über Edge Functions (Service-Role): bot-chat,
-- appointment-book, order-intake, bot-voice-webhook. Lesepfade nutzen
-- PostgREST + RLS (Tenant-Member). `bots` ist zusätzlich von Tenant-
-- Mitgliedern direkt verwaltbar (CRUD), damit der Bot-Builder im Frontend
-- ohne zusätzliche Function auskommt.

-- ─── 1. Bot-Definition ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    -- Hauptkanal des Bots. 'chat' = Web-Widget, 'voice' = Telefonie,
    -- 'telegram'/'whatsapp' = Messenger.
    channel         TEXT NOT NULL DEFAULT 'chat'
                        CHECK (channel IN ('chat', 'voice', 'telegram', 'whatsapp')),
    -- Persönlichkeit/Instruktion, wird dem AI-Tool als zusätzlicher
    -- System-Kontext mitgegeben.
    persona         TEXT,
    -- Begrüßungstext (erste Bot-Nachricht / Voice-Greeting).
    greeting        TEXT,
    -- Fähigkeiten-Flags (Terminbuchung, Bestellannahme) + freie Config.
    capabilities    JSONB NOT NULL DEFAULT '{"appointments": false, "orders": false}'::jsonb,
    config          JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bots_tenant ON public.bots(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bots_tenant_enabled ON public.bots(tenant_id, enabled);

-- ─── 2. Konversationen ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bot_conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    bot_id          UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
    channel         TEXT NOT NULL DEFAULT 'chat'
                        CHECK (channel IN ('chat', 'voice', 'telegram', 'whatsapp')),
    -- Externe Referenz: Web-Session-ID, Telefonnummer/CallSid, Telegram-Chat-ID.
    external_ref    TEXT,
    -- Anzeigename / Kontakt des Gegenübers, soweit bekannt.
    contact_label   TEXT,
    status          TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'closed')),
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_message_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_conversations_tenant
    ON public.bot_conversations(tenant_id, last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_bot_conversations_bot
    ON public.bot_conversations(bot_id, created_at DESC);
-- Eine externe Referenz ist pro Bot eindeutig — erlaubt Upsert je Session.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bot_conversations_bot_ref
    ON public.bot_conversations(bot_id, external_ref)
    WHERE external_ref IS NOT NULL;

-- ─── 3. Nachrichten (Prüfpfad) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bot_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES public.bot_conversations(id) ON DELETE CASCADE,
    bot_id          UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content         TEXT NOT NULL,
    -- Verknüpfung zum AI-Tool-Run (ai_tool_runs.id), falls vorhanden.
    run_id          UUID,
    input_tokens    INTEGER NOT NULL DEFAULT 0,
    output_tokens   INTEGER NOT NULL DEFAULT 0,
    cost_usd        NUMERIC NOT NULL DEFAULT 0,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_messages_conversation
    ON public.bot_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_bot_messages_tenant_created
    ON public.bot_messages(tenant_id, created_at DESC);

-- ─── 4. Terminanfragen ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bot_appointments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    bot_id          UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.bot_conversations(id) ON DELETE SET NULL,
    customer_name   TEXT NOT NULL,
    contact         TEXT,
    service         TEXT,
    requested_at    TIMESTAMPTZ,
    status          TEXT NOT NULL DEFAULT 'requested'
                        CHECK (status IN ('requested', 'confirmed', 'cancelled')),
    notes           TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_appointments_tenant
    ON public.bot_appointments(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_appointments_bot
    ON public.bot_appointments(bot_id, requested_at);

-- ─── 5. Bestellungen ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bot_orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    bot_id          UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.bot_conversations(id) ON DELETE SET NULL,
    customer_name   TEXT NOT NULL,
    contact         TEXT,
    items           JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_amount    NUMERIC NOT NULL DEFAULT 0,
    currency        TEXT NOT NULL DEFAULT 'EUR',
    status          TEXT NOT NULL DEFAULT 'new'
                        CHECK (status IN ('new', 'confirmed', 'fulfilled', 'cancelled')),
    notes           TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_orders_tenant
    ON public.bot_orders(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_orders_bot
    ON public.bot_orders(bot_id, created_at DESC);

-- ─── 6. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.bots              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_appointments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_orders        ENABLE ROW LEVEL SECURITY;

-- bots: Tenant-Mitglieder dürfen lesen UND verwalten (Bot-Builder).
DROP POLICY IF EXISTS "bots tenant-read"   ON public.bots;
DROP POLICY IF EXISTS "bots tenant-insert" ON public.bots;
DROP POLICY IF EXISTS "bots tenant-update" ON public.bots;
DROP POLICY IF EXISTS "bots tenant-delete" ON public.bots;
CREATE POLICY "bots tenant-read"   ON public.bots FOR SELECT USING (public.is_tenant_member(tenant_id));
CREATE POLICY "bots tenant-insert" ON public.bots FOR INSERT WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY "bots tenant-update" ON public.bots FOR UPDATE USING (public.is_tenant_member(tenant_id)) WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY "bots tenant-delete" ON public.bots FOR DELETE USING (public.is_tenant_member(tenant_id));

-- Konversationen/Nachrichten/Termine/Bestellungen: nur lesen für Mitglieder.
-- Schreibzugriff läuft ausschließlich über Service-Role (Edge Functions),
-- für die RLS nicht greift.
DROP POLICY IF EXISTS "bot_conversations tenant-read" ON public.bot_conversations;
CREATE POLICY "bot_conversations tenant-read"
    ON public.bot_conversations FOR SELECT USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "bot_messages tenant-read" ON public.bot_messages;
CREATE POLICY "bot_messages tenant-read"
    ON public.bot_messages FOR SELECT USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "bot_appointments tenant-read"   ON public.bot_appointments;
DROP POLICY IF EXISTS "bot_appointments tenant-update" ON public.bot_appointments;
CREATE POLICY "bot_appointments tenant-read"
    ON public.bot_appointments FOR SELECT USING (public.is_tenant_member(tenant_id));
-- Status-Pflege (bestätigen/stornieren) durch Mitglieder erlaubt.
CREATE POLICY "bot_appointments tenant-update"
    ON public.bot_appointments FOR UPDATE
    USING (public.is_tenant_member(tenant_id)) WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "bot_orders tenant-read"   ON public.bot_orders;
DROP POLICY IF EXISTS "bot_orders tenant-update" ON public.bot_orders;
CREATE POLICY "bot_orders tenant-read"
    ON public.bot_orders FOR SELECT USING (public.is_tenant_member(tenant_id));
CREATE POLICY "bot_orders tenant-update"
    ON public.bot_orders FOR UPDATE
    USING (public.is_tenant_member(tenant_id)) WITH CHECK (public.is_tenant_member(tenant_id));

-- ─── 7. updated_at-Trigger ───────────────────────────────────────────────────
DROP TRIGGER IF EXISTS update_bots_modtime ON public.bots;
CREATE TRIGGER update_bots_modtime
    BEFORE UPDATE ON public.bots
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

DROP TRIGGER IF EXISTS update_bot_conversations_modtime ON public.bot_conversations;
CREATE TRIGGER update_bot_conversations_modtime
    BEFORE UPDATE ON public.bot_conversations
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

DROP TRIGGER IF EXISTS update_bot_appointments_modtime ON public.bot_appointments;
CREATE TRIGGER update_bot_appointments_modtime
    BEFORE UPDATE ON public.bot_appointments
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

DROP TRIGGER IF EXISTS update_bot_orders_modtime ON public.bot_orders;
CREATE TRIGGER update_bot_orders_modtime
    BEFORE UPDATE ON public.bot_orders
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

COMMENT ON TABLE public.bots IS
    'Konversations-Bots pro Tenant (Persona, Kanal, Fähigkeiten). CRUD per RLS für Tenant-Mitglieder.';
COMMENT ON TABLE public.bot_conversations IS
    'Bot-Konversationen (Chat/Voice/Messenger). Schreibpfad über Edge Functions.';
COMMENT ON TABLE public.bot_messages IS
    'Nachrichten-Prüfpfad je Konversation inkl. Token/Kosten-Trail.';
COMMENT ON TABLE public.bot_appointments IS
    'Vom Bot erfasste Terminanfragen.';
COMMENT ON TABLE public.bot_orders IS
    'Vom Bot erfasste Bestellungen.';
