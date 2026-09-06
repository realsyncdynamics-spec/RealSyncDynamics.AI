-- Reconciliation: audit_evidence steht seit dem 2026-05-07 im Ledger und hat
-- die Tabelle nie bekommen — samt Storage-Bucket, Policies und Triggern.
--
-- ── BEFUND (gegen das Live-Projekt ebljyceifhnlzhjfyxup erhoben, 2026-09-06) ──
--
--   to_regclass('public.audit_evidence')            -> NULL          (FEHLT)
--   storage.buckets where id = 'audit-evidence'     -> keine Zeile   (FEHLT)
--   schema_migrations where version = 20260507100000 -> vorhanden    (verbucht)
--
-- Das ist derselbe Ledger-Wirklichkeits-Bruch wie bei den drei Tabellen aus
-- `20260822000000_reconcile_missing_frontend_tables.sql`: Der Ledger-Eintrag
-- existiert, also ueberspringt jeder weitere `db push` die Migration fuer
-- immer. Auf frischem Postgres (CI, `db reset`) ist alles da — nur in
-- Produktion nicht. CLAUDE.md §3 fuehrt den Fall seit dem 2026-08-31 als
-- bekannt, aber unbehoben.
--
-- ── ZWEI FOLGEN, DIE SEITHER STILL LAUFEN ────────────────────────────────────
--
-- 1. `20260619000000_tenant_activation.sql` legt den Trigger
--    `audit_evidence_capture_activation` nur an, wenn die Tabelle existiert
--    (`to_regclass`-Waechter, sonst 42P01 und Rollback der ganzen Migration).
--    In Produktion wurde er also nie angelegt: `tenant_activation.
--    first_report_exported_at` bleibt leer, und damit die Aktivierungs-Metrik
--    des 90-Tage-Programms — „erster Scan UND ein Report exportiert" — auf
--    einem Bein stehen. Gemessen: 0 Zeilen in `tenant_activation`.
-- 2. `20260723000001_rls_recursion_fix_security_definer.sql` ueberspringt aus
--    demselben Grund das Policy-Refactoring auf `is_tenant_member`.
--
-- ── WAS DIESE MIGRATION NICHT BEHAUPTET ──────────────────────────────────────
--
-- CLAUDE.md §3 schreibt, der Screenshot-Nachweis „eines jeden Audits" gehe
-- still verloren, weil `worker/src/persistence.ts` non-fatal gegen die fehlende
-- Tabelle insertet. Am 2026-09-06 nachgemessen stimmt das so nicht: Die ganze
-- Worker-Pipeline ist in Produktion leer — `audit_jobs` 0, `scan_runs` 0,
-- `findings` 0, `audit_findings` 0 — und der Upload nach `audit-evidence`
-- scheiterte ohnehin vor dem Insert, weil auch der Bucket fehlt. Verloren ist
-- also nichts; es lief nie etwas. Der Produktions-Auditpfad ist die Edge
-- Function `gdpr-audit` mit 173 Zeilen in `gdpr_audits`.
--
-- Damit ist das hier keine Rettung laufender Daten, sondern das Herstellen der
-- Voraussetzung: Solange Tabelle und Bucket fehlen, kann der Evidence-Layer
-- nicht in Betrieb gehen, und der Aktivierungs-Trigger bleibt aus.
--
-- Vorgehen wie bei 20260822000000: Inhalt der Original-Migration erneut
-- ausfuehren, durchgehend idempotent, damit `db reset` denselben Stand ergibt.
--
-- ── PROBELAUF (2026-09-06) ───────────────────────────────────────────────────
-- Vollstaendig gegen das Live-Schema ausgefuehrt, in einer Transaktion mit
-- ROLLBACK statt COMMIT. Ergebnis: 2 Policies, 3 Trigger (no_update, no_delete,
-- capture_activation), RLS aktiv, Bucket angelegt — danach zurueckgerollt und
-- nachgeprueft, dass Tabelle und Bucket weiterhin fehlen. Die Migration laeuft
-- also gegen das echte Schema durch, nicht nur gegen das aus dem Repo
-- erwartete. Genau daran waere sie um ein Haar gescheitert, siehe §6.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- §1 Tabelle — Definition aus 20260507100000_audit_evidence.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_evidence (
  id              uuid primary key default gen_random_uuid(),
  audit_id        uuid not null,
  finding_id      uuid,                   -- nullable: Evidence kann auch global sein
  type            text not null
    check (type in (
      'screenshot',
      'request_log',
      'cookie_dump',
      'dom_snapshot',
      'script_reference',
      'response_header'
    )),
  payload_json    jsonb,
  storage_url     text,
  storage_bucket  text default 'audit-evidence',
  storage_path    text,
  size_bytes      bigint,
  mime_type       text,
  tenant_id       uuid not null,
  created_at      timestamptz not null default now(),
  constraint evidence_has_payload_or_storage
    check (payload_json is not null or storage_url is not null or storage_path is not null)
);

-- Der Fremdschluessel fehlte im Original. CLAUDE.md §3 fuehrt
-- `tenant_id UUID NOT NULL REFERENCES tenants(id)` als nicht verhandelbar —
-- und die Tabelle ist ueberall leer, der Nachtrag kostet also nichts. Auf
-- frischem Postgres liegt sie aus dem Original schon vor, deshalb der Waechter:
-- `ADD CONSTRAINT` kennt kein IF NOT EXISTS.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'audit_evidence_tenant_id_fkey'
      AND conrelid = 'public.audit_evidence'::regclass
  ) THEN
    ALTER TABLE public.audit_evidence
      ADD CONSTRAINT audit_evidence_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_evidence_audit_id   ON public.audit_evidence(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_evidence_finding_id ON public.audit_evidence(finding_id);
CREATE INDEX IF NOT EXISTS idx_audit_evidence_tenant_id  ON public.audit_evidence(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_evidence_type       ON public.audit_evidence(type);

-- ============================================================
-- §2 RLS — Default-Deny, Lesen nur fuer Mitglieder des Mandanten
-- ============================================================

ALTER TABLE public.audit_evidence ENABLE ROW LEVEL SECURITY;

-- Bewusst in der refaktorierten Form aus 20260723000001 (is_tenant_member statt
-- memberships-Unterabfrage): Auf frischem Postgres hat diese Migration die
-- Policy bereits umgestellt: wuerde hier die alte Fassung stehen, holte sie die
-- RLS-Rekursion zurueck, die dort abgeschafft wurde.
DROP POLICY IF EXISTS "audit_evidence_tenant_read" ON public.audit_evidence;
DROP POLICY IF EXISTS audit_evidence_tenant_read   ON public.audit_evidence;
CREATE POLICY audit_evidence_tenant_read
  ON public.audit_evidence
  FOR SELECT
  TO authenticated
  USING (public.is_tenant_member(tenant_id));

-- service_role umgeht RLS ohnehin; die Policy steht explizit da, damit die
-- Schreibrichtung im Schema benannt ist und nicht nur implizit gilt.
DROP POLICY IF EXISTS "audit_evidence_service_write" ON public.audit_evidence;
DROP POLICY IF EXISTS audit_evidence_service_write   ON public.audit_evidence;
CREATE POLICY audit_evidence_service_write
  ON public.audit_evidence
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================================
-- §3 Append-only — UPDATE und DELETE sind Prüfpfad-Verstoesse
-- ============================================================
-- Evidence ist Beweismaterial. Wer sie aendern koennte, koennte den Prüfpfad
-- umschreiben; deshalb blockiert der Trigger beide Richtungen fuer jede Rolle,
-- service_role eingeschlossen. Korrektur laeuft ueber eine neue Zeile.

CREATE OR REPLACE FUNCTION public.audit_evidence_block_modification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'audit_evidence is append-only. Insert a new row instead of modifying.';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_evidence_no_update ON public.audit_evidence;
CREATE TRIGGER trg_audit_evidence_no_update
  BEFORE UPDATE ON public.audit_evidence
  FOR EACH ROW EXECUTE FUNCTION public.audit_evidence_block_modification();

DROP TRIGGER IF EXISTS trg_audit_evidence_no_delete ON public.audit_evidence;
CREATE TRIGGER trg_audit_evidence_no_delete
  BEFORE DELETE ON public.audit_evidence
  FOR EACH ROW EXECUTE FUNCTION public.audit_evidence_block_modification();

COMMENT ON TABLE public.audit_evidence IS
  'Evidence Layer (ARCHITECTURE.md Phase 7.3): append-only Beweis-Items pro Audit-Finding. RLS tenant-scoped, Updates/Deletes blockiert per Trigger.';

-- ============================================================
-- §4 Storage-Bucket — fehlte in Produktion ebenfalls
-- ============================================================
-- `worker/src/crawler.ts` laedt den Screenshot nach
-- `<tenant_id>/<scan_run_id>/initial.png` in den Bucket `audit-evidence` und
-- ruft erst danach `recordScreenshotEvidence`. Ohne Bucket scheitert schon der
-- Upload — die Tabelle allein haette den Pfad nicht funktionsfaehig gemacht.
-- Privat per Default; Zugriff nur ueber signierte URLs.

INSERT INTO storage.buckets (id, name, public)
VALUES ('audit-evidence', 'audit-evidence', false)
ON CONFLICT (id) DO NOTHING;

-- Pfad-Konvention <tenant_id>/<audit_id>/<datei>: das erste Segment traegt die
-- Mandantengrenze. Bewusst als Textvergleich gegen memberships und nicht ueber
-- is_tenant_member(uuid) — ein Objekt mit nicht-uuid-foermigem ersten Segment
-- wuerde beim Cast mit 22P02 abbrechen statt sauber leer zu liefern.
DROP POLICY IF EXISTS "audit_evidence_storage_tenant_read" ON storage.objects;
CREATE POLICY "audit_evidence_storage_tenant_read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'audit-evidence'
    AND (storage.foldername(name))[1] IN (
      SELECT tenant_id::text FROM public.memberships WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- §5 Aktivierungs-Trigger — seit 20260619000000 uebersprungen
-- ============================================================
-- Erste Evidence-Zeile eines Mandanten setzt first_report_exported_at. Die
-- Funktion liegt in Produktion bereits vor (gemessen 2026-09-06), nur der
-- Trigger fehlte, weil die Tabelle fehlte.

DO $$
BEGIN
  IF to_regproc('public.tenant_activation_capture_report') IS NULL THEN
    RAISE NOTICE 'tenant_activation_capture_report fehlt — Aktivierungs-Trigger uebersprungen';
    RETURN;
  END IF;

  DROP TRIGGER IF EXISTS audit_evidence_capture_activation ON public.audit_evidence;
  CREATE TRIGGER audit_evidence_capture_activation
    AFTER INSERT ON public.audit_evidence
    FOR EACH ROW EXECUTE FUNCTION public.tenant_activation_capture_report();
END $$;

-- ============================================================
-- §6 BEWUSST NICHT UEBERNOMMEN: v_findings_with_evidence
-- ============================================================
-- Das Original legt die View ueber `audit_findings` an, mit den Spalten
-- `audit_id` und `rule_id`. Produktion fuehrt eine ANDERE `audit_findings`
-- (gemessen 2026-09-06): dort heissen die Spalten `audit_report_id` und
-- `control_reference`, ein `audit_id` gibt es nicht. Ein Replay wuerde mit
-- 42703 abbrechen und — weil alles in einer Transaktion laeuft — die ganze
-- Migration zurueckrollen. Damit stuende `db push` wieder, und zwar fuer JEDE
-- nachfolgende Migration; genau die Betriebsfolge, die CLAUDE.md §5 beschreibt.
--
-- Die View hat ausserdem keinen Konsumenten: kein Treffer im gesamten Repo
-- ausserhalb der Ursprungsmigration. Welche der beiden `audit_findings`-
-- Definitionen gelten soll, ist eine offene Schemafrage wie bei
-- `runtime_events` in 20260822000000 — und wird hier nicht nebenbei
-- entschieden.

COMMIT;
