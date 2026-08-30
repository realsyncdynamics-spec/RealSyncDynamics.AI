-- AP2 — Paketumbau: drei Self-Service-Stufen, Enterprise als Vertrag.
--
-- Freigegeben vom Eigentümer am 2026-08-24, im Umfang:
--   * Paketmodell auf drei bezahlte Pakete umbauen
--   * `policy.packs` ab Starter
--   * WhatsApp als 99-€-Add-on
--   * AP1 als kanonische Entitlement-Basis verwenden
--   * die beiden in AP1 sichtbar gewordenen Widersprüche bereinigen
--
-- Spezifikation: docs/product/zielzustand-paketmodell.md §1.1,
-- Plan: docs/product/implementierungsplan-paketmodell.md AP2.
--
-- ── Die Regel, unter der das hier steht ────────────────────────────────────
--
-- **Nichts wird entfernt, nur weil es nicht mehr Teil eines Pakets ist.**
-- Diese Migration vergibt ausschließlich zusätzliche Berechtigungen und
-- setzt zwei Katalog-Zeilen inaktiv. Sie löscht keinen Key, keine Zuordnung,
-- kein Produkt und keinen Preis. Ein bestehendes Abo auf Agency oder Partner
-- läuft unverändert weiter — die Auflösung geht über `products`, nicht über
-- `plan_catalog`.
--
-- ── Warum kein neuer Entitlement-Key entsteht ──────────────────────────────
--
-- AP2 ist eine Umverteilung, keine Erfindung. Jeder hier vergebene Key
-- existiert seit AP1 oder länger; er wechselt nur den Plan. Deshalb hat diese
-- Migration keinen INSERT auf `entitlements`.

BEGIN;

-- ── 1. Starter — die beiden Zusagen einlösen, die der Plan schon macht ─────
--
-- Zwei Widersprüche, die AP1 sichtbar gemacht hat, sind hier zu Hause:
--
--   `policy.packs`   Die Feature-Liste von Starter nennt „Policy Packs:
--                    DSGVO und EU AI Act", die Berechtigung lag aber erst ab
--                    Agency. Ein Governance-Produkt, dessen Kern die Policy
--                    Packs sind, darf sie nicht erst in der vierten Stufe
--                    gewähren (Zielzustand §1.2).
--
--   `bots.enabled`   `plan.limits` sagt für Starter seit jeher `bots: 1` und
--   `bots.chat`      `answersPerMonth: 500`, `plan.channels` nennt `website`,
--                    und die Feature-Liste verspricht „1 Governance-Bot mit
--                    500 Antworten (Website)". Zur Laufzeit fehlte beides.
--                    Der Kunde bezahlte einen Bot, den der Server ihm
--                    verweigerte.
--
-- Die Kontingente `limit.bots` und `limit.bot_messages_monthly` kommen mit,
-- weil eine Fähigkeit ohne Kontingent nicht nutzbar ist. Ihre Werte sind
-- nicht neu gewählt, sondern aus `plan.limits` übernommen.
INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT p.id, e.id, z.value
FROM (VALUES
  ('policy.packs',                'starter',    1),
  ('bots.enabled',                'starter',    1),
  ('bots.chat',                   'starter',    1),
  ('limit.bots',                  'starter',    1),
  ('limit.bot_messages_monthly',  'starter',  500),

  -- ── 2. Growth — das Zuhause der Agency-Fähigkeiten ──────────────────────
  --
  -- Agency entfällt als Self-Service. Seine exklusiven Berechtigungen wären
  -- damit unverkäuflich geworden; Zielzustand §1.1 weist sie Growth zu.
  --
  -- `limit.api_calls_monthly` steht auf Growth bereits auf 5.000 — ohne
  -- `api.access` war das ein totes Kontingent. Es wird hier nicht angefasst,
  -- sondern nur endlich erreichbar.
  ('policy.packs',                'growth',     1),
  ('api.access',                  'growth',     1),
  ('webhooks.enabled',            'growth',     1),
  ('scheduler.enabled',           'growth',     1),
  ('evidence.advanced',           'growth',     1),
  ('bulk.jobs',                   'growth',     1),
  ('c2pa.export',                 'growth',     1),
  ('provenance.advanced',         'growth',     1),
  -- Für Growth gab es keinen Vorwert; bewusst deutlich unter Agency (50).
  ('limit.bulk_jobs_monthly',     'growth',    10)
) AS z(key, plan_key, value)
JOIN public.entitlements e ON e.key = z.key
JOIN public.products p
  ON p.default_for_plan_key = z.plan_key
  OR p.default_for_plan_key = z.plan_key || '_yearly'
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_entitlements pe
  WHERE pe.product_id = p.id AND pe.entitlement_id = e.id
);

-- ── 3. Agency und Partner stilllegen ──────────────────────────────────────
--
-- `active = false` nimmt sie aus dem Angebot. Es nimmt ihnen nichts:
-- `products`, `product_entitlements`, Stripe-Preise und laufende
-- Subscriptions bleiben unverändert, und `tenant_entitlements()` liest
-- `plan_catalog` gar nicht. Wer heute Agency hat, merkt davon nichts.
--
-- Rückgängig zu machen mit `active = true` — deshalb steht hier kein DELETE.
UPDATE public.plan_catalog
   SET active = false, updated_at = now()
 WHERE plan_key IN ('agency', 'agency_yearly', 'partner', 'partner_yearly');

COMMIT;
