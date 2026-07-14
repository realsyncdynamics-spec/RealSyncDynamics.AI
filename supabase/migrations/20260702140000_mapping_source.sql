-- Auto-Mapping — Provenienz der Control-Zuordnungen (Phase 2).
--
-- Rein additiv: unterscheidet manuell gesetzte von automatisch abgeleiteten
-- Zuordnungen (source). Bestehende Zeilen gelten als 'manual' (Default) und
-- werden von der Auto-Mapping-Logik damit nie überschrieben.

ALTER TABLE public.asset_control_mappings
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'auto'));

COMMENT ON COLUMN public.asset_control_mappings.source IS
    'Herkunft der Zuordnung: manual (menschlich gesetzt, nie automatisch überschrieben) oder auto (aus Asset-Klassifikation abgeleitet).';
