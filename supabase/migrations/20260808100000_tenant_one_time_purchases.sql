-- ═══════════════════════════════════════════════════════════════════════════
--  Einmalkäufe je Tenant (Governance Launch u. a.)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Zweck
--   Hält Käufe fest, die über eine Stripe-Checkout-Session im Modus `payment`
--   abgeschlossen wurden — also ohne Subscription und ohne Verlängerung.
--
-- Warum eine eigene Tabelle und nicht `public.subscriptions`?
--   `subscriptions` trägt seit 20260711000001 UNIQUE(tenant_id): pro Tenant
--   ist dort genau EINE Zeile möglich. Ein Einmalkauf per UPSERT in diese
--   Tabelle würde das laufende Abo eines zahlenden Kunden überschreiben und
--   ihn auf den Umfang des Einmalprodukts herabsetzen. Einmalkäufe müssen
--   sich zum Abo ADDIEREN, nicht es ersetzen — deshalb eine zweite Quelle,
--   die `tenant_entitlements()` per MAX() mit dem Abo vereinigt.
--
-- Additiv: keine bestehende Tabelle, Spalte oder Policy wird verändert.
--
-- Compliance-Bezug
--   DSGVO Art. 5 (1) e (Speicherbegrenzung): Die Tabelle hält ausschließlich
--   Vertrags- und Zahlungsbezugsdaten, keine Inhaltsdaten. Personenbezug
--   entsteht nur über `stripe_customer_id`; Löschung eines Tenants entfernt
--   die Zeilen über ON DELETE CASCADE mit.
--   EU AI Act Art. 12 (Aufzeichnungspflichten): Der Kauf ist Teil des
--   Prüfpfads, welcher Governance-Umfang einem Tenant wann zustand.

CREATE TABLE IF NOT EXISTS public.tenant_one_time_purchases (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- Kanonischer Plan-Key aus shared/pricing.ts (z.B. 'governance_launch').
  plan_key                    TEXT NOT NULL,
  -- Idempotenz-Anker: ein Stripe-Retry desselben Events schreibt dieselbe
  -- Zeile erneut, statt einen zweiten Kauf zu erzeugen.
  stripe_checkout_session_id  TEXT NOT NULL UNIQUE,
  stripe_customer_id          TEXT,
  stripe_payment_intent_id    TEXT,
  stripe_price_id             TEXT,
  stripe_product_id           TEXT,
  amount_total_cents          INTEGER NOT NULL DEFAULT 0,
  currency                    TEXT NOT NULL DEFAULT 'eur',
  -- 'paid'      → Zahlung abgeschlossen, Entitlements gelten
  -- 'pending'   → asynchrone Zahlart, noch nicht bestätigt
  -- 'refunded'  → erstattet, Entitlements gelten nicht mehr
  status                      TEXT NOT NULL DEFAULT 'paid'
                                CHECK (status IN ('paid', 'pending', 'refunded')),
  purchased_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tenant_one_time_purchases IS
  'Einmalkäufe (Stripe-Checkout im Modus payment) je Tenant. Ergänzt das Abo in subscriptions, ersetzt es nicht — tenant_entitlements() vereinigt beide Quellen.';

COMMENT ON COLUMN public.tenant_one_time_purchases.status IS
  'Nur status = paid gewährt Entitlements. refunded belässt die Zeile als Prüfpfad, entzieht aber den Umfang.';

-- Auflösungspfad von tenant_entitlements(): tenant_id + status.
CREATE INDEX IF NOT EXISTS tenant_one_time_purchases_tenant_idx
  ON public.tenant_one_time_purchases (tenant_id, status);

CREATE INDEX IF NOT EXISTS tenant_one_time_purchases_plan_key_idx
  ON public.tenant_one_time_purchases (plan_key);

-- ─── RLS: Tenant-Isolation, Schreibrechte nur Service-Role ──────────────────
-- Lesend darf ein Nutzer die Käufe SEINES Tenants sehen (Billing-Ansicht).
-- Geschrieben wird ausschließlich vom Stripe-Webhook, der mit Service-Role
-- läuft und RLS umgeht — es gibt daher bewusst keine INSERT/UPDATE-Policy.

ALTER TABLE public.tenant_one_time_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "one_time_purchases tenant-read" ON public.tenant_one_time_purchases;
CREATE POLICY "one_time_purchases tenant-read"
  ON public.tenant_one_time_purchases FOR SELECT
  USING (
    tenant_id IN (
      SELECT m.tenant_id FROM public.memberships m
      WHERE m.user_id = (SELECT auth.uid())
    )
  );
