-- ═══════════════════════════════════════════════════════════════════════════
--  entitlement_grants — dauerhafte Rechte außerhalb der Subscription
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Zweck
--   Eine zweite, additive Quelle für Entitlements. Ein Grant verweist auf ein
--   `products`-Zeile; deren `product_entitlements` definieren, was er gewährt.
--   Damit nutzt der Grant exakt dieselbe Katalog-Mechanik wie eine
--   Subscription — es entsteht KEINE zweite Rechte-Definition.
--
--       subscriptions ──┐
--                       ├──► products ──► product_entitlements ──► entitlements
--       entitlement_grants ┘                          │
--                                                     ▼
--                                          tenant_entitlements()
--
-- Warum nicht `subscriptions` erweitern?
--   Das Subscription-Modell ist „genau eine aktive Subscription pro Tenant"
--   (im Repo per UNIQUE(tenant_id) erzwungen). Ein Einmalkauf dort hätte das
--   laufende Abo überschrieben. Ausserdem wählt `tenant_entitlements()` per
--   ORDER BY updated_at DESC LIMIT 1 ohnehin nur EINE Zeile aus — eine zweite
--   Subscription-Zeile würde also nicht additiv wirken, sondern das Abo
--   verdrängen. Grants sind deshalb eine eigene Achse.
--
-- Warum generisch statt „one_time_purchases"?
--   Derselbe Mechanismus trägt Einmalkäufe, manuelle Kulanz-/Vertriebs-Grants
--   und zeitlich befristete Aktionen. `source` + `expires_at` unterscheiden
--   die Fälle, ohne je eine neue Tabelle zu brauchen.
--
-- Additiv: keine bestehende Tabelle, Spalte, Funktion oder Policy wird
-- verändert. Es gibt in Produktion (Stand 2026-08-08) keine vorhandene
-- Grant-, Purchase- oder Order-Struktur, an die sich das anlehnen ließe:
-- `orders`/`order_items` sind Bot-Commerce (bot_id, delivery_address),
-- `customer_onboarding` ist ein Stripe-Session-Log ohne tenant_id.
--
-- Compliance-Bezug
--   DSGVO Art. 5 (1) e: nur Vertrags- und Zahlungsbezugsdaten, keine
--   Inhaltsdaten; Personenbezug allein über `stripe_customer_id`. Löschung
--   des Tenants entfernt die Zeilen per ON DELETE CASCADE.
--   EU AI Act Art. 12: Ein widerrufener Grant wird NICHT gelöscht, sondern
--   auf `status='revoked'` gesetzt — welcher Governance-Umfang wann galt,
--   bleibt lückenlos rekonstruierbar.

CREATE TABLE IF NOT EXISTS public.entitlement_grants (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Das Produkt, dessen product_entitlements dieser Grant gewährt.
  -- RESTRICT: ein Produkt mit ausgestellten Grants darf nicht verschwinden,
  -- sonst verlöre ein bezahlter Kunde stillschweigend seine Rechte.
  product_id                  UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  -- Denormalisiert für Prüfpfad und Lesbarkeit; die Rechte kommen aus product_id.
  plan_key                    TEXT NOT NULL,

  source                      TEXT NOT NULL
                                CHECK (source IN ('one_time_purchase', 'manual', 'promotion', 'migration')),

  -- Idempotenz-Anker. Für Stripe die Checkout-Session-ID, für manuelle Grants
  -- eine Vorgangs-/Ticket-Referenz. Zusammen mit `source` global eindeutig:
  -- ein wiederholt zugestellter Webhook erzeugt denselben Grant, nicht einen
  -- zweiten — und dieselbe Session kann nicht zwei Tenants gutgeschrieben
  -- werden.
  purchase_reference          TEXT NOT NULL,

  stripe_checkout_session_id  TEXT,
  stripe_payment_intent_id    TEXT,
  stripe_customer_id          TEXT,
  amount_total_cents          INTEGER,
  currency                    TEXT,

  status                      TEXT NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'revoked')),
  granted_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- NULL = dauerhaft. Governance Launch gewährt dauerhaft.
  expires_at                  TIMESTAMPTZ,
  revoked_at                  TIMESTAMPTZ,
  revoked_reason              TEXT,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT entitlement_grants_idempotency UNIQUE (source, purchase_reference),

  -- Hält Status und Zeitstempel konsistent: ein widerrufener Grant ohne
  -- revoked_at (oder umgekehrt) wäre im Prüfpfad nicht auswertbar.
  CONSTRAINT entitlement_grants_revocation_consistent
    CHECK ((status = 'revoked') = (revoked_at IS NOT NULL))
);

COMMENT ON TABLE public.entitlement_grants IS
  'Dauerhafte oder befristete Entitlements ausserhalb der Subscription (Einmalkäufe, manuelle Grants, Aktionen). Ergänzt subscriptions additiv — tenant_entitlements() vereinigt beide Quellen. Rechte stammen aus product_entitlements des referenzierten Produkts.';

COMMENT ON COLUMN public.entitlement_grants.purchase_reference IS
  'Idempotenz-Anker, eindeutig je source. Stripe: Checkout-Session-ID. Ein Webhook-Retry aktualisiert dieselbe Zeile, statt einen zweiten Grant zu erzeugen.';

COMMENT ON COLUMN public.entitlement_grants.expires_at IS
  'NULL = dauerhaft. Sonst gilt der Grant nur bis zu diesem Zeitpunkt (tenant_entitlements() filtert darauf).';

COMMENT ON COLUMN public.entitlement_grants.status IS
  'Nur active gewährt Rechte. revoked (z.B. nach Erstattung) entzieht sie, behält die Zeile aber als Prüfpfad.';

-- Auflösungspfad von tenant_entitlements(): tenant_id + status + expires_at.
CREATE INDEX IF NOT EXISTS entitlement_grants_tenant_active_idx
  ON public.entitlement_grants (tenant_id, status, expires_at);

CREATE INDEX IF NOT EXISTS entitlement_grants_product_idx
  ON public.entitlement_grants (product_id);

CREATE INDEX IF NOT EXISTS entitlement_grants_plan_key_idx
  ON public.entitlement_grants (plan_key);

-- ─── RLS: Tenant-Isolation, Schreibrechte ausschliesslich Service-Role ──────
-- Lesen: Mitglieder des eigenen Tenants (Billing-/Plan-Ansicht).
-- Schreiben: nur der Stripe-Webhook bzw. Admin-Tooling mit Service-Role, die
-- RLS ohnehin umgehen — es gibt daher bewusst KEINE INSERT/UPDATE/DELETE-
-- Policy. Ein Grant ist eine Zahlungs-/Vertragstatsache und darf niemals aus
-- dem Browser entstehen.

ALTER TABLE public.entitlement_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "entitlement_grants tenant-read" ON public.entitlement_grants;
CREATE POLICY "entitlement_grants tenant-read"
  ON public.entitlement_grants FOR SELECT
  USING (
    tenant_id IN (
      SELECT m.tenant_id FROM public.memberships m
      WHERE m.user_id = (SELECT auth.uid())
    )
  );
