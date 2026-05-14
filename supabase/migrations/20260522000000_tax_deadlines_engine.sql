-- Tax Deadlines Engine — extends the Tax Evidence Runtime (PR #238)
-- with a per-year filing profile and a catalog of statutory German
-- tax deadlines.
--
-- Positioning unchanged: the engine PREPARES Erinnerungen, sie ist
-- KEINE Steuerberatung. Termine bilden gängige § AO / § UStG-Fristen
-- ab; bei Verschiebungen (Wochenende/Feiertag, § 108 AO) liegt die
-- Verantwortung beim User / Steuerberater. UI zeigt entsprechenden
-- Hinweis.

BEGIN;

-- ── tax_years: Filing-Profil pro Jahr ─────────────────────────────
ALTER TABLE public.tax_years
  ADD COLUMN IF NOT EXISTS ust_cadence TEXT
    NOT NULL DEFAULT 'quarterly'
    CHECK (ust_cadence IN ('monthly','quarterly','none')),
  ADD COLUMN IF NOT EXISTS has_tax_advisor BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS legal_form TEXT
    NOT NULL DEFAULT 'other'
    CHECK (legal_form IN ('einzelunternehmer','gbr','ug','gmbh','ag','other'));

-- ── tax_reminders: erweiterter Typ-Katalog + Dedup-Key ────────────
ALTER TABLE public.tax_reminders
  ADD COLUMN IF NOT EXISTS catalog_key TEXT,
  ADD COLUMN IF NOT EXISTS metadata    JSONB;

-- Drop the legacy CHECK constraint (which only allowed the 4 review
-- types from PR #238) and replace with the full deadline catalogue.
ALTER TABLE public.tax_reminders DROP CONSTRAINT IF EXISTS tax_reminders_reminder_type_check;
ALTER TABLE public.tax_reminders
  ADD CONSTRAINT tax_reminders_reminder_type_check CHECK (
    reminder_type IN (
      -- legacy (PR #238)
      'monthly_review','quarterly_review','year_end','export_ready',
      -- deadline catalog
      'ust_advance','ust_annual',
      'income_tax_annual','corporate_tax_annual','trade_tax_annual',
      'payroll_filing','annual_financials','custom'
    )
  );

-- A given catalog_key may exist at most once per tax year — so the
-- generator can be idempotent and re-runs don't duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS tax_reminders_catalog_dedup
  ON public.tax_reminders (tax_year_id, catalog_key)
  WHERE catalog_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS tax_reminders_type_idx ON public.tax_reminders (reminder_type);

COMMIT;
