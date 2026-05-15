-- Operations Runtime — Inventory Foundation
-- Auth-gated module for inventory / operations workloads inside RealSync.
-- 9 tables, tenant-scoped RLS, audit-events on every movement.
--
-- This is NOT a public surface. /operations is auth-gated in App.tsx.
-- Pricing / homepage stays untouched.

BEGIN;

-- ── inventory_locations ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory_locations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code         TEXT NOT NULL,                                -- short code e.g. "WH1", "OFFICE-DE"
  name         TEXT NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'warehouse'             -- warehouse | shop | mobile | virtual
                 CHECK (kind IN ('warehouse','shop','mobile','virtual')),
  address      TEXT,
  notes        TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);
CREATE INDEX IF NOT EXISTS inventory_locations_tenant_idx ON public.inventory_locations (tenant_id);

-- ── inventory_suppliers ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory_suppliers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code          TEXT NOT NULL,
  name          TEXT NOT NULL,
  contact_name  TEXT,
  email         TEXT,
  phone         TEXT,
  address       TEXT,
  notes         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);
CREATE INDEX IF NOT EXISTS inventory_suppliers_tenant_idx ON public.inventory_suppliers (tenant_id);

-- ── inventory_items ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sku           TEXT NOT NULL,                               -- internal SKU, tenant-unique
  name          TEXT NOT NULL,
  description   TEXT,
  unit          TEXT NOT NULL DEFAULT 'pcs',                 -- pcs / kg / l / m / ...
  reorder_level INTEGER NOT NULL DEFAULT 0
                 CHECK (reorder_level >= 0),
  default_supplier_id UUID REFERENCES public.inventory_suppliers(id) ON DELETE SET NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sku)
);
CREATE INDEX IF NOT EXISTS inventory_items_tenant_idx ON public.inventory_items (tenant_id);

-- ── inventory_stock_levels (current quantity per item × location) ─
CREATE TABLE IF NOT EXISTS public.inventory_stock_levels (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  item_id       UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  location_id   UUID NOT NULL REFERENCES public.inventory_locations(id) ON DELETE CASCADE,
  quantity      NUMERIC(14, 3) NOT NULL DEFAULT 0
                 CHECK (quantity >= 0),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, location_id)
);
CREATE INDEX IF NOT EXISTS inventory_stock_levels_tenant_idx ON public.inventory_stock_levels (tenant_id);

-- ── inventory_movements (immutable audit-style record of every change) ─
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  item_id       UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  location_id   UUID NOT NULL REFERENCES public.inventory_locations(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL
                 CHECK (kind IN ('inbound','outbound','adjustment','transfer')),
  quantity      NUMERIC(14, 3) NOT NULL,                     -- signed: positive=inbound, negative=outbound
  reason        TEXT,
  reference     TEXT,                                        -- purchase order id, invoice no., …
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_movements_tenant_idx   ON public.inventory_movements (tenant_id);
CREATE INDEX IF NOT EXISTS inventory_movements_item_idx     ON public.inventory_movements (item_id);
CREATE INDEX IF NOT EXISTS inventory_movements_location_idx ON public.inventory_movements (location_id);
CREATE INDEX IF NOT EXISTS inventory_movements_occurred_idx ON public.inventory_movements (occurred_at DESC);

-- ── inventory_purchase_orders ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory_purchase_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  number          TEXT NOT NULL,
  supplier_id     UUID REFERENCES public.inventory_suppliers(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','ordered','partially_received','received','cancelled')),
  ordered_at      TIMESTAMPTZ,
  expected_at     TIMESTAMPTZ,
  total_amount    NUMERIC(14, 2),
  currency        TEXT NOT NULL DEFAULT 'EUR',
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, number)
);
CREATE INDEX IF NOT EXISTS inventory_purchase_orders_tenant_idx ON public.inventory_purchase_orders (tenant_id);

-- ── inventory_purchase_order_items ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory_purchase_order_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  purchase_order_id  UUID NOT NULL REFERENCES public.inventory_purchase_orders(id) ON DELETE CASCADE,
  item_id            UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  quantity_ordered   NUMERIC(14, 3) NOT NULL CHECK (quantity_ordered > 0),
  quantity_received  NUMERIC(14, 3) NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  unit_price         NUMERIC(14, 4),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_po_items_tenant_idx ON public.inventory_purchase_order_items (tenant_id);
CREATE INDEX IF NOT EXISTS inventory_po_items_po_idx     ON public.inventory_purchase_order_items (purchase_order_id);

-- ── inventory_barcodes (one item can have multiple barcodes / GS1 codes) ─
CREATE TABLE IF NOT EXISTS public.inventory_barcodes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  item_id       UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  code          TEXT NOT NULL,                               -- EAN-13 / Code-128 / QR payload
  symbology     TEXT NOT NULL DEFAULT 'code128'
                 CHECK (symbology IN ('ean13','code128','code39','qr','datamatrix','custom')),
  is_primary    BOOLEAN NOT NULL DEFAULT FALSE,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);
CREATE INDEX IF NOT EXISTS inventory_barcodes_tenant_idx ON public.inventory_barcodes (tenant_id);
CREATE INDEX IF NOT EXISTS inventory_barcodes_item_idx   ON public.inventory_barcodes (item_id);

-- ── inventory_audit_events (compliance log — every meaningful action) ─
-- Personal data MUST NOT be stored here. created_by is the user UUID;
-- old_value / new_value are JSONB diffs of the row.
CREATE TABLE IF NOT EXISTS public.inventory_audit_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action       TEXT NOT NULL,                                -- "item.create", "movement.book", …
  target_type  TEXT NOT NULL,                                -- "item" | "location" | "movement" | …
  target_id    UUID,
  old_value    JSONB,
  new_value    JSONB,
  reason       TEXT,
  source       TEXT NOT NULL DEFAULT 'ui'
                 CHECK (source IN ('ui','api','import','agent','migration')),
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_audit_events_tenant_idx ON public.inventory_audit_events (tenant_id);
CREATE INDEX IF NOT EXISTS inventory_audit_events_action_idx ON public.inventory_audit_events (action);
CREATE INDEX IF NOT EXISTS inventory_audit_events_occurred_idx ON public.inventory_audit_events (occurred_at DESC);

-- ── Stock-level maintenance trigger ───────────────────────────────
-- Every inventory_movements INSERT updates the corresponding
-- inventory_stock_levels row atomically. Adjustment / transfer
-- semantics:
--   inbound       → +quantity at (item_id, location_id)
--   outbound      → -|quantity| at (item_id, location_id) (movement.quantity is negative)
--   adjustment    → set to absolute (quantity is the delta from the current stock)
--   transfer      → handled as two movements by the caller (outbound + inbound)

CREATE OR REPLACE FUNCTION public.fn_inventory_apply_movement()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.inventory_stock_levels (tenant_id, item_id, location_id, quantity, updated_at)
  VALUES (NEW.tenant_id, NEW.item_id, NEW.location_id, NEW.quantity, now())
  ON CONFLICT (item_id, location_id) DO UPDATE
    SET quantity   = public.inventory_stock_levels.quantity + EXCLUDED.quantity,
        updated_at = now();

  IF (SELECT quantity FROM public.inventory_stock_levels
       WHERE item_id = NEW.item_id AND location_id = NEW.location_id) < 0
  THEN
    RAISE EXCEPTION 'inventory: would drive stock below 0 (item % at location %)',
      NEW.item_id, NEW.location_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_apply_movement ON public.inventory_movements;
CREATE TRIGGER trg_inventory_apply_movement
  AFTER INSERT ON public.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION public.fn_inventory_apply_movement();

-- ── RLS — tenant-scoped, service_role bypass ─────────────────────
-- All operations tables follow the same pattern: members of the
-- tenant can SELECT/INSERT/UPDATE; service_role bypasses RLS by
-- default (Supabase pattern); cross-tenant reads are impossible.

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'inventory_locations','inventory_suppliers','inventory_items',
      'inventory_stock_levels','inventory_movements','inventory_purchase_orders',
      'inventory_purchase_order_items','inventory_barcodes','inventory_audit_events'
    ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',         t || '_tenant_isolation', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I
         USING (tenant_id IN (
           SELECT m.tenant_id FROM public.memberships m
           WHERE m.user_id = auth.uid()
         ))
         WITH CHECK (tenant_id IN (
           SELECT m.tenant_id FROM public.memberships m
           WHERE m.user_id = auth.uid()
         ))',
      t || '_tenant_isolation', t);
  END LOOP;
END $$;

-- ── Updated-at maintenance ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_inventory_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'inventory_locations','inventory_suppliers','inventory_items',
      'inventory_purchase_orders'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'trg_' || t || '_touch', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.fn_inventory_touch_updated_at()',
      'trg_' || t || '_touch', t);
  END LOOP;
END $$;

COMMIT;
