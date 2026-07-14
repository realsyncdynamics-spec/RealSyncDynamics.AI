-- Evidence Vault — exakt gehashten Zeitstempel persistieren (Phase 2).
--
-- Der event_hash eines Snapshots geht über einen Zeitstempel (nowIso in der
-- Edge-Function). Bisher wurde dieser NICHT gespeichert (created_at nutzt den
-- DB-Default now()), sodass die Kette nicht unabhängig nachgerechnet werden
-- konnte. Diese additive Spalte hält den exakt gehashten Zeitstempel und macht
-- die Verifizierung möglich.
--
-- Rein additiv, nullable, KEIN Backfill: Bestandssnapshots (vor dieser Spalte)
-- bleiben event_timestamp = NULL und werden von der Verifizierung als „legacy"
-- (nur strukturell prüfbar) behandelt — nicht als Manipulation. Neue Snapshots
-- setzen den Wert und sind voll kryptografisch verifizierbar.
--
-- Hinweis: ADD COLUMN ist DDL und löst den Immutability-Trigger (BEFORE
-- UPDATE/DELETE FOR EACH ROW) nicht aus; es findet kein Row-Rewrite statt.

ALTER TABLE public.evidence_snapshots ADD COLUMN IF NOT EXISTS event_timestamp TIMESTAMPTZ;

COMMENT ON COLUMN public.evidence_snapshots.event_timestamp IS
    'Exakt in den event_hash eingegangener Zeitstempel (nowIso). Basis der unabhängigen Hash-Chain-Verifizierung. NULL = Legacy-Snapshot (nur strukturell prüfbar).';
