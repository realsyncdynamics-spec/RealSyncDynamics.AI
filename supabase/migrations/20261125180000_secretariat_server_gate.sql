-- KI-Sekretariat: serverseitiges Freigabe-Gate (Schritt A).
--
-- ── Befund ────────────────────────────────────────────────────────────────
--
-- Das KI-Sekretariat (#2435) speichert seinen Entwurf als normalen Bot in
-- `public.bots`, Marker `config.secretariat`. Die Freigabe schreibt der
-- Browser per UPDATE nach `config.secretariat.approval` — nicht
-- autoritativ: Jedes Mandantenmitglied darf `bots` beschreiben (RLS
-- `is_tenant_member`), und `resolveBot` prüft nur `enabled`.
--
-- ── Entwurf (Details: docs/secretariat/SERVER_GATE_UMSETZUNG.md) ─────────
--
-- 1. Die Freigabe liegt in einer EIGENEN Tabelle, die kein Client
--    beschreiben kann (`secretariat_bot_approvals`). `config.secretariat.
--    approval` ist damit bedeutungslos; ein Session-Flag/GUC ist unnötig.
-- 2. Genau eine Hash-Implementierung, hier in SQL
--    (`secretariat_bot_content_sha256`). Browser und Edge rechnen nicht.
-- 3. Freigabe nur per RPC `approve_secretariat_bot` durch Owner/Admin des
--    Bot-Mandanten; der Mandant kommt aus der Bot-Zeile, nie aus Parametern.
-- 4. Trigger `bots_secretariat_gate` (BEFORE INSERT OR UPDATE) für ALLE
--    Rollen: Sekretariats-Bots werden nur mit gültiger Freigabe aktiv; eine
--    Inhaltsänderung an einem aktiven Bot pausiert ihn automatisch.
-- 5. Lese-RPC `secretariat_bot_gate_status` für Oberfläche und Runtime.
--
-- ── Abgrenzung ────────────────────────────────────────────────────────────
--
-- Keine Policy auf `public.bots` wird angelegt, geändert oder entfernt; der
-- Quota-Trigger `bots_enforce_quota` bleibt unberührt (PR #2178 ersetzt
-- beides und kollidiert mit dieser Datei nicht). Nicht-Sekretariats-Bots
-- verhalten sich exakt wie bisher. Rein additiv, nichts wird gelöscht.
--
-- Trigger-Reihenfolge auf public.bots (BEFORE, alphabetisch):
--   INSERT: bots_enforce_quota → bots_secretariat_gate
--   UPDATE: bots_secretariat_gate → update_bots_modtime
-- Der Quota-Trigger prüft beim INSERT also zuerst Mitgliedschaft und
-- Kontingent; `update_bots_modtime` setzt nur `updated_at` (nicht im Hash).
--
-- Verifiziert durch test/runtime/db/secretariat-server-gate.db.test.ts
-- (echtes Postgres) und test/security/secretariat-server-gate-contract.test.ts.

BEGIN;

-- ─── 1. Inhalts-Hash (einzige Implementierung) ────────────────────────────
--
-- SHA-256 über jsonb-Text. jsonb normalisiert Schlüsselreihenfolge und
-- Leerraum; gleiche Werte ergeben denselben Text. `config.secretariat.
-- approval` (Client-Feld aus #2435) ist ausgenommen, alles andere an der
-- Config zählt. `name` zählt mit, weil bot-voice-webhook ihn als
-- Begrüßungsersatz spricht, wenn `greeting` leer ist. Bindung an bot_id und
-- tenant_id: Eine Freigabe lässt sich nicht auf einen anderen Bot oder
-- Mandanten übertragen.
CREATE OR REPLACE FUNCTION public.secretariat_bot_content_sha256(
  p_bot_id       uuid,
  p_tenant_id    uuid,
  p_name         text,
  p_channel      text,
  p_persona      text,
  p_greeting     text,
  p_capabilities jsonb,
  p_config       jsonb
)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path = ''
AS $function$
  SELECT pg_catalog.encode(
           pg_catalog.sha256(
             pg_catalog.convert_to(
               pg_catalog.jsonb_build_object(
                 'bot_id',       p_bot_id,
                 'tenant_id',    p_tenant_id,
                 'name',         p_name,
                 'channel',      p_channel,
                 'persona',      p_persona,
                 'greeting',     p_greeting,
                 'capabilities', p_capabilities,
                 'config',       p_config OPERATOR(pg_catalog.#-) '{secretariat,approval}'::text[]
               )::text,
               'UTF8')),
           'hex');
$function$;

COMMENT ON FUNCTION public.secretariat_bot_content_sha256(uuid, uuid, text, text, text, text, jsonb, jsonb) IS
  'KI-Sekretariat: SHA-256 (hex) über bot_id, tenant_id, name, channel, persona, '
  'greeting, capabilities und config ohne config.secretariat.approval. Einzige '
  'Hash-Implementierung des Freigabe-Gates.';

REVOKE ALL ON FUNCTION public.secretariat_bot_content_sha256(uuid, uuid, text, text, text, text, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;

-- ─── 2. Freigaben (append-only, nur über die RPC) ─────────────────────────
--
-- Keine Feldwerte, keine Kontaktdaten — nur IDs, Hash und Akteur-UUID.
CREATE TABLE IF NOT EXISTS public.secretariat_bot_approvals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id          uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  content_sha256  text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  approved_by     uuid NOT NULL,
  approved_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS secretariat_bot_approvals_bot_hash_idx
  ON public.secretariat_bot_approvals (bot_id, content_sha256);
CREATE INDEX IF NOT EXISTS secretariat_bot_approvals_tenant_idx
  ON public.secretariat_bot_approvals (tenant_id, approved_at DESC);

ALTER TABLE public.secretariat_bot_approvals ENABLE ROW LEVEL SECURITY;

-- Kein Client und auch service_role schreiben nicht direkt. Lesen nur
-- Mitglieder des Mandanten (RLS) und service_role.
REVOKE ALL ON public.secretariat_bot_approvals FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.secretariat_bot_approvals TO authenticated, service_role;

DROP POLICY IF EXISTS secretariat_bot_approvals_select_member ON public.secretariat_bot_approvals;
CREATE POLICY secretariat_bot_approvals_select_member ON public.secretariat_bot_approvals
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

-- Append-only auch für Rollen mit Tabellenrechten (Eigentümer). DELETE ist
-- nur als Kaskade erlaubt, wenn der Bot selbst gelöscht wurde.
CREATE OR REPLACE FUNCTION public.secretariat_bot_approvals_append_only()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'DELETE'
     AND NOT EXISTS (SELECT 1 FROM public.bots b WHERE b.id = OLD.bot_id) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'secretariat_bot_approvals ist append-only'
    USING ERRCODE = '42501';
END;
$function$;

REVOKE ALL ON FUNCTION public.secretariat_bot_approvals_append_only() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS secretariat_bot_approvals_append_only ON public.secretariat_bot_approvals;
CREATE TRIGGER secretariat_bot_approvals_append_only
  BEFORE UPDATE OR DELETE ON public.secretariat_bot_approvals
  FOR EACH ROW EXECUTE FUNCTION public.secretariat_bot_approvals_append_only();

COMMENT ON TABLE public.secretariat_bot_approvals IS
  'KI-Sekretariat: append-only Freigaben (bot_id, tenant_id, content_sha256, '
  'approved_by). Schreiben nur über approve_secretariat_bot(); Lesen für '
  'Mandantenmitglieder. Gültig ist eine Freigabe nur, solange ihr Hash dem '
  'aktuellen Inhalt des Bots entspricht.';

-- ─── 3. Gate-Trigger auf public.bots ──────────────────────────────────────
--
-- Gilt für jede Rolle, service_role eingeschlossen (fail closed).
-- Deaktivieren (`enabled = false`) und Bearbeiten im deaktivierten Zustand
-- sind immer erlaubt. Für Nicht-Sekretariats-Bots ändert sich nichts.
CREATE OR REPLACE FUNCTION public.bots_secretariat_gate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_old_sec boolean;
  v_new_sec boolean;
  v_hash    text;
  v_valid   boolean;
BEGIN
  v_new_sec := NEW.config ? 'secretariat';

  IF TG_OP = 'INSERT' THEN
    IF v_new_sec AND NEW.enabled THEN
      RAISE EXCEPTION 'secretariat bot must be created disabled'
        USING ERRCODE = '42501',
              DETAIL  = 'SECRETARIAT_NOT_APPROVED';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  v_old_sec := OLD.config ? 'secretariat';

  IF v_old_sec AND NOT v_new_sec THEN
    RAISE EXCEPTION 'secretariat marker cannot be removed'
      USING ERRCODE = '42501',
            DETAIL  = 'SECRETARIAT_MARKER_REMOVED';
  END IF;

  IF v_old_sec AND (NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
                    OR NEW.id IS DISTINCT FROM OLD.id) THEN
    RAISE EXCEPTION 'secretariat bot cannot change tenant or id'
      USING ERRCODE = '42501',
            DETAIL  = 'SECRETARIAT_IDENTITY_CHANGED';
  END IF;

  -- Kein Sekretariat oder (weiterhin) deaktiviert: unverändert durchlassen.
  IF NOT v_new_sec OR NOT NEW.enabled THEN
    RETURN NEW;
  END IF;

  v_hash := public.secretariat_bot_content_sha256(
    NEW.id, NEW.tenant_id, NEW.name, NEW.channel, NEW.persona, NEW.greeting,
    NEW.capabilities, NEW.config);

  v_valid := EXISTS (
    SELECT 1 FROM public.secretariat_bot_approvals a
     WHERE a.bot_id = NEW.id
       AND a.tenant_id = NEW.tenant_id
       AND a.content_sha256 = v_hash);

  -- Aktivierungsversuch: war deaktiviert oder wird gerade zum Sekretariat.
  IF NOT OLD.enabled OR NOT v_old_sec THEN
    IF NOT v_valid THEN
      RAISE EXCEPTION 'secretariat bot not approved for its current content'
        USING ERRCODE = '42501',
              DETAIL  = 'SECRETARIAT_NOT_APPROVED';
    END IF;
    -- Rolle zusätzlich zur Freigabe, unabhängig von den Bot-Policies (#2178).
    IF NOT (COALESCE(auth.role(), '') = 'service_role'
            OR public.is_tenant_owner_or_admin(NEW.tenant_id)) THEN
      RAISE EXCEPTION 'secretariat bot activation requires owner or admin'
        USING ERRCODE = '42501',
              DETAIL  = 'SECRETARIAT_ROLE_REQUIRED';
    END IF;
    INSERT INTO public.governance_admin_log
      (tenant_id, actor_user_id, actor_email, action, target_type, target_id, payload)
    VALUES
      (NEW.tenant_id, auth.uid(), NULL, 'secretariat.activated', 'bot', NEW.id::text,
       pg_catalog.jsonb_build_object('content_sha256', v_hash));
    RETURN NEW;
  END IF;

  -- War aktiv und bleibt aktiv: Inhalt geändert ohne passende Freigabe →
  -- automatisch pausieren statt Fehler (Bearbeiten bleibt möglich).
  IF NOT v_valid THEN
    NEW.enabled := false;
    INSERT INTO public.governance_admin_log
      (tenant_id, actor_user_id, actor_email, action, target_type, target_id, payload)
    VALUES
      (NEW.tenant_id, auth.uid(), NULL, 'secretariat.approval_invalidated', 'bot', NEW.id::text,
       pg_catalog.jsonb_build_object('content_sha256', v_hash, 'paused', true));
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.bots_secretariat_gate() IS
  'BEFORE INSERT/UPDATE auf public.bots: Sekretariats-Bots (config ? secretariat) '
  'nur deaktiviert anlegen; Marker, Mandant und id nicht änderbar; Aktivierung nur '
  'mit Freigabe zum aktuellen Hash und durch Owner/Admin oder service_role; '
  'Inhaltsänderung an aktivem Bot ohne passende Freigabe pausiert ihn.';

REVOKE ALL ON FUNCTION public.bots_secretariat_gate() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS bots_secretariat_gate ON public.bots;
CREATE TRIGGER bots_secretariat_gate
  BEFORE INSERT OR UPDATE ON public.bots
  FOR EACH ROW EXECUTE FUNCTION public.bots_secretariat_gate();

-- ─── 4. Freigabe-RPC ──────────────────────────────────────────────────────
--
-- `p_content_sha256` ist der Stand, den der Inhaber gesehen hat
-- (optimistische Sperre). Der Server rechnet selbst; weicht der Wert ab,
-- wird nichts gespeichert. Der Client-Wert wird nie gespeichert.
CREATE OR REPLACE FUNCTION public.approve_secretariat_bot(
  p_bot_id         uuid,
  p_content_sha256 text,
  p_activate       boolean DEFAULT false
)
 RETURNS jsonb
 LANGUAGE plpgsql
 VOLATILE
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_uid         uuid := auth.uid();
  v_tenant      uuid;
  v_bot         public.bots%ROWTYPE;
  v_fields      jsonb;
  v_hash        text;
  v_approval_id uuid;
  v_approved_at timestamptz;
  v_enabled     boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'permission denied for secretariat bot' USING ERRCODE = '42501';
  END IF;

  -- Erst Rolle prüfen, dann sperren: keine Sperre auf fremden Zeilen. Nicht
  -- gefunden und keine Rolle sind von außen nicht unterscheidbar.
  SELECT b.tenant_id INTO v_tenant FROM public.bots b WHERE b.id = p_bot_id;
  IF v_tenant IS NULL OR NOT public.is_tenant_owner_or_admin(v_tenant) THEN
    RAISE EXCEPTION 'permission denied for secretariat bot' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_bot FROM public.bots b
   WHERE b.id = p_bot_id AND b.tenant_id = v_tenant
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'permission denied for secretariat bot' USING ERRCODE = '42501';
  END IF;

  IF NOT (v_bot.config ? 'secretariat') THEN
    RAISE EXCEPTION 'bot is not a secretariat bot'
      USING ERRCODE = 'P0001', DETAIL = 'SECRETARIAT_NOT_FOUND';
  END IF;

  -- Harte Pflichtangaben wie approvalBlockers() in #2435
  -- (src/features/secretariat/websiteDraft.ts): Name des Betriebs bekannt;
  -- Telefon ODER E-Mail bekannt. Serverseitig zusätzlich: Wert ist ein
  -- nicht leerer Text.
  v_fields := v_bot.config -> 'secretariat' -> 'fields';
  IF pg_catalog.jsonb_typeof(v_fields) IS DISTINCT FROM 'object'
     OR NOT (
       v_fields -> 'businessName' ->> 'status' = 'known'
       AND pg_catalog.jsonb_typeof(v_fields -> 'businessName' -> 'value') = 'string'
       AND pg_catalog.btrim(v_fields -> 'businessName' ->> 'value') <> ''
     )
     OR NOT (
       (v_fields -> 'phone' ->> 'status' = 'known'
        AND pg_catalog.jsonb_typeof(v_fields -> 'phone' -> 'value') = 'string'
        AND pg_catalog.btrim(v_fields -> 'phone' ->> 'value') <> '')
       OR
       (v_fields -> 'email' ->> 'status' = 'known'
        AND pg_catalog.jsonb_typeof(v_fields -> 'email' -> 'value') = 'string'
        AND pg_catalog.btrim(v_fields -> 'email' ->> 'value') <> '')
     ) THEN
    RAISE EXCEPTION 'secretariat required fields missing'
      USING ERRCODE = 'P0001', DETAIL = 'SECRETARIAT_FIELDS_MISSING',
            HINT = 'Name des Betriebs und Telefon oder E-Mail angeben.';
  END IF;

  v_hash := public.secretariat_bot_content_sha256(
    v_bot.id, v_bot.tenant_id, v_bot.name, v_bot.channel, v_bot.persona,
    v_bot.greeting, v_bot.capabilities, v_bot.config);

  IF p_content_sha256 IS NULL OR p_content_sha256 IS DISTINCT FROM v_hash THEN
    RAISE EXCEPTION 'secretariat content changed since review'
      USING ERRCODE = 'P0001', DETAIL = 'SECRETARIAT_HASH_MISMATCH',
            HINT = 'Aktuellen Stand über secretariat_bot_gate_status laden und erneut prüfen.';
  END IF;

  INSERT INTO public.secretariat_bot_approvals (bot_id, tenant_id, content_sha256, approved_by)
  VALUES (v_bot.id, v_bot.tenant_id, v_hash, v_uid)
  RETURNING id, approved_at INTO v_approval_id, v_approved_at;

  INSERT INTO public.governance_admin_log
    (tenant_id, actor_user_id, actor_email, action, target_type, target_id, payload)
  VALUES
    (v_bot.tenant_id, v_uid, NULL, 'secretariat.approved', 'bot', v_bot.id::text,
     pg_catalog.jsonb_build_object('content_sha256', v_hash, 'approval_id', v_approval_id));

  v_enabled := v_bot.enabled;
  IF p_activate AND NOT v_bot.enabled THEN
    -- Der Gate-Trigger prüft Freigabe und Rolle erneut und protokolliert.
    UPDATE public.bots SET enabled = true WHERE id = v_bot.id
    RETURNING enabled INTO v_enabled;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'approval_id',    v_approval_id,
    'content_sha256', v_hash,
    'approved_at',    v_approved_at,
    'enabled',        v_enabled);
END;
$function$;

COMMENT ON FUNCTION public.approve_secretariat_bot(uuid, text, boolean) IS
  'KI-Sekretariat: Freigabe durch Owner/Admin des Bot-Mandanten. Hash serverseitig; '
  'p_content_sha256 ist nur die optimistische Sperre. Optional Aktivierung. '
  'Fehlende Anmeldung, fremder Mandant, fehlende Rolle und unbekannter Bot: 42501.';

REVOKE ALL ON FUNCTION public.approve_secretariat_bot(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_secretariat_bot(uuid, text, boolean) TO authenticated;

-- ─── 5. Gate-Status (Oberfläche und Runtime) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.secretariat_bot_gate_status(p_bot_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_bot         public.bots%ROWTYPE;
  v_sec         boolean;
  v_hash        text;
  v_approved_at timestamptz;
BEGIN
  SELECT * INTO v_bot FROM public.bots b WHERE b.id = p_bot_id;
  IF NOT FOUND
     OR NOT (COALESCE(auth.role(), '') = 'service_role'
             OR public.is_tenant_member(v_bot.tenant_id)) THEN
    RAISE EXCEPTION 'permission denied for secretariat bot' USING ERRCODE = '42501';
  END IF;

  v_sec := v_bot.config ? 'secretariat';
  IF v_sec THEN
    v_hash := public.secretariat_bot_content_sha256(
      v_bot.id, v_bot.tenant_id, v_bot.name, v_bot.channel, v_bot.persona,
      v_bot.greeting, v_bot.capabilities, v_bot.config);
    SELECT max(a.approved_at) INTO v_approved_at
      FROM public.secretariat_bot_approvals a
     WHERE a.bot_id = v_bot.id
       AND a.tenant_id = v_bot.tenant_id
       AND a.content_sha256 = v_hash;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'is_secretariat', v_sec,
    'content_sha256', v_hash,
    'approved',       v_sec AND v_approved_at IS NOT NULL,
    'approved_at',    v_approved_at,
    'enabled',        v_bot.enabled);
END;
$function$;

COMMENT ON FUNCTION public.secretariat_bot_gate_status(uuid) IS
  'KI-Sekretariat: {is_secretariat, content_sha256, approved, approved_at, enabled}. '
  'approved = Freigabe zum aktuellen Hash vorhanden. Mitglieder des Bot-Mandanten '
  'und service_role; sonst 42501.';

REVOKE ALL ON FUNCTION public.secretariat_bot_gate_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secretariat_bot_gate_status(uuid) TO authenticated, service_role;

COMMIT;
