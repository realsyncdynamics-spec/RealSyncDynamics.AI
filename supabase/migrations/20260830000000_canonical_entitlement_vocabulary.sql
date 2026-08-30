-- AP1 — Kanonisches Entitlement-Vokabular: die fehlenden Keys.
--
-- Freigegeben vom Eigentümer am 2026-08-24. Ziel: **ein** Namensraum für die
-- Frage „Was darf dieser Kunde?". Vorher standen drei nebeneinander —
-- `ModuleId` (in `unlocks` und `plan.modules`), `addon_id` und die
-- Entitlement-Keys. Autorisiert wurde über die Keys, angezeigt über die
-- Module; beide gingen auseinander.
--
-- ── Warum nur fünf neue Keys und nicht acht ────────────────────────────────
--
-- Der Implementierungsplan nannte acht. Die Messung gegen den vollständigen
-- Migrationsstand hat drei davon als Dubletten entlarvt, bevor sie entstanden:
--
--   `whatsapp`      → `bots.whatsapp`      existiert seit 20260826000000
--   `website_chat`  → `bots.chat`          existiert seit 20260628193759
--   `booking`       → `bots.appointments`  existiert seit 20260628193759
--
-- Sie werden weiterverwendet. Übrig bleiben fünf Fähigkeiten, die tatsächlich
-- keinen Key hatten.
--
-- ── Warum die Plan-Zuordnung keine Produktänderung ist ─────────────────────
--
-- Jeder neue Key erbt genau die Pläne, deren `plan.modules` die bisherige
-- `ModuleId` bereits enthielt. Das ist Übertragung in das kanonische
-- Vokabular, keine Erweiterung des Leistungsumfangs: Der Plan sagte schon
-- vorher zu, diese Fähigkeit zu enthalten — nur stand es an einer Stelle, die
-- zur Laufzeit niemand fragt.
--
-- Wo `plan.modules` und die Datenbank sich widersprachen, gilt die Datenbank.
-- Drei solche Widersprüche sind dabei sichtbar geworden und in
-- `docs/product/entitlement-vokabular.md` festgehalten.
--
-- Rein additiv: Es wird kein Key gelöscht, kein Wert überschrieben, keine
-- Zuordnung entfernt.

BEGIN;

-- ── 1. Die fünf fehlenden Keys ─────────────────────────────────────────────
INSERT INTO public.entitlements (key, description, kind)
SELECT v.key, v.beschreibung, 'boolean'
FROM (VALUES
  ('bots.human_handoff',       'Übergabe an einen Menschen mit Eskalationsstufen'),
  ('bots.multi_channel',       'Ein Bot über mehrere Kanäle mit einem Prüfpfad'),
  ('policy.nis2',              'NIS2 als Rahmenwerk zusätzlich zu DSGVO und EU AI Act'),
  ('policy.iso27001',          'ISO 27001 als Rahmenwerk'),
  ('governance.risk_register', 'Risikoregister mit Eigentümern und Maßnahmenverfolgung')
) AS v(key, beschreibung)
WHERE NOT EXISTS (
  SELECT 1 FROM public.entitlements e WHERE e.key = v.key
);

-- ── 2. Zuordnung zu den Plänen, die die Fähigkeit schon zusagten ───────────
--
-- Jahresvarianten erben über denselben Weg wie in
-- 20260828010000: Das Jahresprodukt bekommt, was sein Monatszwilling hat.
INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT p.id, e.id, 1
FROM (VALUES
  ('bots.human_handoff',       'agency'),
  ('bots.human_handoff',       'enterprise'),
  ('bots.human_handoff',       'partner'),
  ('bots.multi_channel',       'growth'),
  ('bots.multi_channel',       'agency'),
  ('bots.multi_channel',       'enterprise'),
  ('bots.multi_channel',       'partner'),
  ('policy.nis2',              'agency'),
  ('policy.nis2',              'enterprise'),
  ('policy.nis2',              'partner'),
  ('policy.iso27001',          'growth'),
  ('policy.iso27001',          'agency'),
  ('policy.iso27001',          'enterprise'),
  ('policy.iso27001',          'partner'),
  ('governance.risk_register', 'growth'),
  ('governance.risk_register', 'agency'),
  ('governance.risk_register', 'enterprise'),
  ('governance.risk_register', 'partner')
) AS z(key, plan_key)
JOIN public.entitlements e ON e.key = z.key
JOIN public.products p
  ON p.default_for_plan_key = z.plan_key
  OR p.default_for_plan_key = z.plan_key || '_yearly'
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_entitlements pe
  WHERE pe.product_id = p.id AND pe.entitlement_id = e.id
);

COMMIT;
